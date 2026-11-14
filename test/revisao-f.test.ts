// Achados da revisão de código sobre a leitura do sim e o fim do lead (frente F).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo, respostaASimAposRegistro } from "../src/agente/ferramentas/lead";
import {
  type Cofre, ESTADO_INICIAL, type EstadoLead, lerConfirmacao, type Pendente, pedidoDeConfirmacaoPendente, pendenteAberto,
} from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600,
  turno: 2,
};

describe("mensagem longa e repetitiva não trava a leitura do sim", () => {
  // Sem o corte por tamanho, cada repetição dobrava o tempo do regex (250 caracteres: dezenas de segundos).
  for (const base of ["pode sim ", "isso mesmo ", "pode confirmar "]) {
    it(`"${base.trim()}" repetido até 300 caracteres não é sim e responde na hora`, () => {
      const mensagem = `${base.repeat(Math.ceil(300 / base.length))}x`;
      expect(lerConfirmacao(mensagem, GRM301)).toBe("outra");
      expect(lerConfirmacao(`${mensagem}?`, GRM301)).toBe("pergunta");
    }, 1000);
  }

  it("sim longo de verdade, abaixo do corte, continua valendo", () => {
    expect(lerConfirmacao("Sim, confirmo o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas. Pode fechar a reserva, por favor, obrigado!", GRM301))
      .toBe("sim");
  });
});

describe("segunda, nova ou outra reserva só confirmam com demonstrativo", () => {
  for (const mensagem of ["Sim, confirmo essa segunda reserva também.", "confirmo esta nova reserva", "confirmo essa outra reserva", "I confirm this second booking"]) {
    it(`é sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("sim"));
  }
  for (const mensagem of ["confirmo a outra reserva", "confirmo a nova reserva", "confirmo a segunda reserva", "confirmo outra reserva", "I confirm the second booking"]) {
    it(`não é sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("outra"));
  }
});

describe("palavra de reconhecimento sozinha repete o pedido, como o ok", () => {
  for (const mensagem of ["perfeito", "Perfeito!", "certo", "claro", "certinho", "perfeito, obrigado", "Certo, valeu!"]) {
    it(`hesitação: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("hesitacao"));
  }
  for (const mensagem of ["perfeito, pode enviar", "certo, confirmo", "claro, pode fechar", "tudo certo"]) {
    it(`com a frase de envio continua sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("sim"));
  }
});

describe("outros pontos de interrogação também fazem pergunta", () => {
  for (const mensagem of ["sim？", "pode fechar؟", "confirmado？"]) {
    it(`pergunta: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("pergunta"));
  }
  it("pergunta com dado novo continua \"outra\"", () => expect(lerConfirmacao("pode ser para 3 pessoas？", GRM301)).toBe("outra"));
});

describe("pedido de confirmação com a mensagem do turno: mudança de dado derruba o resumo (L10)", () => {
  function cofreCom(pendente: Pendente | null) {
    let estado: EstadoLead = { ...ESTADO_INICIAL, pendente };
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    return { cofre, estado: () => estado };
  }

  for (const mensagem of [
    "muda a saída para 19/01", "com as novas datas", "na verdade somos 3", "pode ser de 16/01/2027 a 18/01/2027?",
    "e o GRM-302, quanto fica?", "meu nome é João Pedro", "o telefone é (11) 97777-0000", "mais uma pessoa vem",
    "can we change the dates?", "actually we're 4",
  ]) {
    it(`derruba: "${mensagem}"`, () => {
      const { cofre, estado } = cofreCom(GRM301);
      expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", mensagem)).toBeUndefined();
      expect(estado().pendente).toBeNull();
      // O sim seguinte não acha resumo: nada é enviado.
      expect(pendenteAberto(estado())).toBeNull();
    });
  }

  for (const mensagem of ["tem wifi?", "qual o horário do check-in?", "o GRM-301 aceita pet?", "para 2 pessoas mesmo, certo?"]) {
    it(`mantém e repete o pedido: "${mensagem}"`, () => {
      const { cofre, estado } = cofreCom(GRM301);
      expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", mensagem)).toMatch(/aguarda a sua confirmação/);
      expect(estado().pendente).toMatchObject({ turno: 3 });
    });
  }

  it("sem a mensagem, nada muda: repete o pedido", () => {
    const { cofre } = cofreCom(GRM301);
    expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt")).toMatch(/aguarda a sua confirmação/);
  });

  it("no turno do próprio resumo, a mensagem com as datas novas não derruba o resumo recém-feito", () => {
    const { cofre, estado } = cofreCom({ ...GRM301, turno: 3 });
    expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", "muda para 16/01/2027 a 18/01/2027")).toBeUndefined();
    expect(estado().pendente).not.toBeNull();
  });
});

describe("sim repetido depois do registro: texto fixo de código, zero POST (L7, L15)", () => {
  const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
  async function registrada() {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number, mensagem: string) => criarContexto(mundo, cofre, turno, mensagem);
    await montarResumo.executar(DADOS, ctx(2, "quero fechar"));
    expect((await confirmarReserva.executar({}, ctx(3, "Sim, confirmo."))).respostaFinal).toMatch(/registrado/);
    return { mundo, ctx, posts: () => mundo.leads.length };
  }

  it("sim logo depois do registro: aviso fixo, e de novo no turno seguinte; nenhum POST a mais", async () => {
    const s = await registrada();
    for (const turno of [4, 5]) {
      expect(respostaASimAposRegistro(s.ctx(turno, "Sim, confirmo de novo!")))
        .toBe("Esse pedido (GRM-301, de sexta-feira, 15/01/2027 a segunda-feira, 18/01/2027) já está registrado com o nosso time comercial. Não enviei de novo.");
    }
    expect(s.posts()).toBe(1);
  });

  it("em inglês", async () => {
    const s = await registrada();
    expect(respostaASimAposRegistro(s.ctx(4, "Yes, I confirm again"))).toMatch(/^This request \(GRM-301, .*\) is already registered .*I did not send it again\.$/);
  });

  it("fica com o modelo: outra mensagem, sim com conversa no meio, ou nada registrado", async () => {
    const s = await registrada();
    expect(respostaASimAposRegistro(s.ctx(4, "tem wifi?"))).toBeUndefined();
    expect(respostaASimAposRegistro(s.ctx(6, "sim"))).toBeUndefined();
    const vazio = criarMundo();
    const cofre: Cofre = { ler: () => ESTADO_INICIAL, salvar: () => {} };
    expect(respostaASimAposRegistro(criarContexto(vazio, cofre, 1, "sim"))).toBeUndefined();
  });

  it("resumo de outra reserva em aberto: o sim é dela, não do registro", async () => {
    const s = await registrada();
    await montarResumo.executar({ ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 }, s.ctx(4, "e o RIO-402"));
    expect(respostaASimAposRegistro(s.ctx(5, "sim"))).toBeUndefined();
  });
});
