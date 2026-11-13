// Adaptador único do modelo. O resto do código só conhece `Modelo`: mensagens de chat
// com ferramentas, no formato de chat completions. Trocar de modelo é trocar a variável
// MODELO; o que for específico de um provedor (gateway, parâmetros) entra só aqui.

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

export function criarModelo(ai: Ai, modelo: string | undefined): Modelo {
  return async (mensagens, ferramentas) => {
    if (!modelo) throw new Error("MODELO não configurado");
    const executar = ai.run as (modelo: string, entrada: unknown) => Promise<unknown>;
    const bruto = await executar.call(ai, modelo, {
      messages: mensagens,
      tools: ferramentas,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
    });
    return normalizarResposta(bruto);
  };
}
