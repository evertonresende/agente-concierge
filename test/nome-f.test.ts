// O nome do lead só pode ser formado por palavras que o hóspede escreveu (P20, frente F).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, pendenteAberto } from "../src/lead";
import type { Mensagem, Modelo } from "../src/modelo";
import { chamar, criarContexto, criarMundo, diz, pedeFerramentas, roteiro, ultimaDoHospede } from "./apoio";
import { comAnteriores } from "./apoio-f";
import { conversa, ultimoResultado } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const TELEFONE = "(11) 98888-0000";
// A observação é texto do próprio resumo para nome de uma palavra só (L20); o modelo a copiou para dentro do nome.
const INCIDENTE = "Pedro (se puder, me diga também o sobrenome)";
const erroDe = (resultado: { paraOModelo: unknown }) => (resultado.paraOModelo as { erro?: string }).erro ?? "";
const resumoDe = (nome: string) => pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome, telefone: TELEFONE }));

/** Sessão no nível das ferramentas: cada resumo recebe o que o hóspede escreveu antes e a mensagem do turno. */
function sessao() {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const escritas: string[] = [];
  let turno = 0;
  return {
    mundo,
    estado: () => estado,
    /** O hóspede escreve `mensagem` e o modelo pede o resumo com `nome`. */
    resumo(nome: string, mensagem: string) {
      const contexto = comAnteriores(criarContexto(mundo, cofre, ++turno, mensagem), ...escritas);
      escritas.push(mensagem);
      return montarResumo.executar({ ...ESTADIA, nome, telefone: TELEFONE }, contexto);
    },
    /** O hóspede escreve `mensagem` e nenhuma ferramenta é chamada. */
    diz(mensagem: string) { turno++; escritas.push(mensagem); },
    sim: () => confirmarReserva.executar({}, criarContexto(mundo, cofre, ++turno, "sim")),
  };
}

describe("nome que o hóspede não escreveu não vira resumo nem lead (P20)", () => {
  it("o caso do incidente: observação do modelo dentro do nome, com resumo pendente de outro nome", async () => {
    const s = sessao();
    const primeiro = await s.resumo("Marina Teste Duarte", "Sou a Marina Teste Duarte, quero fechar");
    expect(primeiro.respostaFinal).toContain("Marina Teste Duarte");

    const recusado = await s.resumo(INCIDENTE, "o titular é o Pedro tudo bem?");
    expect(recusado.respostaFinal).toBeUndefined();
    expect(erroDe(recusado)).toContain("O nome informado não é o que o hóspede escreveu.");
    expect(erroDe(recusado)).toContain("\"sobrenome\"");
    expect(erroDe(recusado)).not.toContain("\"pedro\"");
    // Como todo pedido de resumo que não virou resumo, derruba o que aguardava o sim (L10).
    expect(pendenteAberto(s.estado())).toBeNull();

    await s.sim();
    expect(s.mundo.leads).toEqual([]);
  });

  const RECUSADOS: [caso: string, nome: string, mensagens: string[]][] = [
    ["observação do resumo em inglês", "Pedro (if you can, please tell me your last name too)", ["the booking is under Pedro"]],
    ["título acrescentado", "Sr. Pedro", ["o titular é o Pedro"]],
    ["sobrenome inventado", "Pedro Silva", ["o titular é o Pedro"]],
    ["nome nunca dito", "Hóspede", ["quero fechar para 2 pessoas"]],
    ["nome de exemplo", "Fulano de Tal", ["oi", "quero fechar"]],
    ["nome sem nenhuma palavra", "(?)", ["quero fechar"]],
    ["pedaço de palavra do hóspede", "Mari", ["sou a Marina"]],
  ];
  for (const [caso, nome, mensagens] of RECUSADOS) {
    it(`recusa ${caso}: "${nome}"`, async () => {
      const s = sessao();
      for (const anterior of mensagens.slice(0, -1)) s.diz(anterior);
      const resultado = await s.resumo(nome, mensagens.at(-1)!);
      expect(resultado.respostaFinal).toBeUndefined();
      expect(erroDe(resultado)).toContain("Use o nome exatamente como o hóspede escreveu");
      expect(pendenteAberto(s.estado())).toBeNull();
      expect(s.mundo.leads).toEqual([]);
    });
  }

  it("o que o modelo ou uma ferramenta escreveu não prova o nome", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const historico: Mensagem[] = [
      { role: "user", content: "oi" },
      { role: "assistant", content: "Olá! Falo com a Ana Lima?" },
      { role: "tool", tool_call_id: "c1", content: JSON.stringify({ nome: "Ana Lima" }) },
    ];
    const contexto = { ...criarContexto(mundo, cofre, 2, "quero fechar"), historico };
    const resultado = await montarResumo.executar({ ...ESTADIA, nome: "Ana Lima", telefone: TELEFONE }, contexto);
    expect(resultado.respostaFinal).toBeUndefined();
    expect(erroDe(resultado)).toContain("\"ana\", \"lima\"");
  });

  it("sem o histórico no contexto, só a mensagem do turno prova o nome", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const dados = { ...ESTADIA, nome: "Ana Lima", telefone: TELEFONE };
    expect((await montarResumo.executar(dados, criarContexto(mundo, cofre, 2, "quero fechar"))).respostaFinal).toBeUndefined();
    expect((await montarResumo.executar(dados, criarContexto(mundo, cofre, 3, "quero fechar, sou Ana Lima"))).respostaFinal).toContain("Ana Lima");
  });

  it("recusa depois de um registro não desfaz o registro", async () => {
    const s = sessao();
    await s.resumo("Marina Teste Duarte", "Sou a Marina Teste Duarte, quero fechar");
    await s.sim();
    expect(s.mundo.leads).toHaveLength(1);
    const recusado = await s.resumo(INCIDENTE, "o titular é o Pedro tudo bem?");
    expect(recusado.respostaFinal).toBeUndefined();
    expect(Object.values(s.estado().envios)).toEqual(["registrado"]);
    expect(s.mundo.leads).toHaveLength(1);
  });
});

describe("nome que o hóspede escreveu continua aceito, como o modelo o passou (L20)", () => {
  const ACEITOS: [caso: string, nome: string, mensagens: string[]][] = [
    ["uma palavra só", "Pedro", ["o titular é o Pedro tudo bem?"]],
    ["frase de apresentação", "Marina Teste Duarte", ["Sou a Marina Teste Duarte"]],
    ["escrito em minúsculas", "Marina Teste Duarte", ["sou marina teste duarte"]],
    ["escrito em maiúsculas", "Marina Teste Duarte", ["MARINA TESTE DUARTE"]],
    ["escrito sem acento", "José Antônio Conceição", ["meu nome e jose antonio conceicao"]],
    ["escrito com acento, passado sem", "Jose Antonio", ["sou o José Antônio"]],
    ["em duas mensagens", "Marina Teste Duarte", ["meu nome é Marina", "o sobrenome é Teste Duarte"]],
    ["dito em turno anterior", "Marina Teste Duarte", ["Sou a Marina Teste Duarte", "tem wifi?", "quero fechar"]],
    ["com partículas", "Maria da Silva dos Santos", ["sou a Maria da Silva dos Santos"]],
    ["com partícula de", "João de Souza e Castro", ["aqui é o João de Souza e Castro"]],
    ["com hífen", "Ana-Clara Pires", ["meu nome é Ana-Clara Pires"]],
    ["com apóstrofo", "Luiza D'Ávila", ["sou a Luiza D'Ávila"]],
    ["com apóstrofo tipográfico", "Luiza D'Ávila", ["sou a Luiza D’Ávila"]],
    ["em inglês", "John O'Connor Smith", ["my name is John O'Connor Smith"]],
    ["com algarismo romano", "João Paulo II", ["sou o João Paulo II"]],
    ["com algarismo romano num caractere só", "João Paulo Ⅱ", ["sou o João Paulo Ⅱ"]],
    ["com sufixo por extenso", "Carlos Jr.", ["aqui é o Carlos Jr."]],
    ["com abreviação", "Maria Ap. Souza", ["meu nome é Maria Ap. Souza"]],
    ["só com apóstrofo", "D'Ávila", ["pode pôr D'Ávila"]],
    ["só com hífen", "Ana-Maria", ["sou a Ana-Maria"]],
  ];
  for (const [caso, nome, mensagens] of ACEITOS) {
    it(`aceita ${caso}: "${nome}"`, async () => {
      const s = sessao();
      for (const anterior of mensagens.slice(0, -1)) s.diz(anterior);
      const resultado = await s.resumo(nome, mensagens.at(-1)!);
      expect(resultado.respostaFinal).toContain(nome);
      expect(pendenteAberto(s.estado())?.reserva.nome).toBe(nome);
    });
  }

  it("nome maior que o corte de 120 caracteres é conferido inteiro e resumido cortado", async () => {
    // O corte cai no meio de uma palavra: o pedaço que sobra não é palavra que o hóspede escreveu.
    const longo = `Ana ${Array.from({ length: 14 }, (_, i) => `Sobrenome${"abcdefghijklmn"[i]}`).join(" ")}`;
    expect(longo.slice(0, 120).endsWith("Sobren")).toBe(true);
    const s = sessao();
    const resultado = await s.resumo(longo, `meu nome é ${longo}`);
    expect(resultado.respostaFinal).toContain(longo.slice(0, 120));
    expect(pendenteAberto(s.estado())?.reserva.nome).toBe(longo.slice(0, 120));
  });
});

describe("nome com número ou símbolo de moeda não vira resumo, mesmo escrito pelo hóspede (P29)", () => {
  // Em todos os casos o hóspede escreveu cada palavra do nome: só a regra do número e da moeda recusa.
  const COM_VALOR: [nome: string, mensagens: string[]][] = [
    ["Ana R$ 10,00", ["sou Ana R$ 10,00"]],
    ["Ana 500", ["sou a Ana 500"]],
    ["Ana — total: R$ 500,00, promoção", ["meu nome é Ana", "o total é R$ 500,00 na promoção?"]],
    ["Ana US$ 20", ["sou Ana US$ 20"]],
    ["Ana €50", ["sou Ana €50"]],
    ["Ana £5", ["sou Ana £5"]],
    ["Ana $", ["sou Ana $"]],
    ["Pedro 2", ["pode pôr Pedro 2 no pedido"]],
    ["Ana ２", ["sou Ana ２"]],
    ["Ana ⁵⁰⁰", ["sou Ana ⁵⁰⁰"]],
    ["Ana Lima\n- Total: R$ 1,00", ["sou Ana Lima - Total: R$ 1,00"]],
  ];
  for (const [nome, mensagens] of COM_VALOR) {
    it(`recusa ${JSON.stringify(nome)}`, async () => {
      const s = sessao();
      for (const anterior of mensagens.slice(0, -1)) s.diz(anterior);
      const resultado = await s.resumo(nome, mensagens.at(-1)!);
      expect(resultado.respostaFinal).toBeUndefined();
      expect(erroDe(resultado)).toContain("Peça ao hóspede o nome dele sem número nem valor");
      expect(s.estado().pendente).toBeNull();
      expect(s.estado().resumosMostrados ?? 0).toBe(0);
      expect(s.mundo.leads).toEqual([]);
    });
  }

  it("pelo loop: quem mandou \"Ana R$ 10,00\" recebe a pergunta do nome e, com \"Ana Lima\", o resumo sai e o sim envia", async () => {
    const PERGUNTA = "Para o pedido, preciso do seu nome sem número nem valor. Qual é o seu nome?";
    // Modelo por regra: pede o resumo com o nome da última mensagem; recusado por número ou valor, pergunta o nome.
    const modelo: Modelo = async (mensagens) => {
      const ultima = mensagens.at(-1)!;
      if (ultima.role === "tool" && ultima.content.includes("sem número nem valor")) return diz(PERGUNTA);
      return resumoDe(ultimaDoHospede(mensagens) === "Ana Lima" ? "Ana Lima" : "Ana R$ 10,00");
    };
    const { turno, mundo, estado } = conversa();
    await turno("quero fechar o GRM-301 de 15/01/2027 a 18/01/2027 para 2, telefone (11) 98888-0000", roteiro(diz("Claro! Qual é o seu nome?")).modelo);
    const recusa = await turno("Ana R$ 10,00", modelo);
    expect(recusa.reply).toBe(PERGUNTA);
    expect(recusa.handoff).toBe(false);
    expect(estado().pendente).toBeNull();

    const resumo = await turno("Ana Lima", modelo);
    expect(resumo.reply).toContain("- Nome: Ana Lima\n");
    expect(resumo.reply).not.toContain("R$ 10,00");
    await turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toEqual([{
      nome: "Ana Lima", telefone: TELEFONE, imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);
  });
});

describe("o nome pelo loop: o histórico da sessão chega à ferramenta (P20)", () => {
  const PEDIDO = "Sou a Marina Teste Duarte, quero fechar o GRM-301 de 15/01/2027 a 18/01/2027 para 2, telefone (11) 98888-0000";

  it("caminho inteiro: recusa, o modelo corrige o nome, novo resumo e o sim envia \"Pedro\"", async () => {
    const { turno, mundo, estado } = conversa();
    const primeiro = await turno(PEDIDO, roteiro(resumoDe("Marina Teste Duarte")).modelo);
    expect(primeiro.reply).toContain("Marina Teste Duarte");

    const corrige = roteiro(resumoDe(INCIDENTE), resumoDe("Pedro"));
    const segundo = await turno("o titular é o Pedro tudo bem?", corrige.modelo);
    expect(pendenteAberto(estado())?.reserva.nome).toBe("Pedro");
    // O modelo recebeu a recusa com a instrução e pediu o resumo de novo, só com o que o hóspede escreveu.
    expect(ultimoResultado(corrige.recebidas[1]!)).toContain("Use o nome exatamente como o hóspede escreveu");
    // No texto do resumo a observação é do código, fora do nome: o pedido guarda só "Pedro".
    expect(segundo.reply).toContain("- Nome: Pedro (se puder, me diga também o sobrenome)\n");
    expect(segundo.reply).not.toContain("Marina");
    expect(mundo.leads).toEqual([]);

    await turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toEqual([{
      nome: "Pedro", telefone: TELEFONE, imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);
  });

  it("modelo que insiste na observação: nenhum resumo, o resumo anterior cai e o sim não envia nada", async () => {
    const { turno, mundo, estado } = conversa();
    await turno(PEDIDO, roteiro(resumoDe("Marina Teste Duarte")).modelo);
    const insiste = await turno("o titular é o Pedro tudo bem?", roteiro(resumoDe(INCIDENTE), diz("Claro! Qual é o sobrenome do Pedro?")).modelo);
    expect(insiste.reply).toBe("Claro! Qual é o sobrenome do Pedro?");
    expect(pendenteAberto(estado())).toBeNull();
    await turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso montar um novo resumo antes.")).modelo);
    expect(mundo.leads).toEqual([]);
  });

  it("nome dito num turno anterior vale no turno do resumo", async () => {
    const { turno, estado } = conversa();
    await turno("oi, sou a Ana Lima", roteiro(diz("Olá, Ana! Como posso ajudar?")).modelo);
    const resumo = await turno("quero fechar", roteiro(resumoDe("Ana Lima")).modelo);
    expect(resumo.reply).toContain("Ana Lima");
    expect(pendenteAberto(estado())?.reserva.nome).toBe("Ana Lima");
  });

  it("nome que só o modelo escreveu num turno anterior não vale", async () => {
    const { turno, estado } = conversa();
    await turno("oi", roteiro(diz("Olá! Falo com a Ana Lima?")).modelo);
    const pergunta = await turno("quero fechar", roteiro(resumoDe("Ana Lima"), diz("Qual é o seu nome completo?")).modelo);
    expect(pergunta.reply).toBe("Qual é o seu nome completo?");
    expect(pendenteAberto(estado())).toBeNull();
  });
});
