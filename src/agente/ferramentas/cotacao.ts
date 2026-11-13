import { chaveDaReserva, invalidarPendente, pendenteAberto, type Reserva } from "../../lead";
import { formatarDataComDia } from "../../nucleo/datas";
import { formatarReais } from "../../nucleo/dinheiro";
import { resumir } from "./lead";
import { prepararPedido } from "./pedido";
import { definir } from "./tipos";

export const cotarEstadia = definir(
  "cotar",
  "Calcula o total de uma estadia pela regra de preço. É a ÚNICA fonte de valores: nunca calcule nem altere um "
    + "total por conta própria. Passe as datas como o hóspede escreveu (por exemplo: \"hoje\", \"amanhã\", "
    + "\"depois de amanhã\", \"sexta\", \"sexta que vem\", \"15/01\", \"15 de janeiro\", \"15/01/2027\" ou "
    + "\"2027-01-15\"): quem resolve e valida as datas é o código, no fuso America/Sao_Paulo. Se o hóspede disser "
    + "apenas \"fim de semana\", \"Natal\" ou \"feriado\" sem datas de entrada e saída, peça a data de entrada e a de "
    + "saída (não invente datas). `hospedes` é opcional: sem ele a cotação sai do mesmo jeito. Pode devolver uma "
    + "recusa com o motivo, sem total.",
  {
    imovel_id: { type: "string", description: "Id do imóvel, ex.: GRM-301" },
    checkin: {
      type: "string",
      description: "Data de entrada exatamente como o hóspede escreveu (ex.: \"amanhã\", \"sexta que vem\", \"15/01\", \"15 de janeiro\", \"15/01/2027\" ou \"2027-01-15\"). Não converta por conta própria.",
    },
    checkout: {
      type: "string",
      description: "Data de saída exatamente como o hóspede escreveu (ex.: \"depois de amanhã\", \"domingo\", \"18/01\", \"18 de janeiro\", \"18/01/2027\" ou \"2027-01-18\"). Não converta por conta própria.",
    },
    hospedes: { type: "integer", description: "Número de pessoas (adultos, crianças e bebês contam; pet não)" },
  },
  ["imovel_id", "checkin", "checkout"],
  async (argumentos, contexto) => {
    // Resumo aguardando o sim: o que esta cotação não disser (hóspedes) vale o do resumo.
    const aberto = pendenteAberto(contexto.cofre.ler())?.reserva ?? null;
    // Com resumo em aberto, uma cotação que não dá para ler (data inexistente, imóvel
    // não encontrado, catálogo fora do ar) também derruba a confirmação pendente: o
    // hóspede tentou mudar a estadia, e o sim seguinte não pode enviar a antiga (L10).
    const pedido = await prepararPedido(argumentos, contexto, aberto?.hospedes).catch((erro: unknown) => {
      invalidarPendente(contexto.cofre);
      throw erro;
    });
    if (!pedido.ok) {
      invalidarPendente(contexto.cofre);
      return { recusa: true, paraOModelo: { erro: pedido.erro } };
    }

    // O hóspede pediu outra estadia depois do resumo: a confirmação pendente deixa de
    // valer (contrato L10). Se a estadia nova é válida, o novo resumo sai daqui mesmo,
    // em texto de código; o modelo não redige resumo.
    if (aberto) {
      const nova: Reserva = {
        ...aberto, imovel_id: pedido.ficha.id, checkin: pedido.checkin, checkout: pedido.checkout, hospedes: pedido.hospedes ?? aberto.hospedes,
      };
      if (chaveDaReserva(nova) !== chaveDaReserva(aberto)) {
        invalidarPendente(contexto.cofre);
        if (pedido.cotacao.ok) return resumir(contexto, pedido, aberto.nome, aberto.telefone);
      }
    }

    const { ficha, cotacao, checkin, checkout, hospedes } = pedido;
    const estadia = {
      imovel: { id: ficha.id, nome: ficha.nome, capacidade: ficha.capacidade, minimo_noites: ficha.minimo_noites },
      entrada: formatarDataComDia(checkin),
      saida: formatarDataComDia(checkout),
    };
    if (!cotacao.ok) {
      return {
        recusa: true,
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
        noites: cotacao.noites,
        noites_comuns: { quantidade: cotacao.noites - cotacao.noitesComAcrescimo, valor_de_cada: formatarReais(cotacao.diariaCentavos) },
        noites_de_sexta_e_sabado: { quantidade: cotacao.noitesComAcrescimo, valor_de_cada: formatarReais(cotacao.diariaComAcrescimoCentavos) },
        taxa_de_limpeza: formatarReais(cotacao.taxaLimpezaCentavos),
        total,
        hospedes: hospedes ?? "não informado: informe a capacidade e pergunte quantas pessoas são",
        instrucao: `Declare na resposta as duas datas exatas com dia da semana, dia, mês e ano (entrada ${estadia.entrada} e saída ${estadia.saida}), para o hóspede poder corrigir, e informe o total exatamente como está em \`total\`. O valor é uma cotação: não afirme que as datas estão disponíveis.`,
      },
    };
  },
);
