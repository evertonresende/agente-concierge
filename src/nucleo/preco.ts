// Regra de preço do contrato (seção 3). Função pura, tudo em centavos inteiros.
import { type DataISO, diasEntre, indiceDiaDaSemana, somarDias } from "./datas";

export interface RegrasDoImovel {
  diariaCentavos: number;
  taxaLimpezaCentavos: number;
  minimoNoites: number;
  capacidade: number;
}

export type MotivoRecusa = "datas_invalidas" | "minimo_noites" | "capacidade" | "hospedes_invalido";

export type Cotacao =
  | {
    ok: true;
    noites: number;
    /** Quantas das noites começam numa sexta ou num sábado. */
    noitesComAcrescimo: number;
    diariaCentavos: number;
    diariaComAcrescimoCentavos: number;
    taxaLimpezaCentavos: number;
    totalCentavos: number;
  }
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
  if (!Number.isInteger(noites)) {
    return { ok: false, motivo: "datas_invalidas", explicacao: "A data de entrada ou a de saída não é uma data válida." };
  }
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

  // O padrão se repete a cada 7 noites: 2 com acréscimo por semana cheia, mais as do
  // resto. Sem lista de noites, uma estadia de anos custa o mesmo que uma de dias.
  const resto = Array.from({ length: noites % 7 }, (_, i) => somarDias(checkin, i)).filter(temAcrescimo).length;
  const noitesComAcrescimo = Math.floor(noites / 7) * 2 + resto;
  const diariaComAcrescimoCentavos = diariaComAcrescimo(regras.diariaCentavos);
  // Cada noite já está arredondada para centavos antes de entrar na soma (L14).
  const totalCentavos = (noites - noitesComAcrescimo) * regras.diariaCentavos
    + noitesComAcrescimo * diariaComAcrescimoCentavos
    + regras.taxaLimpezaCentavos;
  return {
    ok: true,
    noites,
    noitesComAcrescimo,
    diariaCentavos: regras.diariaCentavos,
    diariaComAcrescimoCentavos,
    taxaLimpezaCentavos: regras.taxaLimpezaCentavos,
    totalCentavos,
  };
}
