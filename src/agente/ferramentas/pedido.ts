// Leitura comum do pedido de estadia que o modelo manda para cotar e para resumir.
import { type Ficha, regrasDaFicha } from "../../catalogo";
import { type DataISO, ehDataInexistente, formatarDataComDia, resolverData, resolverSaida } from "../../nucleo/datas";
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
