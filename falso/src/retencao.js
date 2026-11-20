// Retenção dos leads do webhook próprio (pergunta 3 da rodada pós-entrega, decisão do
// Éverton em 20/11): cada lead fica guardado 7 dias e depois é apagado pelo alarme do
// Durable Object do segmento.
export const RETENCAO_MS = 7 * 24 * 60 * 60 * 1000;

/** Instante (ISO) antes do qual o lead já venceu. `recebido_em` é ISO: compara como texto. */
export const corteDaRetencao = (agoraMs) => new Date(agoraMs - RETENCAO_MS).toISOString();
