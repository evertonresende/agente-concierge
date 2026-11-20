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
 * Texto fixo quando o pedido passa de um limite, ou `undefined` para seguir. Falha do
 * limitador ou do contador deixa passar: o pedido não fica sem resposta por causa dele.
 */
export async function barrarPorGasto(env: Env, pedido: Request, mensagem: string, agora = Date.now()): Promise<string | undefined> {
  const textos = TEXTOS[idiomaDoHospede([mensagem])];
  try {
    if (env.LIMITE_POR_IP) {
      const ip = pedido.headers.get("cf-connecting-ip") ?? "sem-ip";
      if (!(await env.LIMITE_POR_IP.limit({ key: ip })).success) return textos.ip;
    }
    const teto = tetoDiario(env);
    const contador = contadorDoDia(env, agora);
    if (teto !== undefined && contador && (await contador.usadas()) >= teto) return textos.teto;
  } catch (erro) {
    // ponytail: falha aberta; se o contador cair, o teto do provedor do modelo ainda vale.
    console.log(JSON.stringify({ evento: "falha_no_limite_de_gasto", erro: erro instanceof Error ? erro.name : "desconhecido" }));
  }
  return undefined;
}

/** Soma as chamadas reais do turno ao contador do dia. Melhor esforço. */
export async function registrarGasto(env: Env, chamadas: number, agora = Date.now()): Promise<void> {
  if (tetoDiario(env) === undefined) return;
  try {
    await contadorDoDia(env, agora)?.somar(chamadas);
  } catch {
    // Melhor esforço: a resposta ao hóspede não depende do contador.
  }
}
