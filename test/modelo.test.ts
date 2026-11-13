import { describe, expect, it } from "vitest";
import { criarModelo, normalizarResposta, parametros } from "../src/modelo";

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
    const resposta = await criarModelo(ai, "provedor/modelo-x", {})([{ role: "user", content: "oi" }], []);
    expect(resposta.texto).toBe("oi");
    expect(pedidos[0]![0]).toBe("provedor/modelo-x");
    expect(pedidos[0]![1]).toMatchObject({ messages: [{ role: "user", content: "oi" }], tools: [] });
  });

  it("sem MODELO configurado, falha em vez de escolher um modelo sozinho", async () => {
    const ai = { run: async () => ({}) } as unknown as Ai;
    await expect(criarModelo(ai, undefined, {})([], [])).rejects.toThrow("MODELO");
  });

  it("modelo nativo usa max_tokens; de terceiros, max_completion_tokens", () => {
    expect(parametros("@cf/openai/gpt-oss-120b")).toMatchObject({ max_tokens: 1500 });
    expect(parametros("@cf/openai/gpt-oss-120b")).not.toHaveProperty("max_completion_tokens");
    expect(parametros("autor/modelo-x")).toMatchObject({ max_completion_tokens: 1500 });
    expect(parametros("autor/modelo-x")).not.toHaveProperty("max_tokens");
  });

  it("passa pelo AI Gateway configurado", async () => {
    const pedidos: unknown[][] = [];
    const ai = { run: async (...args: unknown[]) => { pedidos.push(args); return { choices: [{ message: { content: "oi" } }] }; } } as unknown as Ai;
    await criarModelo(ai, "@cf/autor/modelo-x", { gateway: "gw-teste" })([{ role: "user", content: "oi" }], []);
    expect(pedidos[0]![2]).toEqual({ gateway: { id: "gw-teste" } });
  });
});

describe("modelo reserva", () => {
  const ok = (texto: string) => ({ choices: [{ message: { content: texto } }] });

  it("reserva assume quando o principal falha", async () => {
    const chamados: string[] = [];
    const ai = {
      run: async (modelo: string) => {
        chamados.push(modelo);
        if (modelo === "principal/x") throw new Error("429: Too Many Requests");
        return ok("resposta do reserva");
      },
    } as unknown as Ai;
    const resposta = await criarModelo(ai, "principal/x", { reserva: "reserva/y", gateway: "gw" })([{ role: "user", content: "oi" }], []);
    expect(resposta.texto).toBe("resposta do reserva");
    expect(chamados).toEqual(["principal/x", "reserva/y"]);
  });

  it("reserva assume quando o principal passa do prazo", async () => {
    const ai = {
      run: (modelo: string) => modelo === "principal/x" ? new Promise(() => {}) : Promise.resolve(ok("rápido")),
    } as unknown as Ai;
    const resposta = await criarModelo(ai, "principal/x", { reserva: "reserva/y", tempoDoPrincipalMs: 20 })([{ role: "user", content: "oi" }], []);
    expect(resposta.texto).toBe("rápido");
  });

  it("principal que responde não chama o reserva", async () => {
    const chamados: string[] = [];
    const ai = { run: async (modelo: string) => { chamados.push(modelo); return ok("do principal"); } } as unknown as Ai;
    const resposta = await criarModelo(ai, "principal/x", { reserva: "reserva/y" })([{ role: "user", content: "oi" }], []);
    expect(resposta.texto).toBe("do principal");
    expect(chamados).toEqual(["principal/x"]);
  });

  it("sem reserva, a falha do principal sobe para o loop", async () => {
    const ai = { run: async () => { throw new Error("fora do ar"); } } as unknown as Ai;
    await expect(criarModelo(ai, "principal/x", {})([], [])).rejects.toThrow("fora do ar");
  });

  it("sem opções, lê o gateway e o reserva do ambiente dev", async () => {
    const chamados: unknown[][] = [];
    const ai = {
      run: async (...args: unknown[]) => {
        chamados.push(args);
        if (chamados.length === 1) throw new Error("falhou");
        return ok("ok");
      },
    } as unknown as Ai;
    await criarModelo(ai, "@cf/openai/gpt-oss-120b")([{ role: "user", content: "oi" }], []);
    expect(chamados.map((c) => c[0])).toEqual(["@cf/openai/gpt-oss-120b", "@cf/deepseek-ai/deepseek-v4.1-flash-1017"]);
    expect(chamados[1]![2]).toEqual({ gateway: { id: "concierge-dev" } });
  });
});
