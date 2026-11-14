// C1 da terceira rodada do verificador (afirmação junto com pergunta), trazido como está.
// Rodar a partir da raiz do repositório com a frente F mesclada:
//   cp <este arquivo> test/ && ~/.cache/agente-concierge/com-trava.sh npx vitest run test/reproduz.test.ts --maxWorkers=3
//
// C1: em `mudaDadoDoResumo` (src/lead.ts:402), qualquer "?" na mensagem faz a mensagem inteira seguir a regra
// de pergunta (só a lista de sinais). Uma afirmação de mudança que derruba o resumo sozinha ("vou levar minha
// sogra") passa a mantê-lo quando vem com uma pergunta qualquer ("..., tem estacionamento?"). O rearme repete o
// resumo antigo e o "sim" seguinte envia o lead com os dados antigos. A frente G chama o rearme com a mensagem
// do turno (origin/frente-g:src/agente/loop.ts:534).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, mudaDadoDoResumo, type Pendente, pedidoDeConfirmacaoPendente } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600, turno: 2,
};

// Cada uma: a afirmação sozinha derruba o resumo hoje; com a pergunta junto, não derruba.
const AFIRMACAO_E_PERGUNTA: [string, string][] = [
  // Grupo 1: afirmação de mudança + pergunta SEM relação com ela. Fora da leitura aceita (b) em qualquer
  // leitura; é neste grupo que o veredito se apoia.
  ["vou levar minha sogra", "vou levar minha sogra, tem estacionamento?"],
  ["o João vem comigo", "o João vem comigo. tem wifi?"],
  ["vamos eu e o Pedro", "vamos eu e o Pedro. tem toalha?"],
  ["I'll bring my mom", "I'll bring my mom, is there parking?"],
  // Grupo 2: afirmação de mudança com pergunta de confirmação no fim ("ok?", "pode?", "tudo bem?"). A
  // coordenação pode decidir que isto é pergunta, pela leitura (b); se decidir, apague estas cinco linhas.
  ["levo o João", "levo o João, ok?"],
  ["minha sogra vai junto", "minha sogra vai junto, tudo bem?"],
  ["quero o de Copacabana", "quero o de Copacabana, pode?"],
  ["pro réveillon", "pro réveillon, tem vaga?"],
  ["Bob is coming with me", "Bob is coming with me, ok?"],
];

describe("C1: afirmação de mudança seguida de pergunta derruba o resumo, como a afirmação sozinha", () => {
  for (const [sozinha, comPergunta] of AFIRMACAO_E_PERGUNTA) {
    it(`"${comPergunta}" muda o resumo (sozinha, "${sozinha}", já muda)`, () => {
      expect(mudaDadoDoResumo(sozinha, GRM301)).toBe(true);
      expect(mudaDadoDoResumo(comPergunta, GRM301)).toBe(true);
    });

    it(`"${comPergunta}" no fim do turno, depois "sim": nenhum lead com os dados antigos`, async () => {
      const mundo = criarMundo();
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
      // Turno 3: o modelo só responde à pergunta; o fim do turno chama o rearme com a mensagem (como na frente G).
      expect(pedidoDeConfirmacaoPendente(cofre, 3, "pt", comPergunta)).toBeUndefined();
      expect(estado.pendente).toBeNull();
      // Turno 4: "sim".
      await confirmarReserva.executar({}, criarContexto(mundo, cofre, 4, "sim"));
      expect(mundo.leads).toEqual([]);
    });
  }
});

describe("C1, decisão 1: cancelamento com pergunta derruba; só a mensagem toda pergunta mantém o resumo", () => {
  const rearma = (mensagem: string) => {
    let estado: EstadoLead = { ...ESTADO_INICIAL, pendente: GRM301 };
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    return { pedido: pedidoDeConfirmacaoPendente(cofre, 3, "pt", mensagem), pendente: estado.pendente };
  };
  for (const mensagem of ["esquece, qual o horário do check-in?", "deixa pra lá. qual o endereço?"]) {
    it(`derruba: "${mensagem}"`, () => expect(rearma(mensagem)).toEqual({ pedido: undefined, pendente: null }));
  }
  for (const mensagem of ["posso levar minha sogra?", "tem wifi?", "Ah, antes de confirmar, qual é o bairro desse imóvel mesmo?", "can I bring my mom?",
    "qual o horário do check-out?"]) {
    it(`pergunta pura mantém e repete o resumo inteiro: "${mensagem}"`, () => {
      const r = rearma(mensagem);
      expect(r.pendente).not.toBeNull();
      expect(r.pedido).toContain("- Total: R$ 2.156,00");
    });
  }

  it("pelo confirmar_reserva: \"vou levar minha sogra, tem estacionamento?\" derruba e o sim seguinte não envia", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = ESTADO_INICIAL;
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    await montarResumo.executar(DADOS, criarContexto(mundo, cofre, 2, "quero fechar"));
    await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, "vou levar minha sogra, tem estacionamento?"));
    expect(estado.pendente).toBeNull();
    await confirmarReserva.executar({}, criarContexto(mundo, cofre, 4, "sim"));
    expect(mundo.leads).toEqual([]);
  });
});
