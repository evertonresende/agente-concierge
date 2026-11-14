import { describe, expect, it } from "vitest";
import { CONTINGENCIA, rodarTurno } from "../src/agente/loop";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarModelo } from "../src/modelo";
import { criarContexto, criarMundo } from "./apoio";

// `producao` hoje: Haiku de principal, mas sem gateway (P10) nem chave. A binding recusa
// modelo de terceiro sem gateway; o turno tem de cair no reserva ou no aviso honesto.
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
  it("o principal falha e o reserva responde", async () => {
    const { ai, chamados } = aiDeProducao(true);
    const saida = await turno(ai);
    expect(saida.reply).toBe("Resposta do reserva.");
    expect(saida.handoff).toBe(false);
    expect(chamados).toEqual([HAIKU, RESERVA]);
  });

  it("o reserva também falha: aviso honesto com handoff, sem lançar", async () => {
    const { ai } = aiDeProducao(false);
    const saida = await turno(ai);
    expect(saida.reply).toBe(CONTINGENCIA);
    expect(saida.handoff).toBe(true);
    expect(saida.contingencia).toBe(true);
  });
});
