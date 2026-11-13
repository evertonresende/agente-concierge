// O sim é validado por código (contrato L9 e L10; revisão do Marco 1, achado 5). Em todos
// os casos o modelo falso chama `confirmar_reserva`: quem segura o envio é a ferramenta,
// lendo a mensagem do hóspede.
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import {
  type Cofre, ESTADO_INICIAL, type EstadoLead, lerConfirmacao, type Pendente, pedidoDeConfirmacaoPendente,
} from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

/** Sessão com o resumo do GRM-301 mostrado no turno 2. */
async function comResumo() {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const resumo = await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
  expect(resumo.respostaFinal).toContain("R$ 2.156,00");
  const confirma = (turno: number, mensagem: string) => confirmarReserva.executar({}, criarContexto(mundo, cofre, turno, mensagem));
  return { mundo, cofre, confirma, estado: () => estado };
}

describe("o sim é validado por código", () => {
  it("sim inequívoco no turno seguinte ao resumo envia 1 lead", async () => {
    const { mundo, confirma } = await comResumo();
    const r = await confirma(3, "Sim, confirmo.");
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(mundo.leads).toHaveLength(1);
  });

  it("hesitação não envia e o código pergunta de novo; o sim seguinte envia", async () => {
    const { mundo, confirma } = await comResumo();
    const r = await confirma(3, "Acho que sim, talvez pode ser.");
    expect(mundo.leads).toEqual([]);
    expect(r.handoff).toBeUndefined();
    expect(r.respostaFinal).toMatch(/não enviei/i);
    expect(r.respostaFinal).toMatch(/confirmar, responda "sim"/);
    await confirma(4, "Sim, confirmo definitivamente.");
    expect(mundo.leads).toHaveLength(1);
  });

  it("condição de preço não envia nenhum lead e passa para humano", async () => {
    const { mundo, confirma } = await comResumo();
    const r = await confirma(3, "sim, se fizer por R$ 2.000");
    expect(mundo.leads).toEqual([]);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).not.toMatch(/registrad/);
  });

  it("outra pergunta não envia nada e o resumo continua aguardando", async () => {
    const { mundo, confirma, estado } = await comResumo();
    const r = await confirma(3, "Sim. Mas antes: aceita pet?");
    expect(mundo.leads).toEqual([]);
    expect(r.respostaFinal).toBeUndefined();
    expect(JSON.stringify(r.paraOModelo)).toMatch(/Nada foi enviado/);
    expect(estado().pendente).not.toBeNull();
  });

  for (const mensagem of [
    "sim, mas somos 3",
    "sim, meu telefone agora é (21) 97777-0000",
    "sim, mas o nome é Ana Maria Lima",
    "sim, com saída no dia 19/01/2027",
    "Na verdade mudei de ideia: quero de 15/01/2027 a 17/01/2027, e sim, pode fechar!",
  ]) {
    it(`troca de dado junto com o sim não confirma o resumo antigo: "${mensagem}"`, async () => {
      const { mundo, confirma, estado } = await comResumo();
      const r = await confirma(3, mensagem);
      expect(mundo.leads).toEqual([]);
      expect(r.respostaFinal).toBeUndefined();
      // O resumo antigo caiu: um sim seco no turno seguinte também não o envia.
      expect(estado().pendente).toBeNull();
      await confirma(4, "sim");
      expect(mundo.leads).toEqual([]);
    });
  }

  it("sim que não vem logo depois do resumo não envia: o resumo é mostrado de novo e só o sim seguinte envia", async () => {
    const { mundo, confirma } = await comResumo();
    // Turno 3 foi outra conversa, sem ferramenta de lead; o "sim" do turno 4 pode ser resposta a ela.
    const r = await confirma(4, "sim");
    expect(mundo.leads).toEqual([]);
    expect(r.respostaFinal).toContain("Resumo do seu pedido de reserva");
    expect(r.respostaFinal).toContain("Chale Serra Gramado");
    await confirma(5, "sim");
    expect(mundo.leads).toHaveLength(1);
  });

  it("pedido de confirmação repetido por código no fim de um turno de pergunta habilita o sim seguinte", async () => {
    const { mundo, cofre, confirma } = await comResumo();
    const pedido = pedidoDeConfirmacaoPendente(cofre, 3, "pt");
    expect(pedido).toMatch(/GRM-301.*confirmar, responda "sim"/s);
    // No mesmo turno o pedido não sai duas vezes.
    expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt")).toBeUndefined();
    await confirma(4, "sim");
    expect(mundo.leads).toHaveLength(1);
    // Depois do registro não há mais o que confirmar.
    expect(pedidoDeConfirmacaoPendente(cofre, 5, "pt")).toBeUndefined();
  });

  it("pedido de confirmação: nada a repetir sem resumo, nem no turno do próprio resumo; sai em inglês", async () => {
    const vazio: Cofre = { ler: () => ESTADO_INICIAL, salvar: () => { throw new Error("não deveria gravar"); } };
    expect(pedidoDeConfirmacaoPendente(vazio, 3, "pt")).toBeUndefined();
    const { cofre } = await comResumo();
    expect(pedidoDeConfirmacaoPendente(cofre, 2, "pt")).toBeUndefined();
    expect(pedidoDeConfirmacaoPendente(cofre, 3, "en")).toMatch(/GRM-301.*To confirm, reply "yes"/s);
  });
});

describe("leitura da mensagem diante do resumo pendente", () => {
  const pendente = (imovel_id: string): Pendente => ({
    reserva: { imovel_id, checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
    totalCentavos: 215600,
    turno: 2,
  });
  const GRM301 = pendente("GRM-301");

  for (const mensagem of [
    "sim", "Sim!", "siiim", "confirmo", "Confirmado.", "pode fechar", "Pode enviar, por favor", "pode mandar", "isso mesmo",
    "tudo certo", "está tudo certo, pode enviar", "Sim, confirmo.", "Sim, confirmo o resumo.",
    "Sim, confirmo definitivamente.", "Sim, confirmo de novo!",
    "Sim, pode fechar.", "Sim sim, pode confirmar a reserva", "Confirmo tudo", "certo, confirmo", "perfeito, pode fechar",
    "Sim, confirmo o GRM-301.", "sim, confirmo os R$ 2.156,00", "Sim, confirmo o GRM-301 por R$ 2.156,00", "com certeza",
    "ok, pode enviar", "Ok, confirmo",
    "Yes, I confirm.", "yes", "Yes, please go ahead", "yes, confirm the booking", "that's correct", "sí",
  ]) {
    it(`é sim: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe("sim"));
  }

  const naoSao: [string, string][] = [
    ["Acho que sim, talvez pode ser.", "hesitacao"],
    ["acho que sim", "hesitacao"],
    ["pode ser", "hesitacao"],
    ["não sei ainda", "hesitacao"],
    ["I think so", "hesitacao"],
    ["not sure", "hesitacao"],
    // Só um "ok" pode ser apenas "recebi": o código pergunta de novo.
    ["ok", "hesitacao"],
    ["Ok!", "hesitacao"],
    ["beleza", "hesitacao"],
    ["tá bom", "hesitacao"],
    ["sim, se fizer por R$ 2.000", "condicao_de_preco"],
    ["fecho por 2000", "condicao_de_preco"],
    ["sim, com 10% de desconto", "condicao_de_preco"],
    ["sim, mas tem desconto?", "condicao_de_preco"],
    ["yes if you give me a discount", "condicao_de_preco"],
    ["sim, se baixar o valor", "condicao_de_preco"],
    ["Ah, antes de confirmar, qual é o bairro desse imóvel mesmo?", "pergunta"],
    ["sim?", "pergunta"],
    ["pode fechar?", "pergunta"],
    ["confirmado?", "pergunta"],
    ["posso mudar para 3 pessoas?", "outra"],
    ["sim, mas somos 3", "outra"],
    ["sim, mas muda a saída para 19/01/2027", "outra"],
    ["sim, meu nome é João Pedro", "outra"],
    ["Sim, confirmo o GRM-302.", "outra"],
    ["sim, confirmo por R$ 2.156,00... quer dizer, 3 pessoas", "outra"],
    ["não", "outra"],
    ["não confirmo", "outra"],
    ["sim não", "outra"],
    ["ainda não, espera", "outra"],
    ["quero novas datas", "outra"],
    // Palavras que valem numa frase de confirmação não valem recombinadas em outro pedido.
    ["pode mandar o resumo de novo", "outra"],
    ["pode enviar os dados de novo", "outra"],
    ["sim, manda o resumo de novo", "outra"],
    ["yes please send the summary again", "outra"],
    ["send it to my email", "outra"],
    ["novas datas", "outra"],
    ["confirmo novas datas", "outra"],
    ["sim, novas datas", "outra"],
    ["sim com outra data", "outra"],
    ["pode fechar com outra data", "outra"],
    ["pode mudar as datas", "outra"],
    ["confirmo outro telefone", "outra"],
    ["sim, segunda", "outra"],
    ["confirmo a reserva de segunda", "outra"],
    ["pode reservar a segunda", "outra"],
    ["certo, e o wifi", "outra"],
    ["pode me dizer o horário", "outra"],
    ["sim, depois confirmo", "outra"],
    ["I confirm nothing", "outra"],
    ["sim, confirmo por R$ 2.000,00", "condicao_de_preco"],
    ["Obrigado, por enquanto não vou fechar ainda.", "outra"],
    ["", "outra"],
    ["👍", "outra"],
    ["2", "outra"],
  ];
  for (const [mensagem, esperado] of naoSao) {
    it(`não é sim (${esperado}): "${mensagem}"`, () => expect(lerConfirmacao(mensagem, GRM301)).toBe(esperado));
  }

  describe("dados repetidos na confirmação (L9, L10): iguais aos do resumo confirmam, diferentes não", () => {
    const sao501: Pendente = {
      reserva: { imovel_id: "SAO-501", checkin: "2027-01-15", checkout: "2027-01-17", hospedes: 3, nome: "Ana Lima", telefone: "(11) 98888-0000" },
      totalCentavos: 72000,
      turno: 2,
    };
    for (const mensagem of [
      "Sim, confirmo! Pode fechar a reserva do SAO-501 de 15/01/2027 a 17/01/2027 agora mesmo, por favor?",
      "Sim, confirmo essa reserva de 15/01/2027 a 17/01/2027 para 3 hóspedes no imóvel SAO-501.",
      "Sim, para 3 pessoas",
      "Sim, confirmo: 2 noites, 3 pessoas, R$ 720,00",
      "Confirmo a reserva de 2027-01-15 a 2027-01-17",
      "Sim. Pode fechar?",
      "Yes, I confirm the booking for 3 guests from 15/01/2027 to 17/01/2027",
    ]) {
      it(`confirma: "${mensagem}"`, () => expect(lerConfirmacao(mensagem, sao501)).toBe("sim"));
    }

    const naoConfirmam: [string, string][] = [
      // "Telefone" é sinal de mudança (rearme negado por padrão): mesmo o número igual não confirma.
      ["Sim, confirmo, sou Ana Lima, telefone 11 98888-0000", "outra"],
      ["Sim, confirmo o telefone +55 (11) 98888-0000", "outra"],
      ["Sim, mas de 18 a 20", "outra"],
      ["Sim, para 2 pessoas", "outra"],
      ["Sim, confirmo de 15/01/2027 a 18/01/2027", "outra"],
      ["Sim, confirmo de 16/01/2027 a 17/01/2027", "outra"],
      ["Sim, confirmo de 17/01/2027 a 15/01/2027", "outra"],
      // Não dá para comparar com certeza: data sozinha, sem ano, por extenso; número sem unidade ou por extenso.
      ["Sim, confirmo a entrada em 15/01/2027", "outra"],
      ["Sim, confirmo de 15/01 a 17/01", "outra"],
      ["Sim, de 15 a 17 de janeiro", "outra"],
      ["Sim, somos 3", "outra"],
      ["Sim, para três pessoas", "outra"],
      ["Sim, 3 pessoas e 1 bebê", "outra"],
      ["Sim, confirmo 3 noites", "outra"],
      ["Sim, confirmo o GRM-301 de 15/01/2027 a 17/01/2027", "outra"],
      ["Sim, confirmo, sou Ana Maria Lima", "outra"],
      ["Sim, confirmo o telefone (21) 97777-0000", "outra"],
      ["Sim, confirmo de 15/01/2027 a 17/01/2027, mas para 2 pessoas", "outra"],
      ["Sim, confirmo, e tem wifi?", "pergunta"],
      ["Sim, confirmo! Tem wifi?", "pergunta"],
      ["Pode fechar a reserva do SAO-501 de 15/01/2027 a 17/01/2027?", "pergunta"],
      ["Sim, confirmo de 15/01/2027 a 17/01/2027. Dá para entrar mais cedo?", "pergunta"],
      ["Sim, confirmo! Pode fechar a reserva do SAO-501 de 15/01/2027 a 18/01/2027, por favor?", "outra"],
      ["Sim, confirmo por R$ 700,00", "condicao_de_preco"],
    ];
    for (const [mensagem, esperado] of naoConfirmam) {
      it(`não confirma (${esperado}): "${mensagem}"`, () => expect(lerConfirmacao(mensagem, sao501)).toBe(esperado));
    }
  });

  it("o id do imóvel só é aceito se for o do resumo pendente", () => {
    expect(lerConfirmacao("Sim, confirmo o GRM-302.", pendente("GRM-302"))).toBe("sim");
    expect(lerConfirmacao("Sim, confirmo o GRM-301.", pendente("GRM-302"))).toBe("outra");
  });
});
