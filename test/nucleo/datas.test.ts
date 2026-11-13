import { describe, expect, it } from "vitest";
import {
  dataCivilEmSaoPaulo, diaDaSemana, diasEntre, ehDataInexistente, formatarData, formatarDataComDia, interpretarData,
  resolverData, somarDias,
} from "../../src/nucleo/datas";

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

describe("resolverData com relógio injetado", () => {
  const CASOS: readonly [caso: string, hoje: string, entrada: string, esperado: string | null][] = [
    // Explícitas com ano
    ["ISO explícita", "2026-11-13", "2027-01-15", "2027-01-15"],
    ["BR explícita", "2026-11-13", "15/01/2027", "2027-01-15"],
    ["por extenso com ano", "2026-11-13", "15 de janeiro de 2027", "2027-01-15"],
    ["com dia da semana compatível", "2026-11-13", "sexta-feira, 15/01/2027", "2027-01-15"],
    ["com dia da semana incompatível", "2026-11-13", "segunda-feira, 15/01/2027", null],
    ["explícita no passado ainda resolve (recusa fica na L2)", "2026-11-13", "10/11/2026", "2026-11-10"],

    // Data sem ano: antes, igual e depois de hoje (decisão 9 e P1)
    ["sem ano antes de hoje -> ano seguinte", "2026-11-13", "12/11", "2027-11-12"],
    ["sem ano por extenso antes de hoje -> ano seguinte", "2026-11-13", "10 de outubro", "2027-10-10"],
    ["sem ano igual a hoje -> hoje", "2026-11-13", "13/11", "2026-11-13"],
    ["sem ano por extenso igual a hoje -> hoje", "2026-11-13", "13 de novembro", "2026-11-13"],
    ["sem ano depois de hoje -> este ano", "2026-11-13", "14/11", "2026-11-14"],
    ["sem ano com prefixo 'dia'", "2026-11-13", "para o dia 20 de dezembro", "2026-12-20"],

    // Virada de ano
    ["virada de ano: dezembro mantendo dezembro", "2026-12-28", "31/12", "2026-12-31"],
    ["virada de ano: dezembro -> janeiro do ano seguinte", "2026-12-28", "02/01", "2027-01-02"],
    ["virada de ano por extenso: dezembro -> janeiro", "2026-12-30", "15 de janeiro", "2027-01-15"],

    // 29/02 com e sem ano
    ["29/02 com ano bissexto", "2026-11-13", "29/02/2028", "2028-02-29"],
    ["29/02 com ano não bissexto", "2026-11-13", "29/02/2027", null],
    ["29/02 sem ano em ano não bissexto -> próximo 29/02", "2026-11-13", "29/02", "2028-02-29"],
    ["29/02 sem ano antes do dia no ano bissexto", "2028-01-10", "29/02", "2028-02-29"],
    ["29/02 sem ano no próprio 29/02", "2028-02-29", "29/02", "2028-02-29"],
    ["29/02 sem ano depois de 29/02 no ano bissexto", "2028-03-01", "29/02", "2032-02-29"],
    ["29/02 sem ano pulando século não bissexto (2100)", "2096-03-01", "29/02", "2104-02-29"],
    ["29 de fevereiro sem ano", "2026-11-13", "29 de fevereiro", "2028-02-29"],

    // Hoje, amanhã, depois de amanhã, ontem (L1 e L2)
    ["hoje", "2026-11-13", "hoje", "2026-11-13"],
    ["amanhã", "2026-11-13", "amanhã", "2026-11-14"],
    ["amanha sem acento", "2026-11-13", "para amanha", "2026-11-14"],
    ["depois de amanhã", "2026-11-13", "depois de amanhã", "2026-11-15"],
    ["amanhã na virada de ano", "2026-12-31", "amanhã", "2027-01-01"],
    ["depois de amanhã na virada de ano", "2026-12-31", "depois de amanhã", "2027-01-02"],
    ["ontem (passado)", "2026-11-13", "ontem", "2026-11-12"],

    // Cada dia da semana a partir de sexta-feira 2026-11-13 (L1b e P2)
    ["sábado (de sexta)", "2026-11-13", "sábado", "2026-11-14"],
    ["domingo (de sexta)", "2026-11-13", "domingo", "2026-11-15"],
    ["segunda (de sexta)", "2026-11-13", "segunda", "2026-11-16"],
    ["terça-feira (de sexta)", "2026-11-13", "terça-feira", "2026-11-17"],
    ["quarta (de sexta)", "2026-11-13", "quarta", "2026-11-18"],
    ["quinta (de sexta)", "2026-11-13", "quinta", "2026-11-19"],
    ["sexta dita na sexta -> semana seguinte (P2)", "2026-11-13", "sexta", "2026-11-20"],
    ["sexta que vem dita na sexta -> semana seguinte", "2026-11-13", "sexta que vem", "2026-11-20"],
    ["próxima sexta-feira dita na segunda -> esta sexta", "2026-11-16", "próxima sexta-feira", "2026-11-20"],

    // Cada dia da semana dito no próprio dia -> semana seguinte (+7 dias)
    ["domingo no domingo", "2026-11-15", "domingo", "2026-11-22"],
    ["segunda na segunda", "2026-11-16", "segunda-feira", "2026-11-23"],
    ["terça na terça", "2026-11-17", "terça", "2026-11-24"],
    ["quarta na quarta", "2026-11-18", "quarta", "2026-11-25"],
    ["quinta na quinta", "2026-11-19", "quinta", "2026-11-26"],
    ["sexta na sexta", "2026-11-20", "sexta", "2026-11-27"],
    ["sábado no sábado", "2026-11-21", "sábado", "2026-11-28"],

    // Datas inexistentes -> null
    ["30/02 sem ano", "2026-11-13", "30/02", null],
    ["30/02 com ano", "2026-11-13", "30/02/2027", null],
    ["31/04 sem ano", "2026-11-13", "31/04", null],
    ["30 de fevereiro", "2026-11-13", "30 de fevereiro", null],
    ["2027-02-29 ISO", "2026-11-13", "2027-02-29", null],
    ["mês 13", "2026-11-13", "15/13", null],

    // Expressões que NÃO determinam entrada e saída (L1a e L1) -> null
    ["fim de semana", "2026-11-13", "fim de semana", null],
    ["este fim de semana", "2026-11-13", "este fim de semana", null],
    ["final de semana", "2026-11-13", "final de semana", null],
    ["Natal", "2026-11-13", "Natal", null],
    ["no Natal", "2026-11-13", "no Natal", null],
    ["no feriado", "2026-11-13", "no feriado", null],
    ["Réveillon", "2026-11-13", "Réveillon", null],
    ["sexta passada não vira futura", "2026-11-13", "sexta passada", null],
    ["dia sem mês", "2026-11-13", "dia 15", null],
    ["texto vazio", "2026-11-13", "   ", null],
  ];

  it.each(CASOS)("%s (%s | %s -> %s)", (_caso, hoje, entrada, esperado) => {
    expect(resolverData(entrada, hoje)).toBe(esperado);
  });

  it("distingue data inexistente no calendário de expressão vaga e data válida", () => {
    expect(ehDataInexistente("30/02")).toBe(true);
    expect(ehDataInexistente("30/02/2027")).toBe(true);
    expect(ehDataInexistente("29/02/2027")).toBe(true);
    expect(ehDataInexistente("31 de abril")).toBe(true);
    expect(ehDataInexistente("15/01/2027")).toBe(false);
    expect(ehDataInexistente("29/02")).toBe(false);
    expect(ehDataInexistente("fim de semana")).toBe(false);
    expect(ehDataInexistente("no Natal")).toBe(false);
    expect(ehDataInexistente("no feriado")).toBe(false);
    expect(ehDataInexistente("")).toBe(false);
    expect(resolverData("constructor", "2026-11-13")).toBeNull();
    expect(resolverData("15 de toString", "2026-11-13")).toBeNull();
  });
});
