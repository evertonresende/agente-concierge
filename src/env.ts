/** Bindings e variáveis do Worker (contrato seção 8). Secrets podem faltar: `/saude` relata a presença. */
export interface Env {
  AI: Ai;
  SESSAO: DurableObjectNamespace<import("./sessao").Sessao>;
  CATALOGO_URL?: string;
  LEADS_URL?: string;
  AMBIENTE?: string;
  MODELO?: string;
  /** Modelo de outro fornecedor que assume quando o principal falha. */
  MODELO_RESERVA?: string;
  /** Nível de raciocínio dos modelos da Anthropic; ausente ou inválido vira `medium`. */
  MODELO_ESFORCO?: string;
  /** Id do AI Gateway por onde passam as chamadas de modelo. */
  AI_GATEWAY?: string;
  ENVIO_LEADS?: string;
  /** Host do webhook falso (secret de dev): com ele, só esse host recebe lead fora de producao. */
  LEADS_HOST_FALSO?: string;
  /** Contador de chamadas ao modelo por dia (M2). */
  TETO?: DurableObjectNamespace<import("./gasto").Teto>;
  /** Teto diário de chamadas ao modelo; ausente desliga o teto (M2). */
  TETO_DIARIO_CHAMADAS?: string;
  /** Limite de mensagens por IP, binding nativo de rate limit; ausente em dev (M2). */
  LIMITE_POR_IP?: RateLimit;
}
