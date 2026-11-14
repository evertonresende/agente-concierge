import { describe, expect, it, vi } from "vitest";
import { CONTINGENCIA, rodarTurno } from "../src/agente/loop";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarModelo } from "../src/modelo";
import { criarContexto, criarMundo } from "./apoio";

// `producao` hoje: Haiku de principal, mas sem gateway (P10) nem chave. Sem gateway o
// adaptador nem chama o Haiku: o reserva responde direto, ou sai o aviso honesto.
const HAIKU = "anthropic/claude-haiku-5.5";
const RESERVA = "@cf/zai-org/glm-5.3-flash";

function aiDeProducao(reservaNoAr: boolean): { ai: Ai; chamados: string[] } {
  const chamados: string[] = [];
  const ai = {
    run: async (modelo: string, _entrada: unknown, opcoes?: { gateway?: unknown }) => {
      chamados.push(modelo);
      if (modelo.startsWith("anthropic/") && !opcoes?.gateway) throw new Error("AiGatewayError: third-party models require a gateway");
      if (!reservaNoAr) throw new Error("AiError: 3040: capacity temporarily exceeded");
      return { choices: [{ message: { content: "Resposta do reserva." } }] };
    },
  } as unknown as Ai;
  return { ai, chamados };
}

function turno(ai: Ai) {
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const modelo = criarModelo(ai, HAIKU, { reserva: RESERVA, esforco: "medium" });
  return rodarTurno({ mensagem: "Oi", historico: [], houveHandoff: false, contexto: criarContexto(criarMundo(), cofre, 1, "Oi"), modelo, prazo: Date.now() + 5_000 });
}

describe("producao sem gateway para o Haiku", () => {
  it("sem gateway o principal não é chamado e o reserva responde", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ai, chamados } = aiDeProducao(true);
    const saida = await turno(ai);
    const linhas = aviso.mock.calls.map((c) => String(c[0]));
    aviso.mockRestore();
    expect(saida.reply).toBe("Resposta do reserva.");
    expect(saida.handoff).toBe(false);
    expect(chamados).toEqual([RESERVA]);
    expect(linhas.filter((l) => l.includes("principal_pulado"))).toHaveLength(1);
    expect(linhas.join("\n")).toContain("sem AI_GATEWAY");
  });

  it("principal_pulado sai uma vez por turno, também quando o loop repete a primeira chamada", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const ai = { run: async () => (++n === 1 ? { choices: [{ message: { content: "" } }] } : { choices: [{ message: { content: "Resposta do reserva." } }] }) } as unknown as Ai;
    const saida = await turno(ai);
    const linhas = aviso.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("principal_pulado"));
    aviso.mockRestore();
    expect(n).toBe(2);
    expect(saida.reply).toBe("Resposta do reserva.");
    expect(linhas).toHaveLength(1);
  });

  it("sem gateway, uso.chamadas conta só a chamada real ao reserva", async () => {
    const { ai } = aiDeProducao(true);
    const r = await criarModelo(ai, HAIKU, { reserva: RESERVA })([{ role: "user", content: "oi" }], []);
    expect(r.uso.chamadas).toBe(1);
  });

  it("com gateway o principal é chamado", async () => {
    const chamados: string[] = [];
    const ai = { run: async (m: string) => { chamados.push(m); return { stop_reason: "end_turn", content: [{ type: "text", text: "do Haiku" }] }; } } as unknown as Ai;
    const r = await criarModelo(ai, HAIKU, { reserva: RESERVA, gateway: "gw" })([{ role: "user", content: "oi" }], []);
    expect(r.texto).toBe("do Haiku");
    expect(chamados).toEqual([HAIKU]);
  });

  it("o reserva também falha: aviso honesto com handoff, sem lançar", async () => {
    const { ai } = aiDeProducao(false);
    const saida = await turno(ai);
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
    expect(saida.contingencia).toBe(true);
  });
});
