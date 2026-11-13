// Rotas do Worker: POST /chat (contrato seção 2), GET / (página) e GET /saude.
// O módulo de entrada exporta apenas o handler padrão e a classe do Durable Object.
import { tratarChat } from "./chat";
import type { Env } from "./env";
import { destinoDosLeads } from "./lead";
import { PAGINA } from "./pagina";

export { Sessao } from "./sessao";

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
      return new Response(PAGINA, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return Response.json({ erro: "rota não encontrada" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
