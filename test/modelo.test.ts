import { describe, expect, it } from "vitest";
import { criarModelo, lerRespostaAnthropic, type Mensagem, normalizarResposta, parametros, pedidoAnthropic } from "../src/modelo";

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
    expect(parametros("@cf/zai-org/glm-5.3")).toMatchObject({ reasoning_effort: "low" });
    expect(parametros("@cf/zai-org/glm-5.3-flash")).toMatchObject({ reasoning_effort: "low" });
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
    expect(chamados.map((c) => c[0])).toEqual(["@cf/openai/gpt-oss-120b", "@cf/zai-org/glm-5.3-flash"]);
    expect(chamados[1]![2]).toEqual({ gateway: { id: "concierge-dev" } });
  });
});

describe("recusa por limite (contrato L18)", () => {
  const limite = () => new Error("AiError: 3021: rate limiting: inference request per min rate reached");
  const ok = (texto: string) => ({ choices: [{ message: { content: texto } }] });

  it("principal recusa por limite: o reserva responde, 2 chamadas no total", async () => {
    const chamados: string[] = [];
    const ai = { run: async (m: string) => { chamados.push(m); if (m === "principal/x") throw limite(); return ok("do reserva"); } } as unknown as Ai;
    const r = await criarModelo(ai, "principal/x", { reserva: "reserva/y" })([{ role: "user", content: "oi" }], []);
    expect(r.texto).toBe("do reserva");
    expect(chamados).toEqual(["principal/x", "reserva/y"]);
  });

  it("principal e reserva recusam por limite: erro com porLimite, 2 chamadas no total", async () => {
    const chamados: string[] = [];
    const ai = { run: async (m: string) => { chamados.push(m); throw limite(); } } as unknown as Ai;
    const erro = await criarModelo(ai, "principal/x", { reserva: "reserva/y" })([], []).catch((e: unknown) => e);
    expect(erro).toMatchObject({ porLimite: true });
    expect(chamados).toHaveLength(2);
  });

  it("sem reserva, recusa por limite sai com porLimite", async () => {
    const ai = { run: async () => { throw limite(); } } as unknown as Ai;
    await expect(criarModelo(ai, "principal/x", {})([], [])).rejects.toMatchObject({ porLimite: true });
  });

  it("erro de outra natureza segue como antes, sem porLimite", async () => {
    const ai = { run: async (m: string) => { if (m === "principal/x") throw new Error("fora do ar"); throw new Error("também fora"); } } as unknown as Ai;
    const erro = await criarModelo(ai, "principal/x", { reserva: "reserva/y" })([], []).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toHaveProperty("porLimite");
    // principal por outro motivo e reserva por limite: o loop ainda pode tentar de novo
    const ai2 = { run: async (m: string) => { if (m === "principal/x") throw new Error("fora do ar"); throw limite(); } } as unknown as Ai;
    expect(await criarModelo(ai2, "principal/x", { reserva: "reserva/y" })([], []).catch((e: unknown) => e)).not.toHaveProperty("porLimite");
  });
});

describe("modelos da Anthropic (formato Messages)", () => {
  const ferramenta = { type: "function" as const, function: { name: "cotar", description: "Cota", parameters: { type: "object", properties: { imovel_id: { type: "string" } } } } };
  const historico: Mensagem[] = [
    { role: "system", content: "Você é o concierge." },
    { role: "user", content: "Quanto fica o GRM-301?" },
    { role: "assistant", content: "", tool_calls: [
      { id: "toolu_1", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-301"}' } },
      { id: "toolu_2", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-302"}' } },
    ] },
    { role: "tool", tool_call_id: "toolu_1", content: '{"total":"R$ 2.156,00"}' },
    { role: "tool", tool_call_id: "toolu_2", content: '{"total":"R$ 1.330,00"}' },
  ];

  it("monta o pedido: system à parte, sem temperature, esforço em output_config e ferramentas com input_schema", () => {
    const p = pedidoAnthropic(historico, [ferramenta], "low");
    expect(p.system).toBe("Você é o concierge.");
    expect(p).not.toHaveProperty("temperature");
    expect(p.output_config).toEqual({ effort: "low" });
    expect(p.tools).toEqual([{ name: "cotar", description: "Cota", input_schema: ferramenta.function.parameters }]);
  });

  it("nível de raciocínio ausente ou inválido vira medium", () => {
    expect(pedidoAnthropic(historico, [], undefined).output_config).toEqual({ effort: "medium" });
    expect(pedidoAnthropic(historico, [], "").output_config).toEqual({ effort: "medium" });
    expect(pedidoAnthropic(historico, [], "altíssimo").output_config).toEqual({ effort: "medium" });
    expect(pedidoAnthropic(historico, [], "high").output_config).toEqual({ effort: "high" });
  });

  it("devolve todos os resultados de ferramenta do turno numa única mensagem do usuário", () => {
    const { messages } = pedidoAnthropic(historico, [], undefined) as { messages: { role: string; content: Record<string, unknown>[] }[] };
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[1]!.content).toEqual([
      { type: "tool_use", id: "toolu_1", name: "cotar", input: { imovel_id: "GRM-301" } },
      { type: "tool_use", id: "toolu_2", name: "cotar", input: { imovel_id: "GRM-302" } },
    ]);
    expect(messages[2]!.content.map((b) => b.tool_use_id)).toEqual(["toolu_1", "toolu_2"]);
  });

  it("lê texto, chamadas e uso; ignora o raciocínio no texto", () => {
    const bruto = {
      stop_reason: "tool_use",
      content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "Vou cotar." }, { type: "tool_use", id: "toolu_1", name: "cotar", input: { imovel_id: "GRM-301" } }],
      usage: { input_tokens: 100, cache_read_input_tokens: 20, output_tokens: 30 },
    };
    const r = lerRespostaAnthropic(bruto);
    expect(r.texto).toBe("Vou cotar.");
    expect(r.chamadas).toEqual([{ id: "toolu_1", type: "function", function: { name: "cotar", arguments: '{"imovel_id":"GRM-301"}' } }]);
    expect(r.uso).toEqual({ entrada: 120, saida: 30 });
  });

  it("recusa do Claude (stop_reason refusal) passa ao reserva", async () => {
    const chamados: unknown[][] = [];
    const ai = {
      run: async (...args: unknown[]) => {
        chamados.push(args);
        return args[0] === "anthropic/claude-haiku-5.5" ? { stop_reason: "refusal", content: [] } : { choices: [{ message: { content: "do reserva" } }] };
      },
    } as unknown as Ai;
    const r = await criarModelo(ai, "anthropic/claude-haiku-5.5", { reserva: "@cf/zai-org/glm-5.3-flash", gateway: "gw", esforco: "medium" })([{ role: "user", content: "oi" }], [ferramenta]);
    expect(r.texto).toBe("do reserva");
    expect(chamados[0]![1]).toMatchObject({ max_tokens: 8000, output_config: { effort: "medium" }, messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }] });
    expect(chamados[1]![1]).toMatchObject({ messages: [{ role: "user", content: "oi" }], tools: [ferramenta] });
    expect(chamados.map((c) => c[2])).toEqual([{ gateway: { id: "gw" } }, { gateway: { id: "gw" } }]);
  });
});
