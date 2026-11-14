// Casos do adaptador do modelo vindos das sondas do verificador independente (rodada 2),
// adotados pela frente I. Cada teste afirma o comportamento certo.
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTINGENCIA, rodarTurno } from "../src/agente/loop";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarModelo, lerRespostaAnthropic, type Mensagem, type Modelo, normalizarResposta, pedidoAnthropic } from "../src/modelo";
import { criarContexto, criarMundo } from "./apoio";

const HAIKU = "anthropic/claude-haiku-5.5";
const RESERVA = "@cf/zai-org/glm-5.3-flash";
const DO_RESERVA = "Resposta do reserva.";
const OK_RESERVA = { choices: [{ message: { content: DO_RESERVA } }], usage: { prompt_tokens: 7, completion_tokens: 3 } };
const limite = () => new Error("AiError: 3021: rate limiting: inference request per min rate reached");

function turno(modelo: Modelo, historico: Mensagem[] = [], mensagem = "Quais cidades vocês atendem?") {
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const mundo = criarMundo();
  return rodarTurno({ mensagem, historico, houveHandoff: false, contexto: criarContexto(mundo, cofre, 1, mensagem), modelo, prazo: Date.now() + 5_000 })
    .then((saida) => ({ saida, mundo }));
}

/** Haiku devolve `bruto` em toda chamada; o reserva responde texto fixo. */
function aiCom(bruto: () => unknown, reserva: () => unknown = () => OK_RESERVA) {
  const chamados: string[] = [];
  const ai = { run: async (m: string) => { chamados.push(m); return m === HAIKU ? bruto() : reserva(); } } as unknown as Ai;
  return { ai, chamados };
}

const H = (chamados: string[]) => chamados.map((m) => (m === HAIKU ? "H" : "R")).join("");

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------------
describe("A · resposta inútil do principal: o reserva responde e nada do Haiku vaza", () => {
  const ferramentaCortada = { type: "tool_use", id: "toolu_1", name: "listar_cidades", input: {} };
  const casos: [string, unknown][] = [
    ["200 sem corpo (undefined)", undefined],
    ["200 com null", null],
    ["200 com string vazia", ""],
    ["200 com objeto vazio", {}],
    ["content vazio com end_turn", { stop_reason: "end_turn", content: [] }],
    ["só raciocínio com end_turn", { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "x", signature: "s" }] }],
    ["max_tokens com texto cortado", { stop_reason: "max_tokens", content: [{ type: "text", text: "O total da estadia fica em" }] }],
    ["max_tokens no meio de tool_use (entrada parcial)", { stop_reason: "max_tokens", content: [{ type: "text", text: "Vou ver." }, ferramentaCortada] }],
    ["stop_reason ausente com texto", { content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["stop_reason null com texto", { stop_reason: null, content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["stop_reason desconhecido com texto", { stop_reason: "algo_novo", content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["stop_reason numérico com texto", { stop_reason: 1, content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["refusal com texto", { stop_reason: "refusal", content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["pause_turn com texto", { stop_reason: "pause_turn", content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["model_context_window_exceeded com texto", { stop_reason: "model_context_window_exceeded", content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["objeto type:error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }],
    ["objeto type:error com stop_reason end_turn e texto", { type: "error", stop_reason: "end_turn", content: [{ type: "text", text: "HAIKU-VAZOU" }] }],
    ["texto que não é JSON", "Internal Server Error"],
    ["HTML de 502", "<html>502 Bad Gateway</html>"],
    ["end_turn com texto só de espaços", { stop_reason: "end_turn", content: [{ type: "text", text: "   \n\t " }] }],
    ["end_turn com text não-string", { stop_reason: "end_turn", content: [{ type: "text", text: 42 }] }],
    ["tool_use sem nome", { stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_1", input: {} }] }],
    ["content que não é lista", { stop_reason: "end_turn", content: "HAIKU-VAZOU" }],
  ];

  for (const [nome, bruto] of casos) {
    it(`${nome}: chamadas HR, resposta do reserva, nenhuma ferramenta executada`, async () => {
      const { ai, chamados } = aiCom(() => bruto);
      const { saida, mundo } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
      expect(saida.reply).toBe(DO_RESERVA);
      expect(saida.reply).not.toContain("HAIKU-VAZOU");
      expect(H(chamados)).toBe("HR");
      expect(saida.ferramentas).toEqual([]);
      expect(mundo.pedidosAoCatalogo).toEqual([]);
    });
  }

  it("tool_use declarado no stop_reason mas sem bloco de ferramenta (só texto): não vai ao hóspede", async () => {
    const { ai, chamados } = aiCom(() => ({ stop_reason: "tool_use", content: [{ type: "text", text: "Vou consultar a disponibilidade, um instante." }] }));
    const { saida } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    expect(saida.reply).not.toBe("Vou consultar a disponibilidade, um instante.");
    expect(H(chamados)).toBe("HR");
  });

  it("tool_use declarado no stop_reason, bloco de ferramenta sem nome e texto: não vai ao hóspede", async () => {
    const { ai, chamados } = aiCom(() => ({ stop_reason: "tool_use", content: [{ type: "text", text: "Vou cotar." }, { type: "tool_use", id: "toolu_1", input: {} }] }));
    const { saida } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    expect(saida.reply).not.toBe("Vou cotar.");
    expect(H(chamados)).toBe("HR");
  });

  it("bloco de ferramenta com stop_reason end_turn: a ferramenta não roda e o reserva responde", async () => {
    let n = 0;
    const { ai, chamados } = aiCom(() => (++n === 1
      ? { stop_reason: "end_turn", content: [{ type: "tool_use", id: "toolu_1", name: "listar_cidades", input: {} }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "Gramado e Rio." }] }));
    const { saida, mundo } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    console.log(JSON.stringify({ caso: "tool_use com end_turn", chamados: H(chamados), reply: saida.reply, ferramentas: saida.ferramentas }));
    expect(mundo.pedidosAoCatalogo).toEqual([]);
    expect(H(chamados)).toBe("HR");
  });

  it("tool_use com input que não é objeto (string): ferramenta não é executada e nada do Haiku chega ao hóspede", async () => {
    let n = 0;
    const { ai, chamados } = aiCom(() => (++n === 1
      ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_1", name: "ver_imovel", input: "GRM-301" }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "Segunda volta do Haiku." }] }));
    const { saida, mundo } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    console.log(JSON.stringify({ caso: "input string", chamados: H(chamados), reply: saida.reply, catalogo: mundo.pedidosAoCatalogo }));
    expect(mundo.pedidosAoCatalogo).toEqual([]);
    expect(saida.reply).not.toBe(CONTINGENCIA);
  });

  it("tool_use com input null: não executa a ferramenta com argumentos inventados ({})", async () => {
    let n = 0;
    const { ai, chamados } = aiCom(() => (++n === 1
      ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_1", name: "listar_cidades", input: null }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "Segunda volta do Haiku." }] }));
    const { saida, mundo } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    console.log(JSON.stringify({ caso: "input null", chamados: H(chamados), reply: saida.reply, ferramentas: saida.ferramentas, catalogo: mundo.pedidosAoCatalogo }));
    expect(mundo.pedidosAoCatalogo).toEqual([]);
  });

  it("tool_use com nome de ferramenta inexistente: nada executado, nada do Haiku chega ao hóspede", async () => {
    let n = 0;
    const { ai, chamados } = aiCom(() => (++n === 1
      ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_1", name: "apagar_tudo", input: {} }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "Segunda volta do Haiku." }] }));
    const { saida, mundo } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    console.log(JSON.stringify({ caso: "ferramenta inexistente", chamados: H(chamados), reply: saida.reply, ferramentas: saida.ferramentas }));
    expect(mundo.pedidosAoCatalogo).toEqual([]);
    expect(mundo.leads).toEqual([]);
    expect(saida.reply).toBe("Segunda volta do Haiku.");
  });

  it("sem reserva, resposta inútil do Haiku vira aviso honesto com handoff (nada do Haiku vaza)", async () => {
    const { ai, chamados } = aiCom(() => ({ stop_reason: "max_tokens", content: [{ type: "text", text: "HAIKU-VAZOU cortado em" }] }));
    const { saida } = await turno(criarModelo(ai, HAIKU, { gateway: "gw" }));
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
    expect(H(chamados)).toBe("HH");
  });

  it("reserva também inútil (vazio): aviso honesto com handoff", async () => {
    const { ai } = aiCom(() => ({ stop_reason: "max_tokens", content: [] }), () => ({ choices: [{ message: { content: "" } }] }));
    const { saida } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
  });
});

// ---------------------------------------------------------------------------------
type Bloco = Record<string, unknown>;
function blocosDoPedido(historico: Mensagem[]) {
  const { messages } = pedidoAnthropic(historico, [], undefined) as { messages: { role: string; content: Bloco[] }[] };
  return messages;
}
const chamada = (id: string, name = "listar_cidades") => ({ id, type: "function" as const, function: { name, arguments: "{}" } });

/** Cada tool_result aponta para um tool_use da mensagem assistant imediatamente anterior, 1 para 1, e vice-versa. */
function conferirPareamento(messages: { role: string; content: Bloco[] }[]) {
  const todosUsos: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    const usos = m.content.filter((b) => b.type === "tool_use").map((b) => b.id as string);
    todosUsos.push(...usos);
    for (const id of usos) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    if (usos.length > 0) {
      const seguinte = messages[i + 1];
      expect(seguinte?.role).toBe("user");
      const resultados = (seguinte?.content ?? []).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id as string);
      expect([...resultados].sort()).toEqual([...usos].sort());
    }
    if (m.role === "user") {
      const resultados = m.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id as string);
      if (resultados.length > 0) {
        const anterior = messages[i - 1];
        const usosAnteriores = (anterior?.content ?? []).filter((b) => b.type === "tool_use").map((b) => b.id as string);
        for (const r of resultados) expect(usosAnteriores).toContain(r);
        expect(new Set(resultados).size).toBe(resultados.length);
      }
    }
  }
  expect(new Set(todosUsos).size).toBe(todosUsos.length);
}

describe("B · ids de chamada no pedido ao Haiku", () => {
  it("a.b e a_b no mesmo turno", () => {
    conferirPareamento(blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("a.b"), chamada("a_b")] },
      { role: "tool", tool_call_id: "a.b", content: "1" }, { role: "tool", tool_call_id: "a_b", content: "2" },
      { role: "assistant", content: "ok" }, { role: "user", content: "b" },
    ]));
  });

  it("functions.cotar:0 e functions_cotar_0 no mesmo turno, resultados em ordem invertida", () => {
    const msgs = blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("functions.cotar:0", "cotar"), chamada("functions_cotar_0", "cotar")] },
      { role: "tool", tool_call_id: "functions_cotar_0", content: "segundo" }, { role: "tool", tool_call_id: "functions.cotar:0", content: "primeiro" },
      { role: "user", content: "b" },
    ]);
    conferirPareamento(msgs);
    // e o conteúdo de cada resultado segue a sua chamada
    const usos = msgs[1]!.content.filter((b) => b.type === "tool_use").map((b) => b.id);
    const res = msgs[2]!.content.filter((b) => b.type === "tool_result");
    expect(res.find((b) => b.content === "primeiro")!.tool_use_id).toBe(usos[0]);
    expect(res.find((b) => b.content === "segundo")!.tool_use_id).toBe(usos[1]);
  });

  it("id vazio em dois turnos diferentes", () => {
    conferirPareamento(blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("")] }, { role: "tool", tool_call_id: "", content: "1" },
      { role: "assistant", content: "ok" }, { role: "user", content: "b" },
      { role: "assistant", content: "", tool_calls: [chamada("")] }, { role: "tool", tool_call_id: "", content: "2" },
      { role: "user", content: "c" },
    ]));
  });

  it("id muito longo (300 caracteres) sai no padrão e casa", () => {
    const longo = "x".repeat(150) + ".:/" + "y".repeat(147);
    const msgs = blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada(longo)] }, { role: "tool", tool_call_id: longo, content: "1" },
      { role: "user", content: "b" },
    ]);
    conferirPareamento(msgs);
    console.log(JSON.stringify({ caso: "id longo", tamanho: (msgs[1]!.content[0]!.id as string).length }));
  });

  it("mesmo id repetido em turnos diferentes (toolu_1 duas vezes, call_0 três vezes)", () => {
    conferirPareamento(blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("toolu_1"), chamada("call_0")] },
      { role: "tool", tool_call_id: "toolu_1", content: "1" }, { role: "tool", tool_call_id: "call_0", content: "2" },
      { role: "assistant", content: "ok" }, { role: "user", content: "b" },
      { role: "assistant", content: "", tool_calls: [chamada("call_0")] }, { role: "tool", tool_call_id: "call_0", content: "3" },
      { role: "assistant", content: "", tool_calls: [chamada("toolu_1"), chamada("call_0")] },
      { role: "tool", tool_call_id: "toolu_1", content: "4" }, { role: "tool", tool_call_id: "call_0", content: "5" },
      { role: "user", content: "c" },
    ]));
  });

  it("sufixo de desempate colide com id original posterior (x, x, depois x_2)", () => {
    conferirPareamento(blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("x")] }, { role: "tool", tool_call_id: "x", content: "1" },
      { role: "assistant", content: "", tool_calls: [chamada("x")] }, { role: "tool", tool_call_id: "x", content: "2" },
      { role: "assistant", content: "", tool_calls: [chamada("x_2"), chamada("x.2")] },
      { role: "tool", tool_call_id: "x_2", content: "3" }, { role: "tool", tool_call_id: "x.2", content: "4" },
      { role: "user", content: "b" },
    ]));
  });

  it("histórico misto: reserva (call_<hex>) e depois Haiku (toolu_), e o inverso", () => {
    conferirPareamento(blocosDoPedido([
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: [chamada("call_9f8e7d6c5b4a39281706f5e4d3c2b1a0")] },
      { role: "tool", tool_call_id: "call_9f8e7d6c5b4a39281706f5e4d3c2b1a0", content: "1" },
      { role: "assistant", content: "", tool_calls: [chamada("toolu_01ABC"), chamada("chatcmpl-tool-9f")] },
      { role: "tool", tool_call_id: "toolu_01ABC", content: "2" }, { role: "tool", tool_call_id: "chatcmpl-tool-9f", content: "3" },
      { role: "assistant", content: "ok" }, { role: "user", content: "b" },
      { role: "assistant", content: "Vou ver.", tool_calls: [chamada("toolu_01ABC")] }, { role: "tool", tool_call_id: "toolu_01ABC", content: "4" },
      { role: "assistant", content: "", tool_calls: [chamada("functions.ver_imovel:0", "ver_imovel")] },
      { role: "tool", tool_call_id: "functions.ver_imovel:0", content: "5" },
      { role: "user", content: "c" },
    ]));
  });

  it("o MESMO id duas vezes na MESMA resposta (reserva devolve call_0 duas vezes)", () => {
    const resposta = normalizarResposta({ choices: [{ message: { content: null, tool_calls: [
      { id: "call_0", type: "function", function: { name: "listar_cidades", arguments: "{}" } },
      { id: "call_0", type: "function", function: { name: "buscar_imoveis", arguments: "{\"cidade\":\"Gramado\"}" } },
    ] } }] });
    // o loop grava uma mensagem tool por chamada, cada uma com o id da chamada
    const historico: Mensagem[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "", tool_calls: resposta.chamadas },
      ...resposta.chamadas.map((c, i): Mensagem => ({ role: "tool", tool_call_id: c.id, content: `r${i}` })),
      { role: "user", content: "b" },
    ];
    const msgs = blocosDoPedido(historico);
    console.log(JSON.stringify({ caso: "id repetido na mesma resposta", ids: resposta.chamadas.map((c) => c.id), pedido: msgs.slice(1, 3).map((m) => m.content.map((b) => b.id ?? b.tool_use_id)) }));
    conferirPareamento(msgs);
  });

  it("o MESMO id duas vezes na MESMA resposta, de ponta a ponta: o turno seguinte ao Haiku sai com pedido válido", async () => {
    // turno 1: Haiku falha, reserva pede duas ferramentas com o mesmo id; turno 1 volta ao Haiku
    const pedidos: { m: string; e: Record<string, unknown> }[] = [];
    let h = 0;
    const ai = {
      run: async (m: string, e: Record<string, unknown>) => {
        pedidos.push({ m, e: structuredClone(e) });
        if (m === HAIKU) {
          h++;
          if (h === 1) throw new Error("AiGatewayError: 500 Internal Server Error");
          return { stop_reason: "end_turn", content: [{ type: "text", text: "Gramado e Rio." }], usage: {} };
        }
        return { choices: [{ message: { content: null, tool_calls: [
          { id: "call_0", type: "function", function: { name: "listar_cidades", arguments: "{}" } },
          { id: "call_0", type: "function", function: { name: "listar_cidades", arguments: "{}" } },
        ] } }] };
      },
    } as unknown as Ai;
    const { saida } = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" }));
    expect(saida.reply).toBe("Gramado e Rio.");
    const pedidoAoHaiku = pedidos.filter((p) => p.m === HAIKU).at(-1)!.e as { messages: { role: string; content: Bloco[] }[] };
    conferirPareamento(pedidoAoHaiku.messages);
  });
});

// ---------------------------------------------------------------------------------
describe("C · contagem de chamadas reais (uso.chamadas)", () => {
  it("adaptador: principal responde → 1", async () => {
    const { ai } = aiCom(() => ({ stop_reason: "end_turn", content: [{ type: "text", text: "oi" }] }));
    expect((await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([{ role: "user", content: "oi" }], [])).uso.chamadas).toBe(1);
  });
  it("adaptador: principal lança, reserva responde → 2", async () => {
    const { ai } = aiCom(() => { throw new Error("500"); });
    expect((await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([{ role: "user", content: "oi" }], [])).uso.chamadas).toBe(2);
  });
  it("adaptador: principal inútil, reserva responde → 2", async () => {
    const { ai } = aiCom(() => ({ stop_reason: "max_tokens", content: [] }));
    expect((await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([{ role: "user", content: "oi" }], [])).uso.chamadas).toBe(2);
  });
  it("adaptador: principal pendurado, reserva responde → 2", async () => {
    const { ai } = aiCom(() => new Promise(() => {}));
    expect((await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw", tempoDoPrincipalMs: 20 })([{ role: "user", content: "oi" }], [])).uso.chamadas).toBe(2);
  });
  it("adaptador: os dois falham → o erro informa 2 chamadas", async () => {
    const { ai, chamados } = aiCom(() => { throw new Error("500"); }, () => { throw new Error("502"); });
    const erro = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([{ role: "user", content: "oi" }], []).catch((e: unknown) => e);
    expect(chamados.length).toBe(2);
    expect((erro as { chamadas?: number }).chamadas).toBe(2);
  });

  // A soma por turno (saida.uso.chamadas) fica com o loop da frente G.
});

// ---------------------------------------------------------------------------------
describe("D · log de falha (registrarFalha) não carrega dado sensível", () => {
  async function logDe(mensagem: string): Promise<string> {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ai = { run: async () => { throw new Error(mensagem); } } as unknown as Ai;
    await criarModelo(ai, HAIKU, { gateway: "gw" })([{ role: "user", content: "Sou Maria Souza, telefone 11 98765-4321" }], []).catch(() => {});
    const linhas = aviso.mock.calls.map((c) => String(c[0]));
    aviso.mockRestore();
    return linhas.join("\n");
  }

  it.each([
    ["URL com esquema", "falhou em https://gw.exemplo.invalid/v1/conta/gw/anthropic", "gw.exemplo.invalid"],
    ["URL com esquema em maiúsculas", "falhou em HTTPS://gw.exemplo.invalid/v1", "gw.exemplo.invalid"],
    ["hex de 32 (id de conta)", "conta 0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef"],
    ["host sem esquema", "connect failed to api.exemplo.invalid:443", "api.exemplo.invalid"],
    ["token Bearer", "invalid header Authorization: Bearer abcDEF123_tokenSecretoXYZ987", "tokenSecretoXYZ987"],
    ["chave estilo sk-", "invalid x-api-key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv", "sk-ant-api03"],
    ["nome e telefone ecoados do pedido", "400 invalid content: 'Sou Maria Souza, telefone 11 98765-4321'", "98765-4321"],
    ["nome ecoado do pedido", "400 invalid content: 'Sou Maria Souza, telefone 11 98765-4321'", "Maria Souza"],
  ])("%s não aparece no log", async (_n, mensagem, proibido) => {
    const log = await logDe(mensagem);
    expect(log).toContain("modelo_falhou");
    console.log(JSON.stringify({ caso: _n, log }));
    expect(log).not.toContain(proibido);
  });

  it("o corpo do pedido nunca entra no log (só a mensagem do erro)", async () => {
    const log = await logDe("500 Internal Server Error");
    expect(log).not.toContain("Maria");
    expect(log).not.toContain("98765");
  });
});

// ---------------------------------------------------------------------------------
describe("E · regressões do que valia em a071311", () => {
  it("system separado, ferramentas em input_schema, histórico com ferramenta e esforço", () => {
    const corpo = pedidoAnthropic([
      { role: "system", content: "Regras A." }, { role: "system", content: "Regras B." },
      { role: "user", content: "oi" },
      { role: "assistant", content: "Vou ver.", tool_calls: [chamada("toolu_1", "cotar")] },
      { role: "tool", tool_call_id: "toolu_1", content: "{\"total\":1}" },
      { role: "assistant", content: "Fica R$ 1,00." }, { role: "user", content: "e?" },
    ], [{ type: "function", function: { name: "cotar", description: "d", parameters: { type: "object", properties: {} } } }], "low") as Record<string, unknown>;
    expect(corpo.system).toBe("Regras A.\n\nRegras B.");
    expect(corpo.tools).toEqual([{ name: "cotar", description: "d", input_schema: { type: "object", properties: {} } }]);
    expect(corpo.output_config).toEqual({ effort: "low" });
    expect(corpo.max_tokens).toBe(8000);
    expect(corpo).not.toHaveProperty("temperature");
    const msgs = corpo.messages as { role: string; content: Bloco[] }[];
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(msgs[1]!.content).toEqual([{ type: "text", text: "Vou ver." }, { type: "tool_use", id: "toolu_1", name: "cotar", input: {} }]);
    expect(msgs[2]!.content).toEqual([{ type: "tool_result", tool_use_id: "toolu_1", content: "{\"total\":1}" }]);
  });

  it("id do Haiku bem formado passa sem alteração (o Haiku reconhece o próprio id)", () => {
    const r = lerRespostaAnthropic({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "toolu_01AbC-d_9", name: "cotar", input: { a: 1 } }] });
    const msgs = blocosDoPedido([{ role: "user", content: "a" }, { role: "assistant", content: "", tool_calls: r.chamadas }, { role: "tool", tool_call_id: r.chamadas[0]!.id, content: "1" }]);
    expect(msgs[1]!.content[0]!.id).toBe("toolu_01AbC-d_9");
  });

  it.each([
    ["AiError: 3021: rate limiting", true], ["429 Too Many Requests", true], ["rate_limit_error", true],
    ["529 overloaded_error", false], ["AiError: 3040: capacity temporarily exceeded", false], ["500 Internal Server Error", false],
    ["resposta inútil do modelo (stop_reason max_tokens)", false], ["resposta inútil do modelo (stop_reason ausente, sem texto nem ferramenta)", false],
  ])("limite reconhecido só quando é limite: %s → %s", async (texto, esperado) => {
    const { ai } = aiCom(() => { throw new Error(texto); }, () => { throw limite(); });
    const erro = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([], []).catch((e: unknown) => e);
    expect((erro as { porLimite?: boolean }).porLimite === true).toBe(esperado);
  });

  it("resposta inútil do Haiku seguida de limite no reserva não é recusa por limite", async () => {
    const { ai } = aiCom(() => ({ stop_reason: "max_tokens", content: [] }), () => { throw limite(); });
    const erro = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([], []).catch((e: unknown) => e);
    expect(erro).not.toHaveProperty("porLimite");
  });

  it("prazo do principal: pendurado cede ao reserva no prazo", async () => {
    const { ai, chamados } = aiCom(() => new Promise(() => {}));
    const inicio = Date.now();
    const r = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw", tempoDoPrincipalMs: 50 })([], []);
    expect(r.texto).toBe(DO_RESERVA);
    expect(H(chamados)).toBe("HR");
    expect(Date.now() - inicio).toBeLessThan(1_000);
  });

  it("gateway vai nas duas chamadas; sem gateway, terceiro argumento é undefined", async () => {
    const terceiros: unknown[] = [];
    const ai = { run: async (m: string, _e: unknown, o: unknown) => { terceiros.push(o); if (m === HAIKU) throw new Error("500"); return OK_RESERVA; } } as unknown as Ai;
    await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([], []);
    await criarModelo(ai, RESERVA, {})([], []);
    expect(terceiros).toEqual([{ gateway: { id: "gw" } }, { gateway: { id: "gw" } }, undefined]);
  });
});
