/**
 * Decide se um valor em R$ que coincide com um componente da estadia (diária, diária de
 * sexta e sábado, taxa de limpeza ou subtotal de noites) está apresentado como componente,
 * e não como total ou oferta. Confere pela estrutura da estadia, não só por palavras:
 * - valor dito "por noite"/"cada" tem de ser uma diária;
 * - valor ao lado de uma contagem de noites tem de caber nessa contagem;
 * - "cada noite"/"cada uma" sem dizer quais noites, numa estadia que mistura diária comum
 *   e de sexta e sábado, não descreve a estadia;
 * - valor com "total" antes ou logo depois dele não é componente (o total é conferido à parte);
 * - vocabulário de concessão na resposta (desconto, preço especial, faço por...) reprova.
 *
 * Os padrões usam a flag `u` e `(?<!\p{L})` / `(?!\p{L})` como fronteira de palavra,
 * porque `\b` do JavaScript não reconhece letra acentuada.
 */

const RE_VALOR = /R\$\s*(?:[1-9]\d{0,2}(?:\.\d{3})*|0),\d{2}/g;

const REGEX_TERMO_COMPONENTE =
  /(?<!\p{L})(?:di[aá]rias?|noites?|hospedagem|sub-?total|limpeza|taxa(?:\s+de\s+limpeza)?|fim\s+de\s+semana|fds|(?:\d+|uma?)\s+norma(?:l|is)|sexta(?:-feira)?|s[aá]bado|domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|dias?\s+[uú]te(?:l|is)|semana|unit[aá]ri[oa]|por\s+noite|cada\s+(?:uma|noite|di[aá]ria)|pel[ao]s\s+(?:duas|dois|tr[eê]s)|daily|night(?:s|ly)?|each\s+night|rates?|weekend|weekdays?|cleaning|fee)(?!\p{L})/iu;

// Rótulo de preço por noite logo DEPOIS do valor ("R$ 708,00 cada", "R$ 590,00 por noite").
// "cada"/"each" sozinhos só contam se nada além de conector vier depois: "R$ 590,00 cada
// hóspede" não é preço por noite.
const REGEX_POR_NOITE_POSPOSTO =
  /^\s*(?:cada\s+(?:uma|noite|di[aá]ria)|(?:por|per|a|\/)\s*(?:noite|night)|nightly|each\s+night|(?:cada|each)(?=\s*(?:$|[^\s\p{L}]|\s+(?:e|and|mais|plus|com|with)(?!\p{L}))))(?!\p{L})/iu;

// Rótulo de preço por noite ANTES do valor ("Valor de cada noite:", "diária de").
const REGEX_POR_NOITE_ANTES =
  /(?<!\p{L})(?:cada\s+(?:uma|noite|di[aá]ria)|each\s+night|por\s+noite|per\s+night|nightly|di[aá]ria)(?!\p{L})/iu;

// "cada noite"/"cada uma"/"R$ X cada": afirma o mesmo preço para todas as noites citadas.
const REGEX_UNIVERSAL_ANTES = /(?<!\p{L})(?:cada\s+(?:uma|noite|di[aá]ria)|each\s+night)(?!\p{L})/iu;
const REGEX_UNIVERSAL_POSPOSTO = /^\s*(?:cada|each)(?!\p{L})/iu;

// Diz quais noites ("de sexta e sábado", "comum", "de domingo").
const REGEX_QUALIFICA_NOITE =
  /(?<!\p{L})(?:sexta|s[aá]bado|domingo|segunda|ter[cç]a|quarta|quinta|comu(?:m|ns)|norma(?:l|is)|fim\s+de\s+semana|fds|[uú]te(?:l|is)|weekends?|weekdays?|friday|saturday|sunday|monday|tuesday|wednesday|thursday|regular)(?!\p{L})/iu;

// Componente nomeado logo depois do valor ("de diárias", "pelas 2 noites", "de limpeza").
const REGEX_ROTULO_ANEXO =
  /^\s*(?:(?:de|das?|dos?|pel[ao]s?|para\s+as|somando|referentes?\s+[aà]s?|of|for)\s+(?:as\s+|os\s+|the\s+)?(?:\d+\s+|duas\s+|dois\s+|tr[eê]s\s+)?(?:di[aá]rias?|noites?|hospedagem|limpeza|taxa|nights?|cleaning|fim\s+de\s+semana)|pel[ao]s\s+(?:duas|dois|tr[eê]s|\d+))(?!\p{L})/iu;

// "total" antes do valor, exceto "total das (3) noites/diárias", "total sem a limpeza" e
// "subtotal"; e "já com a limpeza"/"incluindo a limpeza", que apresentam o valor como total.
const REGEX_TOTAL_ANTES =
  /(?<!\p{L})total(?!\s+(?:das?|de)\s+(?:\d+\s+)?(?:di[aá]rias?|noites?|hospedagem)|\s+sem\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza)(?!\p{L})|(?<!\p{L})(?:j[aá]\s+com\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|inclu\p{L}*\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|limpeza\s+inclu\p{L}*|in\s+total|comes?\s+to)(?!\p{L})/iu;

// "total" logo depois do valor ("R$ 2.006,00 no total", "R$ 2.006,00, já com a limpeza").
// "total" solto só conta se não vier outro valor na frase: em "limpeza R$ 150,00, total
// R$ 2.156,00" ele rotula o valor seguinte.
const REGEX_TOTAL_SOLTO_DEPOIS = /^[\s,;:(—–-]*total(?!\p{L})/iu;
const REGEX_TOTAL_DEPOIS =
  /^[\s,;:(—–-]*(?:(?:no|ao|in|de|em)\s+total|ao\s+todo|no\s+geral|altogether|j[aá]\s+com\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|inclu\p{L}*\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|including\s+(?:the\s+)?cleaning)(?!\p{L})/iu;

// Rótulo posposto do valor ANTERIOR, que não vale para o valor seguinte.
const REGEX_POSPOSTO_ANTERIOR =
  /^\s*(?:cada\s+(?:uma|noite|di[aá]ria)|cada|each(?:\s+night)?|(?:por|per|a|\/)\s*(?:noite|night)|nightly|(?:no|in)\s+total|total)(?!\p{L})/iu;

// Concessão de preço. Vale na resposta inteira, exceto negada ("não consigo desconto",
// "sem desconto") ou como pedido do hóspede ("seu pedido de desconto").
const REGEX_CONCESSAO =
  /(?<!\p{L})(?:descontos?|abatimento|promo[cç]\p{L}*|pre[cç]o\s+especial|condi[cç][aã]o\s+especial|valor\s+especial|ofertas?|fa[cç]o\s+por|fecho\s+por|fechamos|fechad[oa]|discounts?|special\s+(?:price|rate|deal|offer)|deal)(?!\p{L})/giu;
// "Para você, cada uma sai por..." só conta na frase do valor.
const REGEX_PARA_VOCE = /(?<!\p{L})(?:para|pra)\s+voc[eê](?!\p{L})/giu;
const REGEX_NEGACAO =
  /(?<!\p{L})(?:n[aã]o|sem|nem|nenhuma?|not|without|never|cannot|can'?t|isn'?t)(?!\p{L})/iu;
const REGEX_PEDIDO_ANTES =
  /(?<!\p{L})(?:pedido|pedidos|pedir|pede|pediu|solicita\p{L}*|avaliar|avalia|request\p{L}*|ask\p{L}*)\s+(?:(?:de|do|da|um|uma|o|a|seu|sua|por|for|an?)\s+)*$/iu;
const REGEX_NEGACAO_DEPOIS = /^\s*(?:n[aã]o|is\s+not|isn'?t|not)(?!\p{L})/iu;

const REGEX_CONTAGEM =
  /(?<!\p{L})(\d+|uma?|dois|duas|tr[eê]s|quatro|cinco)\s+(?:noites?|nights?)(?!\p{L})|(?<!\p{L})(?:noites?|nights?)\s*:\s*(\d+)(?!\d)/giu;
const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5 };

const REGEX_SO_CONECTOR = /^[\s(]*(?:de|a|por|at|of)?\s*$/iu;

function ehQuebraDeFrase(texto, i) {
  const ch = texto[i];
  if (ch === '\n' || ch === ';' || ch === '!' || ch === '?') return true;
  return ch === '.' && !(/\d/.test(texto[i - 1] || '') && /\d/.test(texto[i + 1] || ''));
}

/** Limites da cláusula (`pararEmVirgula`) ou da frase em volta de [indice, indice+tamanho). */
function limitesAoRedor(texto, indice, tamanho, pararEmVirgula) {
  let ini = indice;
  while (ini > 0) {
    if (ehQuebraDeFrase(texto, ini - 1)) break;
    if (pararEmVirgula && texto[ini - 1] === ',' && !/\d{2}/.test(texto.slice(ini, ini + 2))) break;
    ini--;
  }
  let fim = indice + tamanho;
  while (fim < texto.length) {
    if (ehQuebraDeFrase(texto, fim)) break;
    if (pararEmVirgula && texto[fim] === ',' && !/\d{2}/.test(texto.slice(fim + 1, fim + 3))) break;
    fim++;
  }
  return { ini, fim };
}

/** Trecho depois do último valor em R$ (com o rótulo posposto dele descartado). */
function cortarAposValorAnterior(antes) {
  let fimAnterior = 0;
  for (const m of antes.matchAll(RE_VALOR)) fimAnterior = m.index + m[0].length;
  if (fimAnterior === 0) return antes;
  return antes.slice(fimAnterior).replace(REGEX_POSPOSTO_ANTERIOR, '');
}

function ateProximoValor(depois) {
  const m = new RegExp(RE_VALOR.source).exec(depois);
  return m ? depois.slice(0, m.index) : depois;
}

function ultimaContagem(trecho) {
  let n = null;
  for (const m of trecho.matchAll(REGEX_CONTAGEM)) {
    const bruto = (m[1] || m[2]).toLowerCase();
    n = /^\d+$/.test(bruto) ? Number(bruto) : NUMEROS[bruto];
  }
  return n;
}

function concessaoEm(texto, regex) {
  for (const m of texto.matchAll(regex)) {
    const antes = texto.slice(0, m.index);
    let ini = antes.length;
    while (ini > 0 && !ehQuebraDeFrase(antes, ini - 1) && antes[ini - 1] !== ',') ini--;
    const clausulaAntes = antes.slice(ini).split(/(?<!\p{L})(?:mas|por[eé]m|but|however)(?!\p{L})/iu).pop();
    if (REGEX_NEGACAO.test(clausulaAntes) || REGEX_PEDIDO_ANTES.test(antes)) continue;
    if (REGEX_NEGACAO_DEPOIS.test(texto.slice(m.index + m[0].length))) continue;
    return true;
  }
  return false;
}

/** A resposta concede preço (desconto, oferta, "faço por") em algum ponto não negado. */
export function respostaConcedePreco(texto) {
  return concessaoEm(texto, REGEX_CONCESSAO);
}

function combinacoesDeNoites(perfil, n) {
  const somas = new Set();
  for (let k = 0; k <= Math.min(n, perfil.noitesNormais); k++) {
    const m = n - k;
    if (m <= perfil.noitesFds) somas.add(k * perfil.diaria + m * perfil.diariaFds);
  }
  return somas;
}

function cabeNaContagem(perfil, centavos, n, porNoite) {
  if (centavos === perfil.limpeza) return true;
  if (centavos === perfil.diaria && n <= perfil.noitesNormais) return true;
  if (centavos === perfil.diariaFds && n <= perfil.noitesFds) return true;
  return !porNoite && combinacoesDeNoites(perfil, n).has(centavos);
}

/**
 * @param {string} texto resposta inteira
 * @param {{ texto: string, centavos: number, indice: number }} valor
 * @param {Array<{ diaria: number, diariaFds: number, limpeza: number, noitesNormais: number|null, noitesFds: number|null }>} perfis
 *   uma entrada por estadia esperada; `noites*` nulos quando só o imóvel é conhecido (sem_total)
 * @param {{ concede?: boolean }} [contexto] resultado de `respostaConcedePreco(texto)`, para não recalcular
 */
export function componenteIdentificado(texto, valor, perfis, contexto = {}) {
  const concede = contexto.concede ?? respostaConcedePreco(texto);
  if (concede) return false;

  const tam = valor.texto.length;
  const clausula = limitesAoRedor(texto, valor.indice, tam, true);
  const frase = limitesAoRedor(texto, valor.indice, tam, false);
  if (concessaoEm(texto.slice(frase.ini, frase.fim), REGEX_PARA_VOCE)) return false;

  // Rótulo: na cláusula do valor; se antes dele, depois da vírgula, só vem conector
  // ("2 noites, de R$ 590,00 cada"), vale a cláusula anterior da mesma frase.
  const antesCurto = cortarAposValorAnterior(texto.slice(clausula.ini, valor.indice));
  const antes = REGEX_SO_CONECTOR.test(antesCurto)
    ? cortarAposValorAnterior(texto.slice(frase.ini, valor.indice))
    : antesCurto;
  const depois = ateProximoValor(texto.slice(valor.indice + tam, clausula.fim));
  const restoDaFrase = texto.slice(valor.indice + tam, frase.fim);
  const depoisNaFrase = ateProximoValor(restoDaFrase);
  const totalDepois =
    REGEX_TOTAL_DEPOIS.test(depoisNaFrase) ||
    (depoisNaFrase === restoDaFrase && REGEX_TOTAL_SOLTO_DEPOIS.test(depoisNaFrase));

  const porNoite = REGEX_POR_NOITE_POSPOSTO.test(depois) || REGEX_POR_NOITE_ANTES.test(antes);
  const anexo = REGEX_ROTULO_ANEXO.test(depois);
  if (!porNoite && !anexo && !REGEX_TERMO_COMPONENTE.test(`${antes} ${depois}`)) return false;

  const ehDiaria = (p) => valor.centavos === p.diaria || valor.centavos === p.diariaFds;

  // Valor dito por noite tem de ser uma diária.
  if (porNoite && !perfis.some(ehDiaria)) return false;

  // Valor com "total" ao lado é total, e o total certo é conferido à parte. Só cede quando o
  // próprio valor vem nomeado como componente ("No total, R$ 1.180,00 de diárias") ou é uma
  // diária dita por noite, já conferida acima ("No total são 2 noites, de R$ 590,00 cada").
  if ((REGEX_TOTAL_ANTES.test(antes) || totalDepois) && !anexo && !porNoite) return false;

  const conhecidas = perfis.filter((p) => p.noitesNormais !== null);
  if (conhecidas.length === 0) return true;

  // Contagem de noites ao lado do valor ("2 noites, de R$ 590,00 cada", "pelas 2 noites").
  const n = ultimaContagem(antes) ?? (anexo ? ultimaContagem(depois) : null);
  if (n !== null && !conhecidas.some((p) => cabeNaContagem(p, valor.centavos, n, porNoite))) return false;

  // "Cada noite sai por R$ 590,00" numa estadia com noites comuns e de sexta e sábado.
  const universal = REGEX_UNIVERSAL_ANTES.test(antes) || REGEX_UNIVERSAL_POSPOSTO.test(depois);
  if (
    universal &&
    n === null &&
    !REGEX_QUALIFICA_NOITE.test(`${antes} ${depois}`) &&
    conhecidas.every((p) => p.noitesNormais > 0 && p.noitesFds > 0)
  ) {
    return false;
  }

  return true;
}
