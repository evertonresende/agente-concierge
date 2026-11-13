import { describe, expect, it } from "vitest";
import { centavosParaReais, formatarReais, reaisParaCentavos } from "../../src/nucleo/dinheiro";

describe("dinheiro", () => {
  it("converte reais do catálogo para centavos inteiros", () => {
    expect(reaisParaCentavos(590)).toBe(59000);
    expect(reaisParaCentavos(245.5)).toBe(24550);
    expect(reaisParaCentavos(365.9)).toBe(36590);
    expect(reaisParaCentavos(0)).toBe(0);
    // Valores que em ponto flutuante ficam logo abaixo do centavo (1.15 * 100 = 114.99999999999999).
    expect(reaisParaCentavos(1.15)).toBe(115);
    expect(reaisParaCentavos(4.35)).toBe(435);
  });

  it("recusa valor com mais de duas casas decimais em vez de arredondar", () => {
    for (const valor of [1.155, 590.001, 0.005]) expect(() => reaisParaCentavos(valor)).toThrow("duas casas");
  });

  it("recusa valor que não é um número de reais", () => {
    expect(() => reaisParaCentavos(Number.NaN)).toThrow();
    expect(() => reaisParaCentavos(-1)).toThrow();
  });

  it("formata centavos como R$ com ponto de milhar e vírgula decimal", () => {
    expect(formatarReais(215600)).toBe("R$ 2.156,00");
    expect(formatarReais(36960)).toBe("R$ 369,60");
    expect(formatarReais(97316)).toBe("R$ 973,16");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
  });

  it("recusa formatar centavos fracionados", () => {
    expect(() => formatarReais(10.5)).toThrow();
  });

  it("converte centavos no número em reais do webhook", () => {
    expect(centavosParaReais(215600)).toBe(2156);
    expect(JSON.stringify({ valor_total: centavosParaReais(97316) })).toBe('{"valor_total":973.16}');
  });
});
