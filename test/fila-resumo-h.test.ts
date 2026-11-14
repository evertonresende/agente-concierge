// Fila da sessão e resumo ainda não entregue (frente H, B1 da terceira rodada do verificador):
// mensagem que entrou na fila com outro turno da mesma sessão em curso, ou na frente dela, não
// confirma resumo criado, alterado ou repetido por turno que terminou depois de ela chegar. A
// confirmação reapresenta o resumo, sem POST e sem chamar o modelo.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import { chaveDaReserva, type Reserva } from "../src/lead";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, pedeFerramentas } from "./apoio";

const ambiente = env as unknown as Env;
let proxima = 0;
const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DADOS = {
  imovel_id: "GRM-301",
  checkin: "15/01/2027",
  checkout: "18/01/2027",
  hospedes: 2,
  nome: "Ana Lima",
  telefone: "(11) 98888-0000",
};
const CONFIRMACOES = /^(sim|confirmo|pode fechar)$/;

/** Modelo falso que anota o que viu; "hospedes N" troca o resumo, confirmações confirmam. */
function modelo(vistas: string[], atrasoMs: () => number): Modelo {
  return async (mensagens: Mensagem[]) => {
    const ultima = mensagens[mensagens.length - 1]!;
    if (ultima.role === "tool") return diz("Certo.");
    vistas.push(ultima.content);
    await pausa(atrasoMs());
    if (ultima.content === "quero fechar") return pedeFerramentas(chamar("montar_resumo", DADOS));
    if (ultima.content.startsWith("hospedes ")) {
      return pedeFerramentas(chamar("montar_resumo", { ...DADOS, hospedes: Number(ultima.content.slice(9)) }));
    }
    if (CONFIRMACOES.test(ultima.content)) return pedeFerramentas(chamar("confirmar_reserva"));
    return diz(`resposta a ${ultima.content}`);
  };
}

async function abrir(vistas: string[], atrasoMs: () => number) {
  const id = `fila-resumo-h-${++proxima}`;
  const mundo = criarMundo();
  const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo: modelo(vistas, atrasoMs), buscar: mundo.buscar };
  });
  const usuarios = () => runInDurableObject(stub, (_s, state) =>
    state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
      .map((l) => JSON.parse(l.mensagem) as Mensagem)
      .filter((m) => m.role === "user")
      .map((m) => m.content));
  return { id, mundo, usuarios };
}

function postChat(sessionId: string, message: string): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), ambiente);
}

const MISTURAS: Record<number, string[]> = {
  5: ["sim", "qual o horário?", "confirmo", "hospedes 3", "sim"],
  10: ["confirmo", "sim", "qual o horário?", "pode fechar", "hospedes 3", "tem wifi?", "sim", "hospedes 4", "confirmo", "sim"],
};

describe("fila da sessão e resumo ainda não entregue (frente H, B1)", () => {
  it("B1: 'quero fechar' e 'sim' ao mesmo tempo → o 'sim' reapresenta o resumo (0 POSTs, sem modelo); o 'sim' seguinte envia o mostrado", async () => {
    const vistas: string[] = [];
    const s = await abrir(vistas, () => 40);

    // O "sim" sai com o turno do resumo já em curso (o modelo leva 40 ms): ordem garantida, não por tempo.
    const fechar = postChat(s.id, "quero fechar");
    await vi.waitFor(() => expect(vistas).toEqual(["quero fechar"]), { interval: 1 });
    const [a, b] = await Promise.all([fechar, postChat(s.id, "sim")]);
    const resumo = await a.json<{ reply: string }>();
    const sim = await b.json<{ reply: string; handoff: boolean }>();
    expect(resumo.reply).toContain("Resumo do seu pedido de reserva:");
    expect(sim.handoff).toBe(false);
    expect(sim.reply).toContain("Ainda não enviei este pedido");
    expect(sim.reply).toContain("Resumo do seu pedido de reserva:");
    expect(vistas).toEqual(["quero fechar"]);
    expect(s.mundo.leads).toEqual([]);

    const depois = await (await postChat(s.id, "sim")).json<{ reply: string }>();
    expect(depois.reply).toMatch(/foi registrado/);
    expect(s.mundo.leads).toMatchObject([{ imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2 }]);
  });

  it("B1-controle: resumo já entregue e 'sim' sozinho depois → 1 lead (caminho normal)", async () => {
    const vistas: string[] = [];
    const s = await abrir(vistas, () => 5);
    await postChat(s.id, "quero fechar");
    await postChat(s.id, "sim");
    expect(s.mundo.leads).toHaveLength(1);
  });

  for (const [primeira, segunda] of [["sim", "confirmo"], ["confirmo", "sim"]] as const) {
    it(`B1 não alcança resumo visto: '${primeira}' e '${segunda}' ao mesmo tempo → 1 lead, um 'foi registrado' e um 'já está registrado', sem reapresentação`, async () => {
      const vistas: string[] = [];
      const s = await abrir(vistas, () => 20);
      await postChat(s.id, "quero fechar");

      const [a, b] = await Promise.all([postChat(s.id, primeira), pausa(2).then(() => postChat(s.id, segunda))]);
      const respostas = [(await a.json<{ reply: string; handoff: boolean }>()), (await b.json<{ reply: string; handoff: boolean }>())];
      expect(s.mundo.leads).toHaveLength(1);
      expect(respostas.map((r) => r.handoff)).toEqual([false, false]);
      expect(respostas.some((r) => r.reply.includes("Ainda não enviei"))).toBe(false);
      expect(respostas.map((r) => r.reply).sort()).toEqual([
        expect.stringMatching(/já está registrado/),
        expect.stringMatching(/foi registrado/),
      ]);
    });
  }

  for (const tamanho of [5, 10]) {
    it(`B1 (item 5): ${tamanho} mensagens ao mesmo tempo depois de um resumo visto → nenhum lead de resumo trocado na rajada, ≤ 1 lead por reserva, nada perdido, ordem mantida`, async () => {
      for (let rodada = 0; rodada < 5; rodada++) {
        const vistas: string[] = [];
        const s = await abrir(vistas, () => 5 + Math.floor(Math.random() * 15));
        await postChat(s.id, "quero fechar");
        vistas.length = 0;

        const mensagens = MISTURAS[tamanho]!;
        const respostas = await Promise.all(mensagens.map((m) => postChat(s.id, m).then(async (r) => ({
          m, status: r.status, ...(await r.json<{ reply: string; handoff: boolean }>()),
        }))));
        expect(respostas.every((r) => r.status === 200)).toBe(true);

        // Só o resumo visto antes da rajada (2 hóspedes) pode virar lead; o trocado na rajada, nunca.
        expect(s.mundo.leads.filter((l) => l.hospedes !== 2)).toEqual([]);
        const chaves = s.mundo.leads.map((l) => chaveDaReserva(l as unknown as Reserva));
        expect(new Set(chaves).size).toBe(chaves.length);

        // Nada perdido, e o modelo viu as mensagens na ordem do histórico (as reapresentadas não chamam o modelo).
        const usuarios = (await s.usuarios()).slice(1);
        expect([...usuarios].sort()).toEqual([...mensagens].sort());
        let i = 0;
        for (const vista of vistas) {
          while (i < usuarios.length && usuarios[i] !== vista) i++;
          expect(i).toBeLessThan(usuarios.length);
          i++;
        }
        for (const r of respostas) {
          if (r.m.endsWith("?")) expect(r.reply).toBe(`resposta a ${r.m}`);
        }
      }
    });
  }
});
