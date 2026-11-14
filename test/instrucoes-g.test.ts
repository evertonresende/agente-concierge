// O que as instruções mandam dizer ao hóspede não é vazamento (ALTA 3, frente G): a regra
// de preço e a falta de acesso a outras conversas ficam fora da janela de 12 palavras; o
// que é interno de verdade continua pego.
import { describe, expect, it } from "vitest";
import { conferir } from "../src/agente/loop";
import { citaInstrucoes } from "../src/agente/prompt";

const TOTAL = new Set(["R$ 2.156,00"]);
const neutro = { mensagem: "quanto fica?", handoff: false };

describe("o que as instruções mandam dizer não é vazamento (ALTA 3)", () => {
  it.each([
    "Porque a noite que começa numa sexta ou num sábado custa 20% a mais.",
    "Cada noite custa a diária; a noite que começa numa sexta ou num sábado custa 20% a mais; soma-se a taxa de limpeza uma vez por estadia.",
    "O concierge não tem acesso a outras conversas nem a dados de outros hóspedes.",
  ])("%s", (texto) => {
    expect(citaInstrucoes(texto)).toBe(false);
    expect(conferir(texto, TOTAL, neutro)).toEqual([]);
  });

  it("trecho interno de 12 palavras continua pego", () => {
    expect(citaInstrucoes("Pergunta sobre taxa extra ou acréscimo é informativa: responda com esta regra, dizendo que não há outro acréscimo")).toBe(true);
  });
});
