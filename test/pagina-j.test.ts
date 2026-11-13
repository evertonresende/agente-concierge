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
    expect(script).not.toMatch(/: unknown|as Record/);
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

// O ambiente de teste não tem DOM. Este documento falso tem só o que o script da página
// usa, para o script rodar de verdade: o que se confere é o que fica na conversa.
class No {
  filhos: No[] = [];
  pai: No | null = null;
  atributos: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  ouvintes: Record<string, ((evento: unknown) => void)[]> = {};
  className = "";
  texto = "";
  value = "";
  type = "";
  disabled = false;
  offsetTop = 0;
  offsetHeight = 0;
  clientHeight = 0;
  scrollTop = 0;
  scrollHeight = 0;
  classList = { add: (classe: string) => { this.className += ` ${classe}`; } };
  constructor(public tag: string, public id = "") {}
  get textContent(): string { return this.texto + this.filhos.map((filho) => filho.textContent).join(""); }
  set textContent(valor: string) { this.filhos = []; this.texto = valor; }
  get firstChild(): No | null { return this.filhos[0] ?? null; }
  get lastChild(): No | null { return this.filhos.at(-1) ?? null; }
  get lastElementChild(): No | null { return this.lastChild; }
  appendChild(filho: No): No { filho.remove(); filho.pai = this; this.filhos.push(filho); return filho; }
  append(...filhos: No[]): void { filhos.forEach((filho) => this.appendChild(filho)); }
  remove(): void { if (this.pai) this.pai.filhos = this.pai.filhos.filter((filho) => filho !== this); this.pai = null; }
  setAttribute(nome: string, valor: string): void { this.atributos[nome] = valor; }
  removeAttribute(nome: string): void { delete this.atributos[nome]; }
  addEventListener(tipo: string, ouvinte: (evento: unknown) => void): void { (this.ouvintes[tipo] ??= []).push(ouvinte); }
  disparar(tipo: string, evento: object = {}): void { (this.ouvintes[tipo] ?? []).forEach((ouvinte) => ouvinte({ preventDefault() {}, ...evento })); }
  requestSubmit(): void { this.disparar("submit"); }
  focus(): void {}
  todos(classe: string): No[] {
    return this.filhos.flatMap((filho) => [...(filho.className.split(" ").includes(classe) ? [filho] : []), ...filho.todos(classe)]);
  }
  querySelector(seletor: string): No | null { return this.todos(seletor.slice(1))[0] ?? null; }
}

function abrirPagina() {
  const no = (id: string) => new No("div", id);
  const nos = {
    conversa: no("conversa"), registro: no("registro"), envio: no("envio"), mensagem: no("mensagem"),
    enviar: no("enviar"), dica: no("dica"), estado: no("estado"), entrada: no("entrada"),
  };
  const exemplo = new No("button");
  exemplo.appendChild(Object.assign(new No("span"), { className: "ex-texto", texto: "Consegue um desconto se eu pagar à vista?" }));
  const pedidos: { corpo: { session_id: string; message: string }; responder: (corpo: unknown) => void; falhar: () => void }[] = [];
  const relogios: (() => void)[] = [];
  const documento = {
    documentElement: new No("html"),
    getElementById: (id: string) => (nos as Record<string, No>)[id] ?? null,
    createElement: (tag: string) => new No(tag),
    querySelectorAll: () => [exemplo],
  };
  const buscar = (_caminho: string, init: { body: string; signal: AbortSignal }) => new Promise((resolver, rejeitar) => {
    init.signal.addEventListener("abort", () => rejeitar(new Error("tempo esgotado")));
    pedidos.push({
      corpo: JSON.parse(init.body),
      responder: (corpo) => resolver({ json: async () => corpo }),
      falhar: () => rejeitar(new Error("sem rede")),
    });
  });
  const script = PAGINA.slice(PAGINA.indexOf("<script>") + "<script>".length, PAGINA.indexOf("</script>"));
  new Function("document", "window", "matchMedia", "fetch", "setTimeout", "clearTimeout", script)(
    documento, {}, () => ({ matches: true }), buscar, (acao: () => void) => relogios.push(acao), () => {},
  );
  const assentar = () => new Promise((resolver) => setTimeout(resolver, 0));
  const escrever = async (texto: string) => { nos.mensagem.value = texto; nos.envio.disparar("submit"); await assentar(); };
  const falas = (de: string) => nos.registro.filhos.filter((turno) => turno.dataset.de === de && !turno.atributos["aria-hidden"]);
  return { nos, exemplo, pedidos, relogios, assentar, escrever, falas };
}

describe("script da página, rodando com um documento falso", () => {
  it("envia para o POST /chat e mostra a resposta, com o aviso quando vem handoff true", async () => {
    const { nos, pedidos, assentar, escrever, falas } = abrirPagina();
    await escrever("  Tem desconto?  ");
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.corpo.message).toBe("Tem desconto?");
    expect(pedidos[0]!.corpo.session_id).toMatch(/^[0-9a-f]{32}$/);
    expect(nos.enviar.disabled).toBe(true);
    expect(nos.estado.textContent).toContain("Aguardando a resposta");
    await escrever("outra, durante a espera");
    expect(pedidos).toHaveLength(1);

    pedidos[0]!.responder({ reply: "Não negocio preço. O total é R$ 2.156,00.", handoff: true });
    await assentar();
    expect(falas("voce").map((turno) => turno.filhos[1]!.textContent)).toEqual(["Tem desconto?"]);
    expect(falas("agente").map((turno) => turno.filhos[1]!.textContent)).toEqual(["Não negocio preço. O total é R$ 2.156,00."]);
    expect(nos.registro.todos("aviso")).toHaveLength(1);
    expect(nos.registro.todos("aviso")[0]!.textContent).toContain("handoff: true");
    expect(nos.registro.todos("erro")).toHaveLength(0);
    expect(nos.enviar.disabled).toBe(false);
    expect(nos.estado.textContent).toBe("");

    nos.mensagem.value = "";
    await escrever("E agora?");
    expect(pedidos[1]!.corpo.session_id).toBe(pedidos[0]!.corpo.session_id);
    pedidos[1]!.responder({ reply: "Sigo atendendo.", handoff: false });
    await assentar();
    expect(nos.registro.todos("aviso")).toHaveLength(1);
  });

  it("falha de rede vira erro, e tentar de novo reenvia a mesma fala sem duplicar", async () => {
    const { nos, pedidos, assentar, escrever, falas } = abrirPagina();
    await escrever("Quanto fica?");
    pedidos[0]!.falhar();
    await assentar();
    expect(nos.registro.todos("erro")).toHaveLength(1);
    expect(nos.registro.todos("nota")[0]!.textContent).toBe("Sem resposta");
    expect(nos.enviar.disabled).toBe(false);

    nos.registro.todos("contorno")[0]!.disparar("click");
    await assentar();
    expect(pedidos).toHaveLength(2);
    expect(pedidos[1]!.corpo).toEqual(pedidos[0]!.corpo);
    expect(nos.registro.todos("erro")).toHaveLength(0);
    pedidos[1]!.responder({ reply: "Fica R$ 2.156,00.", handoff: false });
    await assentar();
    expect(falas("voce")).toHaveLength(1);
    expect(falas("agente")).toHaveLength(1);
    expect(nos.registro.todos("nota")).toHaveLength(0);
  });

  it("resposta fora do contrato e tempo esgotado viram erro, nunca resposta", async () => {
    const { nos, exemplo, pedidos, relogios, assentar, falas } = abrirPagina();
    exemplo.disparar("click");
    await assentar();
    expect(pedidos[0]!.corpo.message).toBe("Consegue um desconto se eu pagar à vista?");
    pedidos[0]!.responder({ reply: "sem a flag" });
    await assentar();
    expect(falas("agente")).toHaveLength(0);
    expect(nos.registro.todos("erro")).toHaveLength(1);

    nos.registro.todos("contorno")[0]!.disparar("click");
    await assentar();
    relogios.at(-1)?.(); // o relógio de 70 s dispara
    await assentar();
    expect(falas("agente")).toHaveLength(0);
    expect(nos.registro.todos("erro")).toHaveLength(1);
    expect(nos.enviar.disabled).toBe(false);
  });
});
