import { describe, expect, it } from "vitest";
import { normalizarTelefone } from "../src/nucleo/telefone";

describe("telefone do lead (L6)", () => {
  const validos: [string, string][] = [
    // Brasileiro, celular (11 dígitos).
    ["(11) 98888-0000", "(11) 98888-0000"],
    ["11988880000", "(11) 98888-0000"],
    ["11 98888 0000", "(11) 98888-0000"],
    ["11.98888.0000", "(11) 98888-0000"],
    ["11-98888-0000", "(11) 98888-0000"],
    ["  (11)98888-0000  ", "(11) 98888-0000"],
    // Brasileiro, fixo (10 dígitos).
    ["(11) 3888-0000", "(11) 3888-0000"],
    ["1138880000", "(11) 3888-0000"],
    // Com o código do país, com e sem "+".
    ["+55 11 98888-0000", "(11) 98888-0000"],
    ["+5511988880000", "(11) 98888-0000"],
    ["55 11 98888-0000", "(11) 98888-0000"],
    ["5511988880000", "(11) 98888-0000"],
    ["+55 (11) 3888-0000", "(11) 3888-0000"],
    ["551138880000", "(11) 3888-0000"],
    // DDD 55 (interior do RS): o 55 da frente não é código do país.
    ["(55) 98888-0000", "(55) 98888-0000"],
    ["55988880000", "(55) 98888-0000"],
    ["5532221234", "(55) 3222-1234"],
    ["+55 55 98888-0000", "(55) 98888-0000"],
    ["+55 55 3222-1234", "(55) 3222-1234"],
    // Sem "+", 11 dígitos são lidos como brasileiro com DDD, mesmo que pareçam de outro país.
    ["14155550123", "(14) 15555-0123"],
    // Estrangeiro: precisa do "+", de 8 a 15 dígitos.
    ["+14155550123", "+14155550123"],
    ["+1 (415) 555-0123", "+14155550123"],
    ["+351 912 345 678", "+351912345678"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+12345678", "+12345678"],
    ["+123456789012345", "+123456789012345"],
  ];
  for (const [entrada, esperado] of validos) {
    it(`"${entrada}" -> "${esperado}"`, () => expect(normalizarTelefone(entrada)).toBe(esperado));
  }

  it("normalizar de novo o que já foi normalizado não muda nada", () => {
    for (const [, esperado] of validos) expect(normalizarTelefone(esperado)).toBe(esperado);
  });

  const invalidos = [
    "", "   ", "12345", "98888-0000", "988880000", // sem DDD
    "123456789", "119888800001", "1198888000012", // 9, 12 e 13 dígitos sem 55 na frente
    "(01) 98888-0000", "(10) 98888-0000", "0800 123 4567", // DDD com zero
    "011 98888-0000", // prefixo 0 de operadora: 12 dígitos
    "+55 98888-0000", "+5511", "+55 11 98888-00000", // brasileiro com "+" e tamanho errado
    "+1234567", "+1234567890123456", // estrangeiro com 7 e com 16 dígitos
    "0014155550123", "4155550", // estrangeiro sem "+"
    "+", "++", "não tenho", "11 98888-0000 ramal 2", "onze nove oito", "(11) 9888-000O",
  ];
  for (const entrada of invalidos) {
    it(`inválido: "${entrada}"`, () => expect(normalizarTelefone(entrada)).toBeNull());
  }
});
