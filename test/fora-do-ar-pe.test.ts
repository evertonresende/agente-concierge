// Pedido do Éverton em 20/11, depois da rodada pós-entrega: producao sai do ar (página e
// API), para ninguém gastar chamando o agente. Com FORA_DO_AR=sim, toda rota responde 503
// com um aviso curto, sem tocar a sessão, o modelo nem o catálogo.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import cru from "../wrangler.jsonc?raw";

const ambiente = env as unknown as Env;
const SEM_SESSAO = { ...ambiente, FORA_DO_AR: "sim", SESSAO: { getByName: () => { throw new Error("a sessão não pode ser chamada"); } } } as unknown as Env;

describe("FORA_DO_AR=sim: página e API fora do ar", () => {
  it.each([
    ["GET", "/"],
    ["GET", "/saude"],
    ["POST", "/chat"],
    ["GET", "/qualquer"],
  ])("%s %s → 503 com aviso, sem chamar a sessão", async (metodo, caminho) => {
    const corpo = metodo === "POST" ? JSON.stringify({ session_id: "x", message: "oi" }) : undefined;
    const resposta = await worker.fetch(new Request(`https://agente.teste${caminho}`, { method: metodo, body: corpo }), SEM_SESSAO);
    expect(resposta.status).toBe(503);
    expect(await resposta.text()).toContain("fora do ar");
  });

  it("sem a var, o agente responde normalmente", async () => {
    expect((await worker.fetch(new Request("https://agente.teste/saude"), ambiente)).status).toBe(200);
  });

  it("producao fica fora do ar pelo wrangler.jsonc; dev não", () => {
    const { env: ambientes } = JSON.parse(cru.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (_t: string, aspas?: string) => aspas ?? "")) as { env: Record<string, { vars: Record<string, string> }> };
    expect(ambientes.producao!.vars.FORA_DO_AR).toBe("sim");
    expect(ambientes.dev!.vars.FORA_DO_AR).toBeUndefined();
  });
});
