import { describe, expect, it } from "vitest";
import { type Contexto } from "../src/agente/ferramentas";
import { cotarEstadia } from "../src/agente/ferramentas/cotacao";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, pendenteAberto } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

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
