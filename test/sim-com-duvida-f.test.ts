// Sim acompanhado de anúncio de dúvida ou de pergunta não é confirmação limpa (C10 da quinta rodada do
// verificador, decisão provisória P19): nada é enviado no turno. O bloco "C10" é o do verificador, como está.
// A regressão veio da retirada de "uma dúvida" e "só uma pergunta" antes da leitura do sim: sobrava um sim limpo.
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, lerConfirmacao, type Pendente, pedidoDeConfirmacaoPendente } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600, turno: 2,
};

describe("C10: um sim seguido do anúncio de uma dúvida envia o lead (regressão do C9, a9c8a8f)", () => {
  // Na rodada 4 (7a3f50d) todas estas mensagens davam "outra" e nada era enviado: o "uma" era sinal de
  // número. Agora "uma dúvida", "uma pergunta" e "só uma pergunta" saem do texto antes da leitura do sim
  // (src/lead.ts:466), e sobra um sim limpo. O hóspede avisou que tem uma dúvida e o lead já saiu (L9:
  // "Outra pergunta: responde e repete o pedido de confirmação; nada é enviado").
  for (const mensagem of [
    "sim, uma dúvida", "sim, só uma pergunta", "Sim. Uma pergunta:", "sim! uma dúvida...", "pode fechar, uma dúvida",
    "confirmo, só uma pergunta", "sim, confirmo. uma dúvida", "Sim! Só uma pergunta 😊", "sim\numa dúvida", "uma dúvida: sim",
  ]) {
    it(`${JSON.stringify(mensagem)}: nenhum POST no turno`, async () => {
      const mundo = criarMundo();
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
      const r = await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, mensagem));
      expect(r.respostaFinal ?? "").not.toMatch(/registrado/);
      expect(mundo.leads).toEqual([]);
    });
  }
});

describe("sim com anúncio de dúvida: as outras formas que enviavam na quinta rodada", () => {
  for (const mensagem of [
    "sim uma duvida", "pode fechar sim, uma pergunta", "confirmo. uma dúvida", "uma pergunta, sim", "confirma, uma pergunta", "bora, uma dúvida",
    "perfeito, confirmo, uma pergunta", "sim, uma pergunta", "Sim, só uma dúvida", "sim, tenho uma dúvida", "sim, uma última pergunta", "sim, mas uma dúvida",
  ]) {
    it(`${JSON.stringify(mensagem)} não é sim`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).not.toBe("sim"));
  }
});

describe("C10, dano em dois turnos: o sim com dúvida não envia, e só sai o lead do resumo refeito", () => {
  const casos: [string, string, Record<string, unknown>, Record<string, unknown>][] = [
    ["sim, uma dúvida", "somos 3, pode?", { ...DADOS, hospedes: 3 }, { hospedes: 3, checkin: "2027-01-15" }],
    ["sim, só uma pergunta", "dá pra trocar a entrada pro dia 16?", { ...DADOS, checkin: "16/01/2027" }, { hospedes: 2, checkin: "2027-01-16" }],
  ];
  for (const [primeira, depois, novo, esperado] of casos) {
    it(`${JSON.stringify(primeira)} e depois ${JSON.stringify(depois)}: um lead só, com o dado novo`, async () => {
      const mundo = criarMundo();
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
      // Turno 3: sim com anúncio de dúvida. Nada sai, pelo confirmar_reserva nem pelo rearme do fim do turno.
      const t3 = await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, primeira));
      expect(t3.respostaFinal ?? "").not.toMatch(/registrado/);
      expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", primeira)).toBeUndefined();
      expect(mundo.leads).toEqual([]);
      // Turno 4: a dúvida anunciada muda um dado, e o modelo monta o resumo novo. Turno 5: "sim".
      const t4 = await montarResumo.executar(novo, criarContexto(mundo, cofre, 4, depois));
      expect(t4.respostaFinal ?? "").toMatch(/^Resumo do seu pedido de reserva:/);
      const t5 = await confirmarReserva.executar({}, criarContexto(mundo, cofre, 5, "sim"));
      expect(t5.respostaFinal ?? "").toMatch(/registrado/);
      expect(mundo.leads).toHaveLength(1);
      expect(mundo.leads[0]).toMatchObject(esperado);
    });
  }
});
