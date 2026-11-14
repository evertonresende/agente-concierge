// P21 (provisória): saída escrita sem ano que, resolvida depois da entrada (P5), cai a mais de
// 90 noites dela é tratada como engano de digitação. O código não cota: recusa sem total e
// manda o modelo pedir as datas de novo, com o ano se a estadia for longa mesmo.
import { describe, expect, it } from "vitest";
import { cotarEstadia } from "../src/agente/ferramentas/cotacao";
import { montarResumo } from "../src/agente/ferramentas/lead";
import { prepararPedido } from "../src/agente/ferramentas/pedido";
import { rodarTurno } from "../src/agente/loop";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import type { Modelo } from "../src/modelo";
import { diasEntre, resolverData, resolverSaida, saidaSemAnoAlemDoTeto, somarDias, TETO_NOITES_SAIDA_SEM_ANO } from "../src/nucleo/datas";
import { chamar, criarContexto, criarMundo, diz, pedeFerramentas, roteiro } from "./apoio";

const HOJE = "2026-11-14";

function sessao(hoje = HOJE) {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  return { mundo, cofre, ctx: (turno: number) => criarContexto(mundo, cofre, turno, "datas", hoje), estado: () => estado };
}

async function pedido(checkin: string, checkout: string, hoje = HOJE, imovel_id = "GRM-301") {
  const { ctx } = sessao(hoje);
  return prepararPedido({ imovel_id, checkin, checkout, hospedes: 2 }, ctx(1));
}

function esperarRecusaP21(resultado: Awaited<ReturnType<typeof pedido>>) {
  expect(resultado.ok).toBe(false);
  const erro = (resultado as { erro: string }).erro;
  expect(erro).toContain("sem ano");
  expect(erro).toContain("Peça ao hóspede as datas de entrada e de saída de novo");
  expect(erro).toContain("com o ano");
  expect(erro).toContain("Não informe nenhum total e não passe para humano.");
  expect(erro).not.toContain("R$");
  return erro;
}

describe("saída sem ano a mais de 90 noites da entrada (P21)", () => {
  it("20/01 a 18/01 com hoje 14/11/2026: recusa com a instrução, sem 363 noites nem total", async () => {
    const resultado = await pedido("20/01", "18/01");
    const erro = esperarRecusaP21(resultado);
    expect(erro).not.toContain("363");
    expect(erro).not.toMatch(/\d{3,}[.,]\d{2}/);
  });

  it("fronteira: 90 noites exatas cotam, 91 recusam (no mesmo ano e na virada de ano)", async () => {
    for (const entrada of ["01/12", "20/01"]) {
      const checkin = resolverData(entrada, HOJE)!;
      const [d90, d91] = [somarDias(checkin, 90), somarDias(checkin, 91)].map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`);
      expect(diasEntre(checkin, resolverSaida(d90!, checkin, HOJE)!)).toBe(TETO_NOITES_SAIDA_SEM_ANO);
      const ok = await pedido(entrada, d90!);
      expect(ok).toMatchObject({ ok: true, cotacao: { ok: true, noites: 90 } });
      esperarRecusaP21(await pedido(entrada, d91!));
    }
  });

  it("não regride a P5: virada de ano, dia da semana, mesmo mês e saída sem ano curta", async () => {
    const casos: readonly [hoje: string, checkin: string, checkout: string, entrada: string, saida: string, noites: number][] = [
      [HOJE, "29/12", "02/01", "2026-12-29", "2027-01-02", 4],
      ["2026-11-18", "segunda", "sexta", "2026-11-23", "2026-11-27", 4],
      [HOJE, "15/03", "20/03", "2027-03-15", "2027-03-20", 5],
      [HOJE, "05/12", "10/12", "2026-12-05", "2026-12-10", 5],
      [HOJE, "30/12", "03/01", "2026-12-30", "2027-01-03", 4],
      [HOJE, "20/01/2027", "25/01", "2027-01-20", "2027-01-25", 5],
    ];
    for (const [hoje, checkin, checkout, entrada, saida, noites] of casos) {
      expect(await pedido(checkin, checkout, hoje)).toMatchObject({ ok: true, checkin: entrada, checkout: saida, cotacao: { ok: true, noites } });
    }
  });

  it("saída com ano escrito não entra na regra: 363 noites continuam cotando", async () => {
    for (const checkout of ["18/01/2028", "18/01/28", "2028-01-18", "18 de janeiro de 2028"]) {
      expect(await pedido("20/01/2027", checkout)).toMatchObject({ ok: true, checkout: "2028-01-18", cotacao: { ok: true, noites: 363 } });
    }
  });

  it("entrada com ano e saída sem ano a mais de 90 noites: recusa", async () => {
    esperarRecusaP21(await pedido("20/01/2027", "18/01"));
    esperarRecusaP21(await pedido("2027-01-20", "18 de janeiro"));
    esperarRecusaP21(await pedido("01/03/2028", "29/02"));
  });

  it("inglês: January 20 a January 18 e Jan 20 a Jan 18 recusam; com o ano na saída, cota", async () => {
    esperarRecusaP21(await pedido("January 20", "January 18"));
    esperarRecusaP21(await pedido("Jan 20", "Jan 18"));
    esperarRecusaP21(await pedido("January 20, 2027", "January 18"));
    expect(await pedido("January 20, 2027", "January 18, 2028")).toMatchObject({ ok: true, cotacao: { ok: true, noites: 363 } });
    expect(await pedido("January 20", "January 25")).toMatchObject({ ok: true, cotacao: { ok: true, noites: 5 } });
  });

  it("o predicado só marca saída sem ano; dia da semana, relativa e data com ano nunca", () => {
    const checkin = "2027-01-20";
    for (const semAno of ["18/01", "18 de janeiro", "18/jan", "January 18", "jan 18", "até 18/01", "dia 18/01"]) {
      expect(saidaSemAnoAlemDoTeto(semAno, checkin, HOJE), semAno).toBe(true);
    }
    for (const outra of ["18/01/2028", "18/01/28", "2028-01-18", "até 18/01/2028", "18 de janeiro de 2028", "January 18, 2028", "sexta", "até sexta", "amanhã", "25/01", "fim de semana"]) {
      expect(saidaSemAnoAlemDoTeto(outra, checkin, HOJE), outra).toBe(false);
    }
  });
});

describe("caminho das ferramentas com a saída sem ano distante (P21)", () => {
  it("cotar devolve recusa sem total nem valor em reais, com a instrução de pedir as datas de novo", async () => {
    const { ctx } = sessao();
    const r = await cotarEstadia.executar({ imovel_id: "GRM-301", checkin: "20/01", checkout: "18/01", adultos: 2 }, ctx(1));
    expect(r.recusa).toBe(true);
    expect(r.total).toBeUndefined();
    const texto = JSON.stringify(r.paraOModelo);
    expect(texto).not.toContain("R$");
    expect(texto).not.toContain("total\":");
    expect(texto).toContain("Peça ao hóspede as datas de entrada e de saída de novo");
  });

  it("montar_resumo devolve o erro sem total e sem resumo", async () => {
    const { ctx } = sessao();
    const r = await montarResumo.executar(
      { imovel_id: "GRM-301", checkin: "20/01", checkout: "18/01", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
      ctx(1),
    );
    expect(r.respostaFinal).toBeUndefined();
    const texto = JSON.stringify(r.paraOModelo);
    expect(texto).not.toContain("R$");
    expect(texto).toContain("Peça ao hóspede as datas de entrada e de saída de novo");
  });

  it("com resumo pendente, faz o mesmo que a recusa de entrada no passado", async () => {
    const resumo = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
    const estados: EstadoLead[][] = [];
    for (const [checkin, checkout] of [["10/11/2026", "12/11/2026"], ["20/01", "18/01"]] as const) {
      const s = sessao();
      await montarResumo.executar(resumo, s.ctx(1));
      expect(s.estado().pendente).not.toBeNull();
      const porCotar = sessao();
      await montarResumo.executar(resumo, porCotar.ctx(1));
      await cotarEstadia.executar({ imovel_id: "GRM-301", checkin, checkout }, porCotar.ctx(2));
      await montarResumo.executar({ ...resumo, checkin, checkout }, s.ctx(2));
      estados.push([porCotar.estado(), s.estado()]);
    }
    expect(estados[1]).toEqual(estados[0]);
    expect(estados[1]![0]!.pendente).toBeNull();
  });
});

describe("turno inteiro com a saída sem ano distante (P21)", () => {
  const turno = (modelo: Modelo) => {
    const { ctx } = sessao();
    return rodarTurno({ mensagem: "de 20/01 a 18/01", historico: [], houveHandoff: false, contexto: ctx(1), modelo, prazo: Date.now() + 5_000 });
  };

  it("recusa sem total e sem handoff, com a instrução na resposta da ferramenta", async () => {
    const { modelo, recebidas } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: "20/01", checkout: "18/01", adultos: 2 })),
      diz("A saída parece estar antes da entrada. Pode me passar as datas de entrada e de saída de novo?"),
    );
    const saida = await turno(modelo);
    const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
    expect(resultado).toContain("Peça ao hóspede as datas de entrada e de saída de novo");
    expect(resultado).not.toContain("R$");
    expect(saida.reply).not.toContain("R$");
    expect(saida.handoff).toBe(false);
  });

  it("recusa depois de cotação válida no mesmo turno não vaza total", async () => {
    const { modelo } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027" })),
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: "20/01", checkout: "18/01" })),
      diz("Pode confirmar as datas de entrada e de saída?"),
    );
    const saida = await turno(modelo);
    expect(saida.reply).not.toContain("R$");
    expect(saida.handoff).toBe(false);
  });
});
