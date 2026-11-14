// Adaptador único do modelo. O resto do código só conhece `Modelo`: mensagens de chat
// com ferramentas, no formato de chat completions. Trocar de modelo é trocar a variável
// MODELO; o que for específico de um provedor (gateway, parâmetros) entra só aqui.
import { env } from "cloudflare:workers";
import type { Env } from "./env";

export interface ChamadaDeFerramenta {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type Mensagem =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ChamadaDeFerramenta[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface DefinicaoDeFerramenta {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface RespostaDoModelo {
  texto: string;
  chamadas: ChamadaDeFerramenta[];
  /** `chamadas`: quantas chamadas reais o adaptador fez para esta resposta (principal + reserva). */
  uso: { entrada: number; saida: number; chamadas?: number };
}

export type Modelo = (mensagens: Mensagem[], ferramentas: DefinicaoDeFerramenta[]) => Promise<RespostaDoModelo>;

// O raciocínio do modelo gasta tokens de saída: com o padrão da plataforma (256) a
// resposta pode vir cortada antes da chamada de ferramenta.
const MAX_TOKENS = 1500;

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

/** Id de chamada de ferramenta para quando o modelo não manda um: único na conversa inteira. */
const idNovo = () => `chamada_${crypto.randomUUID().replace(/-/g, "")}`;

/** Id que o modelo mandou, ou um novo quando falta ou já apareceu nesta mesma resposta. */
function idsDaResposta(): (id: unknown) => string {
  const vistos = new Set<string>();
  return (id) => {
    const escolhido = typeof id === "string" && id !== "" && !vistos.has(id) ? id : idNovo();
    vistos.add(escolhido);
    return escolhido;
  };
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

/**
 * Lê a resposta crua nos dois formatos que o Workers AI devolve: chat completions
 * (`choices[0].message`) e o formato antigo (`response` + `tool_calls` soltos). O
 * raciocínio do modelo é descartado: não vai para o histórico nem para o hóspede.
 */
export function normalizarResposta(bruto: unknown): RespostaDoModelo {
  const raiz = objeto(bruto);
  const escolhas = Array.isArray(raiz.choices) ? raiz.choices : [];
  const mensagem = escolhas.length > 0 ? objeto(objeto(escolhas[0]).message) : raiz;
  const conteudo = escolhas.length > 0 ? mensagem.content : raiz.response;
  const brutas = Array.isArray(mensagem.tool_calls) ? mensagem.tool_calls : [];
  const idDe = idsDaResposta();

  const chamadas = brutas.flatMap((item, i): ChamadaDeFerramenta[] => {
    const chamada = objeto(item);
    const funcao = objeto(chamada.function);
    const nome = funcao.name ?? chamada.name;
    const argumentos = funcao.arguments ?? chamada.arguments ?? {};
    if (typeof nome !== "string" || nome === "") return [];
    return [{
      id: idDe(chamada.id),
      type: "function",
      function: { name: nome, arguments: typeof argumentos === "string" ? argumentos : JSON.stringify(argumentos) },
    }];
  });

  const uso = objeto(raiz.usage);
  return {
    texto: typeof conteudo === "string" ? conteudo.trim() : "",
    chamadas,
    uso: { entrada: numero(uso.prompt_tokens), saida: numero(uso.completion_tokens) },
  };
}

// ---- Modelos da Anthropic (formato Messages, pelo binding do AI Gateway) ----

/** Ids `anthropic/...` vão pelo gateway no formato Messages; o resto, em chat completions. */
const ehAnthropic = (modelo: string) => modelo.startsWith("anthropic/");

// O raciocínio adaptativo conta em max_tokens: com pouco espaço a resposta para no meio.
const MAX_TOKENS_ANTHROPIC = 8000;

type Bloco = Record<string, unknown>;

function argumentosComoObjeto(texto: string): Record<string, unknown> {
  try {
    const dado: unknown = JSON.parse(texto || "{}");
    return dado && typeof dado === "object" && !Array.isArray(dado) ? (dado as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Converte o histórico neutro (chat completions) para o corpo da API Messages. Os
 * resultados de ferramenta seguidos viram uma única mensagem do usuário, como a API pede.
 */
// Níveis de raciocínio da API. Ausente ou fora da lista vira "medium", o nível escolhido (X22).
const ESFORCOS = new Set(["low", "medium", "high", "xhigh", "max"]);
export const esforcoValido = (esforco?: string) => (esforco && ESFORCOS.has(esforco) ? esforco : "medium");

export function pedidoAnthropic(mensagens: Mensagem[], ferramentas: DefinicaoDeFerramenta[], esforco?: string): Record<string, unknown> {
  const sistema = mensagens.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  // A API recusa id fora de [a-zA-Z0-9_-] (erro 7003, medido): o reserva pode devolver
  // outro formato. Cada id também sai único no pedido, e o resultado segue o seu id; um id
  // repetido na mesma resposta (histórico já gravado) vira uma fila, consumida na ordem.
  const usados = new Set<string>();
  let doTurno = new Map<string, string[]>();
  const idParaAnthropic = (original: string) => {
    const base = original.replace(/[^a-zA-Z0-9_-]/g, "_") || "chamada";
    let id = base;
    for (let n = 2; usados.has(id); n++) id = `${base}_${n}`;
    usados.add(id);
    return id;
  };
  const conversa: { role: "user" | "assistant"; content: Bloco[] }[] = [];
  const acrescentar = (role: "user" | "assistant", blocos: Bloco[]) => {
    const ultima = conversa.at(-1);
    if (ultima && ultima.role === role) conversa[conversa.length - 1] = { role, content: [...ultima.content, ...blocos] };
    else conversa.push({ role, content: blocos });
  };
  for (const m of mensagens) {
    if (m.role === "user") acrescentar("user", [{ type: "text", text: m.content }]);
    else if (m.role === "tool") {
      const id = doTurno.get(m.tool_call_id)?.shift() ?? m.tool_call_id.replace(/[^a-zA-Z0-9_-]/g, "_");
      acrescentar("user", [{ type: "tool_result", tool_use_id: id, content: m.content }]);
    }
    else if (m.role === "assistant") {
      // Os blocos de raciocínio não voltam: a API aceita sem eles e a medição não mostrou
      // ganho em devolvê-los (docs/revisoes/modelos.md).
      doTurno = new Map();
      const blocos: Bloco[] = [
        ...(m.content.trim() ? [{ type: "text", text: m.content }] : []),
        ...(m.tool_calls ?? []).map((c) => {
          const id = idParaAnthropic(c.id);
          doTurno.set(c.id, [...(doTurno.get(c.id) ?? []), id]);
          return { type: "tool_use", id, name: c.function.name, input: argumentosComoObjeto(c.function.arguments) };
        }),
      ];
      if (blocos.length > 0) acrescentar("assistant", blocos);
    }
  }
  return {
    max_tokens: MAX_TOKENS_ANTHROPIC,
    ...(sistema ? { system: sistema } : {}),
    messages: conversa,
    tools: ferramentas.map((f) => ({ name: f.function.name, description: f.function.description, input_schema: f.function.parameters })),
    output_config: { effort: esforcoValido(esforco) },
  };
}

/** Resposta do modelo que não serve ao hóspede: falha do principal, o reserva responde. */
class RespostaInutil extends Error {
  override name = "RespostaInutil";
}

// Únicos fins de resposta que entregam algo inteiro. Os demais (`max_tokens`, `refusal`,
// `pause_turn` e qualquer valor novo da API) cortam ou recusam: a resposta não serve.
const FINS_COMPLETOS = new Set(["end_turn", "tool_use", "stop_sequence"]);

/**
 * Lê a resposta da API Messages. Resposta inútil é falha do principal, para o reserva
 * responder: recusa, corte por `max_tokens` (texto pela metade ou chamada de ferramenta
 * cortada), fim desconhecido, erro devolvido como valor ou nada para dizer nem fazer.
 */
export function lerRespostaAnthropic(bruto: unknown): RespostaDoModelo {
  const raiz = objeto(bruto);
  const inutil = (motivo: string) => new RespostaInutil(`resposta inútil do modelo (${motivo})`);
  if (raiz.type === "error") throw inutil("erro devolvido como valor");
  const fim = typeof raiz.stop_reason === "string" ? raiz.stop_reason : "ausente";
  if (!FINS_COMPLETOS.has(fim)) throw inutil(`stop_reason ${fim}`);
  const blocos = (Array.isArray(raiz.content) ? raiz.content : []).map(objeto);
  const texto = blocos.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("\n").trim();
  const usos = blocos.filter((b) => b.type === "tool_use");
  // Chamada sem nome ou com argumentos que não são objeto não pode ser executada: nada de
  // descartar em silêncio nem de inventar argumentos vazios.
  const valido = (b: Bloco) => typeof b.name === "string" && b.name !== "" && !!b.input && typeof b.input === "object" && !Array.isArray(b.input);
  if (!usos.every(valido)) throw inutil("chamada de ferramenta sem nome ou com argumentos inválidos");
  const idDe = idsDaResposta();
  const chamadas = usos.map((b): ChamadaDeFerramenta => ({
    id: idDe(b.id),
    type: "function",
    function: { name: b.name as string, arguments: JSON.stringify(b.input) },
  }));
  if (texto === "" && chamadas.length === 0) throw inutil(`stop_reason ${fim}, sem texto nem ferramenta`);
  // O fim tem de bater com o conteúdo: "tool_use" sem ferramenta deixaria um texto do tipo
  // "vou consultar" pendurado para o hóspede; ferramenta com outro fim não foi pedida.
  if ((fim === "tool_use") !== (chamadas.length > 0)) throw inutil(`stop_reason ${fim} não bate com o conteúdo`);
  const uso = objeto(raiz.usage);
  return {
    texto,
    chamadas,
    // Entrada inclui o que veio do cache, para o custo por conversa não sair subestimado.
    uso: { entrada: numero(uso.input_tokens) + numero(uso.cache_read_input_tokens) + numero(uso.cache_creation_input_tokens), saida: numero(uso.output_tokens) },
  };
}

// ---- Recusa por limite de pedidos (contrato L18) ----

/**
 * Erro de limite: 3021 no Workers AI, 429 ou "rate limit" no gateway e nos provedores.
 * ponytail: casa pelo texto do erro, porque o binding não expõe o status; trocar por
 * status quando o binding passar a expô-lo.
 */
export function ehErroDeLimite(erro: unknown): boolean {
  const texto = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro);
  return /\b3021\b|\b429\b|rate.?limit/i.test(texto);
}

/** Principal e reserva recusaram por limite: o loop não repete o turno (contrato L18). */
export class RecusaPorLimite extends Error {
  readonly porLimite = true;
}

export interface OpcoesDoModelo {
  /** AI Gateway por onde passam todas as chamadas (obrigatório para modelo de terceiros). */
  gateway?: string;
  /** Modelo de outro fornecedor que responde quando o principal falha. */
  reserva?: string;
  /** Quanto o principal pode demorar antes de o reserva assumir. */
  tempoDoPrincipalMs?: number;
  /** Nível de raciocínio dos modelos da Anthropic (`low`, `medium`...); ausente ou inválido vira `medium`. */
  esforco?: string;
}

// Cabe no orçamento de 45 s do turno (contrato seção 2) e deixa tempo para o reserva.
const TEMPO_DO_PRINCIPAL_MS = 20_000;

// Ajuste fino por modelo. O gateway recusa campo que o modelo não aceita (erro 7003).
const AJUSTES: Record<string, Record<string, unknown>> = {
  // Raciocínio padrão é "high" no DeepSeek e "max" nos GLM: lento demais para o teto de 60 s.
  "@cf/deepseek-ai/deepseek-v4.1-flash-1017": { reasoning_effort: "low" },
  "@cf/zai-org/glm-5.3": { reasoning_effort: "low" },
  "@cf/zai-org/glm-5.3-flash": { reasoning_effort: "low" },
};

/** Parâmetros do pedido. Modelo de terceiros (fora do `@cf/`) recebe `max_completion_tokens`, o campo das APIs de chat atuais. */
export function parametros(modelo: string): Record<string, unknown> {
  const limite = modelo.startsWith("@cf/") ? { max_tokens: MAX_TOKENS } : { max_completion_tokens: MAX_TOKENS };
  return { ...limite, temperature: 0.2, ...AJUSTES[modelo] };
}

function opcoesDoAmbiente(): OpcoesDoModelo {
  const vars = env as Partial<Env>;
  return { gateway: vars.AI_GATEWAY || undefined, reserva: vars.MODELO_RESERVA || undefined, esforco: vars.MODELO_ESFORCO || undefined };
}

class TempoDoPrincipal extends Error {}

function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new TempoDoPrincipal(`sem resposta em ${ms} ms`)), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/**
 * Só o nome do modelo e o erro: nunca o conteúdo da conversa (contrato L22). Endereço e
 * sequência longa de hexadecimal (id de conta, de gateway, de pedido) saem mascarados.
 */
function registrarFalha(modelo: string, erro: unknown): void {
  const descricao = (erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro))
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<endereço>")
    .replace(/[0-9a-f]{16,}/gi, "<id>");
  console.warn(JSON.stringify({ evento: "modelo_falhou", modelo, erro: descricao.slice(0, 200) }));
}

/** Se a última tentativa recusou por limite e a anterior também, o erro sai como `RecusaPorLimite`. */
async function comMarcaDeLimite(tentativa: Promise<RespostaDoModelo>, anteriorPorLimite: boolean): Promise<RespostaDoModelo> {
  try {
    return await tentativa;
  } catch (erro) {
    if (anteriorPorLimite && ehErroDeLimite(erro)) throw new RecusaPorLimite(erro instanceof Error ? erro.message : String(erro));
    throw erro;
  }
}

/**
 * Chamadas reais feitas até aqui, para o loop somar: `resposta.uso.chamadas` no sucesso,
 * `erro.chamadas` na falha.
 */
function comChamadas(erro: unknown, chamadas: number): unknown {
  if (erro instanceof Error) Object.assign(erro, { chamadas });
  return erro;
}

async function contado(tentativa: Promise<RespostaDoModelo>, chamadas: number): Promise<RespostaDoModelo> {
  try {
    const r = await tentativa;
    return { ...r, uso: { ...r.uso, chamadas } };
  } catch (erro) {
    throw comChamadas(erro, chamadas);
  }
}

/**
 * Sem `opcoes`, lê `AI_GATEWAY`, `MODELO_RESERVA` e `MODELO_ESFORCO` do ambiente do Worker. Com reserva
 * configurado, o principal tem prazo próprio; se ele lançar ou passar do prazo, o
 * reserva responde a mesma chamada. Sem reserva, o erro sobe para o loop (contrato L18).
 * Recusa por limite no principal e no reserva (ou no principal sem reserva) sobe como
 * `RecusaPorLimite`, com `porLimite: true`: o loop não repete o turno.
 */
export function criarModelo(ai: Ai, modelo: string | undefined, opcoes: OpcoesDoModelo = opcoesDoAmbiente()): Modelo {
  const executar = ai.run as (modelo: string, entrada: unknown, opcoes?: unknown) => Promise<unknown>;
  const chamar = async (id: string, mensagens: Mensagem[], ferramentas: DefinicaoDeFerramenta[]) => {
    try {
      const entrada = ehAnthropic(id)
        ? pedidoAnthropic(mensagens, ferramentas, opcoes.esforco)
        : { messages: mensagens, tools: ferramentas, ...parametros(id) };
      const bruto = await executar.call(ai, id, entrada, opcoes.gateway ? { gateway: { id: opcoes.gateway } } : undefined);
      return ehAnthropic(id) ? lerRespostaAnthropic(bruto) : normalizarResposta(bruto);
    } catch (erro) {
      registrarFalha(id, erro);
      throw erro;
    }
  };

  return async (mensagens, ferramentas) => {
    if (!modelo) throw comChamadas(new Error("MODELO não configurado"), 0);
    if (!opcoes.reserva) return contado(comMarcaDeLimite(chamar(modelo, mensagens, ferramentas), true), 1);
    // Modelo de terceiro sem gateway sempre falha (erro 2021 em cerca de 2,8 s, medido em
    // dev): nem tenta, o reserva responde direto. Decisão provisória da coordenação.
    if (ehAnthropic(modelo) && !opcoes.gateway) {
      // Um registro por turno: a primeira chamada do turno termina na mensagem do hóspede.
      if (mensagens.at(-1)?.role === "user") console.warn(JSON.stringify({ evento: "principal_pulado", modelo, motivo: "sem AI_GATEWAY" }));
      return contado(comMarcaDeLimite(chamar(opcoes.reserva, mensagens, ferramentas), false), 1);
    }
    let principalPorLimite: boolean;
    try {
      return await contado(comLimite(chamar(modelo, mensagens, ferramentas), opcoes.tempoDoPrincipalMs ?? TEMPO_DO_PRINCIPAL_MS), 1);
    } catch (erro) {
      if (erro instanceof TempoDoPrincipal) registrarFalha(modelo, erro);
      principalPorLimite = ehErroDeLimite(erro);
    }
    return contado(comMarcaDeLimite(chamar(opcoes.reserva, mensagens, ferramentas), principalPorLimite), 2);
  };
}
