import { describe, expect, it } from "vitest";
import { criarModelo, normalizarResposta } from "../src/modelo";

describe("adaptador do modelo", () => {
  it("lê texto e uso no formato de chat completions", () => {
    const r = normalizarResposta({
      choices: [{ message: { role: "assistant", content: " Olá! ", reasoning: "pensando..." } }],
      usage: { prompt_tokens: 263, completion_tokens: 55 },
    });
    expect(r).toEqual({ texto: "Olá!", chamadas: [], uso: { entrada: 263, saida: 55 } });
  });

  it("lê chamadas de ferramenta com argumentos em texto", () => {
    const r = normalizarResposta({
      choices: [{ message: { content: null, tool_calls: [{ id: "x1", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-301"}' } }] } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });
    expect(r.texto).toBe("");
    expect(r.chamadas).toEqual([{ id: "x1", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-301"}' } }]);
  });

  it("lê o formato antigo, com argumentos em objeto e sem id", () => {
    const r = normalizarResposta({ response: "ok", tool_calls: [{ name: "cotar", arguments: { imovel_id: "GRM-301" } }] });
    expect(r.texto).toBe("ok");
    expect(r.chamadas).toEqual([{ id: "chamada-1", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-301"}' } }]);
    expect(r.uso).toEqual({ entrada: 0, saida: 0 });
  });

  it("resposta fora do formato vira resposta vazia, sem lançar", () => {
    for (const bruto of [null, "texto", 42, {}, { choices: [] }, { choices: [{}] }]) {
      expect(normalizarResposta(bruto)).toEqual({ texto: "", chamadas: [], uso: { entrada: 0, saida: 0 } });
    }
  });

  it("chama o modelo da variável MODELO com mensagens e ferramentas", async () => {
    const pedidos: unknown[][] = [];
    const ai = { run: async (...args: unknown[]) => { pedidos.push(args); return { choices: [{ message: { content: "oi" } }] }; } } as unknown as Ai;
    const resposta = await criarModelo(ai, "provedor/modelo-x")([{ role: "user", content: "oi" }], []);
    expect(resposta.texto).toBe("oi");
    expect(pedidos[0]![0]).toBe("provedor/modelo-x");
    expect(pedidos[0]![1]).toMatchObject({ messages: [{ role: "user", content: "oi" }], tools: [] });
  });

  it("sem MODELO configurado, falha em vez de escolher um modelo sozinho", async () => {
    const ai = { run: async () => ({}) } as unknown as Ai;
    await expect(criarModelo(ai, undefined)([], [])).rejects.toThrow("MODELO");
  });
});
