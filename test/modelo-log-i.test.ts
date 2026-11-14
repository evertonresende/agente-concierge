import { describe, expect, it, vi } from "vitest";
import { criarModelo } from "../src/modelo";

// Seguimentos da terceira rodada do verificador: o log de falha e os defeitos plantados
// K10, K11, K26 e K31.
const HAIKU = "anthropic/claude-haiku-5.5";
const RESERVA = "@cf/zai-org/glm-5.3-flash";
const doReserva = { choices: [{ message: { content: "Resposta do reserva." } }] };
const ferramenta = { type: "function" as const, function: { name: "cotar", description: "cota", parameters: { type: "object", properties: {} } } };

/** Principal devolve `haiku` (ou lança), reserva responde; guarda o log e as chamadas. */
async function rodar(haiku: () => unknown, tempoDoPrincipalMs?: number) {
  const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
  const chamados: string[] = [];
  const ai = { run: async (m: string) => { chamados.push(m); return m === HAIKU ? haiku() : doReserva; } } as unknown as Ai;
  const r = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw", tempoDoPrincipalMs })([{ role: "user", content: "oi" }], [ferramenta]);
  const falhas = aviso.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("modelo_falhou")).map((l) => JSON.parse(l).erro as string);
  aviso.mockRestore();
  return { r, chamados, falhas };
}

const lanca = (erro: Error) => () => { throw erro; };
const comNome = (nome: string, mensagem: string) => Object.assign(new Error(mensagem), { name: nome });

describe("log de falha: código só da posição de código, nome de lista fechada", () => {
  it.each([
    ["código logo depois do nome do erro", "AiError: 3021: rate limiting: inference request per min rate reached", "Error 3021"],
    ["código sem dois pontos depois", "AiError: 5007", "Error 5007"],
    ["telefone ecoado", "invalid content: 'telefone 11 98765-4321'", "Error"],
    ["telefone curto", "ligue 3333-4444", "Error"],
    ["endereço", "Rua das Flores, 1234, apto 502", "Error"],
    ["CEP", "CEP 30140-071", "Error"],
    ["data antes do código real", "[2026-11-14] upstream :443 AiGatewayError 7003", "Error"],
    ["padrão de código no meio da mensagem", "echo do pedido: 'FakeError: 1234'", "Error"],
    ["número de 5 dígitos na posição de código", "AiError: 30210: x", "Error"],
    ["token com trecho numérico (K26)", "AiError: invalid token abc1234def", "Error"],
  ])("%s", async (_n, mensagem, esperado) => {
    expect((await rodar(lanca(new Error(mensagem)))).falhas).toEqual([esperado]);
  });

  it("nome conhecido passa; nome livre sai como ErroDesconhecido", async () => {
    expect((await rodar(lanca(comNome("AiGatewayError", "AiGatewayError: 7003: x")))).falhas).toEqual(["AiGatewayError 7003"]);
    expect((await rodar(lanca(comNome("Maria Souza 11 98765-4321", "x")))).falhas).toEqual(["ErroDesconhecido"]);
  });

  it("classe da plataforma com o código no começo da mensagem; Error genérico não", async () => {
    expect((await rodar(lanca(comNome("AiGatewayError", "7003: does not support assistant message prefill")))).falhas).toEqual(["AiGatewayError 7003"]);
    expect((await rodar(lanca(comNome("AiError", "5007: No such model")))).falhas).toEqual(["AiError 5007"]);
    expect((await rodar(lanca(new Error("1234, apto 502")))).falhas).toEqual(["Error"]);
  });

  it.each(["502B ecoado", "1234abc", "2024Maria", "9876x5432", "1234_x"])("dígito colado em letra ou _ não é código: %s", async (mensagem) => {
    expect((await rodar(lanca(comNome("AiGatewayError", mensagem)))).falhas).toEqual(["AiGatewayError"]);
    expect((await rodar(lanca(new Error(`AiError: ${mensagem}`)))).falhas).toEqual(["Error"]);
  });

  it("valor lançado que não é Error sai como ErroDesconhecido", async () => {
    expect((await rodar(() => { throw "AiError: 3021"; })).falhas).toEqual(["ErroDesconhecido"]);
  });

  it("prazo do principal sai com o nome próprio (K31)", async () => {
    const { r, falhas } = await rodar(() => new Promise(() => {}), 10);
    expect(r.texto).toBe("Resposta do reserva.");
    expect(falhas).toEqual(["TempoDoPrincipal"]);
  });
});

describe("log de falha: motivo da resposta inútil numa palavra", () => {
  it.each([
    ["corte por max_tokens", { stop_reason: "max_tokens", content: [{ type: "text", text: "pela met" }] }, "corte"],
    ["recusa", { stop_reason: "refusal", content: [] }, "recusa"],
    ["fim desconhecido", { stop_reason: "pause_turn", content: [{ type: "text", text: "x" }] }, "fim_desconhecido"],
    ["fim que não bate", { stop_reason: "tool_use", content: [{ type: "text", text: "vou consultar" }] }, "fim_nao_bate"],
    ["vazia", { stop_reason: "end_turn", content: [] }, "vazia"],
    ["erro devolvido como valor", { type: "error", error: { type: "overloaded_error" } }, "erro_como_valor"],
  ])("%s", async (_n, bruto, motivo) => {
    const { r, falhas } = await rodar(() => bruto);
    expect(r.texto).toBe("Resposta do reserva.");
    expect(falhas).toEqual([`RespostaInutil ${motivo}`]);
  });
});

describe("chamada de ferramenta inválida vai ao reserva (K10, K11)", () => {
  it("input em lista não é aceito como argumentos (K10)", async () => {
    const { r, falhas } = await rodar(() => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "cotar", input: [] }] }));
    expect(r.chamadas).toEqual([]);
    expect(r.texto).toBe("Resposta do reserva.");
    expect(falhas).toEqual(["RespostaInutil ferramenta_invalida"]);
  });

  it("um bloco sem name ao lado de um válido não é descartado em silêncio (K11)", async () => {
    const { r, chamados } = await rodar(() => ({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "a", name: "cotar", input: {} }, { type: "tool_use", id: "b", input: {} }],
    }));
    expect(chamados).toEqual([HAIKU, RESERVA]);
    expect(r.chamadas).toEqual([]);
    expect(r.texto).toBe("Resposta do reserva.");
  });
});
