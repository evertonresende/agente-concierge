import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { tratarChat } from "../src/chat";
import type { Env } from "../src/env";
import worker, * as entrada from "../src/index";
import { type Sessao, TETO_WORKER_MS } from "../src/sessao";
import { criarMundo, diz, roteiro } from "./apoio";

const ambiente = env as unknown as Env;

function pedir(caminho: string, init?: RequestInit, variaveis: Env = ambiente): Promise<Response> {
  return worker.fetch(new Request(`https://agente.teste${caminho}`, init), variaveis);
}

function chat(corpo: unknown): Promise<Response> {
  return pedir("/chat", { method: "POST", body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
}

async function prepararSessao(sessionId: string, ...respostas: Parameters<typeof roteiro>) {
  const { modelo, recebidas } = roteiro(...respostas);
  const stub = ambiente.SESSAO.getByName(`sessao:${sessionId}`);
  await runInDurableObject(stub, (sessao: Sessao) => { sessao.dependencias = { modelo, buscar: criarMundo().buscar }; });
  return recebidas;
}

describe("POST /chat", () => {
  it("mensagem válida devolve 200 com reply em texto, handoff booleano e cabeçalhos de uso", async () => {
    await prepararSessao("abc-123", diz("Olá! Como posso ajudar?"));
    const resposta = await chat({ session_id: "abc-123", message: "oi" });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ reply: "Olá! Como posso ajudar?", handoff: false });
    expect(resposta.headers.get("x-uso-entrada")).toBe("10");
    expect(resposta.headers.get("x-uso-saida")).toBe("5");
    expect(resposta.headers.get("x-chamadas-modelo")).toBe("1");
  });

  it("session_id vazio vale como uma sessão qualquer (L17a)", async () => {
    await prepararSessao("", diz("Olá!"));
    const resposta = await chat({ session_id: "", message: "oi" });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ reply: "Olá!", handoff: false });
  });

  it("JSON inválido, primitivo, vazio ou campo não texto devolve 400 no formato do contrato", async () => {
    for (const corpo of [
      "",
      "{quebrado",
      "[]",
      "null",
      "123",
      "true",
      '"texto"',
      { message: "oi" },
      { session_id: "a" },
      { session_id: 1, message: "oi" },
      { session_id: null, message: "oi" },
      { session_id: "a", message: null },
      { session_id: "a", message: true },
      { session_id: "a", message: { texto: "oi" } },
      { session_id: ["a"], message: "oi" },
    ]) {
      const resposta = await chat(corpo);
      expect(resposta.status).toBe(400);
      const dado = await resposta.json<{ reply: string; handoff: boolean }>();
      expect(typeof dado.reply).toBe("string");
      expect(dado.reply).not.toBe("");
      expect(dado.handoff).toBe(false);
    }
  });

  it("mensagem vazia ou longa demais devolve 200 sem chamar o modelo, e exatamente 8.000 caracteres passa (L17)", async () => {
    const recebidas = await prepararSessao("limites", diz("Li sua mensagem longa."));
    for (const message of ["", "   \n\t ", "x".repeat(8001)]) {
      const resposta = await chat({ session_id: "limites", message });
      expect(resposta.status).toBe(200);
      const dado = await resposta.json<{ reply: string; handoff: boolean }>();
      expect(dado.reply).not.toBe("");
      expect(dado.handoff).toBe(false);
      expect(resposta.headers.get("x-chamadas-modelo")).toBe("0");
    }
    expect(recebidas).toHaveLength(0);

    const limiteExato = await chat({ session_id: "limites", message: "x".repeat(8000) });
    expect(limiteExato.status).toBe(200);
    expect(await limiteExato.json()).toEqual({ reply: "Li sua mensagem longa.", handoff: false });
    expect(limiteExato.headers.get("x-chamadas-modelo")).toBe("1");
    expect(recebidas).toHaveLength(1);
  });

  it("falha interna nunca vira 500: 200 com aviso e handoff (L18)", async () => {
    await prepararSessao("falha", new Error("fora do ar"), new Error("fora do ar"));
    const resposta = await chat({ session_id: "falha", message: "oi" });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ handoff: true });
  });

  it("Durable Object que falha uma vez recupera na nova tentativa (L18)", async () => {
    let tentativas = 0;
    const instavel = {
      getByName: () => ({
        conversar: async () => {
          tentativas++;
          if (tentativas === 1) throw new Error("falha transitória");
          return { reply: "Recuperado!", handoff: false, uso: { entrada: 10, saida: 5, chamadas: 1 } };
        },
      }),
    };
    const resposta = await pedir("/chat", { method: "POST", body: JSON.stringify({ session_id: "rec", message: "oi" }) },
      { ...ambiente, SESSAO: instavel as unknown as Env["SESSAO"] });
    expect(resposta.status).toBe(200);
    expect(tentativas).toBe(2);
    expect(await resposta.json()).toEqual({ reply: "Recuperado!", handoff: false });
  });

  it("Durable Object que lança nas duas tentativas devolve 200 com contingência e nunca 500", async () => {
    let tentativas = 0;
    const quebrado = {
      getByName: () => ({
        conversar: async () => {
          tentativas++;
          throw new Error("objeto fora do ar");
        },
      }),
    };
    const resposta = await pedir("/chat", { method: "POST", body: JSON.stringify({ session_id: "x", message: "oi" }) },
      { ...ambiente, SESSAO: quebrado as unknown as Env["SESSAO"] });
    expect(resposta.status).toBe(200);
    expect(tentativas).toBe(2);
    const dado = await resposta.json<{ reply: string; handoff: boolean }>();
    expect(dado.handoff).toBe(true);
    expect(dado.reply).not.toContain("objeto fora do ar");
  });

  it("módulo de entrada do Worker só exporta default (objeto) e as classes Sessao e Teto", () => {
    expect(Object.keys(entrada).sort()).toEqual(["Sessao", "Teto", "default"]);
    expect(typeof entrada.Teto).toBe("function");
    expect(typeof entrada.default).toBe("object");
    expect(entrada.default).not.toBeNull();
    expect(typeof entrada.Sessao).toBe("function");
  });

  it("teto próprio do Worker fica abaixo de 60 s e devolve contingência sem retentar quando estoura", async () => {
    expect(TETO_WORKER_MS).toBeLessThan(60_000);
    let tentativas = 0;
    const lento = {
      getByName: () => ({
        conversar: async () => {
          tentativas++;
          await new Promise((r) => setTimeout(r, 250));
          throw new Error("falha tardia depois do teto");
        },
      }),
    };
    const inicio = Date.now();
    const req = new Request("https://agente.teste/chat", { method: "POST", body: JSON.stringify({ session_id: "teto", message: "oi" }) });
    const resposta = await tratarChat(req, { ...ambiente, SESSAO: lento as unknown as Env["SESSAO"] }, 60);
    const decorrido = Date.now() - inicio;
    expect(resposta.status).toBe(200);
    expect(decorrido).toBeLessThan(200);
    expect(tentativas).toBe(1);
    expect(await resposta.json()).toMatchObject({ handoff: true });
    // Garante que a rejeição tardia do objeto não vira rejeição não tratada.
    await new Promise((r) => setTimeout(r, 250));
  });

  it("GET em /chat devolve 405 e rota desconhecida devolve 404", async () => {
    expect((await pedir("/chat")).status).toBe(405);
    expect((await pedir("/nao-existe")).status).toBe(404);
  });
});

describe("GET /saude", () => {
  it("informa ambiente, destino dos leads, envio e a presença das variáveis, sem valores", async () => {
    const resposta = await pedir("/saude");
    const texto = await resposta.text();
    expect(JSON.parse(texto)).toEqual({
      ok: true,
      ambiente: "dev",
      leads_destino: "falso",
      envio_leads: "ligado",
      variaveis: { CATALOGO_URL: true, LEADS_URL: true, AMBIENTE: true, MODELO: true, ENVIO_LEADS: true },
      impressao: { CATALOGO_URL: expect.stringMatching(/^[0-9a-f]{12}$/), LEADS_URL: expect.stringMatching(/^[0-9a-f]{12}$/) },
    });
    expect(texto).not.toContain("token-de-teste");
  });

  it("webhook no host do catálogo aparece como real, e envio diferente de ligado como desligado", async () => {
    const variaveis = { ...ambiente, AMBIENTE: "producao", ENVIO_LEADS: "sim", LEADS_URL: "https://catalogo.teste/leads/token-de-teste" };
    const dado = await (await pedir("/saude", undefined, variaveis)).json();
    expect(dado).toMatchObject({ ambiente: "producao", leads_destino: "real", envio_leads: "desligado" });
  });

  it("variável faltando aparece como ausente", async () => {
    const dado = await (await pedir("/saude", undefined, { ...ambiente, LEADS_URL: undefined })).json();
    expect(dado).toMatchObject({ ok: false, variaveis: { LEADS_URL: false } });
  });
});

describe("GET /", () => {
  it("devolve a página de chat", async () => {
    const resposta = await pedir("/");
    expect(resposta.headers.get("content-type")).toContain("text/html");
    expect(await resposta.text()).toContain("/chat");
  });
});
