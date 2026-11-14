// Caminho sem AI_GATEWAY (principal anthropic/ pulado), vindo das sondas do verificador
// independente (rodada 2), adotado pela frente I.
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTINGENCIA, rodarTurno } from "../src/agente/loop";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarModelo, type Modelo } from "../src/modelo";
import { criarContexto, criarMundo } from "./apoio";

const HAIKU = "anthropic/claude-haiku-5.5";
const RESERVA = "@cf/zai-org/glm-5.3-flash";
const OK = { choices: [{ message: { content: "Resposta do reserva." } }] };
const limite = () => new Error("AiError: 3021: rate limiting: inference request per min rate reached");

function aiCom(haiku: () => unknown, reserva: () => unknown = () => OK) {
  const chamados: string[] = [];
  const terceiros: unknown[] = [];
  const ai = { run: async (m: string, _e: unknown, o: unknown) => { chamados.push(m); terceiros.push(o); return m === HAIKU ? haiku() : reserva(); } } as unknown as Ai;
  return { ai, chamados, terceiros };
}
function turno(modelo: Modelo) {
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  return rodarTurno({ mensagem: "Oi", historico: [], houveHandoff: false, contexto: criarContexto(criarMundo(), cofre, 1, "Oi"), modelo, prazo: Date.now() + 5_000 });
}
const haikuOk = () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "do Haiku" }] });

afterEach(() => vi.restoreAllMocks());

describe("F · sem AI_GATEWAY o principal anthropic/ é pulado", () => {
  it("opções explícitas sem gateway: principal 0 vezes, reserva sem terceiro argumento", async () => {
    const { ai, chamados, terceiros } = aiCom(haikuOk);
    const r = await criarModelo(ai, HAIKU, { reserva: RESERVA })([{ role: "user", content: "oi" }], []);
    expect(chamados).toEqual([RESERVA]);
    expect(terceiros).toEqual([undefined]);
    expect(r.uso.chamadas).toBe(1);
  });

  it("gateway string vazia: principal 0 vezes", async () => {
    const { ai, chamados } = aiCom(haikuOk);
    await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "" })([{ role: "user", content: "oi" }], []);
    expect(chamados).toEqual([RESERVA]);
  });

  it("variável AI_GATEWAY vazia no ambiente (caminho de producao, sem opções): principal 0 vezes", async () => {
    const vars = env as unknown as Record<string, unknown>;
    const antes = vars.AI_GATEWAY;
    vars.AI_GATEWAY = "";
    try {
      const { ai, chamados } = aiCom(haikuOk);
      await criarModelo(ai, HAIKU)([{ role: "user", content: "oi" }], []);
      expect(chamados).toEqual([RESERVA]);
    } finally {
      vars.AI_GATEWAY = antes;
    }
  });

  it("variável AI_GATEWAY presente no ambiente (dev): principal chamado com o gateway", async () => {
    const { ai, chamados, terceiros } = aiCom(haikuOk);
    const r = await criarModelo(ai, HAIKU)([{ role: "user", content: "oi" }], []);
    expect(chamados).toEqual([HAIKU]);
    expect(terceiros).toEqual([{ gateway: { id: "concierge-dev" } }]);
    expect(r.texto).toBe("do Haiku");
  });

  it("principal que não é anthropic/ sem gateway continua sendo chamado", async () => {
    const { ai, chamados } = aiCom(haikuOk);
    await criarModelo(ai, "@cf/deepseek-ai/deepseek-v4.1-flash-1017", { reserva: RESERVA })([{ role: "user", content: "oi" }], []);
    expect(chamados).toEqual(["@cf/deepseek-ai/deepseek-v4.1-flash-1017"]);
  });

  it("reserva falhando nesse caminho: aviso honesto com handoff e o Haiku nunca chamado", async () => {
    const { ai, chamados } = aiCom(haikuOk, () => { throw new Error("AiError: 3040: capacity temporarily exceeded"); });
    const saida = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA }));
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
    expect(chamados.every((m) => m === RESERVA)).toBe(true);
  });

  it("reserva inútil (vazio) nesse caminho: aviso honesto com handoff", async () => {
    const { ai } = aiCom(haikuOk, () => ({ choices: [{ message: { content: "" } }] }));
    const saida = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA }));
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
  });

  it("L18 nesse caminho: o reserva é o único modelo; recusa por limite sai como porLimite (igual ao caminho sem reserva)", async () => {
    // caminho sem reserva: um modelo só, recusa por limite → porLimite (o loop não repete)
    const so = { run: async () => { throw limite(); } } as unknown as Ai;
    const semReserva = await criarModelo(so, RESERVA, {})([{ role: "user", content: "oi" }], []).catch((e: unknown) => e);
    expect((semReserva as { porLimite?: boolean }).porLimite).toBe(true);
    // caminho sem gateway: também um modelo só chamado
    const { ai, chamados } = aiCom(haikuOk, () => { throw limite(); });
    const pulado = await criarModelo(ai, HAIKU, { reserva: RESERVA })([{ role: "user", content: "oi" }], []).catch((e: unknown) => e);
    expect(chamados).toEqual([RESERVA]);
    expect((pulado as { porLimite?: boolean }).porLimite).toBe(true);
  });

  it("registro principal_pulado: uma linha por turno, sem valor de variável, mesmo com nova tentativa do loop", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const { ai } = aiCom(haikuOk, () => (++n === 1 ? { choices: [{ message: { content: "" } }] } : OK));
    const saida = await turno(criarModelo(ai, HAIKU, { reserva: RESERVA }));
    const linhas = aviso.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("principal_pulado"));
    console.log(JSON.stringify({ caso: "principal_pulado com nova tentativa", linhas: linhas.length, reply: saida.reply }));
    for (const l of linhas) expect(l).not.toContain("concierge");
    expect(linhas).toHaveLength(1);
  });
});
