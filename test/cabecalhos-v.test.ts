import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import { PAGINA } from "../src/pagina";
import type { Sessao } from "../src/sessao";
import { criarMundo, diz } from "./apoio";

const ambiente = env as unknown as Env;

async function sha256Base64(texto: string): Promise<string> {
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  return btoa(String.fromCharCode(...resumo));
}

function conteudoDe(html: string, tag: "script" | "style"): string {
  const abre = `<${tag}>`;
  return html.slice(html.indexOf(abre) + abre.length, html.indexOf(`</${tag}>`));
}

function diretivas(politica: string): Map<string, string[]> {
  return new Map(politica.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const [nome, ...valores] = d.split(/\s+/);
    return [nome!, valores];
  }));
}

describe("cabeçalhos de proteção da página (GET /)", () => {
  it("a página sai com a política de conteúdo e os demais cabeçalhos de proteção", async () => {
    const resposta = await worker.fetch(new Request("https://agente.teste/"), ambiente);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(resposta.headers.get("x-frame-options")).toBe("DENY");
    expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");
    expect(resposta.headers.get("referrer-policy")).toBe("no-referrer");
    expect(resposta.headers.get("permissions-policy")).toMatch(/camera=\(\)/);
    const politica = diretivas(resposta.headers.get("content-security-policy") ?? "");
    expect(politica.get("default-src")).toEqual(["'none'"]);
    expect(politica.get("connect-src")).toEqual(["'self'"]);
    expect(politica.get("font-src")).toEqual(["data:"]);
    expect(politica.get("img-src")).toEqual(["'none'"]);
    expect(politica.get("base-uri")).toEqual(["'none'"]);
    expect(politica.get("form-action")).toEqual(["'none'"]);
    expect(politica.get("frame-ancestors")).toEqual(["'none'"]);
    expect(await resposta.text()).toBe(PAGINA);
  });

  it("script e estilo só passam pelo sha256 do conteúdo servido, sem outra fonte", async () => {
    const resposta = await worker.fetch(new Request("https://agente.teste/"), ambiente);
    const html = await resposta.text();
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<style/g)).toHaveLength(1);
    const politica = diretivas(resposta.headers.get("content-security-policy") ?? "");
    expect(politica.get("script-src")).toEqual([`'sha256-${await sha256Base64(conteudoDe(html, "script"))}'`]);
    expect(politica.get("style-src")).toEqual([`'sha256-${await sha256Base64(conteudoDe(html, "style"))}'`]);
    expect(resposta.headers.get("content-security-policy")).not.toMatch(/unsafe-|\*/);
  });

  it("o HTML não tem atributo de estilo nem manipulador embutido, que a política bloquearia", () => {
    expect(PAGINA).not.toMatch(/\sstyle\s*=/i);
    expect(PAGINA).not.toMatch(/<[^>]*\son[a-z]+\s*=/i);
    expect(PAGINA).not.toMatch(/javascript:/i);
    expect(PAGINA).not.toMatch(/setAttribute\(\s*['"](style|on[a-z]+)['"]/i);
  });

  it("GET /saude e POST /chat seguem com o mesmo status e o mesmo corpo", async () => {
    const saude = await worker.fetch(new Request("https://agente.teste/saude"), ambiente);
    expect(saude.status).toBe(200);
    expect(Object.keys(await saude.json() as object)).toEqual(["ok", "ambiente", "leads_destino", "envio_leads", "variaveis"]);

    const id = "cabecalhos-v";
    await runInDurableObject(ambiente.SESSAO.getByName(`sessao:${id}`), (s: Sessao) => {
      s.dependencias = { modelo: async () => diz("ok"), buscar: criarMundo().buscar };
    });
    const chat = await worker.fetch(new Request("https://agente.teste/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: id, message: "oi" }),
    }), ambiente);
    expect(chat.status).toBe(200);
    expect(await chat.json()).toEqual({ reply: "ok", handoff: false });
  });
});
