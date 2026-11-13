import { type Ficha, regrasDaFicha } from "../../catalogo";
import { chaveDaReserva, invalidarPendente, type Pendente } from "../../lead";
import { type DataISO, formatarDataComDia, interpretarData } from "../../nucleo/datas";
import { formatarReais } from "../../nucleo/dinheiro";
import { cotar, type Cotacao } from "../../nucleo/preco";
import { type Argumentos, type Contexto, definir, numero, texto } from "./tipos";

export type Pedido =
  | { ok: true; ficha: Ficha; checkin: DataISO; checkout: DataISO; hospedes: number | undefined; cotacao: Cotacao }
  | { ok: false; erro: string };

/** Lê imóvel, datas e hóspedes dos argumentos, busca a ficha e aplica a regra de preço. */
export async function prepararPedido(argumentos: Argumentos, contexto: Contexto): Promise<Pedido> {
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
  const hospedes = numero(argumentos, "hospedes");
  return { ok: true, ficha, checkin, checkout, hospedes, cotacao: cotar(regrasDaFicha(ficha), checkin, checkout, hospedes) };
}

/** A cotação pedida é de outra estadia que não a do resumo pendente? (contrato L10) */
function mudouDepoisDoResumo(pendente: Pendente, pedido: Extract<Pedido, { ok: true }>): boolean {
  const r = pendente.reserva;
  const pedida = { ...r, imovel_id: pedido.ficha.id, checkin: pedido.checkin, checkout: pedido.checkout, hospedes: pedido.hospedes ?? r.hospedes };
  return chaveDaReserva(pedida) !== chaveDaReserva(r);
}

export const cotarEstadia = definir(
  "cotar",
  "Calcula o total de uma estadia pela regra de preço. É a ÚNICA fonte de valores: nunca calcule nem altere um "
    + "total por conta própria. Passe as datas como o hóspede escreveu, em DD/MM/AAAA ou AAAA-MM-DD. `hospedes` é "
    + "opcional: sem ele a cotação sai do mesmo jeito. Pode devolver uma recusa com o motivo, sem total.",
  {
    imovel_id: { type: "string", description: "Id do imóvel, ex.: GRM-301" },
    checkin: { type: "string", description: "Data de entrada, DD/MM/AAAA ou AAAA-MM-DD" },
    checkout: { type: "string", description: "Data de saída, DD/MM/AAAA ou AAAA-MM-DD" },
    hospedes: { type: "integer", description: "Número de pessoas (adultos, crianças e bebês contam; pet não)" },
  },
  ["imovel_id", "checkin", "checkout"],
  async (argumentos, contexto) => {
    const pedido = await prepararPedido(argumentos, contexto);
    if (!pedido.ok) return { paraOModelo: { erro: pedido.erro } };

    const pendente = contexto.cofre.ler().pendente;
    const invalidou = pendente !== null && mudouDepoisDoResumo(pendente, pedido);
    if (invalidou) invalidarPendente(contexto.cofre);

    const { ficha, cotacao, checkin, checkout, hospedes } = pedido;
    const estadia = {
      imovel: { id: ficha.id, nome: ficha.nome, capacidade: ficha.capacidade, minimo_noites: ficha.minimo_noites },
      entrada: formatarDataComDia(checkin),
      saida: formatarDataComDia(checkout),
    };
    if (!cotacao.ok) {
      return {
        paraOModelo: {
          ...estadia,
          recusada: true,
          motivo: cotacao.explicacao,
          instrucao: "Explique o motivo ao hóspede. Não informe nenhum total. Isto não é caso de passar para humano.",
        },
      };
    }
    const total = formatarReais(cotacao.totalCentavos);
    return {
      total,
      paraOModelo: {
        ...estadia,
        noites: cotacao.noites.map((n) => ({
          noite: formatarDataComDia(n.data),
          valor: formatarReais(n.centavos),
          acrescimo_de_fim_de_semana: n.comAcrescimo,
        })),
        taxa_de_limpeza: formatarReais(cotacao.taxaLimpezaCentavos),
        total,
        hospedes: hospedes ?? "não informado: informe a capacidade e pergunte quantas pessoas são",
        instrucao: "Informe o total exatamente como está em `total` e as datas com o dia da semana. O valor é uma "
          + "cotação: não afirme que as datas estão disponíveis."
          + (invalidou ? " O resumo que aguardava confirmação deixou de valer: para fechar, monte um novo resumo." : ""),
      },
    };
  },
);
