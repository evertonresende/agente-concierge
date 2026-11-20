// M3 da rodada pós-entrega: provar a troca do CATALOGO_URL e do LEADS_URL de producao antes
// de qualquer conversa com confirmação, sem expor o secret. O /saude mostra só os 12
// primeiros hex do SHA-256 de cada URL; quem tem a URL esperada calcula o mesmo e compara.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";

const sha12 = async (texto: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);

describe("GET /saude: impressão das URLs, nunca o valor", () => {
  it("traz a impressão de 12 hex de cada URL e nenhum trecho dela", async () => {
    const ambiente = env as unknown as Env;
    const corpo = await (await worker.fetch(new Request("https://agente.teste/saude"), ambiente)).json() as Record<string, unknown>;
    expect(corpo.impressao).toEqual({ CATALOGO_URL: await sha12(ambiente.CATALOGO_URL!), LEADS_URL: await sha12(ambiente.LEADS_URL!) });
    const texto = JSON.stringify(corpo);
    for (const url of [ambiente.CATALOGO_URL!, ambiente.LEADS_URL!]) {
      expect(texto).not.toContain(new URL(url).host);
      expect(texto).not.toContain(new URL(url).pathname);
    }
  });

  it("sem a variável, a impressão é null", async () => {
    const corpo = await (await worker.fetch(new Request("https://agente.teste/saude"), { ...(env as unknown as Env), LEADS_URL: undefined })).json() as { impressao: Record<string, unknown> };
    expect(corpo.impressao.LEADS_URL).toBeNull();
  });
});
