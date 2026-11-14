// Apoio dos testes da frente F (o `test/apoio.ts` é congelado).
import type { Contexto } from "../src/agente/ferramentas";
import type { Mensagem } from "../src/modelo";

/**
 * O que o hóspede roteirizado escreve ao pedir o fechamento. Ele diz o próprio nome: o nome do lead só
 * pode ser formado por palavras que o hóspede escreveu (P20).
 */
export const queroFechar = (dados: { nome?: unknown }): string => `quero fechar, sou ${String(dados.nome)}`;

/** O contexto com as mensagens anteriores do hóspede no histórico, como o laço entrega às ferramentas. */
export function comAnteriores(contexto: Contexto, ...anteriores: string[]): Contexto {
  return { ...contexto, historico: anteriores.map((content): Mensagem => ({ role: "user", content })) };
}
