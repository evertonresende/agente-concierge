// Leitura comum do pedido de estadia que o modelo manda para cotar e para resumir.
import { type Ficha, regrasDaFicha } from "../../catalogo";
import { type DataISO, interpretarData } from "../../nucleo/datas";
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
  const checkin = entrada ? interpretarData(entrada) : null;
  const checkout = saida ? interpretarData(saida) : null;
  if (!checkin || !checkout) {
    return {
      ok: false,
      erro: "Data de entrada ou de saída ausente, inexistente ou incompleta. Peça ao hóspede as duas datas com dia, "
        + "mês e ano (DD/MM/AAAA). Não informe nenhum total.",
    };
  }
  const ficha = await contexto.catalogo.ficha(id);
  if (!ficha) return { ok: false, erro: "Imóvel não encontrado no catálogo. Não informe nenhum valor." };
  const hospedes = numero(argumentos, "hospedes") ?? hospedesPadrao;
  return { ok: true, ficha, checkin, checkout, hospedes, cotacao: cotar(regrasDaFicha(ficha), checkin, checkout, hospedes) };
}
