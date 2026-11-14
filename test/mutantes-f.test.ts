// Testes dos defeitos plantados que escaparam na terceira rodada do verificador (C2): cada um falha
// com o seu mutante (N01, N02, N03, N08 e N19).
import { describe, expect, it } from "vitest";
import { lerConfirmacao, mudaDadoDoResumo, type Pendente } from "../src/lead";

const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600, turno: 2,
};

describe("forma nova da P15 com resto sem palavra de sinal: não confirma (N01, N02, N03)", () => {
  for (const m of ["bora com a sogra", "manda ver com a Maria", "go ahead with Mary", "correct the name", "isso aí, com o João", "please confirm for Bob and me"]) {
    it(`"${m}" é outra`, () => expect(lerConfirmacao(m, GRM301, 3)).toBe("outra"));
  }
});

describe("hesitação cujo resto começa com sim e segue com conteúdo: derruba (N08)", () => {
  for (const m of ["acho que sim, mas com a minha sogra", "talvez sim, só que no carnaval", "acho que sim, porém depois"]) {
    it(`"${m}" é outra`, () => expect(lerConfirmacao(m, GRM301, 3)).toBe("outra"));
  }
});

describe("pergunta com negação derruba no rearme (N19)", () => {
  it("\"isso não está certo?\" muda", () => expect(mudaDadoDoResumo("isso não está certo?", GRM301)).toBe(true));
});
