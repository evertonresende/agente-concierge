// Pergunta 3 da rodada pós-entrega (recomendação aceita pelo Éverton em 20/11): a
// demonstração pública registra o pedido confirmado no webhook próprio, guarda os leads por
// 7 dias e mostra um aviso pedindo dados fictícios.
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JavaScript do Worker falso, sem tipos
import { corteDaRetencao, RETENCAO_MS } from "../falso/src/retencao.js";
import { PAGINA } from "../src/pagina";

const AVISO = "Demonstração: use nome e telefone fictícios. Os pedidos ficam num registro de teste, apagado em 7 dias, e ninguém entra em contato.";

describe("aviso de dados fictícios na página", () => {
  it("aparece junto do campo de mensagem e é lido com ele", () => {
    expect(PAGINA).toContain(`<p class="dica" id="aviso">${AVISO}</p>`);
    expect(PAGINA).toContain('aria-describedby="dica aviso"');
  });
});

describe("retenção dos leads no webhook próprio", () => {
  it("7 dias: o corte é o instante de 7 dias atrás, em ISO, comparável com recebido_em", () => {
    expect(RETENCAO_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const agora = Date.parse("2026-11-27T12:00:00.000Z");
    expect(corteDaRetencao(agora)).toBe("2026-11-20T12:00:00.000Z");
    expect("2026-11-20T11:59:59.999Z" < corteDaRetencao(agora)).toBe(true);
    expect("2026-11-20T12:00:00.001Z" < corteDaRetencao(agora)).toBe(false);
  });
});
