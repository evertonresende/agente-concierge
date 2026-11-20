// Proteção de gasto da demonstração pública (M2 da rodada pós-entrega, valores decididos pelo
// Éverton em 20/11): limite de mensagens por IP, pelo binding nativo de rate limit, e teto
// diário de chamadas ao modelo, contado num Durable Object por dia civil de São Paulo. Acima
// de qualquer um, o /chat responde um texto fixo sem chamar o modelo.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { dataCivilEmSaoPaulo } from "./nucleo/datas";
import { idiomaDoHospede } from "./nucleo/idioma";

const TEXTOS = {
  pt: {
    ip: "Você mandou muitas mensagens em pouco tempo. Espere um minuto e tente de novo.",
    teto: "A demonstração atingiu o limite de uso de hoje. Tente de novo amanhã.",
  },
  en: {
    ip: "You sent too many messages in a short time. Please wait a minute and try again.",
    teto: "The demo has reached today's usage limit. Please try again tomorrow.",
  },
};

/** Contador de chamadas ao modelo de um dia. Um objeto por dia: o nome leva a data. */
export class Teto extends DurableObject {
  async usadas(): Promise<number> {
    return (await this.ctx.storage.get<number>("chamadas")) ?? 0;
  }

  async somar(chamadas: number): Promise<void> {
    if (!Number.isInteger(chamadas) || chamadas <= 0) return;
    await this.ctx.storage.put("chamadas", (await this.usadas()) + chamadas);
  }
}

/** Teto do dia em chamadas ao modelo; ausente, vazio ou inválido desliga o teto. */
function tetoDiario(env: Env): number | undefined {
  const valor = Number(env.TETO_DIARIO_CHAMADAS);
  return Number.isInteger(valor) && valor > 0 ? valor : undefined;
}

const contadorDoDia = (env: Env, agora: number) => env.TETO?.getByName(`teto:${dataCivilEmSaoPaulo(agora)}`);

/**
 * Prazo das chamadas ao contador: no máximo 1,5 s e nunca mais que 10% do tempo que resta à
 * resposta. Lento, o contador não pode comer o orçamento do turno (contrato seção 2).
 */
export function prazoDoContador(prazoDaRespostaMs: number, agora = Date.now()): number {
  return Math.min(1_500, Math.max(0, (prazoDaRespostaMs - agora) / 10));
}

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new Error("contador lento")), ms); });
  promessa.catch(() => {});
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

/**
 * Texto fixo quando o pedido passa de um limite, ou `undefined` para seguir. Falha do
 * limitador ou do contador deixa passar: o pedido não fica sem resposta por causa dele.
 */
export async function barrarPorGasto(
  env: Env, pedido: Request, mensagem: string, prazoMs = 1_500, agora = Date.now(),
): Promise<string | undefined> {
  const textos = TEXTOS[idiomaDoHospede([mensagem])];
  try {
    if (env.LIMITE_POR_IP) {
      const ip = pedido.headers.get("cf-connecting-ip") ?? "sem-ip";
      if (!(await env.LIMITE_POR_IP.limit({ key: ip })).success) return textos.ip;
    }
    const teto = tetoDiario(env);
    const contador = contadorDoDia(env, agora);
    // ponytail: confere antes e soma depois; pedidos simultâneos podem passar um pouco do teto.
    if (teto !== undefined && contador && (await comPrazo(contador.usadas(), prazoMs)) >= teto) return textos.teto;
  } catch (erro) {
    // ponytail: falha aberta; se o contador cair, o teto do provedor do modelo ainda vale.
    console.log(JSON.stringify({ evento: "falha_no_limite_de_gasto", erro: erro instanceof Error ? erro.name : "desconhecido" }));
  }
  return undefined;
}

/** Soma as chamadas reais do turno ao contador do dia. Melhor esforço. */
export async function registrarGasto(env: Env, chamadas: number, prazoMs = 1_500, agora = Date.now()): Promise<void> {
  if (tetoDiario(env) === undefined) return;
  try {
    const contador = contadorDoDia(env, agora);
    if (contador) await comPrazo(contador.somar(chamadas), prazoMs);
  } catch {
    // Melhor esforço: a resposta ao hóspede não depende do contador.
  }
}
