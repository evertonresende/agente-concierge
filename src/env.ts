/** Bindings e variáveis do Worker (contrato seção 8). Secrets podem faltar: `/saude` relata a presença. */
export interface Env {
  AI: Ai;
  SESSAO: DurableObjectNamespace<import("./sessao").Sessao>;
  CATALOGO_URL?: string;
  LEADS_URL?: string;
  AMBIENTE?: string;
  MODELO?: string;
  /** Modelo de outro provedor que assume quando o principal falha (só onde o gateway tem a chave). */
  MODELO_RESERVA?: string;
  /** Id do AI Gateway por onde passam as chamadas de modelo. */
  AI_GATEWAY?: string;
  ENVIO_LEADS?: string;
}
