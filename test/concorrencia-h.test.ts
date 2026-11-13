import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Dependencias, Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, type Mundo, pedeFerramentas, ultimaDoHospede } from "./apoio";

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

async function abrir(dependencias: Dependencias) {
  const stub = ambiente.SESSAO.getByName(`concorrencia-h-${++proxima}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = dependencias;
  });
  return stub;
}

function postChat(sessionId: string, message: string): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), ambiente);
}

describe("concorrência endurecida e falhas (frente H)", () => {
  it("POST /chat: duas perguntas simultâneas na mesma sessão dão 200 e mantêm o histórico na ordem", async () => {
    const id = `http-perguntas-${++proxima}`;
    const mundo = criarMundo();
    const entradas: string[] = [];
    let historicoVisto: Mensagem[] = [];
    let liberar!: () => void;
    const portao = new Promise<void>((r) => { liberar = r; });

    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      entradas.push(ultima);
      if (ultima === "primeira pergunta") await portao;
      if (ultima === "o que perguntei?") historicoVisto = mensagens;
      return diz(`resposta: ${ultima}`);
    };

    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar };
    });

    const p1 = postChat(id, "primeira pergunta");
    const p2 = postChat(id, "segunda pergunta");
    while (entradas.length === 0) await pausa(5);
    await pausa(80);
    expect(entradas).toEqual(["primeira pergunta"]);

    liberar();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await r1.json()).toEqual({ reply: "resposta: primeira pergunta", handoff: false });
    expect(await r2.json()).toEqual({ reply: "resposta: segunda pergunta", handoff: false });

    const r3 = await postChat(id, "o que perguntei?");
    expect(r3.status).toBe(200);
    expect(historicoVisto.filter((m) => m.role !== "system")).toEqual([
      { role: "user", content: "primeira pergunta" },
      { role: "assistant", content: "resposta: primeira pergunta" },
      { role: "user", content: "segunda pergunta" },
      { role: "assistant", content: "resposta: segunda pergunta" },
      { role: "user", content: "o que perguntei?" },
    ]);
  });

  it("POST /chat: duas confirmações simultâneas geram exatamente 1 lead e duas respostas 200", async () => {
    const id = `http-sims-${++proxima}`;
    const mundo = criarMundo();
    const modelo: Modelo = async (mensagens) =>
      ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));

    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar };
    });

    const resumo = await postChat(id, "quero fechar");
    expect(resumo.status).toBe(200);
    expect(mundo.leads).toHaveLength(0);

    const [s1, s2] = await Promise.all([postChat(id, "sim"), postChat(id, "sim")]);
    expect(s1.status).toBe(200);
    expect(s2.status).toBe(200);
    const d1 = await s1.json<{ reply: string; handoff: boolean }>();
    const d2 = await s2.json<{ reply: string; handoff: boolean }>();
    expect(d1.handoff).toBe(false);
    expect(d2.handoff).toBe(false);
    expect([d1.reply, d2.reply].sort()).toEqual([
      expect.stringMatching(/já está registrado/),
      expect.stringMatching(/foi registrado/),
    ]);
    expect(mundo.leads).toHaveLength(1);
  });

  it("sessões diferentes em paralelo não se bloqueiam", async () => {
    let liberarA!: () => void;
    const portaoA = new Promise<void>((r) => { liberarA = r; });
    const stubA = await abrir({
      modelo: async () => { await portaoA; return diz("A"); },
      buscar: criarMundo().buscar,
    });
    const stubB = await abrir({
      modelo: async () => diz("B"),
      buscar: criarMundo().buscar,
    });

    const promessaA = stubA.conversar("oi A");
    const respB = await stubB.conversar("oi B");
    expect(respB).toMatchObject({ reply: "B", handoff: false });

    liberarA();
    expect(await promessaA).toMatchObject({ reply: "A", handoff: false });
  });

  it("espera na fila não gasta o orçamento da mensagem seguinte até o teto da sessão (achado 9)", async () => {
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      await pausa(ultima === "lenta" ? 200 : 100);
      return diz(`ok:${ultima}`);
    };
    const stub = await abrir({
      modelo,
      buscar: criarMundo().buscar,
      orcamentoMs: 250,
      tetoMs: 800,
    });

    // Chegam juntas: a segunda espera ~200 ms na fila e precisa de 100 ms (> 50 ms restantes de 250 ms).
    const [r1, r2] = await Promise.all([stub.conversar("lenta"), stub.conversar("seguinte")]);
    expect(r1).toMatchObject({ reply: "ok:lenta", handoff: false });
    expect(r2).toMatchObject({ reply: "ok:seguinte", handoff: false });
  });

  it("mesmo após espera na fila, turno nunca ultrapassa o teto da sessão (achado 9)", async () => {
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      await pausa(ultima === "primeira" ? 180 : 350);
      return diz(`ok:${ultima}`);
    };
    const stub = await abrir({
      modelo,
      buscar: criarMundo().buscar,
      orcamentoMs: 260,
      tetoMs: 360,
    });

    const inicio = Date.now();
    const [r1, r2, r3] = await Promise.all([
      stub.conversar("primeira"),
      stub.conversar("segunda"),
      stub.conversar("terceira"),
    ]);
    const decorrido = Date.now() - inicio;

    expect(r1).toMatchObject({ reply: "ok:primeira", handoff: false });
    expect(r2.handoff).toBe(true);
    expect(r2.reply).toContain("problema técnico");
    expect(r3.handoff).toBe(true);
    expect(r3.reply).toContain("problema técnico");
    expect(decorrido).toBeLessThan(600);
  });

  it("resumo não fica confirmável se a gravação do histórico falhar (achado 8)", async () => {
    const mundo = criarMundo();
    const vistas: Mensagem[][] = [];
    const modelo: Modelo = async (mensagens) => {
      vistas.push(mensagens);
      return ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub = await abrir({ modelo, buscar: mundo.buscar });

    // Força falha apenas na transação do turno do montar_resumo.
    await runInDurableObject(stub, (_sessao: Sessao, state) => {
      const original = state.storage.transactionSync.bind(state.storage);
      let falharUmaVez = true;
      state.storage.transactionSync = ((fn: () => unknown) => {
        if (falharUmaVez) {
          falharUmaVez = false;
          throw new Error("falha simulada ao gravar histórico");
        }
        return original(fn);
      }) as typeof state.storage.transactionSync;
    });

    const resumo = await stub.conversar("quero fechar");
    expect(resumo.handoff).toBe(true);
    expect(resumo.reply).toContain("problema técnico");

    // Mesmo após reinício do objeto, o resumo não entregue não pode valer para o "sim".
    await evictDurableObject(stub);
    await runInDurableObject(stub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar };
    });

    await stub.conversar("sim");
    expect(mundo.leads).toEqual([]);
    expect(vistas.at(-2)![0]!.content).toContain("Nenhum resumo aguardando confirmação");
  });

  it("falha ao gravar histórico numa alteração de resumo preserva apenas o resumo já entregue (achado 8)", async () => {
    const mundo = criarMundo();
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
      if (ultima === "alterar") return pedeFerramentas(chamar("montar_resumo", { ...DADOS, checkout: "19/01/2027" }));
      return pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub = await abrir({ modelo, buscar: mundo.buscar });

    // Turno 1 entrega o resumo até 18/01/2027 normalmente.
    const r1 = await stub.conversar("quero fechar");
    expect(r1.handoff).toBe(false);
    expect(r1.reply).toContain("18/01/2027");

    // Turno 2 tenta alterar para 19/01/2027, mas falha ao gravar o histórico.
    await runInDurableObject(stub, (_sessao: Sessao, state) => {
      const original = state.storage.transactionSync.bind(state.storage);
      let falharUmaVez = true;
      state.storage.transactionSync = ((fn: () => unknown) => {
        if (falharUmaVez) {
          falharUmaVez = false;
          throw new Error("falha simulada ao gravar histórico");
        }
        return original(fn);
      }) as typeof state.storage.transactionSync;
    });

    const r2 = await stub.conversar("alterar");
    expect(r2.handoff).toBe(true);

    // Como houve um turno falho no meio, o primeiro "sim" reapresenta apenas o resumo já entregue (18/01),
    // nunca a alteração (19/01); o "sim" seguinte confirma e envia só a 18/01.
    const r3 = await stub.conversar("sim");
    expect(r3.handoff).toBe(false);
    expect(r3.reply).toContain("18/01/2027");
    expect(r3.reply).not.toContain("19/01/2027");
    expect(mundo.leads).toEqual([]);

    const r4 = await stub.conversar("sim");
    expect(r4.handoff).toBe(false);
    expect(mundo.leads).toMatchObject([{ checkout: "2027-01-18", valor_total: 2156 }]);
  });

  it("reinício do objeto entre o marcador 'enviando' e a resposta do webhook não gera segundo POST, nem com dois sins simultâneos", async () => {
    const mundo: Mundo = criarMundo();
    let liberouPost!: () => void;
    const postEmCurso = new Promise<void>((r) => { liberouPost = r; });
    let postsIniciados = 0;

    const buscarLento = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        postsIniciados++;
        liberouPost();
        await pausa(300);
      }
      return mundo.buscar(entrada, init);
    }) as typeof fetch;

    const modelo: Modelo = async (mensagens) =>
      ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));

    const stub = await abrir({ modelo, buscar: buscarLento, orcamentoMs: 120, tetoMs: 250 });
    await stub.conversar("quero fechar");

    const primeiraConfirmacao = await stub.conversar("sim");
    await postEmCurso;
    expect(postsIniciados).toBe(1);
    expect(primeiraConfirmacao.handoff).toBe(true);
    expect(primeiraConfirmacao.reply).toContain("problema técnico");

    // Reinicia o objeto antes de a resposta do webhook chegar, com "enviando" já persistido no SQLite.
    await evictDurableObject(stub);
    await runInDurableObject(stub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: buscarLento };
    });

    const [a, b] = await Promise.all([stub.conversar("sim"), stub.conversar("sim")]);
    expect(a.handoff).toBe(true);
    expect(b.handoff).toBe(true);
    expect(a.reply).toContain("Não consegui confirmar");
    expect(b.reply).toContain("Não consegui confirmar");
    expect(postsIniciados).toBe(1);

    // Espera o POST abandonado encerrar para provar que não sobra rejeição não tratada.
    await pausa(350);
    expect(postsIniciados).toBe(1);
  });

  it("dois sins simultâneos com prazo estourado durante o POST não duplicam lead nem deixam rejeição não tratada (achado 11)", async () => {
    for (const falharWebhook of [false, true]) {
      const mundo = criarMundo({ statusDoWebhook: 201 });
      let postsIniciados = 0;
      const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          postsIniciados++;
          await pausa(250);
          if (falharWebhook) throw new Error("queda tardia do webhook");
        }
        return mundo.buscar(entrada, init);
      }) as typeof fetch;

      const modelo: Modelo = async (mensagens) =>
        ultimaDoHospede(mensagens) === "sim"
          ? pedeFerramentas(chamar("confirmar_reserva"))
          : pedeFerramentas(chamar("montar_resumo", DADOS));

      const stub = await abrir({ modelo, buscar, orcamentoMs: 100, tetoMs: 400 });
      await stub.conversar("quero fechar");

      const [r1, r2] = await Promise.all([stub.conversar("sim"), stub.conversar("sim")]);
      expect(r1.handoff).toBe(true);
      expect(r1.reply).toContain("problema técnico");
      expect(r2.handoff).toBe(true);
      expect(r2.reply).toContain("Não consegui confirmar");
      expect(postsIniciados).toBe(1);

      await pausa(300);
      expect(postsIniciados).toBe(1);
    }
  });

  it("prazo estourado durante recotação, montagem de resumo ou modelo não envia POST nem gera rejeição não tratada", async () => {
    const mundo = criarMundo();
    let postsIniciados = 0;
    const buscarAtrasado = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") postsIniciados++;
      await pausa(220);
      return mundo.buscar(entrada, init);
    }) as typeof fetch;

    const modelo: Modelo = async (mensagens) =>
      ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));

    // 1. Estoura na recotação antes do POST: nenhum POST pode sair depois.
    const stub1 = await abrir({ modelo, buscar: mundo.buscar, orcamentoMs: 100, tetoMs: 300 });
    await stub1.conversar("quero fechar");
    await runInDurableObject(stub1, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: buscarAtrasado, orcamentoMs: 80, tetoMs: 300 };
    });
    const cortadaRecotar = await stub1.conversar("sim");
    expect(cortadaRecotar.handoff).toBe(true);
    await pausa(280);
    expect(postsIniciados).toBe(0);

    // 2. Estoura no catálogo durante montar_resumo com erro tardio do catálogo.
    const buscarComErroTardio = (async () => {
      await pausa(200);
      throw new Error("catálogo caiu tarde");
    }) as unknown as typeof fetch;
    const stub2 = await abrir({ modelo, buscar: buscarComErroTardio, orcamentoMs: 80, tetoMs: 300 });
    const cortadaResumo = await stub2.conversar("quero fechar");
    expect(cortadaResumo.handoff).toBe(true);
    await pausa(250);

    // 3. Estoura no modelo com rejeição tardia do modelo.
    const modeloLentoComErro: Modelo = async () => {
      await pausa(200);
      throw new Error("modelo caiu tarde");
    };
    const stub3 = await abrir({ modelo: modeloLentoComErro, buscar: mundo.buscar, orcamentoMs: 80, tetoMs: 300 });
    const cortadaModelo = await stub3.conversar("oi");
    expect(cortadaModelo.handoff).toBe(true);
    await pausa(250);
  });
});
