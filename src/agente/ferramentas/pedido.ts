// Leitura comum do pedido de estadia que o modelo manda para cotar e para resumir.
import { type Ficha, regrasDaFicha } from "../../catalogo";
import { type DataISO, ehDataInexistente, formatarDataComDia, resolverData, resolverSaida, saidaSemAnoAlemDoTeto } from "../../nucleo/datas";
import type { Mensagem } from "../../modelo";
import { cotar, type Cotacao } from "../../nucleo/preco";
import { type Argumentos, type Contexto, numero, texto } from "./tipos";

export type Pedido =
  | { ok: true; ficha: Ficha; checkin: DataISO; checkout: DataISO; hospedes: number | undefined; cotacao: Cotacao }
  | { ok: false; erro: string };

/**
 * Lê imóvel, datas e hóspedes dos argumentos, busca a ficha e aplica a regra de preço.
 * `hospedesPadrao` vale quando os argumentos não trazem o número de hóspedes.
 */
export async function prepararPedido(argumentos: Argumentos, contexto: Contexto, hospedesPadrao?: number): Promise<Pedido> {
  const id = texto(argumentos, "imovel_id");
  if (!id) return { ok: false, erro: "Falta o imóvel. Pergunte ao hóspede qual imóvel ele quer." };
  const entrada = texto(argumentos, "checkin");
  const saida = texto(argumentos, "checkout");
  const checkin = entrada ? resolverData(entrada, contexto.hoje) : null;
  const checkout = saida
    ? (checkin ? resolverSaida(saida, checkin, contexto.hoje) : resolverData(saida, contexto.hoje))
    : null;
  if (!checkin || !checkout) {
    const inexistente = (entrada && !checkin && ehDataInexistente(entrada))
      || (saida && !checkout && ehDataInexistente(saida));
    return {
      ok: false,
      erro: inexistente
        ? "Data de entrada ou de saída inexistente no calendário. Peça ao hóspede a data correta de entrada e de saída. "
          + "Não informe nenhum total e não passe para humano."
        : "Não foi possível determinar a data de entrada ou de saída. Expressões sem mês ou datas exatas (como "
          + "\"fim de semana\", \"Natal\", \"feriado\" ou \"dia 15\") não definem o período: peça ao hóspede a data "
          + "completa de entrada e a de saída. Não informe nenhum total e não passe para humano.",
    };
  }
  if (checkin < contexto.hoje) {
    return {
      ok: false,
      erro: `A data de entrada (${formatarDataComDia(checkin)}) já passou (hoje é ${formatarDataComDia(contexto.hoje)}). `
        + "Não é possível cotar ou reservar datas no passado. Explique o motivo ao hóspede e peça novas datas de "
        + "entrada e de saída. Não informe nenhum total e não passe para humano.",
    };
  }
  if (saida && saidaSemAnoAlemDoTeto(saida, checkin, contexto.hoje)) {
    return {
      ok: false,
      erro: "A data de saída veio sem ano e, depois da entrada, a estadia ficaria longa demais: deve ser engano de "
        + "digitação. Peça ao hóspede as datas de entrada e de saída de novo, com o ano se a estadia for longa mesmo. "
        + "Não complete o ano por conta própria nem chame a ferramenta de novo com um ano que o hóspede não escreveu. "
        + "Não informe nenhum total e não passe para humano.",
    };
  }
  const ficha = await contexto.catalogo.ficha(id);
  if (!ficha) return { ok: false, erro: "Imóvel não encontrado no catálogo. Não informe nenhum valor." };
  const hospedes = contarHospedes(argumentos) ?? hospedesPadrao;
  return { ok: true, ficha, checkin, checkout, hospedes, cotacao: cotar(regrasDaFicha(ficha), checkin, checkout, hospedes) };
}

const PARTES_DO_GRUPO = ["adultos", "criancas", "bebes"] as const;

/**
 * Número de hóspedes que o código usa (L13): a soma de adultos, crianças e bebês, quando
 * o modelo manda as partes; senão, `hospedes`. Parte inválida (negativa ou fracionada)
 * vira o número da conta, para a regra de preço recusar com o motivo; 0 no total também.
 */
export function contarHospedes(argumentos: Argumentos): number | undefined {
  const partes = PARTES_DO_GRUPO.map((parte) => numero(argumentos, parte)).filter((n): n is number => n !== undefined);
  if (partes.length === 0) return numero(argumentos, "hospedes");
  return partes.find((n) => !Number.isInteger(n) || n < 0) ?? partes.reduce((soma, n) => soma + n, 0);
}

/** Imóvel e datas resolvidos dos argumentos de cotar ou de montar_resumo, para comparar pedidos. */
function estadiaDe(argumentos: Argumentos, hoje: DataISO): string | undefined {
  const id = texto(argumentos, "imovel_id")?.toUpperCase();
  const entrada = texto(argumentos, "checkin");
  const saida = texto(argumentos, "checkout");
  if (!id || !entrada || !saida) return undefined;
  const checkin = resolverData(entrada, hoje);
  const checkout = checkin ? resolverSaida(saida, checkin, hoje) : null;
  return checkin && checkout ? `${id}|${checkin}|${checkout}` : undefined;
}

function argumentosDe(texto: string): Argumentos | undefined {
  try {
    const dado: unknown = JSON.parse(texto || "{}");
    return dado && typeof dado === "object" && !Array.isArray(dado) ? (dado as Argumentos) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Número de pessoas da última cotação deste imóvel e destas datas na conversa, aceita ou
 * recusada (L13, L13a). O resumo não pode sair com menos gente: "bebê não ocupa cama,
 * fecha para 2" depois de cotar 2 adultos e 2 bebês é o mesmo grupo de 4.
 */
export function grupoCotado(mensagens: Mensagem[], argumentos: Argumentos, hoje: DataISO): number | undefined {
  const alvo = estadiaDe(argumentos, hoje);
  if (!alvo) return undefined;
  let grupo: number | undefined;
  for (const m of mensagens) {
    if (m.role !== "assistant") continue;
    for (const chamada of m.tool_calls ?? []) {
      const dados = chamada.function.name === "cotar" ? argumentosDe(chamada.function.arguments) : undefined;
      if (!dados || estadiaDe(dados, hoje) !== alvo) continue;
      const n = contarHospedes(dados);
      if (n !== undefined && Number.isInteger(n) && n > 0) grupo = n;
    }
  }
  return grupo;
}
