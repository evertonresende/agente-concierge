// Achados da revisão de código sobre a leitura do sim e o fim do lead (frente F).
import { describe, expect, it } from "vitest";
import { lerConfirmacao, type Pendente } from "../src/lead";

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
