// F4 da rodada pós-entrega: com imóvel e datas na mensagem e um pedido de desconto, o
// modelo passava para humano e só oferecia a cotação, sem cotar. Reproduzido em dev 2 de 2
// com "Quero reservar o FLN-103 de ... para 4 pessoas, mas só se tiver 10% de desconto".
// A conferência agora pede a cotação quando a mensagem traz o id e as datas e nada cotou.
import { describe, expect, it } from "vitest";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 3 };
const PEDE_COTACAO = /chame cotar/i;

describe("F4: imóvel e datas na mensagem viram cotação na mesma resposta", () => {
  it("desconto passado para humano sem cotar: a conferência pede a cotação, e ela sai com o handoff", async () => {
    const { turno } = conversa();
    const r = roteiro(
      pedeFerramentas(chamar("passar_para_humano", { motivo: "desconto_ou_negociacao" })),
      diz("Não concedo desconto. Uma pessoa do time continua com você. Se quiser, posso cotar essas datas."),
      pedeFerramentas(chamar("cotar", ESTADIA)),
      diz("Não concedo desconto. Uma pessoa do time continua com você. Pelo valor normal, fica R$ 2.156,00."),
    );
    const saida = await turno("Quero reservar o GRM-301 de 15/01/2027 a 18/01/2027 para 3 pessoas, mas só se tiver 10% de desconto.", r.modelo);
    expect(r.recebidas[2]!.at(-1)!.content).toMatch(PEDE_COTACAO);
    expect(saida.handoff).toBe(true);
    expect(saida.reply).toContain("R$ 2.156,00");
  });

  for (const [motivo, mensagem] of [
    ["acao_fora_do_alcance", "Quero cancelar minha reserva do GRM-301 de 15/01/2027 a 18/01/2027."],
    ["reclamacao", "Fiquei no GRM-301 de 10/11/2026 a 12/11/2026 e o chuveiro não funcionava. Quero reclamar."],
    ["pediu_pessoa", "Quero falar com uma pessoa sobre o GRM-301 de 15/01/2027 a 18/01/2027."],
  ] as const) {
    it(`handoff por ${motivo} com id e datas: não pede cotação (revisão)`, async () => {
      const { turno } = conversa();
      const r = roteiro(pedeFerramentas(chamar("passar_para_humano", { motivo })), diz("Uma pessoa do time continua com você."));
      const saida = await turno(mensagem, r.modelo);
      expect(r.recebidas).toHaveLength(2);
      expect(saida.reply).not.toMatch(/R\$/);
    });
  }

  it("com cotação no turno, nenhuma chamada a mais", async () => {
    const { turno } = conversa();
    const r = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00."));
    await turno("Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 3?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
  });

  it("sem id do imóvel na mensagem, nenhuma chamada a mais", async () => {
    const { turno } = conversa();
    const r = roteiro(diz("Qual imóvel você quer? Temos opções em várias cidades."));
    await turno("Quero viajar de 15/01/2027 a 18/01/2027 com 3 pessoas.", r.modelo);
    expect(r.recebidas).toHaveLength(1);
  });

  it("sem datas na mensagem, nenhuma chamada a mais", async () => {
    const { turno } = conversa();
    const r = roteiro(diz("O GRM-301 é um chalé em Gramado."));
    await turno("Me fala do GRM-301.", r.modelo);
    expect(r.recebidas).toHaveLength(1);
  });
});
