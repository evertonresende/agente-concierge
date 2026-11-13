import { describe, expect, it } from "vitest";
import { dataCivilEmSaoPaulo, diaDaSemana, diasEntre, formatarData, formatarDataComDia, interpretarData, somarDias } from "../../src/nucleo/datas";

describe("datas", () => {
  it("aceita data ISO e DD/MM/AAAA explícitas", () => {
    expect(interpretarData("2027-01-15")).toBe("2027-01-15");
    expect(interpretarData("15/01/2027")).toBe("2027-01-15");
    expect(interpretarData(" 5/1/2027 ")).toBe("2027-01-05");
  });

  it("recusa data que não existe ou que não está num formato explícito", () => {
    expect(interpretarData("30/02/2027")).toBeNull();
    expect(interpretarData("2027-02-29")).toBeNull();
    expect(interpretarData("2027-13-01")).toBeNull();
    expect(interpretarData("15/01")).toBeNull();
    expect(interpretarData("amanhã")).toBeNull();
    expect(interpretarData("")).toBeNull();
  });

  it("aceita 29/02 em ano bissexto", () => {
    expect(interpretarData("29/02/2028")).toBe("2028-02-29");
    expect(diaDaSemana("2028-02-29")).toBe("terça-feira");
  });

  it("calcula o dia da semana pela data civil", () => {
    expect(diaDaSemana("2027-01-15")).toBe("sexta-feira");
    expect(diaDaSemana("2027-01-16")).toBe("sábado");
    expect(diaDaSemana("2027-01-17")).toBe("domingo");
    expect(diaDaSemana("2027-01-18")).toBe("segunda-feira");
    expect(diaDaSemana("2026-12-31")).toBe("quinta-feira");
    expect(diaDaSemana("2027-01-01")).toBe("sexta-feira");
  });

  it("conta noites e soma dias atravessando a virada do ano", () => {
    expect(diasEntre("2027-01-15", "2027-01-18")).toBe(3);
    expect(diasEntre("2026-12-31", "2027-01-02")).toBe(2);
    expect(diasEntre("2027-01-18", "2027-01-15")).toBe(-3);
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("formata a data para o hóspede", () => {
    expect(formatarData("2027-01-15")).toBe("15/01/2027");
    expect(formatarDataComDia("2027-01-15")).toBe("sexta-feira, 15/01/2027");
  });

  it("converte um instante na data civil de São Paulo (UTC-3)", () => {
    // 23h59 de 15/01 em São Paulo = 02h59 UTC do dia 16: a data UTC já é a do dia seguinte.
    expect(dataCivilEmSaoPaulo(Date.UTC(2027, 0, 16, 2, 59))).toBe("2027-01-15");
    // 00h01 de 16/01 em São Paulo = 03h01 UTC do dia 16.
    expect(dataCivilEmSaoPaulo(Date.UTC(2027, 0, 16, 3, 1))).toBe("2027-01-16");
    // Meio-dia em São Paulo: as duas datas coincidem.
    expect(dataCivilEmSaoPaulo(Date.UTC(2027, 0, 15, 15, 0))).toBe("2027-01-15");
    // Virada do ano e do mês: 22h de 31/12 em São Paulo já é 01h de 01/01 em UTC.
    expect(dataCivilEmSaoPaulo(Date.UTC(2027, 0, 1, 1, 0))).toBe("2026-12-31");
    expect(dataCivilEmSaoPaulo(Date.UTC(2028, 2, 1, 2, 0))).toBe("2028-02-29");
  });
});
