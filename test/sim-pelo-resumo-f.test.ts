// Sim limpo ao resumo do turno anterior, com o modelo pedindo o mesmo resumo de novo em vez
// de confirmar: a chamada de montar_resumo vale como a confirmação, pelo caminho dela (frente F).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, pendenteAberto } from "../src/lead";
import { chamar, criarContexto, criarMundo, diz, FICHAS, pedeFerramentas, roteiro } from "./apoio";
import { comAnteriores } from "./apoio-f";
import { conversa } from "./apoio-g";

// Imóvel de teste que acomoda o grupo do caso (6 e depois 8 pessoas).
const fichas = { ...FICHAS, "BMB-202": { ...FICHAS["GRM-301"], id: "BMB-202", nome: "Casa de Teste", capacidade: 10 } };
const ESTADIA = { imovel_id: "BMB-202", checkin: "15/01/2027", checkout: "18/01/2027" };
const PESSOA = { nome: "Eduarda Lucas Lima", telefone: "(11) 98888-0000" };
const APRESENTACAO = "Vou fechar. Meu nome é Eduarda Lucas Lima e meu telefone é (11) 98888-0000";
const resumoDe = (hospedes: number, outros: Record<string, unknown> = {}) =>
  chamar("montar_resumo", { ...ESTADIA, ...PESSOA, hospedes, ...outros });
const confirma = () => chamar("confirmar_reserva");
const LEAD = {
  nome: "Eduarda Lucas Lima", telefone: "(11) 98888-0000", imovel_id: "BMB-202",
  checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 8, valor_total: 2156,
};

/** Os três primeiros turnos do caso: cotação para 6, resumo para 6 e troca para 8, com resumo novo e sem envio. */
async function ateOResumoDeOito(opcoes: Parameters<typeof conversa>[0] = {}) {
  const c = conversa({ fichas, ...opcoes });
  await c.turno(
    "quanto fica o BMB-202 de 15/01/2027 a 18/01/2027 para 6?",
    roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, hospedes: 6 })), diz("Fica R$ 2.156,00.")).modelo,
  );
  await c.turno(APRESENTACAO, roteiro(pedeFerramentas(resumoDe(6))).modelo);
  const troca = await c.turno("Sim, pode confirmar! Ah, troca para 8 hóspedes em vez de 6.", roteiro(pedeFerramentas(resumoDe(8))).modelo);
  expect(troca.reply).toContain("Hóspedes: 8");
  expect(c.mundo.leads).toEqual([]);
  return c;
}

describe("sim limpo com o modelo pedindo o mesmo resumo de novo (pelo laço)", () => {
  it("(a) vale como a confirmação: 1 POST, resposta de registrado, lead com 8 hóspedes", async () => {
    const c = await ateOResumoDeOito();
    const r = roteiro(pedeFerramentas(resumoDe(8)));
    const sim = await c.turno("Sim, confirmo.", r.modelo);
    expect(c.mundo.leads).toEqual([LEAD]);
    expect(sim.reply).toMatch(/registrado/i);
    expect(sim.reply).toContain("R$ 2.156,00");
    expect(sim.reply).not.toContain("Resumo do seu pedido");
    expect(sim.handoff).toBe(false);
    expect(r.recebidas).toHaveLength(1);
  });

  const DIFERENTES: [caso: string, chamada: ReturnType<typeof resumoDe>, noResumo: string][] = [
    ["outro número de hóspedes", resumoDe(7), "Hóspedes: 7"],
    ["outra saída", resumoDe(8, { checkout: "19/01/2027" }), "19/01/2027"],
    ["outro telefone", resumoDe(8, { telefone: "(11) 97777-0000" }), "(11) 97777-0000"],
    ["outro nome", resumoDe(8, { nome: "Eduarda Lima" }), "Nome: Eduarda Lima\n"],
    ["outro imóvel", resumoDe(4, { imovel_id: "GRM-301" }), "(GRM-301)"],
  ];
  for (const [caso, chamada, noResumo] of DIFERENTES) {
    it(`(b) ${caso}: resumo novo, 0 POST`, async () => {
      const c = await ateOResumoDeOito();
      const sim = await c.turno("Sim, confirmo.", roteiro(pedeFerramentas(chamada)).modelo);
      expect(c.mundo.leads).toEqual([]);
      expect(sim.reply).toContain("Resumo do seu pedido");
      expect(sim.reply).toContain(noResumo);
      expect(sim.reply).not.toMatch(/registrado/i);
    });
  }

  for (const mensagem of ["sim, e tem wifi?", "acho que sim", "sim, mas antes uma dúvida", "pode ser", "ok"]) {
    it(`(c) ${JSON.stringify(mensagem)} não é sim limpo: 0 POST, o resumo é mostrado de novo`, async () => {
      const c = await ateOResumoDeOito();
      const saida = await c.turno(mensagem, roteiro(pedeFerramentas(resumoDe(8))).modelo);
      expect(c.mundo.leads).toEqual([]);
      // Como antes: o pedido de resumo mostra o resumo, sem passar pela confirmação.
      expect(saida.reply.startsWith("Resumo do seu pedido")).toBe(true);
      expect(saida.reply).not.toMatch(/registrado/i);
    });
  }

  it("(e) resumo e confirmação pedidos na mesma resposta do modelo: 1 POST só, em qualquer ordem", async () => {
    for (const chamadas of [[resumoDe(8), confirma()], [confirma(), resumoDe(8)]]) {
      const c = await ateOResumoDeOito();
      const sim = await c.turno("Sim, confirmo.", roteiro(pedeFerramentas(...chamadas)).modelo);
      expect(c.mundo.leads).toEqual([LEAD]);
      expect(sim.reply).toMatch(/registrado/i);
    }
  });

  it("(f) depois de registrado, outro sim não envia de novo, nem com o modelo pedindo o resumo outra vez", async () => {
    const c = await ateOResumoDeOito();
    await c.turno("Sim, confirmo.", roteiro(pedeFerramentas(resumoDe(8))).modelo);
    // Sim repetido logo depois: texto fixo, sem chamada ao modelo.
    const repetido = await c.turno("sim", roteiro().modelo);
    expect(repetido.reply).toContain("já está registrado");
    await c.turno("tem wifi?", roteiro(diz("Tem wifi.")).modelo);
    const depois = await c.turno("sim, confirmo", roteiro(pedeFerramentas(resumoDe(8))).modelo);
    expect(depois.reply).toContain("já está registrado");
    expect(c.mundo.leads).toEqual([LEAD]);
  });

  it("mesmas travas do confirmar_reserva: webhook 500 não diz registrado e passa para humano", async () => {
    const c = await ateOResumoDeOito({ statusDoWebhook: 500 });
    const sim = await c.turno("Sim, confirmo.", roteiro(pedeFerramentas(resumoDe(8))).modelo);
    expect(sim.reply).not.toMatch(/registrad/i);
    expect(sim.reply).toContain("Não consegui");
    expect(sim.handoff).toBe(true);
    // L11: a tentativa e uma nova tentativa, como pelo confirmar_reserva.
    expect(c.mundo.leads).toHaveLength(2);
  });
});

describe("sim limpo com o mesmo resumo pedido de novo (pelas ferramentas)", () => {
  const DADOS = { ...ESTADIA, ...PESSOA, hospedes: 8 };
  function sessao(envio: { ligado?: boolean } = {}, statusDoWebhook = 201) {
    const mundo = criarMundo({ fichas, statusDoWebhook });
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number, mensagem: string) => {
      const contexto = comAnteriores(criarContexto(mundo, cofre, turno, mensagem), APRESENTACAO);
      return { ...contexto, envio: { ...contexto.envio, ...envio } };
    };
    return { mundo, estado: () => estado, ctx };
  }

  it("(d) resumo que não foi mostrado no turno anterior: 0 POST, o resumo é mostrado de novo", async () => {
    const s = sessao();
    await montarResumo.executar(DADOS, s.ctx(2, APRESENTACAO));
    const tarde = await montarResumo.executar(DADOS, s.ctx(4, "sim"));
    expect(s.mundo.leads).toEqual([]);
    // Como antes: o pedido de resumo grava e mostra o resumo, sem passar pela confirmação.
    expect(tarde.respostaFinal?.startsWith("Resumo do seu pedido")).toBe(true);
    expect(pendenteAberto(s.estado())?.turno).toBe(4);
  });

  it("no mesmo turno do resumo, a mensagem que parece sim não envia", async () => {
    const s = sessao();
    await montarResumo.executar(DADOS, s.ctx(2, APRESENTACAO));
    await montarResumo.executar(DADOS, s.ctx(2, "sim"));
    expect(s.mundo.leads).toEqual([]);
  });

  const CASOS: [caso: string, envio: { ligado?: boolean }, status: number][] = [
    ["registro", {}, 201],
    ["envio desligado", { ligado: false }, 201],
    ["webhook 500", {}, 500],
    ["webhook 422", {}, 422],
  ];
  for (const [caso, envio, status] of CASOS) {
    it(`mesmo resultado, mesmo estado e mesmos POSTs do confirmar_reserva: ${caso}`, async () => {
      const pelaConfirmacao = sessao(envio, status);
      await montarResumo.executar(DADOS, pelaConfirmacao.ctx(2, APRESENTACAO));
      const esperado = await confirmarReserva.executar({}, pelaConfirmacao.ctx(3, "Sim, confirmo."));

      const peloResumo = sessao(envio, status);
      await montarResumo.executar(DADOS, peloResumo.ctx(2, APRESENTACAO));
      const obtido = await montarResumo.executar(DADOS, peloResumo.ctx(3, "Sim, confirmo."));

      expect(obtido).toEqual(esperado);
      expect(peloResumo.estado()).toEqual(pelaConfirmacao.estado());
      expect(peloResumo.mundo.leads).toEqual(pelaConfirmacao.mundo.leads);
    });
  }
});
