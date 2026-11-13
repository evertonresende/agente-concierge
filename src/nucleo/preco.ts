// Regra de preço do contrato (seção 3). Função pura, tudo em centavos inteiros.
import { type DataISO, diasEntre, indiceDiaDaSemana, somarDias } from "./datas";

export interface RegrasDoImovel {
  diariaCentavos: number;
  taxaLimpezaCentavos: number;
  minimoNoites: number;
  capacidade: number;
}

export interface Noite {
  data: DataISO;
  centavos: number;
  comAcrescimo: boolean;
}

export type MotivoRecusa = "datas_invalidas" | "minimo_noites" | "capacidade" | "hospedes_invalido";

export type Cotacao =
  | { ok: true; noites: Noite[]; taxaLimpezaCentavos: number; totalCentavos: number }
  | { ok: false; motivo: MotivoRecusa; explicacao: string };

/** Diária com 20% a mais; meio centavo arredonda para cima (contrato L14). */
export function diariaComAcrescimo(diariaCentavos: number): number {
  return Math.floor((120 * diariaCentavos + 50) / 100);
}

/** A noite que começa numa sexta (5) ou num sábado (6) tem acréscimo. */
function temAcrescimo(data: DataISO): boolean {
  const dia = indiceDiaDaSemana(data);
  return dia === 5 || dia === 6;
}

/**
 * Cota a estadia ou recusa com o motivo. `hospedes` é opcional: o preço não depende
 * dele (contrato L8), mas, quando vem, precisa ser inteiro positivo (L13) e caber
 * na capacidade.
 */
export function cotar(regras: RegrasDoImovel, checkin: DataISO, checkout: DataISO, hospedes?: number): Cotacao {
  const noites = diasEntre(checkin, checkout);
  if (noites <= 0) {
    return {
      ok: false,
      motivo: "datas_invalidas",
      explicacao: noites === 0
        ? "A saída está no mesmo dia da entrada; a estadia precisa ter pelo menos uma noite."
        : "A data de saída é anterior à data de entrada.",
    };
  }
  if (noites < regras.minimoNoites) {
    return {
      ok: false,
      motivo: "minimo_noites",
      explicacao: `Este imóvel exige no mínimo ${regras.minimoNoites} noites, e o período pedido tem ${noites}.`,
    };
  }
  if (hospedes !== undefined) {
    if (!Number.isInteger(hospedes) || hospedes < 1) {
      return {
        ok: false,
        motivo: "hospedes_invalido",
        explicacao: "O número de hóspedes precisa ser um número inteiro maior que zero.",
      };
    }
    if (hospedes > regras.capacidade) {
      return {
        ok: false,
        motivo: "capacidade",
        explicacao: `Este imóvel acomoda no máximo ${regras.capacidade} pessoas, e o pedido é para ${hospedes}.`,
      };
    }
  }

  const lista: Noite[] = Array.from({ length: noites }, (_, i) => {
    const data = somarDias(checkin, i);
    const comAcrescimo = temAcrescimo(data);
    return { data, comAcrescimo, centavos: comAcrescimo ? diariaComAcrescimo(regras.diariaCentavos) : regras.diariaCentavos };
  });
  const totalCentavos = lista.reduce((soma, n) => soma + n.centavos, 0) + regras.taxaLimpezaCentavos;
  return { ok: true, noites: lista, taxaLimpezaCentavos: regras.taxaLimpezaCentavos, totalCentavos };
}
