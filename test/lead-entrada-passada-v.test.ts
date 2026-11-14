import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { type Contexto } from "../src/agente/ferramentas";
import { cotarEstadia } from "../src/agente/ferramentas/cotacao";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, pendenteAberto } from "../src/lead";
import type { Env } from "../src/env";
import type { Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarContexto, criarMundo, diz, pedeFerramentas, ultimaDoHospede } from "./apoio";

const DIA = "2027-01-15";
const DADOS = { imovel_id: "GRM-301", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

/** Estadia [entrada, saída]: resumo montado no turno 1 com `hojeDoResumo`; o hóspede manda `sim` no turno 2 com `hojeDoSim`. */
async function cenario([checkin, checkout]: [string, string], hojeDoResumo: string, hojeDoSim: string, peloResumo = false) {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const ctx = (turno: number, mensagem: string, hoje: string): Contexto =>
    ({ ...criarContexto(mundo, cofre, turno, mensagem, hoje), historico: [{ role: "user", content: "sou Ana Lima" }] });
  const argumentos = { ...DADOS, checkin, checkout };
  await cotarEstadia.executar(argumentos, ctx(1, "quanto fica?", hojeDoResumo));
  const resumo = await montarResumo.executar(argumentos, ctx(1, "quero fechar", hojeDoResumo));
  expect(resumo.paraOModelo).toMatchObject({ resumo_apresentado: true });
  const sim = peloResumo
    ? await montarResumo.executar(argumentos, ctx(2, "sim", hojeDoSim))
    : await confirmarReserva.executar({}, ctx(2, "sim", hojeDoSim));
  return { leads: mundo.leads, pendente: pendenteAberto(estado), sim };
}

describe("confirmação com a data de entrada já passada (L2)", () => {
  it("resumo no dia da entrada e sim no dia seguinte: nada é enviado e o resumo deixa de valer", async () => {
    const { leads, pendente, sim } = await cenario(["15/01/2027", "18/01/2027"], DIA, "2027-01-16");
    expect(leads).toEqual([]);
    expect(pendente).toBeNull();
    expect(JSON.stringify(sim.paraOModelo)).toMatch(/já passou/);
  });

  it("o mesmo pelo caminho do resumo repetido com sim: nada é enviado e o resumo deixa de valer", async () => {
    const { leads, pendente, sim } = await cenario(["15/01/2027", "18/01/2027"], DIA, "2027-01-16", true);
    expect(leads).toEqual([]);
    expect(pendente).toBeNull();
    expect(JSON.stringify(sim.paraOModelo)).toMatch(/já passou/);
  });

  it("controle: o sim no próprio dia da entrada envia um pedido", async () => {
    const { leads, sim } = await cenario(["15/01/2027", "18/01/2027"], DIA, DIA);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18" });
    expect(sim.paraOModelo).toEqual({ registrado: true });
  });

  it("controle: entrada futura, sim dias depois do resumo mas antes da entrada, envia", async () => {
    const { leads, sim } = await cenario(["25/01/2027", "28/01/2027"], DIA, "2027-01-20");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ checkin: "2027-01-25" });
    expect(sim.paraOModelo).toEqual({ registrado: true });
  });
});

describe("confirmação com a data de entrada já passada, no nível do turno (L2)", () => {
  const NOVAS_DATAS = "Essa data de entrada já passou. Quais novas datas você prefere?";
  // Dia D = 15/01/2027. São Paulo é UTC-3: 23h30 de D lá é 02h30 de 16/01 em UTC.
  const D_23H30 = Date.UTC(2027, 0, 16, 2, 30);
  const D_23H45 = Date.UTC(2027, 0, 16, 2, 45);
  const D1_00H30 = Date.UTC(2027, 0, 16, 3, 30);
  let proxima = 0;

  /** Resumo no turno 1 às 23h30 de D (São Paulo) e "sim" no turno 2 no instante `doSim`, pelo relógio da sessão. */
  async function turnos(doSim: number) {
    const mundo = criarMundo();
    const recebidoDaFerramenta: string[] = [];
    // Depois do resultado da ferramenta, o modelo falso só escreve o texto, também quando o
    // loop pede a conferência do rascunho.
    let respondeu = false;
    const modelo: Modelo = async (mensagens) => {
      const ultima = mensagens.at(-1)!;
      if (ultima.role === "tool") recebidoDaFerramenta.push(ultima.content);
      if (ultima.role === "tool" || respondeu) {
        respondeu = true;
        return diz(NOVAS_DATAS);
      }
      return ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", { ...DADOS, checkin: "15/01/2027", checkout: "18/01/2027" }));
    };
    let instante = D_23H30;
    const stub = (env as unknown as Env).SESSAO.getByName(`lead-entrada-passada-v-${++proxima}`);
    await runInDurableObject(stub, (s: Sessao) => { s.dependencias = { modelo, buscar: mundo.buscar, agora: () => instante }; });
    const resumo = await stub.conversar("quero fechar, sou Ana Lima");
    expect(resumo.reply).toMatch(/15\/01\/2027/);
    expect(mundo.leads).toEqual([]);

    instante = doSim;
    const logs: string[] = [];
    const espiado = vi.spyOn(console, "log").mockImplementation((texto) => { logs.push(String(texto)); });
    let saida: { reply: string; handoff: boolean };
    try {
      saida = await stub.conversar("sim");
    } finally {
      espiado.mockRestore();
    }
    const turno = logs.filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, unknown>).find((o) => o.evento === "turno");
    const estado = await runInDurableObject(stub, (_s, state) => {
      const linha = state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = ?", "lead").toArray()[0];
      return JSON.parse(linha!.valor) as EstadoLead;
    });
    return { mundo, saida, turno, estado, recebidoDaFerramenta };
  }

  it("resumo às 23h30 de D e sim às 00h30 de D+1: nada enviado, resumo descartado, handoff falso e pedido de novas datas", async () => {
    const { mundo, saida, turno, estado, recebidoDaFerramenta } = await turnos(D1_00H30);
    expect(mundo.leads).toEqual([]);
    expect(pendenteAberto(estado)).toBeNull();
    expect(saida.handoff).toBe(false);
    expect(turno).toMatchObject({ evento: "turno", contingencia: false, handoff: false });
    expect(recebidoDaFerramenta).toHaveLength(1);
    const resultado = JSON.parse(recebidoDaFerramenta[0]!) as Record<string, unknown>;
    expect(resultado.recusada).toBe(true);
    expect(String(resultado.motivo)).toMatch(/data de entrada já passou/);
    expect(String(resultado.motivo)).toMatch(/novas datas/);
    expect(saida.reply).toBe(NOVAS_DATAS);
  });

  it("controle: o sim às 23h45 do próprio dia D envia 1 pedido e devolve o texto fixo de registrado", async () => {
    const { mundo, saida } = await turnos(D_23H45);
    expect(mundo.leads).toHaveLength(1);
    expect(mundo.leads[0]).toMatchObject({ checkin: "2027-01-15", checkout: "2027-01-18" });
    expect(saida.reply).toMatch(/^Pronto! Seu pedido de reserva foi registrado/);
    expect(saida.handoff).toBe(false);
  });
});
