// Telefone do lead (contrato L6). Função pura: devolve o telefone no formato enviado ao
// webhook, ou `null` quando o que o hóspede informou não é um telefone válido.

/**
 * - Brasileiro com DDD (10 ou 11 dígitos, com ou sem 55 na frente, com qualquer
 *   pontuação): `(DD) NNNNN-NNNN` ou `(DD) NNNN-NNNN`.
 * - Estrangeiro, escrito com `+` e de 8 a 15 dígitos: `+dígitos`.
 * - Qualquer outra coisa: `null`.
 *
 * Aplicar de novo ao resultado devolve o mesmo texto.
 */
export function normalizarTelefone(texto: string): string | null {
  // Pontuação é livre; letra não faz parte de telefone ("ramal 2", "não tenho").
  if (/\p{L}/u.test(texto)) return null;
  const comMais = texto.trim().startsWith("+");
  const digitos = texto.replace(/\D/g, "");
  // O 55 só é código do país quando sobra um número com DDD: 55 também é um DDD.
  const comPais = digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13);
  if (comMais && !comPais) {
    const estrangeiro = !digitos.startsWith("55") && digitos.length >= 8 && digitos.length <= 15;
    return estrangeiro ? `+${digitos}` : null;
  }
  const nacional = comPais ? digitos.slice(2) : digitos;
  // DDD não tem zero; depois dele, 8 dígitos (fixo) ou 9 (celular).
  const partes = /^([1-9]{2})(\d{4,5})(\d{4})$/.exec(nacional);
  return partes ? `(${partes[1]}) ${partes[2]}-${partes[3]}` : null;
}
