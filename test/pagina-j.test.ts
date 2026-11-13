import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import { lerResposta, PAGINA } from "../src/pagina";

describe("página de chat (GET /)", () => {
  it("a rota devolve o HTML da página, com o que o hóspede precisa ver", async () => {
    const resposta = await worker.fetch(new Request("https://agente.teste/"), env as unknown as Env);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("text/html");
    const html = await resposta.text();
    expect(html).toBe(PAGINA);
    for (const trecho of [
      "Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas?",
      "O GRM-301 tem lareira e hidromassagem?",
      "Consegue um desconto se eu pagar à vista?",
      "Agente de demonstração, dados fictícios.",
      'href="https://github.com/evertonresende/agente-concierge"',
      '<label class="rotulo" for="mensagem">Sua mensagem</label>',
      "handoff: true",
      "Tentar de novo",
    ]) expect(html).toContain(trecho);
  });

  it("o texto da resposta do agente nunca entra como HTML", () => {
    for (const perigo of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval("]) {
      expect(PAGINA).not.toContain(perigo);
    }
  });

  it("é um arquivo só: fonte embutida e nenhum endereço de terceiros", () => {
    expect(PAGINA).toContain("src: url(data:font/woff2;base64,d09GMg");
    const enderecos = new Set(PAGINA.match(/https?:\/\/[^\s"'<)]+/g));
    expect([...enderecos]).toEqual(["https://github.com/evertonresende/agente-concierge"]);
    expect(PAGINA).not.toMatch(/<link|<img|<script[^>]+src=|@import/);
  });

  it("o efeito de ponteiro em cima só existe dentro de (hover: hover)", () => {
    const comeco = PAGINA.indexOf("@media (hover: hover) {");
    const fim = PAGINA.indexOf("/* fim do hover */");
    expect(comeco).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(comeco);
    expect(PAGINA.slice(0, comeco) + PAGINA.slice(fim)).not.toContain(":hover");
    expect(PAGINA.slice(comeco, fim)).toContain(".exemplo:hover");
  });

  it("o script que vai para o navegador é JavaScript válido e leva a regra de leitura da resposta", () => {
    const script = PAGINA.slice(PAGINA.indexOf("<script>") + "<script>".length, PAGINA.indexOf("</script>"));
    expect(script).toContain("var lerResposta = function lerResposta(");
    expect(script).toContain("/R\\$ (?=\\d)/g");
    expect(script).toContain("'R$' + ESPACO_QUE_NAO_QUEBRA");
    expect(() => new Function(script)).not.toThrow();
    // Só o que o navegador entende: nada de TypeScript nem de ajudante do empacotador.
    expect(script).not.toMatch(/: unknown|as Record|__name/);
  });
});

describe("leitura da resposta do POST /chat pela página", () => {
  it("aceita o formato do contrato", () => {
    expect(lerResposta({ reply: "Olá!", handoff: false })).toEqual({ reply: "Olá!", handoff: false });
    expect(lerResposta({ reply: "Vou passar para uma pessoa.", handoff: true, extra: 1 })).toEqual({
      reply: "Vou passar para uma pessoa.",
      handoff: true,
    });
  });

  it("qualquer outra coisa vira erro, não resposta", () => {
    for (const corpo of [null, undefined, "texto", 42, [], {}, { reply: "Olá!" }, { handoff: true },
      { reply: "", handoff: false }, { reply: "   ", handoff: false }, { reply: 7, handoff: false },
      { reply: "Olá!", handoff: "true" }, { erro: "rota nao encontrada" }]) {
      expect(lerResposta(corpo)).toBeNull();
    }
  });
});
