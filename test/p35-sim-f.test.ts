// P35: formas naturais de confirmar que a gramática fechada do sim não tinha, da mesma classe
// que a L9 e a P13 já aceitam. Cada forma nova tem a matriz negativa (frente F).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, lerConfirmacao, type Pendente } from "../src/lead";
import { chamar, criarContexto, criarMundo, pedeFerramentas, roteiro } from "./apoio";
import { comAnteriores } from "./apoio-f";
import { conversa } from "./apoio-g";

const RESERVA = { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
// Primeiro resumo da conversa (turno 2) e resumo novo, que substituiu outro no turno anterior (turno 4).
const PRIMEIRO: Pendente = { reserva: RESERVA, totalCentavos: 215600, turno: 2, criadoEm: 2, ordem: 1 };
const NOVO: Pendente = { ...PRIMEIRO, turno: 4, criadoEm: 4, ordem: 2 };
const sim = (mensagem: string, pendente = NOVO) => lerConfirmacao(mensagem, pendente, pendente.turno + 1);

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const LEAD = { nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156 };

const REVELADAS = {
  um: "Pode fechar, confirmo os dados do resumo.",
  dois: "Confirmo também esse segundo pedido.",
  tres: "Sim, confirmo o resumo e autorizo encaminhar o pedido.",
  quatro: "Confirmo, pode encaminhar o pedido pelo valor normal.",
};

// Uma frase de base por forma nova: (a) a (e).
const FORMAS: Record<string, string> = {
  "a: os dados do resumo": "Pode fechar, confirmo os dados do resumo",
  "a: os dados do pedido": "confirmo os dados do pedido",
  "b: esse segundo pedido": "Confirmo esse segundo pedido",
  "b: também + esse novo pedido": "Confirmo também esse novo pedido",
  "b: também + este outro pedido": "confirmo também este outro pedido",
  "b: também + essa segunda reserva": "Confirmo também essa segunda reserva",
  "c: pode encaminhar o pedido": "Confirmo, pode encaminhar o pedido",
  "d: confirmo o resumo e pode enviar o pedido": "Sim, confirmo o resumo e pode enviar o pedido",
  "e: autorizo encaminhar o pedido": "Sim, autorizo encaminhar o pedido",
  "e: autorizo o envio do pedido": "autorizo o envio do pedido",
};

describe("P35: as frases reveladas", () => {
  it("1 e 3 dão sim com o resumo do turno anterior", () => {
    expect(sim(REVELADAS.um, PRIMEIRO)).toBe("sim");
    expect(sim(REVELADAS.tres, PRIMEIRO)).toBe("sim");
  });
  it("2 dá sim só com o segundo resumo novo; com o primeiro resumo repete o pedido (P13)", () => {
    expect(sim(REVELADAS.dois, NOVO)).toBe("sim");
    expect(sim(REVELADAS.dois, PRIMEIRO)).toBe("hesitacao");
  });
  it("4 não dá sim: palavra de valor junto do sim", () => {
    expect(sim(REVELADAS.quatro, PRIMEIRO)).not.toBe("sim");
    expect(sim("Confirmo, pode encaminhar o pedido.", PRIMEIRO)).toBe("sim");
  });
});

describe("P35: cada forma nova confirma sozinha", () => {
  for (const [forma, frase] of Object.entries(FORMAS)) {
    it(`${forma}: "${frase}"`, () => expect(sim(frase)).toBe("sim"));
  }
  it("forma com novidade, com o primeiro resumo da conversa, repete o pedido (P13)", () => {
    for (const frase of ["Confirmo esse segundo pedido", "Confirmo também esse novo pedido", "confirmo este outro pedido"]) {
      expect(sim(frase, PRIMEIRO), frase).toBe("hesitacao");
    }
  });
});

// Acréscimos que tiram a frase do sim: valor (mesmo igual ao do resumo), pergunta, mudança,
// hesitação, condição de preço e sobra depois da forma.
const DEPOIS = [
  " para 2 pessoas", " para 3 pessoas", " de 15/01/2027 a 18/01/2027", " em janeiro", " na sexta", " Ana Lima",
  " (11) 98888-0000", " GRM-301", " RIO-402", ", tem wifi?", "? tem estacionamento?", ", mas muda a saída",
  " para outra data", " e mudo a data", ", se fizer desconto", " pelo valor normal", " pelo preço combinado", " anterior",
  " da minha irmã", " para outro telefone", " de novo amanhã", " ou não", " sem o café",
];
const ANTES = ["acho que ", "talvez ", "não sei, ", "se baixar o preço, "];

describe("P35: matriz negativa, nenhuma variação de uma forma nova é sim", () => {
  for (const [forma, frase] of Object.entries(FORMAS)) {
    it(forma, () => {
      const variacoes = [...DEPOIS.map((d) => frase + d), ...ANTES.map((a) => a + frase.toLowerCase())];
      const furos = variacoes.filter((v) => sim(v) === "sim" || sim(v, PRIMEIRO) === "sim");
      expect(furos).toEqual([]);
    });
  }
  it("sobras citadas na P35", () => {
    for (const frase of [
      "Pode fechar, confirmo os dados do resumo anterior", "Confirmo também esse segundo pedido da minha irmã",
      "Confirmo, pode encaminhar para outro telefone", "autorizo encaminhar o pedido para outra data",
      "Sim, confirmo o resumo e mudo a data", "confirmo os dados do resumo e do outro", "autorizo encaminhar",
      "autorizo o pedido", "autorizo enviar o resumo", "confirmo o resumo e", "e confirmo",
    ]) expect(sim(frase), frase).not.toBe("sim");
  });
});

/** Sessão pelas ferramentas: resumo de outra saída (turno 1), o resumo do pedido (turno 2) e a mensagem (turno 3). */
async function confirmarComDoisResumos(mensagem: string) {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const ctx = (turno: number, m: string) => comAnteriores(criarContexto(mundo, cofre, turno, m), "sou Ana Lima");
  await montarResumo.executar({ ...DADOS, checkout: "19/01/2027" }, ctx(1, "quero fechar"));
  await montarResumo.executar(DADOS, ctx(2, "na verdade até dia 18"));
  await confirmarReserva.executar({}, ctx(3, mensagem));
  return mundo.leads;
}

describe("P35: nenhum POST nas variações negativas", () => {
  for (const [forma, frase] of Object.entries(FORMAS)) {
    it(forma, async () => {
      for (const v of [...DEPOIS.map((d) => frase + d), ...ANTES.map((a) => a + frase.toLowerCase())]) {
        expect(await confirmarComDoisResumos(v), v).toEqual([]);
      }
      expect(await confirmarComDoisResumos(frase)).toEqual([LEAD]);
    });
  }
});

describe("P35: pelo laço, com o webhook falso", () => {
  for (const frase of [REVELADAS.um, REVELADAS.tres]) {
    it(`${JSON.stringify(frase)}: 1 POST com os 7 campos do resumo`, async () => {
      const { turno, mundo } = conversa();
      await turno("quero fechar, sou Ana Lima", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
      const saida = await turno(frase, roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
      expect(mundo.leads).toEqual([LEAD]);
      expect(saida.reply).toMatch(/registrado/i);
    });
  }

  it("frase 2: o segundo pedido, com o resumo novo do turno anterior, gera 1 POST dele", async () => {
    const { turno, mundo } = conversa();
    await turno("quero fechar, sou Ana Lima", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    await turno("quero outra, de 20/01/2027 a 22/01/2027", roteiro(pedeFerramentas(chamar("montar_resumo", { ...DADOS, checkin: "20/01/2027", checkout: "22/01/2027" }))).modelo);
    const saida = await turno(REVELADAS.dois, roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toHaveLength(2);
    expect(mundo.leads[1]).toEqual({ ...LEAD, checkin: "2027-01-20", checkout: "2027-01-22", valor_total: 1330 });
    expect(saida.reply).toMatch(/registrado/i);
  });

  it("frase 2 com o primeiro resumo da conversa: 0 POST e o resumo repetido", async () => {
    const { turno, mundo } = conversa();
    await turno("quero fechar, sou Ana Lima", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    const saida = await turno(REVELADAS.dois, roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toEqual([]);
    expect(saida.reply).toContain("Resumo do seu pedido");
  });

  for (const ferramenta of ["confirmar_reserva", "montar_resumo"] as const) {
    it(`frase 4 com o modelo chamando ${ferramenta}: 0 POST`, async () => {
      const { turno, mundo } = conversa();
      await turno("quero fechar, sou Ana Lima", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
      const chamada = ferramenta === "montar_resumo" ? chamar("montar_resumo", DADOS) : chamar("confirmar_reserva");
      const saida = await turno(REVELADAS.quatro, roteiro(pedeFerramentas(chamada), pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
      expect(mundo.leads).toEqual([]);
      expect(saida.reply).toContain("Resumo do seu pedido");
      expect(saida.reply).toContain("R$ 2.156,00");
    });
  }
});
