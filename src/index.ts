// Rotas do Worker: POST /chat (contrato seção 2), GET / (página) e GET /saude.
import { CONTINGENCIA } from "./agente/loop";
import type { Env } from "./env";
import { destinoDosLeads } from "./lead";
import { PAGINA } from "./pagina";
import { type RespostaDoChat, TETO_WORKER_MS } from "./sessao";

export { Sessao } from "./sessao";

const LIMITE_DA_MENSAGEM = 8_000;
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
const TENTATIVAS_SESSAO = 2;

class TempoEsgotadoWorker extends Error {}

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new TempoEsgotadoWorker());
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new TempoEsgotadoWorker()), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

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

export async function tratarChat(pedido: Request, env: Env, tetoMs = TETO_WORKER_MS): Promise<Response> {
  const chegada = Date.now();
  const prazo = chegada + tetoMs;
  try {
    let corpo: unknown;
    try {
      const leitura = pedido.json();
      leitura.catch(() => {});
      corpo = await comPrazo(leitura, prazo - Date.now());
    } catch {
      return responder(400, "Corpo inválido: envie um JSON com session_id e message.", false);
    }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      return responder(400, "Corpo inválido: session_id e message são obrigatórios e precisam ser texto.", false);
    }
    const { session_id, message } = corpo as Record<string, unknown>;
    if (typeof session_id !== "string" || typeof message !== "string") {
      return responder(400, "Corpo inválido: session_id e message são obrigatórios e precisam ser texto.", false);
    }
    if (message.trim() === "") {
      return responder(200, "Não recebi nenhum texto. Pode escrever a sua mensagem?", false);
    }
    if (message.length > LIMITE_DA_MENSAGEM) {
      return responder(200, "Sua mensagem ficou longa demais para eu ler de uma vez. Pode resumir em poucas linhas?", false);
    }

    const idPedido = crypto.randomUUID();
    for (let tentativa = 1; ; tentativa++) {
      const restante = prazo - Date.now();
      if (restante <= 0) {
        console.log(JSON.stringify({ evento: "tempo_esgotado_no_worker" }));
        return responder(200, CONTINGENCIA, true);
      }
      try {
        // O prefixo deixa o session_id vazio valer como uma sessão qualquer (contrato L17a).
        const chamada = env.SESSAO.getByName(`sessao:${session_id}`).conversar(message, chegada, idPedido);
        // Evita rejeição não tratada se o teto do Worker vencer antes da promessa da sessão.
        chamada.catch(() => {});
        const resposta = await comPrazo(chamada, restante);
        return responder(200, resposta.reply, resposta.handoff, resposta.uso);
      } catch (erro) {
        if (erro instanceof TempoEsgotadoWorker || tentativa >= TENTATIVAS_SESSAO) {
          console.log(JSON.stringify({
            evento: erro instanceof TempoEsgotadoWorker ? "tempo_esgotado_no_worker" : "falha_no_chat",
          }));
          return responder(200, CONTINGENCIA, true);
        }
      }
    }
  } catch {
    console.log(JSON.stringify({ evento: "falha_inesperada_no_chat" }));
    return responder(200, CONTINGENCIA, true);
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
