/** Bindings e variáveis do Worker (contrato seção 8). Secrets podem faltar: `/saude` relata a presença. */
export interface Env {
  AI: Ai;
  SESSAO: DurableObjectNamespace<import("./sessao").Sessao>;
  CATALOGO_URL?: string;
  LEADS_URL?: string;
  AMBIENTE?: string;
  MODELO?: string;
  ENVIO_LEADS?: string;
}
