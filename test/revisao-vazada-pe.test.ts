// F3 da rodada pós-entrega: a conferência marcava como regra inventada a oferta de "outros
// imóveis que aceitam pet" depois de ler uma ficha sem pet, e a reescrita expunha o laço
// interno ao hóspede ("Revisei a resposta anterior...") e repetia o aviso da regra.
import { describe, expect, it } from "vitest";
import { conferir, corrigirValores, semFalaDaRevisao } from "../src/agente/loop";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa } from "./apoio-g";

const SEM_PET = { regras: { "GRM-301": { nome: "Chale Serra Gramado", regras: { aceita_pet: false } } } };
const SITUACAO = { mensagem: "O GRM-301 aceita cachorro?", handoff: false, ...SEM_PET };
const OFERTA = "O GRM-301 não aceita pet. Se quiser, posso indicar outros imóveis que aceitam pet.";
const REGRA_FIXA = "Pelas regras da ficha";

describe("F3: oferta de outros imóveis com pet não é regra inventada", () => {
  it("a conferência não pede correção da oferta", () => {
    expect(conferir(OFERTA, new Set(), SITUACAO)).toEqual([]);
  });

  it("formas parecidas também passam", () => {
    for (const texto of [
      "Posso procurar outras opções que aceitam animais.",
      "Há outros imóveis no catálogo que aceitam pets, se você quiser.",
      "I can suggest other properties that allow pets.",
    ]) expect(conferir(texto, new Set(), SITUACAO), texto).toEqual([]);
  });

  it("afirmar que o imóvel da ficha aceita pet continua pego", () => {
    expect(conferir("O GRM-301 aceita pets, pode levar.", new Set(), SITUACAO)).toHaveLength(1);
    expect(conferir("Sim, aceita pets!", new Set(), SITUACAO)).toHaveLength(1);
  });

  it("\"outro\" que não fala de outros imóveis não isenta (revisão)", () => {
    for (const texto of ["Outra vantagem: o GRM-301 aceita pets.", "Outro ponto positivo é que o GRM-301 aceita pets."]) {
      expect(conferir(texto, new Set(), SITUACAO), texto).toHaveLength(1);
    }
  });

  it("no turno inteiro: uma chamada só, e a resposta chega como o modelo escreveu", async () => {
    const { turno } = conversa();
    const r = roteiro(pedeFerramentas(chamar("ver_imovel", { imovel_id: "GRM-301" })), diz(OFERTA));
    const saida = await turno("O GRM-301 aceita cachorro?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(saida.reply).toBe(OFERTA);
  });
});

describe("F3: a reescrita nunca fala da revisão ao hóspede", () => {
  it("frase sobre revisão ou resposta anterior, depois de um rascunho rejeitado, sai por código", async () => {
    const { turno } = conversa();
    const r = roteiro(
      pedeFerramentas(chamar("ver_imovel", { imovel_id: "GRM-301" })),
      diz("Sim, o GRM-301 aceita pets."),
      diz("Revisei a resposta anterior e ela está de acordo com a ficha. O GRM-301 não aceita pet."),
    );
    const saida = await turno("O GRM-301 aceita cachorro?", r.modelo);
    expect(saida.reply).not.toMatch(/revis|resposta anterior/i);
    expect(saida.reply).toContain("não aceita pet");
  });

  it("o pedido de correção manda não citar a revisão", async () => {
    const { turno } = conversa();
    const r = roteiro(
      pedeFerramentas(chamar("ver_imovel", { imovel_id: "GRM-301" })),
      diz("Sim, o GRM-301 aceita pets."),
      diz("O GRM-301 não aceita pet."),
    );
    await turno("O GRM-301 aceita cachorro?", r.modelo);
    expect(r.recebidas[2]!.at(-1)!.content).toMatch(/não (?:mencione|cite|fale)[^.]*revis/i);
  });

  it("a frase fixa da regra não se soma a um aviso de regra que já está na resposta", () => {
    const texto = "Este imóvel não aceita pet. O GRM-301 aceita pets, pode levar.";
    const saida = corrigirValores(texto, new Set(), undefined, { ...SITUACAO, textos: { troca: { regra: `${REGRA_FIXA}, isso não é permitido neste imóvel.` } } as never });
    expect(saida).toBe("Este imóvel não aceita pet.");
  });

  it("aviso de outra regra não dispensa a frase fixa da regra cortada (revisão)", () => {
    const saida = corrigirValores("O GRM-301 aceita pets. Ele não permite festas.", new Set(), undefined,
      { ...SITUACAO, textos: { troca: { regra: `${REGRA_FIXA}, isso não é permitido neste imóvel.` } } as never });
    expect(saida).toContain(REGRA_FIXA);
    expect(saida).toContain("Ele não permite festas.");
  });

  it("frase que só começa falando da revisão perde só esse pedaço (revisão)", () => {
    expect(semFalaDaRevisao("Como disse na mensagem anterior, o GRM-301 não aceita pet.")).toBe("O GRM-301 não aceita pet.");
    expect(semFalaDaRevisao("Revisei: o total é R$ 2.156,00.")).toBe("O total é R$ 2.156,00.");
    expect(semFalaDaRevisao("Revisei a resposta anterior e ela está de acordo com a ficha. Tem lareira.")).toBe("Tem lareira.");
  });
});
