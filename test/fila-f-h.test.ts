// Fila da sessão (frente H) com a frente F atual: mensagens simultâneas na mesma sessão são
// processadas uma por vez, na ordem de chegada, e a corrida não multiplica POSTs.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, pedeFerramentas, ultimaDoHospede, URL_LEADS } from "./apoio";

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
const CONFIRMACOES = new Set(["sim", "confirmo"]);

function postChat(sessionId: string, message: string): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), ambiente);
}

/** Sessão com webhook lento que responde `status`; registra a ordem de modelo e POST. */
async function sessaoComEventos(status: number) {
  const id = `fila-f-h-${++proxima}`;
  const mundo = criarMundo();
  const eventos: string[] = [];
  const posts: unknown[] = [];
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (!String(entrada).startsWith(URL_LEADS) || init?.method !== "POST") return mundo.buscar(entrada, init);
    posts.push(JSON.parse(String(init.body)));
    eventos.push("post:inicio");
    await pausa(60);
    eventos.push("post:fim");
    return Response.json({ ok: status === 201 }, { status });
  }) as typeof fetch;
  const modelo: Modelo = async (mensagens) => {
    const ultima = ultimaDoHospede(mensagens);
    eventos.push(`modelo:${ultima}`);
    return CONFIRMACOES.has(ultima) ? pedeFerramentas(chamar("confirmar_reserva")) : pedeFerramentas(chamar("montar_resumo", DADOS));
  };
  const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo, buscar };
  });
  const historico = () => runInDurableObject(stub, (_s, state) =>
    state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
      .map((l) => JSON.parse(l.mensagem) as Mensagem)
      .filter((m) => m.role === "user" || (m.role === "assistant" && typeof m.content === "string" && m.content !== "")));
  return { id, eventos, posts, historico };
}

describe("fila da sessão com a F atual (frente H)", () => {
  it("'sim' e 'confirmo' ao mesmo tempo: 1 POST, o 2º turno só começa depois do POST do 1º, histórico em pares na ordem", async () => {
    const s = await sessaoComEventos(201);
    await postChat(s.id, "quero fechar");

    const [r1, r2] = await Promise.all([postChat(s.id, "sim"), postChat(s.id, "confirmo")]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const respostas = { sim: (await r1.json<{ reply: string }>()).reply, confirmo: (await r2.json<{ reply: string }>()).reply };
    expect(s.posts).toHaveLength(1);

    // Um turno inteiro por vez: o modelo da 2ª mensagem só é chamado depois que o POST da 1ª terminou.
    const confirmacoes = s.eventos.filter((e) => e !== "modelo:quero fechar");
    const primeira = confirmacoes[0]!.slice("modelo:".length) as "sim" | "confirmo";
    const segunda = primeira === "sim" ? "confirmo" : "sim";
    expect(confirmacoes.slice(0, 3)).toEqual([`modelo:${primeira}`, "post:inicio", "post:fim"]);
    expect(confirmacoes.indexOf(`modelo:${segunda}`)).toBeGreaterThan(confirmacoes.indexOf("post:fim"));

    // Histórico na ordem da fila, cada resposta logo depois da sua mensagem, e cada pedido recebe a sua.
    const historico = await s.historico();
    const depoisDoResumo = historico.slice(2).map((m) => `${m.role}:${m.role === "user" ? m.content : ""}`);
    expect(depoisDoResumo).toEqual([`user:${primeira}`, "assistant:", `user:${segunda}`, "assistant:"]);
    expect(historico[3]!.content).toBe(respostas[primeira]);
    expect(historico[5]!.content).toBe(respostas[segunda]);
    expect(respostas[primeira]).toMatch(/foi registrado/);
    expect(respostas[segunda]).toMatch(/já está registrado/);
  });

  it("P14 na corrida: dois 'sim' ao mesmo tempo com webhook 500 → no máximo 2 POSTs na estadia (o 1º e a nova tentativa), 0 do 2º turno", async () => {
    const s = await sessaoComEventos(500);
    await postChat(s.id, "quero fechar");

    const [r1, r2] = await Promise.all([postChat(s.id, "sim"), postChat(s.id, "sim")]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((await r1.json<{ handoff: boolean }>()).handoff).toBe(true);
    expect((await r2.json<{ handoff: boolean }>()).handoff).toBe(true);
    expect(s.posts).toHaveLength(2);
    const confirmacoes = s.eventos.filter((e) => e !== "modelo:quero fechar");
    expect(confirmacoes.slice(0, 5)).toEqual(["modelo:sim", "post:inicio", "post:fim", "post:inicio", "post:fim"]);
    // O 2º turno só chama o modelo (o falso pede confirmar_reserva a cada chamada) e nenhum POST.
    expect(confirmacoes.slice(5)).not.toHaveLength(0);
    expect(confirmacoes.slice(5).every((e) => e === "modelo:sim")).toBe(true);
  });
});
