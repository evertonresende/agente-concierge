// Pergunta 2 da rodada pós-entrega (recomendação aceita pelo Éverton em 20/11): perguntar
// pela forma de pagamento é informação que o catálogo não traz (L5, sem handoff); pedir para
// pagar, gerar link, sinal ou reembolso continua sendo ação fora do alcance (L19, handoff).
import { describe, expect, it } from "vitest";
import { decidirHandoff, MATRIZ } from "../src/agente/ferramentas/handoff";
import { montarPrompt } from "../src/agente/prompt";
import { ESTADO_INICIAL } from "../src/lead";

describe("forma de pagamento: pergunta é informação ausente, pedido de pagar é ação fora do alcance", () => {
  it("a matriz e o prompt separam os dois", () => {
    expect(MATRIZ.informacao_ausente!.descricao).toMatch(/formas de pagamento aceitas/);
    expect(MATRIZ.acao_fora_do_alcance!.descricao).toMatch(/pedido para pagar/);
    expect(MATRIZ.acao_fora_do_alcance!.descricao).not.toMatch(/(?:^|, )pagamento,/);
    const prompt = montarPrompt(ESTADO_INICIAL, false);
    expect(prompt).toMatch(/formas de pagamento aceitas/);
    expect(prompt).not.toMatch(/reserva já feita, pagamento,/);
  });

  it("a ferramenta segue a decisão do motivo", () => {
    expect(decidirHandoff("informacao_ausente", "Vocês aceitam Pix ou cartão?", [])).toBe(false);
    expect(decidirHandoff("acao_fora_do_alcance", "Me manda o link para pagar o sinal agora?", [])).toBe(true);
  });
});
