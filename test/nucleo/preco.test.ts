import { describe, expect, it } from "vitest";
import { indiceDiaDaSemana, somarDias } from "../../src/nucleo/datas";
import { formatarReais, reaisParaCentavos } from "../../src/nucleo/dinheiro";
import { cotar, diariaComAcrescimo, type RegrasDoImovel } from "../../src/nucleo/preco";

function regras(diaria: number, limpeza: number, minimoNoites: number, capacidade: number): RegrasDoImovel {
  return { diariaCentavos: reaisParaCentavos(diaria), taxaLimpezaCentavos: reaisParaCentavos(limpeza), minimoNoites, capacidade };
}

const GRM301 = regras(590, 150, 2, 4);

function total(r: RegrasDoImovel, checkin: string, checkout: string, hospedes?: number): string {
  const c = cotar(r, checkin, checkout, hospedes);
  if (!c.ok) throw new Error(`recusou: ${c.motivo}`);
  return formatarReais(c.totalCentavos);
}

describe("preço", () => {
  it("exemplo do contrato: R$ 2.156,00", () => {
    const c = cotar(GRM301, "2027-01-15", "2027-01-18", 2);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    // sexta 70800 + sábado 70800 + domingo 59000 + limpeza 15000
    expect(c).toMatchObject({ noites: 3, noitesComAcrescimo: 2, diariaCentavos: 59000, diariaComAcrescimoCentavos: 70800 });
    expect(c.taxaLimpezaCentavos).toBe(15000);
    expect(c.totalCentavos).toBe(215600);
    expect(formatarReais(c.totalCentavos)).toBe("R$ 2.156,00");
  });

  it("centavos reais do catálogo: 245,50 × 1,2 = 29460 e 365,90 × 1,2 = 43908", () => {
    // Em ponto flutuante 245.5 * 1.2 dá 294.59999999999997.
    expect(diariaComAcrescimo(reaisParaCentavos(245.5))).toBe(29460);
    expect(diariaComAcrescimo(reaisParaCentavos(365.9))).toBe(43908);
    expect(total(regras(245.5, 75, 1, 2), "2027-01-15", "2027-01-16", 2)).toBe("R$ 369,60");
    expect(total(regras(365.9, 95, 2, 3), "2027-01-15", "2027-01-17", 2)).toBe("R$ 973,16");
  });

  it("fração de centavo arredonda para o centavo mais próximo, por noite (L14)", () => {
    // 20% de um valor inteiro em centavos só deixa frações 0,2 / 0,4 / 0,6 / 0,8.
    expect(diariaComAcrescimo(1)).toBe(1); // 1,2
    expect(diariaComAcrescimo(2)).toBe(2); // 2,4
    expect(diariaComAcrescimo(3)).toBe(4); // 3,6
    expect(diariaComAcrescimo(4)).toBe(5); // 4,8
    expect(diariaComAcrescimo(5)).toBe(6); // 6,0
  });

  it("o arredondamento é por noite, não na soma", () => {
    // 245,53 × 1,2 = 294,636 -> 294,64 por noite. Duas noites: 589,28; arredondando a soma daria 589,27.
    const c = cotar(regras(245.53, 0, 1, 2), "2027-01-15", "2027-01-17");
    expect(c).toMatchObject({ ok: true, totalCentavos: 58928 });
  });

  it("conta as noites de sexta e sábado em estadias de várias semanas, começando em qualquer dia", () => {
    const r = regras(100, 0, 1, 2);
    // Confere contra a conta noite a noite, para os 7 dias de início e durações de 1 a 30 noites.
    for (let inicio = 0; inicio < 7; inicio++) {
      const checkin = somarDias("2027-01-10", inicio); // 10/01/2027 é domingo
      for (let noites = 1; noites <= 30; noites++) {
        const esperado = Array.from({ length: noites }, (_, i) => [5, 6].includes(indiceDiaDaSemana(somarDias(checkin, i))) ? 12000 : 10000)
          .reduce((a, b) => a + b, 0);
        const c = cotar(r, checkin, somarDias(checkin, noites));
        expect(c).toMatchObject({ ok: true, totalCentavos: esperado });
      }
    }
  });

  it("estadia de dez anos é cotada sem montar lista de noites", () => {
    const c = cotar(GRM301, "2027-01-01", "2037-01-01", 2);
    expect(c).toMatchObject({ ok: true, noites: 3653, noitesComAcrescimo: 1044 });
  });

  it("dias úteis sem acréscimo, e a taxa de limpeza entra uma vez só", () => {
    expect(total(GRM301, "2027-01-18", "2027-01-20", 2)).toBe("R$ 1.330,00");
  });

  it("quinta e domingo sem acréscimo numa estadia de quatro noites", () => {
    expect(total(regras(1150, 320, 4, 10), "2027-01-14", "2027-01-18", 8)).toBe("R$ 5.380,00");
  });

  it("virada de ano: quinta 31/12 sem acréscimo, sexta 01/01 com acréscimo", () => {
    expect(total(regras(310, 100, 1, 2), "2026-12-31", "2027-01-02", 1)).toBe("R$ 782,00");
  });

  it("o número de hóspedes não muda o preço e pode faltar (L8)", () => {
    expect(total(GRM301, "2027-01-15", "2027-01-18")).toBe("R$ 2.156,00");
    expect(total(GRM301, "2027-01-15", "2027-01-18", 1)).toBe("R$ 2.156,00");
  });

  it("recusa abaixo do mínimo de noites, com o motivo e sem total", () => {
    const c = cotar(GRM301, "2027-01-15", "2027-01-16", 2);
    expect(c).toMatchObject({ ok: false, motivo: "minimo_noites" });
    expect(c).not.toHaveProperty("totalCentavos");
    if (!c.ok) expect(c.explicacao).toContain("mínimo 2 noites");
  });

  it("recusa acima da capacidade, com o motivo e sem total", () => {
    const c = cotar(GRM301, "2027-01-15", "2027-01-18", 5);
    expect(c).toMatchObject({ ok: false, motivo: "capacidade" });
    expect(c).not.toHaveProperty("totalCentavos");
    if (!c.ok) expect(c.explicacao).toContain("no máximo 4 pessoas");
  });

  it("recusa saída antes da entrada e saída no mesmo dia", () => {
    expect(cotar(GRM301, "2027-01-18", "2027-01-15", 2)).toMatchObject({ ok: false, motivo: "datas_invalidas" });
    expect(cotar(GRM301, "2027-01-15", "2027-01-15", 2)).toMatchObject({ ok: false, motivo: "datas_invalidas" });
  });

  it("os limites exatos não recusam: noites = mínimo e hóspedes = capacidade", () => {
    expect(total(GRM301, "2027-01-15", "2027-01-17", 2)).toBe("R$ 1.566,00");
    expect(total(GRM301, "2027-01-15", "2027-01-18", 4)).toBe("R$ 2.156,00");
  });

  it("número de hóspedes zero, negativo ou fracionário pede correção (L13)", () => {
    for (const n of [0, -2, 2.5]) {
      expect(cotar(GRM301, "2027-01-15", "2027-01-18", n)).toMatchObject({ ok: false, motivo: "hospedes_invalido" });
    }
  });
});
