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
    it(`"${base.trim()}" repetido até 250 caracteres não é sim e responde na hora`, () => {
      const mensagem = `${base.repeat(Math.floor(250 / base.length))}x`;
      expect(lerConfirmacao(mensagem, GRM301)).toBe("outra");
      expect(lerConfirmacao(`${mensagem}?`, GRM301)).toBe("pergunta");
    }, 1000);
  }

  it("sim longo de verdade, abaixo do corte, continua valendo", () => {
    expect(lerConfirmacao("Sim, confirmo, está tudo certo. Pode fechar a reserva, por favor, obrigado!", GRM301)).toBe("sim");
    // Com valores, mesmo iguais aos do resumo, repete o pedido (P13).
    expect(lerConfirmacao("Sim, confirmo o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas. Pode fechar a reserva, por favor, obrigado!", GRM301))
      .toBe("hesitacao");
  });
});

describe("segunda, nova ou outra reserva: com demonstrativo e resumo antigo repetem o pedido (P13); sem demonstrativo não são sim", () => {
  for (const mensagem of ["Sim, confirmo essa segunda reserva também.", "confirmo esta nova reserva", "confirmo essa outra reserva", "I confirm this second booking"]) {
    it(`repete o pedido: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("hesitacao"));
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

  // Valor do resumo repetido fora de um sim também derruba (B2).
  for (const mensagem of ["o GRM-301 aceita pet?", "para 2 pessoas mesmo, certo?"]) {
    it(`derruba: "${mensagem}"`, () => {
      const { cofre, estado } = cofreCom(GRM301);
      expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", mensagem)).toBeUndefined();
      expect(estado().pendente).toBeNull();
    });
  }

  for (const mensagem of ["tem wifi?", "qual o horário do check-in?", "aceita pet?"]) {
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

describe("mensagem acima de 300 caracteres não é lida como confirmação (A6)", () => {
  it("8.000 dígitos: não é sim e derruba o resumo no rearme", () => {
    const enorme = "1".repeat(8000);
    expect(lerConfirmacao(enorme, GRM301)).toBe("outra");
    let estado: EstadoLead = { ...ESTADO_INICIAL, pendente: GRM301 };
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", enorme)).toBeUndefined();
    expect(estado.pendente).toBeNull();
  });

  it("sim repetido até passar de 300 caracteres não envia", () => {
    expect(lerConfirmacao("sim, confirmo. ".repeat(21), GRM301)).toBe("outra");
  });
});

describe("todo pedido de confirmação gerado por código traz o resumo inteiro (L10)", () => {
  const LINHAS = ["Resumo do seu pedido de reserva:", "- Imóvel: GRM-301", "- Entrada: sexta-feira, 15/01/2027", "- Saída: segunda-feira, 18/01/2027 (3 noites)",
    "- Hóspedes: 2", "- Nome: Ana Lima", "- Telefone: (11) 98888-0000", "- Total: R$ 2.156,00", "Para confirmar, responda \"sim\""];

  it("rearme no fim do turno", () => {
    let estado: EstadoLead = { ...ESTADO_INICIAL, pendente: GRM301 };
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const pedido = pedidoDeConfirmacaoPendente(cofre, 3, "pt", "tem wifi?")!;
    for (const linha of LINHAS) expect(pedido).toContain(linha);
  });

  it("depois de hesitação", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    await montarResumo.executar({ imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
      criarContexto(mundo, cofre, 2, "quero fechar"));
    const r = await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, "acho que sim"));
    for (const linha of LINHAS.map((l) => l.replace("GRM-301", "Chalé"))) expect(r.respostaFinal).toContain(linha.startsWith("- Imóvel") ? "(GRM-301)" : linha);
    expect(mundo.leads).toEqual([]);
  });
});

describe("rearme negado por padrão: mensagem com sinal de mudança derruba o resumo, e o sim seguinte não envia (A1, A2, A5)", () => {
  const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
  async function comResumo() {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number, mensagem: string) => criarContexto(mundo, cofre, turno, mensagem);
    await montarResumo.executar(DADOS, ctx(2, "quero fechar"));
    return { mundo, cofre, estado: () => estado, confirma: (turno: number, mensagem: string) => confirmarReserva.executar({}, ctx(turno, mensagem)) };
  }

  // A1: hesitação com dado novo não repete o pedido: derruba o resumo.
  for (const mensagem of ["acho que sim, mas somos 3", "pode ser no outro apartamento", "acho que sim, com o telefone (11) 97777-0000"]) {
    it(`hesitação com dado: "${mensagem}"`, async () => {
      const s = await comResumo();
      const r = await s.confirma(3, mensagem);
      expect(r.respostaFinal).toBeUndefined();
      expect(s.estado().pendente).toBeNull();
      await s.confirma(4, "Sim, confirmo.");
      expect(s.mundo.leads).toEqual([]);
    });
  }

  // A2: rearme no fim de um turno escrito pelo modelo.
  for (const mensagem of ["vamos ser três", "minha esposa também vai", "a saída é no domingo", "o nome é Ana Souza"]) {
    it(`rearme com dado: "${mensagem}"`, async () => {
      const s = await comResumo();
      expect(pedidoDeConfirmacaoPendente(s.cofre, 3, "pt", mensagem)).toBeUndefined();
      expect(s.estado().pendente).toBeNull();
      await s.confirma(4, "Sim, confirmo.");
      expect(s.mundo.leads).toEqual([]);
    });
  }

  // A5: "confirmo com as novas datas" logo depois do primeiro resumo.
  it("\"confirmo com as novas datas\" logo depois do primeiro resumo não envia: repete o pedido com o resumo (A5, P13)", async () => {
    const s = await comResumo();
    const r = await s.confirma(3, "confirmo com as novas datas");
    expect(r.respostaFinal).toContain("- Total: R$ 2.156,00");
    expect(s.estado().pendente).not.toBeNull();
    expect(s.mundo.leads).toEqual([]);
  });

  it("\"de novo\" é outra vez, não dado novo: o sim confirma", async () => {
    const s = await comResumo();
    await s.confirma(3, "Sim, confirmo de novo!");
    expect(s.mundo.leads).toHaveLength(1);
  });
});

describe("sim só com caracteres comuns; \"?\" só com verbo de envio (A4)", () => {
  const ESTRANHOS = ["sim❓", "sim❔", "sim﹖", "sim⁇", "sim‽", "sim;", "¿sim", "sim 🤔", "sim 👎", "sim ❌"]; // "confirmo 👍" confirma desde a P15
  for (const mensagem of ESTRANHOS) {
    it(`repete o pedido: ${JSON.stringify(mensagem)}`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("hesitacao"));
  }
  it("\"sim, pode?\" é pergunta; com o verbo de envio é sim", () => {
    expect(lerConfirmacao("sim, pode?", GRM301)).toBe("pergunta");
    expect(lerConfirmacao("Sim, confirmo! Pode fechar a reserva, por favor?", GRM301)).toBe("sim");
  });
  it("sinal de mudança junto de emoji derruba", () => expect(lerConfirmacao("sim 🤔 somos 3", GRM301)).toBe("outra"));
  it("a lista só pesa sobre o sim: recusa e pergunta com emoji seguem como eram", () => {
    expect(lerConfirmacao("não 👎", GRM301)).toBe("outra");
    expect(lerConfirmacao("tem wifi? 😊", GRM301)).toBe("pergunta");
  });
  it("letra ou marca que a gramática descarta também não passa", () => {
    for (const mensagem of ["sim\u0294", "sim\u20E0", "sim\u02BC"]) expect(lerConfirmacao(mensagem, GRM301)).toBe("hesitacao");
  });
  it("pergunta longa com sinal de mudança derruba (o sinal vem antes do corte de 120)", () => {
    expect(lerConfirmacao(`antes de fechar, ${"me conta uma coisa sobre o bairro e o acesso, ".repeat(3)}dá para ir com a minha esposa?`, GRM301)).toBe("outra");
  });
  it("acentos, apóstrofo e o \"sim\" entre aspas continuam limpos", () => {
    for (const mensagem of ["Sí", "that's correct", "\"sim\"", "Sim, confirmo, está tudo certo."]) expect(lerConfirmacao(mensagem, GRM301)).toBe("sim");
  });
  it("nenhum deles envia: o sim estranho só repete o pedido com o resumo", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number, mensagem: string) => criarContexto(mundo, cofre, turno, mensagem);
    await montarResumo.executar({ imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" }, ctx(2, "quero fechar"));
    let turno = 3;
    for (const mensagem of [...ESTRANHOS, "sim, pode?"]) {
      const r = await confirmarReserva.executar({}, ctx(turno++, mensagem));
      if (r.respostaFinal) expect(r.respostaFinal).toContain("- Total: R$ 2.156,00");
    }
    expect(mundo.leads).toEqual([]);
  });
});

describe("P11: \"s\" e \"ok\" sozinhos repetem o pedido; \"isso\", \"exato\" e \"pode\" confirmam", () => {
  for (const mensagem of ["s", "S", "s.", "ok"]) {
    it(`hesitação: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("hesitacao"));
  }
  for (const mensagem of ["isso", "exato", "pode", "Isso!", "Exato."]) {
    it(`sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("sim"));
  }
});

describe("P13: sim com palavra de referência ou de novidade, sem dado novo", () => {
  const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
  function sessao() {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number, mensagem: string) => criarContexto(mundo, cofre, turno, mensagem);
    return {
      mundo,
      estado: () => estado,
      resumo: (turno: number, dados: Record<string, unknown> = DADOS) => montarResumo.executar(dados, ctx(turno, "quero fechar")),
      confirma: (turno: number, mensagem: string) => confirmarReserva.executar({}, ctx(turno, mensagem)),
    };
  }

  // Item 1: palavra que só aponta para o resumo mostrado.
  for (const mensagem of ["Sim, pode enviar esse pedido", "Confirmo esse resumo", "Sim, confirmo essa reserva", "Sim, com esses dados",
    "pode enviar esse pedido", "confirmo esse resumo"]) {
    it(`confirma: "${mensagem}"`, async () => {
      const s = sessao();
      await s.resumo(2);
      expect((await s.confirma(3, mensagem)).respostaFinal).toMatch(/registrado/);
      expect(s.mundo.leads).toHaveLength(1);
    });
  }

  it("lead-04: datas trocadas no turno 2, \"Sim, confirmo com as novas datas.\" no 3 envia as datas novas", async () => {
    const s = sessao();
    await s.resumo(1);
    await s.resumo(2, { ...DADOS, checkout: "17/01/2027" });
    expect((await s.confirma(3, "Sim, confirmo com as novas datas.")).respostaFinal).toMatch(/registrado/);
    expect(s.mundo.leads).toMatchObject([{ checkout: "2027-01-17" }]);
  });

  it("lead-07: segunda reserva pedida no turno 3, \"Sim, confirmo essa segunda reserva também.\" no 4 envia", async () => {
    const s = sessao();
    await s.resumo(1);
    await s.confirma(2, "Sim, confirmo.");
    await s.resumo(3, { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 });
    expect((await s.confirma(4, "Sim, confirmo essa segunda reserva também.")).respostaFinal).toMatch(/registrado/);
    expect(s.mundo.leads).toHaveLength(2);
  });

  it("palavra de novidade com resumo antigo (repetido, não criado no turno anterior): repete o pedido, zero POST", async () => {
    const s = sessao();
    await s.resumo(1);
    await s.resumo(2, { ...DADOS, checkout: "17/01/2027" });
    await s.confirma(3, "acho que sim"); // repete o pedido: o resumo não é mais novo
    const r = await s.confirma(4, "Sim, confirmo com as novas datas.");
    expect(r.respostaFinal).toContain("- Total:");
    expect(s.estado().pendente).not.toBeNull();
    expect(s.mundo.leads).toEqual([]);
  });

  for (const mensagem of ["Sim, confirmo, telefone (11) 98888-0000", "Sim, confirmo de 15/01/2027 a 18/01/2027", "Sim, confirmo para 2 pessoas"]) {
    it(`sim com valor igual ao do resumo repete o pedido com o resumo, zero POST: "${mensagem}"`, async () => {
      const s = sessao();
      await s.resumo(2);
      const r = await s.confirma(3, mensagem);
      expect(r.respostaFinal).toContain("- Total: R$ 2.156,00");
      expect(s.estado().pendente).not.toBeNull();
      expect(s.mundo.leads).toEqual([]);
    });
  }

  it("\"segunda\" como data continua sendo data: derruba quando não é dia do resumo, repete quando é", () => {
    const quartaASexta: Pendente = { ...GRM301, reserva: { ...GRM301.reserva, checkin: "2027-01-20", checkout: "2027-01-22" } };
    for (const mensagem of ["sim, na segunda", "sim, entrada segunda-feira", "sim, segunda que vem"]) {
      expect(lerConfirmacao(mensagem, quartaASexta, 3)).toBe("outra");
    }
    // No GRM-301 a saída é numa segunda-feira: valor igual, repete o pedido.
    expect(lerConfirmacao("sim, na segunda", GRM301, 3)).toBe("hesitacao");
  });
});

describe("B1: a hesitação não engole a mudança; só é hesitação o que, sem as palavras de hesitação, fica vazio ou é sim", () => {
  const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
  for (const mensagem of ["acho que sim, mas no mês que vem", "talvez, só eu", "pode ser, mas sem o pet", "acho que sim, sobrenome Souza",
    "acho que sim, mas na semana que vem", "maybe next month", "acho que sim, mas posterga", "talvez, mas é Ana Lima Souza", "não sei, sozinho",
    "pode ser mais tarde"]) {
    it(`derruba, e o sim seguinte não envia: "${mensagem}"`, async () => {
      const mundo = criarMundo();
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      const ctx = (turno: number, m: string) => criarContexto(mundo, cofre, turno, m);
      await montarResumo.executar(DADOS, ctx(2, "quero fechar"));
      expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("outra");
      await confirmarReserva.executar({}, ctx(3, mensagem));
      await confirmarReserva.executar({}, ctx(4, "sim"));
      expect(mundo.leads).toEqual([]);
    });
  }
  for (const mensagem of ["acho que sim", "Acho que sim, talvez pode ser.", "pode ser", "talvez", "não sei ainda", "I think so", "not sure", "acho que sim, ok"]) {
    it(`continua hesitação: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("hesitacao"));
  }
});

describe("P15: formas de confirmação", () => {
  const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
  for (const mensagem of ["tá ótimo, confirma", "Sim! 😊", "sim 👍", "manda ver", "bora", "isso aí", "show, pode mandar", "beleza, confirma", "confirma",
    "sim, quero", "quero sim", "perfect, go ahead", "please confirm", "all correct", "confirme", "confirm", "correct", "go ahead", "Sim 🙏", "confirmo ✅"]) {
    it(`envia: "${mensagem}"`, async () => {
      const mundo = criarMundo();
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
      expect((await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, mensagem))).respostaFinal).toMatch(/registrado|registered/);
      expect(mundo.leads).toHaveLength(1);
    });
  }
  for (const mensagem of ["👍", "😊", "ok", "perfeito", "ótimo", "tá ótimo", "beleza", "show", "perfect", "great", "sim 🤔", "sim ❓"]) {
    it(`repete o pedido com o resumo, sem derrubar: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("hesitacao"));
  }
  it("\"confirma?\" continua pergunta", () => expect(lerConfirmacao("confirma?", GRM301, 3)).toBe("pergunta"));
});

describe("B4: referência confirma; valor por extenso igual repete o pedido, diferente derruba", () => {
  for (const mensagem of ["sim, esse pedido", "sim, esse resumo", "sim, essa reserva", "sim, esses dados"]) {
    it(`sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("sim"));
  }
  // Resumo GRM-301: entrada sexta-feira 15/01/2027, saída segunda-feira 18/01/2027, 2 hóspedes, 3 noites.
  for (const mensagem of ["sim, dois hóspedes", "sim, duas pessoas", "sim, sexta", "sim, sexta-feira", "sim, janeiro", "sim, três noites", "sim, segunda-feira"]) {
    it(`repete o pedido: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("hesitacao"));
  }
  for (const mensagem of ["sim, três hóspedes", "sim, sábado", "sim, fevereiro", "sim, duas noites"]) {
    it(`derruba: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301, 3)).toBe("outra"));
  }
});
