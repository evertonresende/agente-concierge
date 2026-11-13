import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { cotarEstadia } from "../src/agente/ferramentas/cotacao";
import { prepararPedido } from "../src/agente/ferramentas/pedido";
import { rodarTurno } from "../src/agente/loop";
import type { Env } from "../src/env";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import type { Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarContexto, criarMundo, diz, pedeFerramentas, roteiro } from "./apoio";

function montar(hoje = "2026-11-13") {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const turno = (n: number, mensagem: string, modelo: Modelo) =>
    rodarTurno({ mensagem, historico: [], houveHandoff: false, contexto: criarContexto(mundo, cofre, n, mensagem, hoje), modelo, prazo: Date.now() + 5_000 });
  return { mundo, cofre, turno, estado: () => estado };
}

describe("cotação e pedido com datas resolvidas por código", () => {
  it("a definição da ferramenta cotar instrui o modelo a passar as datas como o hóspede escreveu", () => {
    const { description, parameters } = cotarEstadia.definicao.function;
    const props = (parameters as { properties: Record<string, { description: string }> }).properties;
    expect(description).toContain("como o hóspede escreveu");
    expect(description).toContain("America/Sao_Paulo");
    expect(props.checkin!.description).toContain("como o hóspede escreveu");
    expect(props.checkout!.description).toContain("como o hóspede escreveu");
  });

  const COTACOES: readonly [
    caso: string,
    hoje: string,
    checkin: string,
    checkout: string,
    entradaEsperada: string,
    saidaEsperada: string,
    totalEsperado: string,
  ][] = [
    ["hoje a amanhã (aceita entrada hoje)", "2026-11-13", "hoje", "amanhã", "sexta-feira, 13/11/2026", "sábado, 14/11/2026", "R$ 369,60"],
    ["amanhã a depois de amanhã", "2026-11-13", "amanhã", "depois de amanhã", "sábado, 14/11/2026", "domingo, 15/11/2026", "R$ 369,60"],
    ["sem ano igual a hoje a +2 dias", "2026-11-13", "13/11", "15/11", "sexta-feira, 13/11/2026", "domingo, 15/11/2026", "R$ 664,20"],
    ["sem ano já passou neste ano -> próximo ano", "2026-11-13", "10/11", "12/11", "quarta-feira, 10/11/2027", "sexta-feira, 12/11/2027", "R$ 566,00"],
    ["virada de ano (dezembro -> janeiro)", "2026-12-30", "31/12", "02/01", "quinta-feira, 31/12/2026", "sábado, 02/01/2027", "R$ 615,10"],
    ["29/02 sem ano em ano bissexto", "2028-01-10", "29/02", "02/03", "terça-feira, 29/02/2028", "quinta-feira, 02/03/2028", "R$ 566,00"],
    ["29/02 sem ano em ano não bissexto -> próximo bissexto", "2026-11-13", "29/02", "02/03/2028", "terça-feira, 29/02/2028", "quinta-feira, 02/03/2028", "R$ 566,00"],
    ["sexta que vem dita na segunda", "2026-11-16", "sexta que vem", "domingo", "sexta-feira, 20/11/2026", "domingo, 22/11/2026", "R$ 664,20"],
    ["sexta dita na sexta -> semana seguinte", "2026-11-13", "sexta", "23/11", "sexta-feira, 20/11/2026", "segunda-feira, 23/11/2026", "R$ 909,70"],
  ];

  it.each(COTACOES)("%s", async (_caso, hoje, checkin, checkout, entradaEsperada, saidaEsperada, totalEsperado) => {
    const { turno } = montar(hoje);
    const { modelo, recebidas } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", checkin, checkout, hospedes: 2 })),
      diz(`De ${entradaEsperada} a ${saidaEsperada}, o total fica em ${totalEsperado}.`),
    );
    const saida = await turno(1, `cotar de ${checkin} a ${checkout}`, modelo);
    expect(saida.handoff).toBe(false);
    expect(saida.reply).toContain(totalEsperado);
    const resultado = JSON.parse(recebidas[1]!.findLast((m) => m.role === "tool")!.content);
    expect(resultado.entrada).toBe(entradaEsperada);
    expect(resultado.saida).toBe(saidaEsperada);
    expect(resultado.total).toBe(totalEsperado);
    expect(resultado.instrucao).toContain(entradaEsperada);
    expect(resultado.instrucao).toContain(saidaEsperada);
  });

  it("entrada no passado (L2): recusa, explica e pede novas datas, sem total e sem handoff", async () => {
    for (const [checkin, checkout] of [
      ["10/11/2026", "12/11/2026"],
      ["ontem", "amanhã"],
    ] as const) {
      const { turno } = montar("2026-11-13");
      const { modelo, recebidas } = roteiro(
        pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin, checkout })),
        diz("A data de entrada já passou. Informe novas datas de entrada e saída."),
      );
      const saida = await turno(1, `de ${checkin} a ${checkout}`, modelo);
      const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
      expect(resultado).toContain("já passou");
      expect(resultado).toContain("novas datas");
      expect(resultado).not.toContain("R$");
      expect(saida.reply).not.toContain("R$");
      expect(saida.handoff).toBe(false);
    }
  });

  it("recusa no passado depois de cotação válida no mesmo turno não vaza total", async () => {
    const { turno } = montar("2026-11-13");
    const { modelo } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", checkin: "15/01/2027", checkout: "18/01/2027" })),
      pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", checkin: "10/11/2026", checkout: "12/11/2026" })),
      diz("Essa data de entrada já passou. Qual outra data prefere?"),
    );
    const saida = await turno(1, "tenta 10/11/2026", modelo);
    expect(saida.reply).not.toContain("R$");
    expect(saida.handoff).toBe(false);
  });

  it("fim de semana e Natal não são mapeados e pedem entrada e saída sem total (L1a e L1)", async () => {
    for (const expressao of ["fim de semana", "este fim de semana", "no Natal", "Natal", "no feriado"]) {
      const { turno } = montar("2026-11-13");
      const { modelo, recebidas } = roteiro(
        pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: expressao, checkout: expressao })),
        diz("Qual é a data exata de entrada e de saída que você deseja?"),
      );
      const saida = await turno(1, `quanto fica ${expressao}?`, modelo);
      const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
      expect(resultado).toContain("entrada");
      expect(resultado).toContain("saída");
      expect(resultado).not.toContain("R$");
      expect(saida.reply).not.toContain("R$");
      expect(saida.handoff).toBe(false);
    }
  });

  it("data inexistente (30/02 sem ano e 29/02/2027) pede a data correta sem total", async () => {
    for (const dataRuim of ["30/02", "29/02/2027"]) {
      const { turno } = montar("2026-11-13");
      const { modelo, recebidas } = roteiro(
        pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: dataRuim, checkout: "03/03/2027" })),
        diz("Essa data não existe no calendário. Qual é a data correta?"),
      );
      const saida = await turno(1, `de ${dataRuim} a 03/03/2027`, modelo);
      const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
      expect(resultado).toContain("inexistente");
      expect(resultado).not.toContain("R$");
      expect(saida.reply).not.toContain("R$");
      expect(saida.handoff).toBe(false);
    }
  });

  it("saída no mesmo dia ou anterior à entrada continua recusada sem total", async () => {
    for (const [checkin, checkout] of [["hoje", "hoje"], ["18/01/2027", "15/01/2027"]] as const) {
      const { turno } = montar("2026-11-13");
      const { modelo, recebidas } = roteiro(
        pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", checkin, checkout })),
        diz("A saída precisa ser depois da entrada."),
      );
      const saida = await turno(1, "datas invertidas", modelo);
      const resultado = JSON.parse(recebidas[1]!.findLast((m) => m.role === "tool")!.content);
      expect(resultado.recusada).toBe(true);
      expect(saida.reply).not.toContain("R$");
      expect(saida.handoff).toBe(false);
    }
  });

  it("montar_resumo e confirmar_reserva funcionam com datas sem ano resolvidas por prepararPedido", async () => {
    const { mundo, cofre, turno } = montar("2026-11-13");
    const dados = { imovel_id: "GRM-301", checkin: "15/01", checkout: "18/01", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
    const resumo = await turno(1, "quero fechar de 15/01 a 18/01", roteiro(pedeFerramentas(chamar("montar_resumo", dados))).modelo);
    expect(resumo.reply).toContain("sexta-feira, 15/01/2027");
    expect(resumo.reply).toContain("segunda-feira, 18/01/2027");
    expect(resumo.reply).toContain("R$ 2.156,00");

    const confirmacao = await turno(2, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(confirmacao.reply).toMatch(/registrad/i);
    expect(mundo.leads).toEqual([{
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);

    // Confirma que prepararPedido mantém compatibilidade direta com o contexto.
    const pedido = await prepararPedido(dados, criarContexto(mundo, cofre, 3, "teste", "2026-11-13"));
    expect(pedido).toMatchObject({ ok: true, checkin: "2027-01-15", checkout: "2027-01-18" });
  });
});

describe("sessão usa relógio injetado no fuso America/Sao_Paulo", () => {
  const namespace = (env as unknown as Env).SESSAO;
  let seq = 0;

  it("às 23h30 de sexta em São Paulo (02h30 UTC de sábado), 'hoje' ainda é sexta 13/11/2026", async () => {
    const mundo = criarMundo();
    const { modelo, recebidas } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", checkin: "hoje", checkout: "amanhã", hospedes: 1 })),
      diz("Entrada sexta-feira, 13/11/2026, saída sábado, 14/11/2026. Total: R$ 369,60."),
    );
    const stub = namespace.getByName(`datas-sp-${++seq}`);
    await runInDurableObject(stub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar, agora: () => Date.UTC(2026, 10, 14, 2, 30) };
    });

    const resp = await stub.conversar("quero de hoje até amanhã no RIO-402");
    expect(resp.handoff).toBe(false);
    expect(resp.reply).toContain("R$ 369,60");
    const tool = JSON.parse(recebidas[1]!.findLast((m) => m.role === "tool")!.content);
    expect(tool.entrada).toBe("sexta-feira, 13/11/2026");
    expect(tool.saida).toBe("sábado, 14/11/2026");
  });
});
