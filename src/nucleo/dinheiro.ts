// Dinheiro é sempre um número inteiro de centavos. Reais com casas decimais só existem
// em duas fronteiras: a entrada do catálogo e a saída para o webhook.

/** Valor em reais vindo do catálogo (ex.: 245.5) para centavos inteiros (24550). */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais) || reais < 0) throw new Error("valor em reais inválido");
  return Math.round(reais * 100);
}

/** 215600 -> "R$ 2.156,00". É o único lugar que escreve um valor para o hóspede. */
export function formatarReais(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error("centavos inválidos");
  const reais = Math.trunc(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = (centavos % 100).toString().padStart(2, "0");
  return `R$ ${reais},${resto}`;
}

/** 215600 -> 2156 (número em reais do campo valor_total do webhook). */
export function centavosParaReais(centavos: number): number {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error("centavos inválidos");
  return centavos / 100;
}
