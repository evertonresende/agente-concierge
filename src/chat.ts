// Tratamento de POST /chat fora do módulo de entrada do Worker (A1, A5, A5c, A6).
import { CONTINGENCIA } from "./agente/loop";
import type { Env } from "./env";
import { nomeDoErro, type RespostaDoChat, TETO_WORKER_MS } from "./sessao";

const LIMITE_DA_MENSAGEM = 8_000;
const LIMITE_DO_CORPO = 65_536;
const MENSAGEM_LONGA_DEMAIS = "Sua mensagem ficou longa demais para eu ler de uma vez. Pode resumir em poucas linhas?";
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
const TENTATIVAS_SESSAO = 2;

class TempoEsgotadoWorker extends Error {}
class CorpoGrandeDemais extends Error {}

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

async function lerCorpoLimitado(pedido: Request, limite: number, prazo: number): Promise<unknown> {
  if (!pedido.body) throw new SyntaxError("corpo vazio");
  const leitor = pedido.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const leitura = leitor.read();
      leitura.catch(() => {});
      const { done, value } = await comPrazo(leitura, prazo - Date.now());
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limite) throw new CorpoGrandeDemais();
      pedacos.push(value);
    }
  } catch (erro) {
    leitor.cancel().catch(() => {});
    throw erro;
  } finally {
    leitor.releaseLock();
  }
  const completo = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    completo.set(pedaco, posicao);
    posicao += pedaco.byteLength;
  }
  const texto = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(completo);
  return JSON.parse(texto);
}

export async function tratarChat(pedido: Request, env: Env, tetoMs = TETO_WORKER_MS): Promise<Response> {
  const chegada = Date.now();
  const prazo = chegada + tetoMs;
  try {
    const tamanhoInformado = pedido.headers.get("content-length");
    if (tamanhoInformado !== null) {
      const bruto = tamanhoInformado.trim();
      if (/^\d+$/.test(bruto) && Number(bruto) > LIMITE_DO_CORPO) {
        pedido.body?.cancel().catch(() => {});
        return responder(200, MENSAGEM_LONGA_DEMAIS, false);
      }
    }

    let corpo: unknown;
    try {
      corpo = await lerCorpoLimitado(pedido, LIMITE_DO_CORPO, prazo);
    } catch (erro) {
      if (erro instanceof CorpoGrandeDemais) {
        return responder(200, MENSAGEM_LONGA_DEMAIS, false);
      }
      if (erro instanceof TempoEsgotadoWorker) {
        console.log(JSON.stringify({ evento: "tempo_esgotado_no_worker", origem: "prazo", erro: nomeDoErro(erro) }));
        return responder(200, CONTINGENCIA, true);
      }
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
      return responder(200, MENSAGEM_LONGA_DEMAIS, false);
    }

    const idPedido = crypto.randomUUID();
    for (let tentativa = 1; ; tentativa++) {
      const restante = prazo - Date.now();
      if (restante <= 0) {
        console.log(JSON.stringify({ evento: "tempo_esgotado_no_worker", origem: "prazo", erro: "TempoEsgotadoWorker" }));
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
          console.log(JSON.stringify(
            erro instanceof TempoEsgotadoWorker
              ? { evento: "tempo_esgotado_no_worker", origem: "prazo", erro: nomeDoErro(erro) }
              : { evento: "falha_no_chat", origem: "sessao", erro: nomeDoErro(erro) },
          ));
          return responder(200, CONTINGENCIA, true);
        }
      }
    }
  } catch (erro) {
    console.log(JSON.stringify({ evento: "falha_inesperada_no_chat", origem: "worker", erro: nomeDoErro(erro) }));
    return responder(200, CONTINGENCIA, true);
  }
}
