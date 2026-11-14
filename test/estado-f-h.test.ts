// Estado do lead da frente F atravessando o Durable Object (frente H): o teto de POSTs por
// estadia e o bloqueio da P14, e o marcador "enviando" sem resultado (L11), precisam valer
// na hora em que a F os grava, mesmo que o turno termine em contingência ou o objeto reinicie.
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { chaveDaEstadia, type EstadoLead } from "../src/lead";
import type { Modelo } from "../src/modelo";
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
const ESTADIA = chaveDaEstadia({ ...DADOS, checkin: "2027-01-15", checkout: "2027-01-18" });

type Passo = number | "422nome";

/** Catálogo do mundo de teste; o webhook responde os passos em ordem e conta os POSTs. */
function webhookEmPassos(passos: Passo[], antesDoPost?: (n: number) => Promise<void>) {
  const mundo = criarMundo();
  const posts: unknown[] = [];
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (!String(entrada).startsWith(URL_LEADS) || init?.method !== "POST") return mundo.buscar(entrada, init);
    const passo = passos[Math.min(posts.length, passos.length - 1)]!;
    posts.push(JSON.parse(String(init.body)));
    await antesDoPost?.(posts.length);
    if (passo === "422nome") return Response.json({ erros: [{ campo: "nome", erro: "invalido" }] }, { status: 422 });
    return Response.json({ ok: passo === 201 }, { status: passo });
  }) as typeof fetch;
  return { posts, buscar };
}

/** "quero fechar, sou Ana Lima" e "outro telefone" montam resumo da mesma estadia; "nome corrigido: Ana Lima Souza" troca o nome; "sim" confirma. */
const modelo: Modelo = async (mensagens) => {
  const ultima = ultimaDoHospede(mensagens);
  if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
  if (ultima === "outro telefone") return pedeFerramentas(chamar("montar_resumo", { ...DADOS, telefone: "(11) 97777-0000" }));
  if (ultima === "nome corrigido: Ana Lima Souza") return pedeFerramentas(chamar("montar_resumo", { ...DADOS, nome: "Ana Lima Souza" }));
  return pedeFerramentas(chamar("montar_resumo", DADOS));
};

async function abrir(buscar: typeof fetch, extra: { orcamentoMs?: number; tetoMs?: number } = {}) {
  const stub = ambiente.SESSAO.getByName(`estado-f-h-${++proxima}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo, buscar, ...extra };
  });
  return stub;
}

async function reiniciar(stub: DurableObjectStub<Sessao>, buscar: typeof fetch) {
  await evictDurableObject(stub);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo, buscar };
  });
}

function estadoGravado(stub: DurableObjectStub<Sessao>): Promise<EstadoLead> {
  return runInDurableObject(stub, (_sessao, state) => {
    const linha = state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = 'lead'").toArray()[0];
    return JSON.parse(linha!.valor) as EstadoLead;
  });
}

/** "sim" cujo turno o Worker abandona (contingência no Worker) enquanto o POST ainda está em curso. */
async function simAbandonadoPeloWorker(stub: DurableObjectStub<Sessao>, posts: unknown[], liberarPost: () => void) {
  const idPedido = `pedido-${proxima}`;
  const turno = stub.conversar("sim", Date.now(), idPedido);
  // Espera pelo lado do teste: continuar de uma promise resolvida dentro do objeto faria I/O no contexto dele.
  await vi.waitFor(() => expect(posts.length).toBeGreaterThan(0));
  await stub.registrarContingenciaNoWorker(idPedido);
  liberarPost();
  return turno;
}

describe("estado da F no Durable Object (frente H)", () => {
  it("P14: 5xx duas vezes num turno que o Worker abandonou → bloqueio e contador gravados; depois de reiniciar, outro telefone na mesma estadia não ganha POST", async () => {
    let liberar!: () => void;
    const portao = new Promise<void>((r) => { liberar = r; });
    const { posts, buscar } = webhookEmPassos([500, 500, 201], async (n) => {
      if (n === 1) await portao;
    });
    const stub = await abrir(buscar);

    await stub.conversar("quero fechar, sou Ana Lima");
    const sim = await simAbandonadoPeloWorker(stub, posts, liberar);
    expect(sim.handoff).toBe(true);
    expect(posts).toHaveLength(2);

    const gravado = await estadoGravado(stub);
    expect(gravado.estadiasBloqueadas?.[ESTADIA]).toBe("recusado");
    expect(gravado.postsSemRegistro?.[ESTADIA]).toBe(2);

    await reiniciar(stub, buscar);
    await stub.conversar("outro telefone");
    const outro = await stub.conversar("sim");
    expect(outro.handoff).toBe(true);
    expect(posts).toHaveLength(2);
  });

  it("P14: contador da estadia (422 com campo) sobrevive a turno abandonado e a reinício → o envio corrigido com 5xx não ganha nova tentativa", async () => {
    let liberar!: () => void;
    const portao = new Promise<void>((r) => { liberar = r; });
    const { posts, buscar } = webhookEmPassos(["422nome", 500, 500, 201], async (n) => {
      if (n === 1) await portao;
    });
    const stub = await abrir(buscar);

    await stub.conversar("quero fechar, sou Ana Lima");
    await simAbandonadoPeloWorker(stub, posts, liberar);
    expect(posts).toHaveLength(1);
    expect((await estadoGravado(stub)).postsSemRegistro?.[ESTADIA]).toBe(1);

    await reiniciar(stub, buscar);
    await stub.conversar("nome corrigido: Ana Lima Souza");
    const corrigido = await stub.conversar("sim");
    expect(corrigido.handoff).toBe(true);
    // Segundo POST sem 201 da estadia: sem nova tentativa do 5xx (P14), 2 POSTs no total.
    expect(posts).toHaveLength(2);
    expect((await estadoGravado(stub)).estadiasBloqueadas?.[ESTADIA]).toBe("recusado");
  });

  it("L11/P14: reinício no meio do POST deixa 'enviando' gravado; a F lê como incerto e bloqueia a ESTADIA, sem POST novo nem com outro telefone", async () => {
    const { posts, buscar } = webhookEmPassos([201], () => pausa(300));
    const stub = await abrir(buscar, { orcamentoMs: 120, tetoMs: 250 });

    await stub.conversar("quero fechar, sou Ana Lima");
    const sim = await stub.conversar("sim");
    expect(sim.handoff).toBe(true);
    expect(posts).toHaveLength(1);
    expect(Object.values((await estadoGravado(stub)).envios)).toEqual(["enviando"]);

    await reiniciar(stub, buscar);
    await stub.conversar("outro telefone");
    const outro = await stub.conversar("sim");
    expect(outro.handoff).toBe(true);
    expect(outro.reply).toContain("Não consegui confirmar");
    await pausa(350);
    expect(posts).toHaveLength(1);
  });
});
