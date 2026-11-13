// Rotas do Worker: POST /chat (contrato seção 2), GET / (página) e GET /saude.
import type { Env } from "./env";
import { destinoDosLeads } from "./lead";
import { PAGINA } from "./pagina";
import type { RespostaDoChat } from "./sessao";

export { Sessao } from "./sessao";

const LIMITE_DA_MENSAGEM = 8_000;
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
const FALHA_INTERNA = "Tive um problema técnico e não consegui concluir o seu atendimento agora. Vou passar a conversa "
  + "para uma pessoa do nosso time, que continua com você.";

function responder(status: number, reply: string, handoff: boolean, uso: RespostaDoChat["uso"] = SEM_USO): Response {
  return Response.json({ reply, handoff }, {
    status,
    headers: {
      "x-uso-entrada": String(uso.entrada),
      "x-uso-saida": String(uso.saida),
      "x-chamadas-modelo": String(uso.chamadas),
    },
  });
}

async function chat(pedido: Request, env: Env): Promise<Response> {
  const chegada = Date.now();
  let corpo: unknown;
  try {
    corpo = await pedido.json();
  } catch {
    return responder(400, "Corpo inválido: envie um JSON com session_id e message.", false);
  }
  const { session_id, message } = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  if (typeof session_id !== "string" || typeof message !== "string") {
    return responder(400, "Corpo inválido: session_id e message são obrigatórios e precisam ser texto.", false);
  }
  if (message.trim() === "") {
    return responder(200, "Não recebi nenhum texto. Pode escrever a sua mensagem?", false);
  }
  if (message.length > LIMITE_DA_MENSAGEM) {
    return responder(200, "Sua mensagem ficou longa demais para eu ler de uma vez. Pode resumir em poucas linhas?", false);
  }
  try {
    // O prefixo deixa o session_id vazio valer como uma sessão qualquer (contrato L17a).
    const resposta = await env.SESSAO.getByName(`sessao:${session_id}`).conversar(message, chegada);
    return responder(200, resposta.reply, resposta.handoff, resposta.uso);
  } catch {
    console.log(JSON.stringify({ evento: "falha_no_chat" }));
    return responder(200, FALHA_INTERNA, true);
  }
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
      return pedido.method === "POST" ? chat(pedido, env) : Response.json({ erro: "use POST" }, { status: 405, headers: { allow: "POST" } });
    }
    if (pedido.method === "GET" && pathname === "/saude") return saude(env);
    if (pedido.method === "GET" && pathname === "/") {
      return new Response(PAGINA, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return Response.json({ erro: "rota não encontrada" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
