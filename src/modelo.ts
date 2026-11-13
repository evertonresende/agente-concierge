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
  uso: { entrada: number; saida: number };
}

export type Modelo = (mensagens: Mensagem[], ferramentas: DefinicaoDeFerramenta[]) => Promise<RespostaDoModelo>;

// O raciocínio do modelo gasta tokens de saída: com o padrão da plataforma (256) a
// resposta pode vir cortada antes da chamada de ferramenta.
const MAX_TOKENS = 1500;

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
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

  const chamadas = brutas.flatMap((item, i): ChamadaDeFerramenta[] => {
    const chamada = objeto(item);
    const funcao = objeto(chamada.function);
    const nome = funcao.name ?? chamada.name;
    const argumentos = funcao.arguments ?? chamada.arguments ?? {};
    if (typeof nome !== "string" || nome === "") return [];
    return [{
      id: typeof chamada.id === "string" && chamada.id !== "" ? chamada.id : `chamada-${i + 1}`,
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

export interface OpcoesDoModelo {
  /** AI Gateway por onde passam todas as chamadas (obrigatório para modelo de terceiros). */
  gateway?: string;
  /** Modelo de outro fornecedor que responde quando o principal falha. */
  reserva?: string;
  /** Quanto o principal pode demorar antes de o reserva assumir. */
  tempoDoPrincipalMs?: number;
}

// Cabe no orçamento de 45 s do turno (contrato seção 2) e deixa tempo para o reserva.
const TEMPO_DO_PRINCIPAL_MS = 20_000;

// Ajuste fino por modelo. O gateway recusa campo que o modelo não aceita (erro 7003).
const AJUSTES: Record<string, Record<string, unknown>> = {
  // Raciocínio padrão é "high": lento demais para o teto de 60 s.
  "@cf/deepseek-ai/deepseek-v4.1-flash-1017": { reasoning_effort: "low" },
};

/** Parâmetros do pedido. Modelo de terceiros (fora do `@cf/`) recebe `max_completion_tokens`, o campo das APIs de chat atuais. */
export function parametros(modelo: string): Record<string, unknown> {
  const limite = modelo.startsWith("@cf/") ? { max_tokens: MAX_TOKENS } : { max_completion_tokens: MAX_TOKENS };
  return { ...limite, temperature: 0.2, ...AJUSTES[modelo] };
}

function opcoesDoAmbiente(): OpcoesDoModelo {
  const vars = env as Partial<Env>;
  return { gateway: vars.AI_GATEWAY || undefined, reserva: vars.MODELO_RESERVA || undefined };
}

class TempoDoPrincipal extends Error {}

function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new TempoDoPrincipal(`sem resposta em ${ms} ms`)), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/** Só o nome do modelo e o erro: nunca o conteúdo da conversa (contrato L22). */
function registrarFalha(modelo: string, erro: unknown): void {
  const descricao = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  console.warn(JSON.stringify({ evento: "modelo_falhou", modelo, erro: descricao.slice(0, 200) }));
}

/**
 * Sem `opcoes`, lê `AI_GATEWAY` e `MODELO_RESERVA` do ambiente do Worker. Com reserva
 * configurado, o principal tem prazo próprio; se ele lançar ou passar do prazo, o
 * reserva responde a mesma chamada. Sem reserva, o erro sobe para o loop (contrato L18).
 */
export function criarModelo(ai: Ai, modelo: string | undefined, opcoes: OpcoesDoModelo = opcoesDoAmbiente()): Modelo {
  const executar = ai.run as (modelo: string, entrada: unknown, opcoes?: unknown) => Promise<unknown>;
  const chamar = async (id: string, mensagens: Mensagem[], ferramentas: DefinicaoDeFerramenta[]) => {
    try {
      const bruto = await executar.call(ai, id, { messages: mensagens, tools: ferramentas, ...parametros(id) },
        opcoes.gateway ? { gateway: { id: opcoes.gateway } } : undefined);
      return normalizarResposta(bruto);
    } catch (erro) {
      registrarFalha(id, erro);
      throw erro;
    }
  };

  return async (mensagens, ferramentas) => {
    if (!modelo) throw new Error("MODELO não configurado");
    if (!opcoes.reserva) return chamar(modelo, mensagens, ferramentas);
    try {
      return await comLimite(chamar(modelo, mensagens, ferramentas), opcoes.tempoDoPrincipalMs ?? TEMPO_DO_PRINCIPAL_MS);
    } catch (erro) {
      if (erro instanceof TempoDoPrincipal) registrarFalha(modelo, erro);
      return chamar(opcoes.reserva, mensagens, ferramentas);
    }
  };
}
