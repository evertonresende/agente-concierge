// Rotas do Worker: POST /chat (contrato seção 2), GET / (página) e GET /saude.
// O módulo de entrada exporta apenas o handler padrão e a classe do Durable Object.
import { tratarChat } from "./chat";
import type { Env } from "./env";
import { destinoDosLeads } from "./lead";
import { PAGINA } from "./pagina";

export { Teto } from "./gasto";
export { Sessao } from "./sessao";

async function hashDoBloco(tag: "script" | "style"): Promise<string> {
  const abre = `<${tag}>`;
  const conteudo = PAGINA.slice(PAGINA.indexOf(abre) + abre.length, PAGINA.indexOf(`</${tag}>`));
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(conteudo)));
  return `'sha256-${btoa(String.fromCharCode(...resumo))}'`;
}

// Os hashes saem do conteúdo real da página, calculados uma vez por isolate: a política
// acompanha qualquer mudança no script ou no estilo sem valor colado à mão.
let cabecalhosDaPagina: Promise<Record<string, string>> | undefined;
function cabecalhosDePagina(): Promise<Record<string, string>> {
  cabecalhosDaPagina ??= Promise.all([hashDoBloco("script"), hashDoBloco("style")]).then(([script, estilo]) => ({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": [
      "default-src 'none'",
      `script-src ${script}`,
      `style-src ${estilo}`,
      // A borda pode inserir um elemento oculto com atributo style; sem isto ele deixaria de
      // ficar oculto. Atributo de estilo não executa código, e a página não escreve HTML de fora.
      "style-src-attr 'unsafe-inline'",
      "connect-src 'self'",
      "font-src data:", // a fonte Inter vem embutida em data:
      "img-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  }));
  return cabecalhosDaPagina;
}

function saude(env: Env): Response {
  const variaveis = {
    CATALOGO_URL: Boolean(env.CATALOGO_URL),
    LEADS_URL: Boolean(env.LEADS_URL),
    AMBIENTE: Boolean(env.AMBIENTE),
    MODELO: Boolean(env.MODELO),
    ENVIO_LEADS: Boolean(env.ENVIO_LEADS),
  };
  return Response.json({
    ok: Object.values(variaveis).every(Boolean),
    ambiente: env.AMBIENTE ?? null,
    leads_destino: destinoDosLeads(env.LEADS_URL, env.CATALOGO_URL),
    envio_leads: env.ENVIO_LEADS === "ligado" ? "ligado" : "desligado",
    variaveis,
  });
}

export default {
  async fetch(pedido: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(pedido.url);
    if (pathname === "/chat") {
      return pedido.method === "POST"
        ? tratarChat(pedido, env)
        : Response.json({ erro: "use POST" }, { status: 405, headers: { allow: "POST" } });
    }
    if (pedido.method === "GET" && pathname === "/saude") return saude(env);
    if (pedido.method === "GET" && pathname === "/") {
      return new Response(PAGINA, { headers: await cabecalhosDePagina() });
    }
    return Response.json({ erro: "rota não encontrada" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
