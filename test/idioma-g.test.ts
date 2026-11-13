// Idioma da resposta (L15, frente G): o hóspede em inglês recebe a cotação com as datas
// em inglês e um alerta de idioma, e a resposta mantém o conteúdo com o total no formato
// do contrato, R$ 2.156,00. O hóspede em português não muda nada.
import { describe, expect, it } from "vitest";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const EM_INGLES = "Hi! How much is GRM-301 from January 15, 2027 to January 18, 2027 for 2 guests?";
const EM_PORTUGUES = "Oi! Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas?";
// Palavras que só existem em português, como no caso de eval do contrato, mais o dia da semana.
const PORTUGUES = /\b(?:noites?|h[oó]spedes?|di[aá]rias?|taxas?|limpeza|estadias?|valor(?:es)?|pre[cç]os?|custa|fica|pessoas?|reais|cota[cç][aã]o|n[aã]o|para|entre|ol[aá]|entrada|sa[ií]da)\b|-feira|s[aá]bado|domingo/i;

async function cotar(mensagem: string, resposta: string) {
  const { turno } = conversa();
  const r = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz(resposta));
  const saida = await turno(mensagem, r.modelo);
  return { saida, recebidas: r.recebidas };
}

describe("idioma: hóspede em inglês (L15)", () => {
  it("a cotação chega ao modelo com as datas em inglês, o total no formato do contrato e um alerta de idioma", async () => {
    const { recebidas } = await cotar(EM_INGLES, "GRM-301: R$ 2.156,00.");
    const resultado = JSON.parse(ultimoResultado(recebidas[1]!));
    expect(resultado.entrada).toBe("Friday, January 15, 2027");
    expect(resultado.saida).toBe("Monday, January 18, 2027");
    expect(resultado.instrucao).toContain("entrada Friday, January 15, 2027 e saída Monday, January 18, 2027");
    expect(JSON.stringify(resultado)).not.toContain("-feira");
    expect(resultado.total).toBe("R$ 2.156,00");
    expect(recebidas[0]![0]!.content).toContain("O hóspede escreve em inglês");
  });

  it.each([
    ["total em formato inglês", "GRM-301 from Friday, January 15, 2027 to Monday, January 18, 2027 costs R$ 2,156.00 in total."],
    ["total com BRL", "The stay at GRM-301 is BRL 2,156 in total."],
    ["conta parcial por noite", "At GRM-301 each weekday night is R$ 590.00, Friday and Saturday nights are R$ 708.00, cleaning is R$ 150.00, and the total is R$ 2,156.00."],
  ])("%s: a resposta mantém o conteúdo, em inglês, com R$ 2.156,00", async (_nome, resposta) => {
    const { saida } = await cotar(EM_INGLES, resposta);
    expect(saida.reply).toContain("GRM-301");
    expect(saida.reply).toContain("R$ 2.156,00");
    expect(saida.reply).not.toMatch(/R\$ 2,156\.00|BRL/);
    expect(saida.reply).not.toMatch(PORTUGUES);
    expect(saida).toMatchObject({ handoff: false, contingencia: false });
  });
});

describe("idioma: hóspede em português não muda", () => {
  it("a cotação chega com as datas em português e sem alerta de idioma", async () => {
    const { saida, recebidas } = await cotar(EM_PORTUGUES, "O GRM-301 fica em R$ 2,156.00 no total.");
    const resultado = JSON.parse(ultimoResultado(recebidas[1]!));
    expect(resultado.entrada).toBe("sexta-feira, 15/01/2027");
    expect(resultado.saida).toBe("segunda-feira, 18/01/2027");
    expect(recebidas[0]![0]!.content).not.toContain("O hóspede escreve em inglês");
    expect(saida.reply).toBe("O GRM-301 fica em R$ 2.156,00 no total.");
  });
});
