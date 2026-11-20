// M2 da rodada pós-entrega: acima do teto diário de chamadas ao modelo ou do limite por IP,
// o /chat responde um texto fixo, 200 e handoff false, sem chamar o modelo. Valores
// decididos pelo Éverton em 20/11 (recomendação aceita): producao 1.500 chamadas por dia e
// 10 mensagens por minuto por IP; dev 5.000 por dia e sem limite por IP.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import { dataCivilEmSaoPaulo } from "../src/nucleo/datas";
import type { Sessao } from "../src/sessao";
import { criarMundo, diz, roteiro } from "./apoio";
import configuracao from "../wrangler.jsonc?raw";

const ambiente = env as unknown as Env;
const TETO = /limite de uso de hoje/;
const POR_IP = /muitas mensagens em pouco tempo/;

async function prepararSessao(sessionId: string, ...respostas: Parameters<typeof roteiro>) {
  const r = roteiro(...respostas);
  await runInDurableObject(ambiente.SESSAO.getByName(`sessao:${sessionId}`), (sessao: Sessao) => {
    sessao.dependencias = { modelo: r.modelo, buscar: criarMundo().buscar };
  });
  return r.recebidas;
}

const chat = (variaveis: Env, sessionId: string, message = "oi", ip = "cliente-de-teste-a") =>
  worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify({ session_id: sessionId, message }),
  }), variaveis);

// O contador do dia é uma instância da Sessao (`teto:<data>`): sem classe nova de Durable Object.
const contadorDeHoje = () => {
  const stub = ambiente.SESSAO.getByName(`teto:${dataCivilEmSaoPaulo(Date.now())}`);
  return { usadas: () => stub.usadasNoTeto(), somar: (n: number) => stub.somarNoTeto(n) };
};

describe("M2: teto diário de chamadas ao modelo", () => {
  it("abaixo do teto, o turno roda e as chamadas reais entram no contador do dia", async () => {
    const antes = await contadorDeHoje().usadas();
    await prepararSessao("gasto-1", diz("Olá!"));
    const resposta = await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: String(antes + 100) }, "gasto-1");
    expect(await resposta.json()).toEqual({ reply: "Olá!", handoff: false });
    expect(await contadorDeHoje().usadas()).toBe(antes + 1);
  });

  it("no teto: texto fixo, 200, handoff false e zero chamadas ao modelo", async () => {
    await contadorDeHoje().somar(1);
    const usadas = await contadorDeHoje().usadas();
    const recebidas = await prepararSessao("gasto-2", diz("não deveria ser chamado"));
    const resposta = await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: String(usadas) }, "gasto-2");
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as { reply: string; handoff: boolean };
    expect(corpo.reply).toMatch(TETO);
    expect(corpo.handoff).toBe(false);
    expect(resposta.headers.get("x-chamadas-modelo")).toBe("0");
    expect(recebidas).toHaveLength(0);
    expect(await contadorDeHoje().usadas()).toBe(usadas);
  });

  it("sem TETO_DIARIO_CHAMADAS, nenhum teto", async () => {
    await contadorDeHoje().somar(1_000_000);
    await prepararSessao("gasto-3", diz("Olá!"));
    expect(await (await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: undefined }, "gasto-3")).json()).toEqual({ reply: "Olá!", handoff: false });
  });
});

describe("M2: limite por IP", () => {
  it("acima do limite: texto fixo, zero chamadas ao modelo, e o IP vai como chave", async () => {
    const chaves: string[] = [];
    const LIMITE_POR_IP = { limit: async ({ key }: { key: string }) => { chaves.push(key); return { success: false }; } };
    const recebidas = await prepararSessao("gasto-4", diz("não deveria ser chamado"));
    const resposta = await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: undefined, LIMITE_POR_IP } as unknown as Env, "gasto-4", "oi", "cliente-de-teste-b");
    const corpo = await resposta.json() as { reply: string; handoff: boolean };
    expect(resposta.status).toBe(200);
    expect(corpo.reply).toMatch(POR_IP);
    expect(corpo.handoff).toBe(false);
    expect(resposta.headers.get("x-chamadas-modelo")).toBe("0");
    expect(recebidas).toHaveLength(0);
    expect(chaves).toEqual(["cliente-de-teste-b"]);
  });

  it("em inglês, o texto fixo sai em inglês", async () => {
    const LIMITE_POR_IP = { limit: async () => ({ success: false }) };
    const resposta = await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: undefined, LIMITE_POR_IP } as unknown as Env, "gasto-5", "Hello, how much is the GRM-301 for two nights?");
    expect(((await resposta.json()) as { reply: string }).reply).toMatch(/too many messages/);
  });

  it("dentro do limite, o turno roda", async () => {
    const LIMITE_POR_IP = { limit: async () => ({ success: true }) };
    await prepararSessao("gasto-6", diz("Olá!"));
    expect(await (await chat({ ...ambiente, TETO_DIARIO_CHAMADAS: undefined, LIMITE_POR_IP } as unknown as Env, "gasto-6")).json()).toEqual({ reply: "Olá!", handoff: false });
  });
});

describe("M2: valores por ambiente no wrangler.jsonc", () => {
  const semComentarios = JSON.parse(configuracao.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (trecho: string, aspas: string | undefined) => aspas ?? "")) as {
    env: Record<string, { vars: Record<string, string>; ratelimits?: { name: string; simple: { limit: number; period: number } }[] }>;
  };
  it("producao: 1.500 chamadas por dia e 10 mensagens por minuto por IP", () => {
    expect(semComentarios.env.producao!.vars.TETO_DIARIO_CHAMADAS).toBe("1500");
    expect(semComentarios.env.producao!.ratelimits).toEqual([expect.objectContaining({ name: "LIMITE_POR_IP", simple: { limit: 10, period: 60 } })]);
  });
  it("dev: 5.000 chamadas por dia e sem limite por IP (o runner de evals sai de um IP só)", () => {
    expect(semComentarios.env.dev!.vars.TETO_DIARIO_CHAMADAS).toBe("5000");
    expect(semComentarios.env.dev!.ratelimits).toBeUndefined();
  });
});

describe("M2: a proteção de gasto não come o orçamento da resposta", () => {
  it("o prazo do contador é 10% do que resta, no máximo 1,5 s", async () => {
    const { prazoDoContador } = await import("../src/gasto");
    expect(prazoDoContador(1_000_120, 1_000_000)).toBe(12);
    expect(prazoDoContador(1_050_000, 1_000_000)).toBe(1_500);
    expect(prazoDoContador(999_000, 1_000_000)).toBe(0);
  });
});
