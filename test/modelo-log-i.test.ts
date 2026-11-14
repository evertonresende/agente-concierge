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

  it("valor lançado que não é Error sai como ErroDesconhecido", async () => {
    expect((await rodar(() => { throw "AiError: 3021"; })).falhas).toEqual(["ErroDesconhecido"]);
  });

  it("prazo do principal sai com o nome próprio (K31)", async () => {
    const { r, falhas } = await rodar(() => new Promise(() => {}), 10);
    expect(r.texto).toBe("Resposta do reserva.");
    expect(falhas).toEqual(["TempoDoPrincipal"]);
  });
});
