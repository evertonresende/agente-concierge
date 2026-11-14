// Grupo cotado amarrado ao resumo (L13, L13a, frente G): o lead nunca sai com menos
// pessoas do que a última cotação daquele imóvel e daquelas datas, nem com o grupo que a
// capacidade recusou. Quem amarra é o código, não o esquema de montar_resumo.
import { describe, expect, it } from "vitest";
import { contarHospedes, grupoCotado } from "../src/agente/ferramentas/pedido";
import type { Mensagem } from "../src/modelo";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

const DATAS = { checkin: "15/01/2027", checkout: "18/01/2027" };
const PESSOA = { nome: "Ana Lima", telefone: "(11) 98888-0000" };
const cotar = (argumentos: Record<string, unknown>): Mensagem => ({ role: "assistant", content: "", tool_calls: [chamar("cotar", argumentos)] });

describe("grupoCotado: o grupo da última cotação do mesmo imóvel e das mesmas datas", () => {
  const hoje = "2026-11-14";

  it("soma as partes, em qualquer formato de data, e vale a última cotação", () => {
    const historico = [cotar({ imovel_id: "GRM-301", ...DATAS, adultos: 2, bebes: 2 })];
    expect(grupoCotado(historico, { imovel_id: "grm-301", checkin: "2027-01-15", checkout: "2027-01-18" }, hoje)).toBe(4);
    expect(grupoCotado([...historico, cotar({ imovel_id: "GRM-301", ...DATAS, hospedes: 3 })], { imovel_id: "GRM-301", ...DATAS }, hoje)).toBe(3);
  });

  it("outra estadia ou outro imóvel não conta", () => {
    const historico = [cotar({ imovel_id: "GRM-301", ...DATAS, hospedes: 4 })];
    expect(grupoCotado(historico, { imovel_id: "GRM-301", checkin: "22/01/2027", checkout: "25/01/2027" }, hoje)).toBeUndefined();
    expect(grupoCotado(historico, { imovel_id: "RIO-402", ...DATAS }, hoje)).toBeUndefined();
  });

  it("P03: com os dois formatos em cotar, as partes vencem o número antigo", () => {
    expect(contarHospedes({ hospedes: 2, adultos: 2, criancas: 1 })).toBe(3);
  });
});

describe("resumo amarrado ao grupo cotado (ALTA 4)", () => {
  it("montar_resumo com as partes do grupo soma como cotar", async () => {
    const c = conversa();
    const s = await c.turno("Fecha o GRM-301 de 15/01/2027 a 18/01/2027 para 2 adultos e 2 bebês. Ana Lima, (11) 98888-0000.",
      roteiro(pedeFerramentas(chamar("montar_resumo", { imovel_id: "GRM-301", ...DATAS, adultos: 2, bebes: 2, ...PESSOA }))).modelo);
    expect(s.reply).toContain("Hóspedes: 4");
  });

  it("cotação para 2 adultos e 2 bebês: o resumo com 2 é recusado e o lead não sai com 2", async () => {
    const c = conversa();
    await c.turno("Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2 adultos e 2 bebês de colo?",
      roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, adultos: 2, bebes: 2 })), diz("Para 4 pessoas fica R$ 2.156,00.")).modelo);
    const r = roteiro(pedeFerramentas(chamar("montar_resumo", { imovel_id: "GRM-301", ...DATAS, hospedes: 2, ...PESSOA })), diz("São 4 pessoas, certo?"));
    await c.turno("Pode fechar. Ana Lima, (11) 98888-0000.", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).erro).toContain("foi para 4 pessoas");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Ainda não há resumo.")).modelo);
    expect(c.mundo.leads).toEqual([]);
  });

  it("RIO-402 (capacidade 2): grupo de 4 recusado na cotação não vira resumo nem lead de 2", async () => {
    const c = conversa();
    await c.turno("Quanto fica o RIO-402 de 15/01/2027 a 18/01/2027 para 2 adultos e 2 bebês?",
      roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", ...DATAS, adultos: 2, bebes: 2 })), diz("O RIO-402 acomoda no máximo 2 pessoas.")).modelo);
    const r = roteiro(pedeFerramentas(chamar("montar_resumo", { imovel_id: "RIO-402", ...DATAS, hospedes: 2, ...PESSOA })), diz("Bebês contam como hóspedes."));
    const saida = await c.turno("Bebê não ocupa cama. Fecha para 2: Ana Lima, (11) 98888-0000.", r.modelo);
    expect(saida.reply).not.toContain("Resumo do seu pedido");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Ainda não há resumo.")).modelo);
    expect(c.mundo.leads).toEqual([]);
  });

  it("o grupo mudou de verdade: cotado de novo com 3, o resumo com 3 sai", async () => {
    const c = conversa();
    await c.turno("Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 4?",
      roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, hospedes: 4 })), diz("Fica R$ 2.156,00.")).modelo);
    const r = roteiro(
      pedeFerramentas(chamar("montar_resumo", { imovel_id: "GRM-301", ...DATAS, hospedes: 3, ...PESSOA })),
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, hospedes: 3 })),
      pedeFerramentas(chamar("montar_resumo", { imovel_id: "GRM-301", ...DATAS, hospedes: 3, ...PESSOA })),
    );
    const saida = await c.turno("Um desistiu, vamos em 3. Pode fechar: Ana Lima, (11) 98888-0000.", r.modelo);
    expect(saida.reply).toContain("Hóspedes: 3");
  });

  it("P25: resumo pendente com 2 e nova cotação com 3 nas mesmas datas: o resumo novo leva 3", async () => {
    const c = conversa();
    await c.turno("Fecha o GRM-301 de 15/01/2027 a 18/01/2027 para 2. Ana Lima, (11) 98888-0000.",
      roteiro(pedeFerramentas(chamar("montar_resumo", { imovel_id: "GRM-301", ...DATAS, hospedes: 2, ...PESSOA }))).modelo);
    const saida = await c.turno("Na verdade somos 3.", roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, hospedes: 3 }))).modelo);
    expect(saida.reply).toContain("Hóspedes: 3");
  });
});
