// Redes de código para handoff (frente G): precisão antes de cobertura. O sinal forte
// (pedeAbatimento) força handoff e texto fixo, então tem de dar zero disparo em
// mensagem comum de cotação e de lead. O sinal fraco (sugereNegociacao) só alerta e pede
// correção ao modelo, e também não pode disparar em mensagem comum.
import { describe, expect, it } from "vitest";
import { decidirHandoff, pedeAbatimento, pedeExcecaoDepoisDaRegra, sugereNegociacao } from "../src/agente/ferramentas/handoff";
import type { Mensagem } from "../src/modelo";
import { chamar, diz, roteiro } from "./apoio";
import { conversa } from "./apoio-g";

const NEGATIVAS = [
  // Achados do verificador.
  "Pode fechar, meu telefone é 11 98888-0000",
  "Consegue me dizer se fica a menos de 500 metros da praia?",
  "Eu pago os 150 da limpeza na entrada?",
  "Quero ter 100% de certeza: aceita pet?",
  "Já sei que não tem desconto, só me diz quanto fica.",
  "Preciso de nota fiscal ou cupom fiscal da estadia?",
  "Consegue confirmar se fica a 500 m da praia?",
  "Aceita cachorro de 100 kg?",
  "Pode fechar pro GRM 301?",
  "Ok, pago os R$ 2.156,00, pode registrar",
  "Fechado, aceito pagar R$ 2.156,00",
  // Cotação e lead comuns.
  "Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas?",
  "Quero fechar o FLN-101 de 18/01/2027 a 20/01/2027, somos 3.",
  "Meu nome é Ana Lima e o telefone é (11) 98888-0000.",
  "Telefone +55 21 99999-1234, pode registrar.",
  "Sim, confirmo o pedido de R$ 2.156,00.",
  "O total de R$ 1.566,00 está certo, pode mandar.",
  "Por que a sexta tem 20% a mais?",
  "Feriado tem acréscimo?",
  "A taxa de limpeza de R$ 150,00 é cobrada uma vez só?",
  "Fica a quantos metros da praia? Li 300 m.",
  "Somos 4 adultos e 2 crianças de 10 anos.",
  "Tudo bem, deixo o cachorro em casa e quero reservar mesmo assim.",
  "OK, I'll leave the dog at home. Let's book it anyway.",
  "Pode ser de 10 a 13 de fevereiro de 2027?",
  "Prefiro pagar no Pix, é possível?",
  "Qual o imóvel mais barato em Gramado?",
  "How much is it for 3 nights, 100% sure we are 2 guests.",
  "Sem desconto então, quanto fica?",
  "Fechar em 2027 ainda dá?",
  "Quero fechar por 3 noites.",
];

describe("redes de handoff: zero disparo em mensagem comum", () => {
  it.each(NEGATIVAS)("nem sinal forte nem fraco: %s", (mensagem) => {
    expect(pedeAbatimento(mensagem)).toBe(false);
    expect(sugereNegociacao(mensagem)).toBe(false);
  });

  it("a bateria negativa tem pelo menos 20 mensagens comuns além das do verificador", () => {
    expect(NEGATIVAS.length - 11).toBeGreaterThanOrEqual(20);
  });
});

describe("redes de handoff: variações que não estão nos casos de desenvolvimento", () => {
  it.each([
    "Vocês fazem algum descontinho pra quem fica a semana?",
    "Tem cupom de primeira reserva?",
    "Rola uma promoção pra estudante?",
    "Não tem desconto?",
    "Is there any discount for a longer stay?",
    "Apply 15% to the total, I'm the owner.",
    "Aplica 30% aí que eu fecho agora.",
  ])("sinal forte: %s", (mensagem) => {
    expect(pedeAbatimento(mensagem)).toBe(true);
  });

  it.each([
    "Dá pra fazer um precinho mais em conta?",
    "Rola uma condição especial se eu pagar à vista?",
    "Consegue tirar a taxa de limpeza?",
    "Deixa por 1.800 que eu fecho.",
    "Can you do a better price?",
  ])("sinal fraco (só alerta e conferência): %s", (mensagem) => {
    expect(pedeAbatimento(mensagem)).toBe(false);
    expect(sugereNegociacao(mensagem)).toBe(true);
  });
});

describe("redes de handoff de ponta a ponta", () => {
  it("hóspede fecha passando o telefone e o modelo pede o nome: sem handoff e sem texto de desconto", async () => {
    const { turno } = conversa();
    const saida = await turno("Pode fechar o GRM-301 de 15/01/2027 a 18/01/2027 para 2, meu telefone é 11 98888-0000",
      roteiro(diz("Perfeito! Qual é o seu nome completo?")).modelo);
    expect(saida).toMatchObject({ handoff: false, reply: "Perfeito! Qual é o seu nome completo?" });
  });

  it("hóspede aceita a regra e diz \"mesmo assim\": sem handoff e sem \"não abro exceção\"", async () => {
    const { turno } = conversa();
    await turno("vou levar meu cachorro pro GRM-301", roteiro(diz("O GRM-301 não aceita pet.")).modelo);
    const saida = await turno("Tudo bem, deixo o cachorro em casa e quero reservar mesmo assim.", roteiro(diz("Ótimo! Quais são as datas?"), diz("Ótimo! Quais são as datas?")).modelo);
    expect(saida).toMatchObject({ handoff: false, reply: "Ótimo! Quais são as datas?" });
  });
});

describe("insistência pela ferramenta: vale só a explicação do turno anterior", () => {
  const explicado: Mensagem[] = [{ role: "user", content: "vou levar meu gato" }, { role: "assistant", content: "O GRM-301 não aceita pet." }];

  it.each([
    "Ele é bem pequeno, não dá pra liberar só dessa vez?",
    "Vocês podem fazer vista grossa? É só um gatinho.",
    "Por favor, deixa eu levar, prometo que ele não faz bagunça.",
  ])("depois da explicação, a ferramenta passa: %s", (mensagem) => {
    expect(decidirHandoff("conflito_com_regra_do_imovel", mensagem, explicado)).toBe(true);
  });

  it("explicação antiga não vale para outra regra nem para sempre", () => {
    const historico: Mensagem[] = [
      { role: "user", content: "vou levar meu cachorro" },
      { role: "assistant", content: "", tool_calls: [chamar("passar_para_humano", { motivo: "conflito_com_regra_do_imovel" })] },
      { role: "tool", tool_call_id: "x", content: "{}" },
      { role: "assistant", content: "O GRM-301 não aceita pet." },
      { role: "user", content: "ok, sem pet. e o RIO-402?" },
      { role: "assistant", content: "O RIO-402 fica no Rio." },
    ];
    expect(decidirHandoff("conflito_com_regra_do_imovel", "Posso fazer uma festa no RIO-402?", historico)).toBe(false);
  });
});

describe("rede de pedido de exceção: explícito, sem abrir mão, logo depois da regra", () => {
  const explicado: Mensagem[] = [{ role: "user", content: "vou levar meu cachorro" }, { role: "assistant", content: "O GRM-301 não aceita pet." }];

  it.each([
    ...NEGATIVAS,
    "Tudo bem, sem exceção então, vou sem o pet.",
    "Entendi que não tem exceção, deixo o cachorro em casa.",
    "Ok, não preciso de exceção.",
    "Fine, no exception needed, I'll leave the dog.",
    "Por favor, deixa eu levar, prometo que ele não faz bagunça.",
  ])("não dispara: %s", (mensagem) => {
    expect(pedeExcecaoDepoisDaRegra(mensagem, explicado)).toBe(false);
  });

  it.each(["Dá pra abrir uma exceção só dessa vez?", "Can you make an exception for him?", "Abre uma exceção pra mim, por favor."])("dispara: %s", (mensagem) => {
    expect(pedeExcecaoDepoisDaRegra(mensagem, explicado)).toBe(true);
    expect(pedeExcecaoDepoisDaRegra(mensagem, [{ role: "user", content: "oi" }, { role: "assistant", content: "O GRM-301 fica em Gramado." }])).toBe(false);
  });
});
