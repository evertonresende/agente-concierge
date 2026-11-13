import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Sessao } from "../src/sessao";
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

  it("JSON inválido ou campo faltando devolve 400 no formato do contrato", async () => {
    for (const corpo of ["{quebrado", "[]", "null", { message: "oi" }, { session_id: "a" }, { session_id: 1, message: "oi" }, { session_id: "a", message: { texto: "oi" } }]) {
      const resposta = await chat(corpo);
      expect(resposta.status).toBe(400);
      const dado = await resposta.json<{ reply: string; handoff: boolean }>();
      expect(dado.reply).not.toBe("");
      expect(dado.handoff).toBe(false);
    }
  });

  it("mensagem vazia ou longa demais devolve 200 sem chamar o modelo (L17)", async () => {
    const recebidas = await prepararSessao("limites");
    for (const message of ["", "   ", "x".repeat(8001)]) {
      const resposta = await chat({ session_id: "limites", message });
      expect(resposta.status).toBe(200);
      const dado = await resposta.json<{ reply: string; handoff: boolean }>();
      expect(dado.reply).not.toBe("");
      expect(dado.handoff).toBe(false);
      expect(resposta.headers.get("x-chamadas-modelo")).toBe("0");
    }
    expect(recebidas).toHaveLength(0);
  });

  it("falha interna nunca vira 500: 200 com aviso e handoff (L18)", async () => {
    await prepararSessao("falha", new Error("fora do ar"), new Error("fora do ar"));
    const resposta = await chat({ session_id: "falha", message: "oi" });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ handoff: true });
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
