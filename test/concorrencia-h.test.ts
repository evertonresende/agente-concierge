import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { FERRAMENTAS } from "../src/agente/ferramentas";
import { definir } from "../src/agente/ferramentas/tipos";
import { tratarChat } from "../src/chat";
import type { Env } from "../src/env";
import worker from "../src/index";
import { apresentarResumo, type EstadoLead } from "../src/lead";
import type { Mensagem, Modelo } from "../src/modelo";
import { type Dependencias, type RespostaDoChat, type Sessao, TETO_SESSAO_MS, TETO_WORKER_MS } from "../src/sessao";
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

function postChat(sessionId: string, message: string, variaveis: Env = ambiente): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), variaveis);
}

function comNamespaceRealEnvolvido(
  interceptar: (realStub: DurableObjectStub<Sessao>, args: [string, number?, string?, number?]) => Promise<RespostaDoChat>,
): Env {
  return {
    ...ambiente,
    SESSAO: {
      ...ambiente.SESSAO,
      getByName(nome: string) {
        const realStub = ambiente.SESSAO.getByName(nome);
        return {
          conversar(mensagem: string, chegada?: number, idPedido?: string, prazoWorker?: number) {
            return interceptar(realStub, [mensagem, chegada, idPedido, prazoWorker]);
          },
          registrarContingenciaNoWorker(idPedido?: string) {
            return realStub.registrarContingenciaNoWorker(idPedido);
          },
        };
      },
    } as unknown as Env["SESSAO"],
  };
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

  it("item 1a: objeto real lança depois de gravar o turno → retentativa devolve a mesma resposta com a mensagem 1 vez no histórico e zero POST extra", async () => {
    const id = `retentativa-pos-gravacao-${++proxima}`;
    const mundo = criarMundo();
    let chamadasModelo = 0;
    const modelo: Modelo = async () => {
      chamadasModelo++;
      return diz("Olá, pedido recebido!");
    };

    const realStub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(realStub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar };
    });

    let tentativas = 0;
    const envComFalha = comNamespaceRealEnvolvido(async (stub, args) => {
      tentativas++;
      const resposta = await stub.conversar(...args);
      if (tentativas === 1) throw new Error("falha de RPC depois de gravar");
      return resposta;
    });

    const r1 = await postChat(id, "oi", envComFalha);
    expect(r1.status).toBe(200);
    expect(tentativas).toBe(2);
    expect(chamadasModelo).toBe(1);
    expect(await r1.json()).toEqual({ reply: "Olá, pedido recebido!", handoff: false });
    expect(r1.headers.get("x-chamadas-modelo")).toBe("1");

    const historicoGravado = await runInDurableObject(realStub, (_sessao, state) =>
      state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
        .map((l) => JSON.parse(l.mensagem) as Mensagem));
    expect(historicoGravado).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "Olá, pedido recebido!" },
    ]);
    expect(mundo.leads).toEqual([]);
  });

  it("item 1b: objeto real lança depois de gravar 'sim' com resumo pendente → no máximo o efeito da 1ª passagem, nunca lead vindo da 2ª", async () => {
    // Subcaso 1 (regra P4): resumo no turno 1, pergunta no turno 2; no turno 3 ("sim"), a 1ª passagem
    // apenas reapresenta o resumo e grava, depois lança. A 2ª passagem não pode ler "sim" como confirmação.
    const id1 = `retentativa-sim-p4-${++proxima}`;
    const mundo1 = criarMundo();
    let chamadasNoSim1 = 0;
    const modelo1: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "quero fechar") return pedeFerramentas(chamar("montar_resumo", DADOS));
      if (ultima === "sim") {
        chamadasNoSim1++;
        return pedeFerramentas(chamar("confirmar_reserva"));
      }
      return diz("O check-in é às 15:00.");
    };
    const stub1 = ambiente.SESSAO.getByName(`sessao:${id1}`);
    await runInDurableObject(stub1, (sessao: Sessao) => {
      sessao.dependencias = { modelo: modelo1, buscar: mundo1.buscar };
    });

    expect((await postChat(id1, "quero fechar")).status).toBe(200);
    expect((await postChat(id1, "qual o horário?")).status).toBe(200);

    let tentativas1 = 0;
    const envFalha1 = comNamespaceRealEnvolvido(async (stub, args) => {
      tentativas1++;
      const resposta = await stub.conversar(...args);
      if (tentativas1 === 1) throw new Error("falha após gravar reapresentação");
      return resposta;
    });
    const respSim1 = await postChat(id1, "sim", envFalha1);
    expect(respSim1.status).toBe(200);
    expect(tentativas1).toBe(2);
    expect(chamadasNoSim1).toBe(1);
    const dado1 = await respSim1.json<{ reply: string; handoff: boolean }>();
    expect(dado1.handoff).toBe(false);
    expect(dado1.reply).toContain("Ainda não enviei este pedido");
    expect(mundo1.leads).toEqual([]);

    const usersNoHistorico1 = await runInDurableObject(stub1, (_sessao, state) =>
      state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
        .map((l) => JSON.parse(l.mensagem) as Mensagem)
        .filter((m) => m.role === "user")
        .map((m) => m.content));
    expect(usersNoHistorico1).toEqual(["quero fechar", "qual o horário?", "sim"]);

    // Subcaso 2: "sim" no turno seguinte ao resumo → 1ª passagem envia 1 lead e grava, depois lança;
    // a 2ª passagem devolve a mesma resposta gravada, com exatamente 1 POST e "sim" 1 vez no histórico.
    const id2 = `retentativa-sim-envio-${++proxima}`;
    const mundo2 = criarMundo();
    let postsIniciados = 0;
    let chamadasNoSim2 = 0;
    const buscarContado = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") postsIniciados++;
      return mundo2.buscar(entrada, init);
    }) as typeof fetch;
    const modelo2: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "sim") {
        chamadasNoSim2++;
        return pedeFerramentas(chamar("confirmar_reserva"));
      }
      return pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub2 = ambiente.SESSAO.getByName(`sessao:${id2}`);
    await runInDurableObject(stub2, (sessao: Sessao) => {
      sessao.dependencias = { modelo: modelo2, buscar: buscarContado };
    });

    expect((await postChat(id2, "quero fechar")).status).toBe(200);
    let tentativas2 = 0;
    const envFalha2 = comNamespaceRealEnvolvido(async (stub, args) => {
      tentativas2++;
      const resposta = await stub.conversar(...args);
      if (tentativas2 === 1) throw new Error("falha após gravar confirmação");
      return resposta;
    });
    const respSim2 = await postChat(id2, "sim", envFalha2);
    expect(respSim2.status).toBe(200);
    expect(tentativas2).toBe(2);
    expect(chamadasNoSim2).toBe(1);
    expect(postsIniciados).toBe(1);
    expect(mundo2.leads).toHaveLength(1);
    const dado2 = await respSim2.json<{ reply: string; handoff: boolean }>();
    expect(dado2.handoff).toBe(false);
    expect(dado2.reply).toMatch(/foi registrado/);

    const usersNoHistorico2 = await runInDurableObject(stub2, (_sessao, state) =>
      state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
        .map((l) => JSON.parse(l.mensagem) as Mensagem)
        .filter((m) => m.role === "user")
        .map((m) => m.content));
    expect(usersNoHistorico2).toEqual(["quero fechar", "sim"]);
  });

  it("item 1c: objeto real lança antes de gravar → retentativa processa 1 vez e responde", async () => {
    const id = `retentativa-antes-gravar-${++proxima}`;
    const mundo = criarMundo();
    let chamadasModelo = 0;
    const modelo: Modelo = async () => {
      chamadasModelo++;
      return diz("Processada na tentativa 2!");
    };

    const realStub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(realStub, (sessao: Sessao) => {
      sessao.dependencias = { modelo, buscar: mundo.buscar };
    });

    let tentativas = 0;
    const envComFalha = comNamespaceRealEnvolvido(async (stub, args) => {
      tentativas++;
      if (tentativas === 1) throw new Error("falha antes de gravar no objeto");
      return stub.conversar(...args);
    });

    const resposta = await postChat(id, "oi", envComFalha);
    expect(resposta.status).toBe(200);
    expect(tentativas).toBe(2);
    expect(chamadasModelo).toBe(1);
    expect(await resposta.json()).toEqual({ reply: "Processada na tentativa 2!", handoff: false });

    const historicoGravado = await runInDurableObject(realStub, (_sessao, state) =>
      state.storage.sql.exec<{ mensagem: string }>("SELECT mensagem FROM historico ORDER BY id").toArray()
        .map((l) => JSON.parse(l.mensagem) as Mensagem));
    expect(historicoGravado).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "Processada na tentativa 2!" },
    ]);
  });

  it("item 1d e item 3: duas tentativas somadas respeitam o teto do Worker sem orçamento novo na retentativa", async () => {
    const id = `teto-retentativa-${++proxima}`;
    const mundo = criarMundo();
    const realStub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(realStub, (sessao: Sessao) => {
      sessao.dependencias = {
        modelo: async () => {
          await pausa(90);
          return diz("resposta que passaria se houvesse orçamento novo");
        },
        buscar: mundo.buscar,
      };
    });

    let tentativas = 0;
    const envComFalha = comNamespaceRealEnvolvido(async (stub, args) => {
      tentativas++;
      if (tentativas === 1) {
        await pausa(80);
        throw new Error("falha transitória na 1ª tentativa");
      }
      return stub.conversar(...args);
    });

    const inicio = Date.now();
    const req = new Request("https://agente.teste/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: id, message: "oi" }),
    });
    const resposta = await tratarChat(req, envComFalha, 120);
    const decorrido = Date.now() - inicio;

    expect(resposta.status).toBe(200);
    expect(tentativas).toBe(2);
    expect(decorrido).toBeLessThan(155);
    expect(await resposta.json()).toMatchObject({ handoff: true });
    await pausa(110);
  });

  it("item 3: cofre não aceita gravação depois do turno fechado quando o POST tardio devolve 201", async () => {
    const mundo = criarMundo({ statusDoWebhook: 201 });
    const buscarLento = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") await pausa(200);
      return mundo.buscar(entrada, init);
    }) as typeof fetch;

    const modelo: Modelo = async (mensagens) =>
      ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));

    const stub = await abrir({ modelo, buscar: buscarLento, orcamentoMs: 80, tetoMs: 250 });
    await stub.conversar("quero fechar");

    // O turno estoura em 80 ms com o marcador em "enviando" e o POST ainda em curso.
    const cortada = await stub.conversar("sim");
    expect(cortada.handoff).toBe(true);
    expect(cortada.reply).toContain("problema técnico");

    // Espera o POST tardio devolver 201 e tentar marcar "registrado" com o turno já fechado.
    await pausa(250);

    const estadoLead = await runInDurableObject(stub, (_sessao, state) => {
      const linha = state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = ?", "lead").toArray()[0];
      return JSON.parse(linha!.valor) as EstadoLead;
    });
    expect(Object.values(estadoLead.envios)).toEqual(["enviando"]);

    const seguinte = await stub.conversar("sim");
    expect(seguinte.handoff).toBe(true);
    expect(seguinte.reply).toContain("Não consegui confirmar");
    expect(seguinte.reply).not.toMatch(/já está registrado/);
  });

  it("item 3: turno de contingência descarta resumo pendente alterado no mesmo turno", async () => {
    const mundo = criarMundo();
    const vistas: Mensagem[][] = [];
    FERRAMENTAS.push(definir("apresentar_e_seguir", "sonda de teste", {}, [], async (_args, contexto) => {
      apresentarResumo(contexto.cofre, {
        imovel_id: "GRM-301",
        checkin: "2027-01-15",
        checkout: "2027-01-19",
        hospedes: 2,
        nome: "Ana Lima",
        telefone: "(11) 98888-0000",
      }, 215_600, contexto.turno);
      return { paraOModelo: { ok: true } };
    }));

    try {
      const modelo: Modelo = async (mensagens) => {
        vistas.push(mensagens);
        const ultima = ultimaDoHospede(mensagens);
        if (ultima === "alterar") {
          if (mensagens.at(-1)?.role === "tool") throw new Error("modelo caiu após ferramenta");
          return pedeFerramentas(chamar("apresentar_e_seguir"));
        }
        return mensagens.at(-1)?.role === "tool"
          ? diz("Nenhum resumo aguardando confirmação.")
          : pedeFerramentas(chamar("confirmar_reserva"));
      };

      const stub = await abrir({ modelo, buscar: mundo.buscar });
      const falha = await stub.conversar("alterar");
      expect(falha.handoff).toBe(true);
      expect(falha.reply).toContain("problema técnico");

      const estadoLead = await runInDurableObject(stub, (_sessao, state) => {
        const linha = state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = ?", "lead").toArray()[0];
        return linha ? (JSON.parse(linha.valor) as EstadoLead) : { pendente: null, envios: {} };
      });
      expect(estadoLead.pendente).toBeNull();

      await stub.conversar("sim");
      expect(vistas.at(-1)![0]!.content).toContain("Nenhum resumo aguardando confirmação");
      expect(mundo.leads).toEqual([]);
    } finally {
      FERRAMENTAS.pop();
    }
  });

  it("item 3: TETO_SESSAO_MS é menor que o teto do Worker com folga mínima de 5 s e abaixo de 60 s", () => {
    expect(TETO_SESSAO_MS).toBeLessThan(TETO_WORKER_MS);
    expect(TETO_WORKER_MS - TETO_SESSAO_MS).toBeGreaterThanOrEqual(5_000);
    expect(TETO_WORKER_MS).toBeLessThan(60_000);
  });

  it("regressão: buscar do catálogo e do webhook não pode ser chamada com this ligado a deps (Illegal invocation)", async () => {
    const mundo = criarMundo();
    const buscarSemThis = function (this: unknown, entrada: RequestInfo | URL, init?: RequestInit) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      return mundo.buscar(entrada, init);
    } as typeof fetch;

    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
      if (ultima === "quero fechar") return pedeFerramentas(chamar("montar_resumo", DADOS));
      return mensagens.at(-1)?.role === "tool"
        ? diz("Temos imóveis em Gramado.")
        : pedeFerramentas(chamar("listar_cidades"));
    };

    const stub = await abrir({ modelo, buscar: buscarSemThis });

    const consulta = await stub.conversar("quais cidades vocês têm?");
    expect(consulta.handoff).toBe(false);
    expect(consulta.reply).toBe("Temos imóveis em Gramado.");

    const resumo = await stub.conversar("quero fechar");
    expect(resumo.handoff).toBe(false);
    expect(resumo.reply).toContain("Resumo do seu pedido de reserva:");

    const confirmacao = await stub.conversar("sim");
    expect(confirmacao.handoff).toBe(false);
    expect(confirmacao.reply).toMatch(/foi registrado/);
    expect(mundo.leads).toHaveLength(1);
  });

  it("log de contingência registra origem e classe do erro sem mensagem nem dado pessoal", async () => {
    const espiado = vi.spyOn(console, "log");
    const lerLogs = () => espiado.mock.calls
      .flatMap((c) => typeof c[0] === "string" ? [c[0]] : [])
      .filter((linha) => linha.startsWith("{"))
      .map((linha) => JSON.parse(linha) as Record<string, unknown>);

    try {
      // 1. Falha do catálogo (TypeError e HTTP 500 -> ErroDoCatalogo sem vazar URL/token).
      espiado.mockClear();
      const stubCat = await abrir({
        modelo: async () => pedeFerramentas(chamar("listar_cidades")),
        buscar: (async () => { throw new TypeError("https://catalogo.privado/token-secreto"); }) as unknown as typeof fetch,
      });
      expect((await stubCat.conversar("cidades")).handoff).toBe(true);
      const logsCat = lerLogs();
      expect(logsCat.at(-1)).toMatchObject({ evento: "turno", contingencia: true, origem: "catalogo", erro: "TypeError" });
      expect(JSON.stringify(logsCat)).not.toContain("token-secreto");

      espiado.mockClear();
      const stubCat500 = await abrir({
        modelo: async () => pedeFerramentas(chamar("listar_cidades")),
        buscar: (async () => new Response("erro interno do catalogo", { status: 500 })) as unknown as typeof fetch,
      });
      expect((await stubCat500.conversar("cidades")).handoff).toBe(true);
      expect(lerLogs().at(-1)).toMatchObject({ evento: "turno", contingencia: true, origem: "catalogo", erro: "ErroDoCatalogo" });

      // 2. Falha do modelo (RangeError).
      espiado.mockClear();
      const stubMod = await abrir({
        modelo: async () => { throw new RangeError("dado Ana Lima"); },
        buscar: criarMundo().buscar,
      });
      expect((await stubMod.conversar("oi")).handoff).toBe(true);
      const logsMod = lerLogs();
      expect(logsMod.at(-1)).toMatchObject({ evento: "turno", contingencia: true, origem: "modelo", erro: "RangeError" });
      expect(JSON.stringify(logsMod)).not.toContain("Ana Lima");

      // 3. Falha no envio de lead sem vazar segredo da URL.
      espiado.mockClear();
      FERRAMENTAS.push(definir("sondar_falha_lead", "sonda de teste", {}, [], async (_args, contexto) => {
        await contexto.envio.postar({
          nome: "Ana Lima",
          telefone: "(11) 98888-0000",
          imovel_id: "GRM-301",
          checkin: "2027-01-15",
          checkout: "2027-01-18",
          hospedes: 2,
          valor_total: 2156,
        });
        return { paraOModelo: { ok: true } };
      }));
      try {
        const stubLead = await abrir({
          modelo: async () => pedeFerramentas(chamar("sondar_falha_lead")),
          buscar: (async () => { throw new TypeError("https://leads.privado/segredo-lead"); }) as unknown as typeof fetch,
        });
        expect((await stubLead.conversar("sim")).handoff).toBe(true);
        const logsLead = lerLogs();
        expect(logsLead.at(-1)).toMatchObject({ evento: "turno", contingencia: true, origem: "lead", erro: "Error" });
        expect(JSON.stringify(logsLead)).not.toContain("segredo-lead");
      } finally {
        FERRAMENTAS.pop();
      }

      // 4. Falha de prazo.
      espiado.mockClear();
      const stubPrazo = await abrir({
        modelo: async () => { await pausa(150); return diz("tarde"); },
        buscar: criarMundo().buscar,
        orcamentoMs: 40,
        tetoMs: 100,
      });
      expect((await stubPrazo.conversar("oi")).handoff).toBe(true);
      expect(lerLogs().at(-1)).toMatchObject({ evento: "turno", contingencia: true, origem: "prazo", erro: "TempoEsgotado" });
      await pausa(140);

      // 5. Falha interna (transactionSync).
      espiado.mockClear();
      const stubInt = await abrir({
        modelo: async () => diz("ok"),
        buscar: criarMundo().buscar,
      });
      await runInDurableObject(stubInt, (_sessao, state) => {
        state.storage.transactionSync = (() => { throw new Error("sqlite sigiloso"); }) as typeof state.storage.transactionSync;
      });
      expect((await stubInt.conversar("oi")).handoff).toBe(true);
      const logsInt = lerLogs();
      expect(logsInt.at(-1)).toMatchObject({ evento: "falha_no_turno", contingencia: true, origem: "interno", erro: "Error" });
      expect(JSON.stringify(logsInt)).not.toContain("sqlite sigiloso");
    } finally {
      espiado.mockRestore();
    }
  });

  it("postar chamado depois do prazo estourado é recusado sem disparar POST ao webhook", async () => {
    const mundo = criarMundo();
    let postsIniciados = 0;
    const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") postsIniciados++;
      return mundo.buscar(entrada, init);
    }) as typeof fetch;

    let erroDoPostTardio: unknown = null;
    FERRAMENTAS.push(definir("postar_tardio", "sonda de teste", {}, [], async (_args, contexto) => {
      await pausa(140);
      try {
        await contexto.envio.postar({
          nome: "Ana Lima",
          telefone: "(11) 98888-0000",
          imovel_id: "GRM-301",
          checkin: "2027-01-15",
          checkout: "2027-01-18",
          hospedes: 2,
          valor_total: 2156,
        });
      } catch (erro) {
        erroDoPostTardio = erro;
      }
      return { paraOModelo: { ok: true } };
    }));

    try {
      const stub = await abrir({
        modelo: async () => pedeFerramentas(chamar("postar_tardio")),
        buscar,
        orcamentoMs: 50,
        tetoMs: 200,
      });
      const resposta = await stub.conversar("sim");
      expect(resposta.handoff).toBe(true);
      await pausa(140);
      expect(erroDoPostTardio).toBeInstanceOf(Error);
      expect(postsIniciados).toBe(0);
      expect(mundo.leads).toEqual([]);
    } finally {
      FERRAMENTAS.pop();
    }
  });

  it("A5: log falha_no_chat do Worker registra origem e classe do erro sem mensagem nem dado do hóspede", async () => {
    const logs: string[] = [];
    const espiado = vi.spyOn(console, "log").mockImplementation((texto) => { logs.push(String(texto)); });
    try {
      const envFalha = {
        ...ambiente,
        SESSAO: {
          getByName: () => ({
            conversar: async () => { throw new TypeError("Ana Lima (11) 98888-0000"); },
          }),
        },
      } as unknown as Env;
      const resposta = await postChat("sessao-a5", "Sou Ana Lima, (11) 98888-0000", envFalha);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ handoff: true });
    } finally {
      espiado.mockRestore();
    }
    const evento = logs.map((l) => JSON.parse(l) as Record<string, unknown>).find((o) => o.evento === "falha_no_chat");
    expect(evento).toEqual({ evento: "falha_no_chat", origem: "sessao", erro: "TypeError" });
    expect(logs.join("\n")).not.toMatch(/Ana|98888|Sou /);
  });

  it("A1 (P12): corpo acima de 64 KB devolve 200 'longa demais' sem parsear nem tocar na sessão; 64 KB exato e session_id de 60 KB passam sem vazar no log", async () => {
    let chamadasSessao = 0;
    const nomesVistos: number[] = [];
    const envEspiao: Env = {
      ...ambiente,
      SESSAO: {
        getByName(nome: string) {
          nomesVistos.push(nome.length);
          return {
            conversar: async () => {
              chamadasSessao++;
              return { reply: "ok sessao", handoff: false, uso: { entrada: 10, saida: 5, chamadas: 1 } };
            },
          };
        },
      } as unknown as Env["SESSAO"],
    };

    const textoLongo = "Sua mensagem ficou longa demais para eu ler de uma vez. Pode resumir em poucas linhas?";

    // 1. Corpo de 30 MB em message → 200 com texto fixo, handoff false, sem tocar na sessão.
    const corpo30MB = JSON.stringify({ session_id: "s-30m", message: "y".repeat(30_000_000) });
    const resp30MB = await worker.fetch(new Request("https://agente.teste/chat", { method: "POST", body: corpo30MB }), envEspiao);
    expect(resp30MB.status).toBe(200);
    expect(await resp30MB.json()).toEqual({ reply: textoLongo, handoff: false });
    expect(chamadasSessao).toBe(0);

    // 2. Campo extra gigante de 30 MB → 200 com texto fixo, sem tocar na sessão.
    const corpoExtra = JSON.stringify({ session_id: "s-extra", message: "oi", lixo: "z".repeat(30_000_000) });
    const respExtra = await worker.fetch(new Request("https://agente.teste/chat", { method: "POST", body: corpoExtra }), envEspiao);
    expect(respExtra.status).toBe(200);
    expect(await respExtra.json()).toEqual({ reply: textoLongo, handoff: false });
    expect(chamadasSessao).toBe(0);

    // 3. Corpo de exatamente 64 KB + 1 byte (65.537 bytes) via fluxo com content-length mentiroso ("10") → para de ler cedo e devolve 200.
    const base = '{"session_id":"s-borda","message":"oi","extra":"';
    const sufixo = '"}';
    const limiteExato = `${base}${"a".repeat(65_536 - base.length - sufixo.length)}${sufixo}`;
    expect(new TextEncoder().encode(limiteExato).byteLength).toBe(65_536);
    const acimaDeUmByte = `${base}${"a".repeat(65_537 - base.length - sufixo.length)}${sufixo}`;
    expect(new TextEncoder().encode(acimaDeUmByte).byteLength).toBe(65_537);

    const bytes30MB = new TextEncoder().encode(`{"session_id":"s-borda","message":"oi","extra":"${"a".repeat(30_000_000)}"}`);
    let puxados = 0;
    let cursor = 0;
    const fluxoMentiroso = new ReadableStream<Uint8Array>({
      pull(c) {
        if (cursor >= bytes30MB.byteLength) {
          c.close();
          return;
        }
        const pedaco = bytes30MB.subarray(cursor, cursor + 16_384);
        cursor += pedaco.byteLength;
        puxados += pedaco.byteLength;
        c.enqueue(pedaco);
      },
    });
    const respBordaAcima = await worker.fetch(new Request("https://agente.teste/chat", {
      method: "POST",
      headers: { "content-length": "10" },
      body: fluxoMentiroso,
      duplex: "half",
    } as RequestInit), envEspiao);
    expect(respBordaAcima.status).toBe(200);
    expect(await respBordaAcima.json()).toEqual({ reply: textoLongo, handoff: false });
    expect(chamadasSessao).toBe(0);
    expect(puxados).toBeLessThanOrEqual(98_304);

    // 3b. Exatamente 64 KB + 1 byte (65.537 bytes) sem content-length devolve 200 "longa demais" sem tocar na sessão.
    const resp64kMais1 = await worker.fetch(new Request("https://agente.teste/chat", { method: "POST", body: acimaDeUmByte }), envEspiao);
    expect(resp64kMais1.status).toBe(200);
    expect(await resp64kMais1.json()).toEqual({ reply: textoLongo, handoff: false });
    expect(chamadasSessao).toBe(0);

    // 4. Exatamente 65.536 bytes com JSON válido passa.
    const respExato = await worker.fetch(new Request("https://agente.teste/chat", { method: "POST", body: limiteExato }), envEspiao);
    expect(respExato.status).toBe(200);
    expect(await respExato.json()).toEqual({ reply: "ok sessao", handoff: false });
    expect(chamadasSessao).toBe(1);

    // 5. session_id de 60 KB no binding real vale (200) e não aparece inteiro no log.
    const session60KB = "k".repeat(60 * 1024);
    const stubReal = ambiente.SESSAO.getByName(`sessao:${session60KB}`);
    await runInDurableObject(stubReal, (s: Sessao) => {
      s.dependencias = { modelo: async () => diz("ok 60kb"), buscar: criarMundo().buscar };
    });
    const logs: string[] = [];
    const espiado = vi.spyOn(console, "log").mockImplementation((texto) => { logs.push(String(texto)); });
    try {
      const resp60KB = await postChat(session60KB, "oi");
      expect(resp60KB.status).toBe(200);
      expect(await resp60KB.json()).toEqual({ reply: "ok 60kb", handoff: false });
    } finally {
      espiado.mockRestore();
    }
    expect(logs.join("\n")).not.toContain(session60KB);
    expect(nomesVistos[0]).toBeGreaterThan(0);
  });

  it("A5c: corpo que nunca termina estoura o teto do Worker e devolve 200 com contingência (não 400)", async () => {
    const fluxoPreso = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"session_id":"x3","message":"oi'));
      },
    });
    const logs: string[] = [];
    const espiado = vi.spyOn(console, "log").mockImplementation((texto) => { logs.push(String(texto)); });
    try {
      const req = new Request("https://agente.teste/chat", { method: "POST", body: fluxoPreso, duplex: "half" } as RequestInit);
      const resp = await tratarChat(req, ambiente, 80);
      expect(resp.status).toBe(200);
      const dado = await resp.json<{ reply: string; handoff: boolean }>();
      expect(dado.handoff).toBe(true);
      expect(dado.reply).toContain("problema técnico");
    } finally {
      espiado.mockRestore();
    }
    expect(logs.some((l) => l.includes("tempo_esgotado_no_worker"))).toBe(true);
  });

  it("A4: tabela pedidos é podada e mantém no máximo os últimos 20 pedidos", async () => {
    const id = `poda-pedidos-${++proxima}`;
    const mundo = criarMundo();
    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (s: Sessao) => {
      s.dependencias = { modelo: async () => diz("ok"), buscar: mundo.buscar };
    });

    for (let i = 0; i < 30; i++) {
      const r = await postChat(id, `mensagem ${i}`);
      expect(r.status).toBe(200);
    }

    const total = await runInDurableObject(stub, (_s, state) =>
      state.storage.sql.exec<{ c: number }>("SELECT count(*) AS c FROM pedidos").one().c);
    expect(total).toBe(20);
  });

  it("A5b: contingência fora do turno registra handoff=true no estado da sessão (prazo na fila e teto do Worker)", async () => {
    // 1. Mensagem vencida na fila dentro do objeto.
    const stubFila = await abrir({ modelo: async () => diz("ok"), buscar: criarMundo().buscar });
    const vencida = await stubFila.conversar("segunda", Date.now() - 60_000, "id-vencida");
    expect(vencida.handoff).toBe(true);
    const handoffFila = await runInDurableObject(stubFila, (_s, state) =>
      state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = 'handoff'").toArray()[0]?.valor ?? null);
    expect(handoffFila).toBe("true");

    // 2. Contingência devolvida pelo Worker no estouro do teto também grava handoff=true na sessão.
    const idWorker = `a5b-worker-${++proxima}`;
    const stubWorker = ambiente.SESSAO.getByName(`sessao:${idWorker}`);
    await runInDurableObject(stubWorker, (s: Sessao) => {
      s.dependencias = {
        modelo: async () => {
          await pausa(180);
          return diz("tarde");
        },
        buscar: criarMundo().buscar,
      };
    });
    const req = new Request("https://agente.teste/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: idWorker, message: "oi" }),
    });
    const resp = await tratarChat(req, ambiente, 60);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ handoff: true });
    await pausa(200);

    const handoffWorker = await runInDurableObject(stubWorker, (_s, state) =>
      state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = 'handoff'").toArray()[0]?.valor ?? null);
    expect(handoffWorker).toBe("true");
  });

  it("A0 (i): resposta de resumo perdida nas duas tentativas → primeiro 'sim' reapresenta o resumo com 0 leads sem chamar agente → segundo 'sim' envia 1 lead", async () => {
    const id = `a0-duas-perdas-${++proxima}`;
    const mundo = criarMundo();
    let chamadasModelo = 0;
    const modelo: Modelo = async (mensagens) => {
      chamadasModelo++;
      return ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (s: Sessao) => {
      s.dependencias = { modelo, buscar: mundo.buscar };
    });

    // Wrapper sem registrarContingenciaNoWorker para provar que a repetição do idPedido já marca reapresentar.
    let entregasPerdidas = 0;
    const envDuasPerdas: Env = {
      ...ambiente,
      SESSAO: {
        getByName(nome: string) {
          const real = ambiente.SESSAO.getByName(nome);
          return {
            async conversar(msg: string, c?: number, i?: string, p?: number) {
              entregasPerdidas++;
              await real.conversar(msg, c, i, p);
              throw new Error("resposta perdida no transporte");
            },
          };
        },
      } as unknown as Env["SESSAO"],
    };

    const falhaResumo = await postChat(id, "quero fechar", envDuasPerdas);
    expect(falhaResumo.status).toBe(200);
    expect(entregasPerdidas).toBe(2);
    expect(await falhaResumo.json()).toMatchObject({ handoff: true });
    expect(chamadasModelo).toBe(1);
    expect(mundo.leads).toEqual([]);

    const chamadasAntesDoSim = chamadasModelo;
    const primeiroSim = await postChat(id, "sim");
    expect(primeiroSim.status).toBe(200);
    expect(chamadasModelo).toBe(chamadasAntesDoSim);
    expect(primeiroSim.headers.get("x-chamadas-modelo")).toBe("0");
    const dadoPrimeiroSim = await primeiroSim.json<{ reply: string; handoff: boolean }>();
    expect(dadoPrimeiroSim.handoff).toBe(false);
    expect(dadoPrimeiroSim.reply).toContain("Resumo do seu pedido de reserva:");
    expect(dadoPrimeiroSim.reply).toContain("Ana Lima");
    expect(dadoPrimeiroSim.reply).toContain("R$ 2.156,00");
    expect(dadoPrimeiroSim.reply).toMatch(/confirmar, responda "sim"/);
    expect(mundo.leads).toEqual([]);

    const segundoSim = await postChat(id, "sim");
    expect(segundoSim.status).toBe(200);
    const dadoSegundoSim = await segundoSim.json<{ reply: string; handoff: boolean }>();
    expect(dadoSegundoSim.handoff).toBe(false);
    expect(dadoSegundoSim.reply).toMatch(/foi registrado/);
    expect(mundo.leads).toHaveLength(1);
  });

  it("A0 (ii): perda só na primeira tentativa, segunda entregue → primeiro 'sim' reapresenta o resumo com 0 leads → segundo 'sim' envia 1 lead", async () => {
    const id = `a0-uma-perda-${++proxima}`;
    const mundo = criarMundo();
    let chamadasModelo = 0;
    const modelo: Modelo = async (mensagens) => {
      chamadasModelo++;
      return ultimaDoHospede(mensagens) === "sim"
        ? pedeFerramentas(chamar("confirmar_reserva"))
        : pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (s: Sessao) => {
      s.dependencias = { modelo, buscar: mundo.buscar };
    });

    let tentativas = 0;
    const envUmaPerda = comNamespaceRealEnvolvido(async (real, args) => {
      tentativas++;
      const resposta = await real.conversar(...args);
      if (tentativas === 1) throw new Error("perda só na primeira entrega");
      return resposta;
    });

    const resumoEntregue = await postChat(id, "quero fechar", envUmaPerda);
    expect(resumoEntregue.status).toBe(200);
    expect(tentativas).toBe(2);
    expect((await resumoEntregue.json<{ reply: string }>()).reply).toContain("Resumo do seu pedido de reserva:");
    expect(chamadasModelo).toBe(1);

    const primeiroSim = await postChat(id, "sim");
    expect(primeiroSim.status).toBe(200);
    expect(chamadasModelo).toBe(1);
    expect((await primeiroSim.json<{ reply: string }>()).reply).toContain("Resumo do seu pedido de reserva:");
    expect(mundo.leads).toEqual([]);

    const segundoSim = await postChat(id, "sim");
    expect(segundoSim.status).toBe(200);
    expect((await segundoSim.json<{ reply: string }>()).reply).toMatch(/foi registrado/);
    expect(mundo.leads).toHaveLength(1);
  });

  it("A3 (iii): cenário S5 (atraso na volta da RPC e estouro na folga antes da transação) → 0 leads no primeiro 'sim'", async () => {
    // Subcaso A: objeto conclui dentro do orçamento, mas volta da RPC atrasa além do teto do Worker.
    const idA = `a3-s5-volta-${++proxima}`;
    const mundoA = criarMundo();
    const modeloA: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
      if (ultima === "quero fechar") {
        await pausa(180);
        return pedeFerramentas(chamar("montar_resumo", DADOS));
      }
      return diz("ok");
    };
    const stubA = ambiente.SESSAO.getByName(`sessao:${idA}`);
    await runInDurableObject(stubA, (s: Sessao) => {
      s.dependencias = { modelo: modeloA, buscar: mundoA.buscar, tetoMs: 265, orcamentoMs: 265 };
    });
    const envVoltaLenta = comNamespaceRealEnvolvido(async (real, args) => {
      const r = await real.conversar(...args);
      await pausa(120);
      return r;
    });

    const reqA = new Request("https://agente.teste/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: idA, message: "quero fechar" }),
    });
    const respA = await tratarChat(reqA, envVoltaLenta, 250);
    expect(respA.status).toBe(200);
    expect(await respA.json()).toMatchObject({ handoff: true });
    await pausa(150);

    const simA1 = await postChat(idA, "sim");
    expect(simA1.status).toBe(200);
    expect(mundoA.leads).toEqual([]);
    expect((await simA1.json<{ reply: string }>()).reply).toContain("Resumo do seu pedido de reserva:");

    const simA2 = await postChat(idA, "sim");
    expect(simA2.status).toBe(200);
    expect(mundoA.leads).toHaveLength(1);

    // Subcaso B: turno ultrapassa a folga do Worker antes da transação → tratado como contingência, sem pendente confirmável.
    const idB = `a3-s5-folga-${++proxima}`;
    const mundoB = criarMundo();
    const modeloB: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
      if (ultima === "quero fechar") {
        await pausa(230);
        return pedeFerramentas(chamar("montar_resumo", DADOS));
      }
      return diz("ok");
    };
    const stubB = ambiente.SESSAO.getByName(`sessao:${idB}`);
    await runInDurableObject(stubB, (s: Sessao) => {
      s.dependencias = { modelo: modeloB, buscar: mundoB.buscar, tetoMs: 265, orcamentoMs: 265 };
    });
    const reqB = new Request("https://agente.teste/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: idB, message: "quero fechar" }),
    });
    const respB = await tratarChat(reqB, ambiente, 250);
    expect(respB.status).toBe(200);
    expect(await respB.json()).toMatchObject({ handoff: true });
    await pausa(80);

    await postChat(idB, "sim");
    expect(mundoB.leads).toEqual([]);
  });

  it("A0 (iv): marca reapresentar posta e mensagem que muda dado ('na verdade somos 3') → segue caminho normal, limpa marca e gera 0 leads", async () => {
    const id = `a0-muda-dado-${++proxima}`;
    const mundo = criarMundo();
    const recebidas: string[] = [];
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      recebidas.push(ultima);
      if (ultima === "na verdade somos 3") {
        return pedeFerramentas(chamar("montar_resumo", { ...DADOS, hospedes: 3 }));
      }
      if (ultima === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
      return pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
    await runInDurableObject(stub, (s: Sessao) => {
      s.dependencias = { modelo, buscar: mundo.buscar };
    });

    const envFalha = comNamespaceRealEnvolvido(async (real, args) => {
      await real.conversar(...args);
      throw new Error("falha após gravar resumo inicial");
    });

    const falha = await postChat(id, "quero fechar", envFalha);
    expect(falha.status).toBe(200);
    expect(await falha.json()).toMatchObject({ handoff: true });

    const mudanca = await postChat(id, "na verdade somos 3");
    expect(mudanca.status).toBe(200);
    expect(recebidas).toContain("na verdade somos 3");
    const dadoMudanca = await mudanca.json<{ reply: string; handoff: boolean }>();
    expect(dadoMudanca.reply).toContain("Hóspedes: 3");
    expect(mundo.leads).toEqual([]);

    const marca = await runInDurableObject(stub, (_s, state) =>
      state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = 'reapresentar'").toArray()[0]?.valor ?? null);
    expect(marca).toBeNull();

    // Depois de receber o resumo novo (3 hóspedes), o "sim" confirma normalmente o resumo de 3 hóspedes.
    const sim = await postChat(id, "sim");
    expect(sim.status).toBe(200);
    expect(mundo.leads).toMatchObject([{ hospedes: 3 }]);
  });
});
