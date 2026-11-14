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
  /(?<!\p{L})(?:di[aá]rias?|noites?|hospedagem|sub-?total|limpeza|taxa(?:\s+de\s+limpeza)?|fim\s+de\s+semana|fds|(?:\d+|uma?)\s+norma(?:l|is)|sexta(?:-feira)?|s[aá]bado|domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|dias?\s+[uú]te(?:l|is)|semana|unit[aá]ri[oa]|por\s+noite|cada\s+(?:uma|noite|di[aá]ria)|pel[ao]s\s+(?:duas|dois|tr[eê]s)|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?|daily|night(?:s|ly)?|weeknights?|each\s+night|rates?|weekend|weekdays?|cleaning|fee)(?!\p{L})/iu;

// Rótulo de preço por noite logo DEPOIS do valor ("R$ 708,00 cada", "R$ 590,00 por noite").
// "cada"/"each" sozinhos só contam se nada além de conector vier depois: "R$ 590,00 cada
// hóspede" não é preço por noite.
const REGEX_POR_NOITE_POSPOSTO =
  /^\s*(?:cada\s+(?:uma|noite|di[aá]ria)|(?:por|per|a|\/)\s*(?:noite|night)|nightly|each\s+night|(?:cada|each)(?=\s*(?:$|[^\s\p{L}]|\s+(?:e|and|mais|plus|com|with)(?!\p{L}))))(?!\p{L})/iu;

// Rótulo de preço por noite ANTES do valor ("Valor de cada noite:", "diária de").
const REGEX_POR_NOITE_ANTES =
  /(?<!\p{L})(?:cada\s+(?:uma|noite|di[aá]ria)|each\s+(?:night|one)|por\s+noite|per\s+night|nightly|di[aá]ria)(?!\p{L})/iu;

// "cada noite"/"cada uma"/"R$ X cada": afirma o mesmo preço para todas as noites citadas.
const REGEX_UNIVERSAL_ANTES = /(?<!\p{L})(?:cada\s+(?:uma|noite|di[aá]ria)|each\s+(?:night|one))(?!\p{L})/iu;
const REGEX_UNIVERSAL_POSPOSTO = /^\s*(?:cada|each)(?!\p{L})/iu;

// Diz quais noites: de sexta e sábado (diária com acréscimo) ou comuns.
const REGEX_NOITE_FDS =
  /(?<!\p{L})(?:sexta|s[aá]bado|fim\s+de\s+semana|fds|weekends?|fridays?|saturdays?)(?!\p{L})/iu;
const REGEX_NOITE_COMUM =
  /(?<!\p{L})(?:domingo|segunda|ter[cç]a|quarta|quinta|comu(?:m|ns)|norma(?:l|is)|[uú]te(?:l|is)|weekdays?|weeknights?|sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|regular)(?!\p{L})/iu;

// Componente nomeado logo depois do valor ("de diárias", "pelas 2 noites", "de limpeza").
const REGEX_ROTULO_ANEXO =
  /^\s*(?:(?:de|das?|dos?|pel[ao]s?|para\s+as|somando|referentes?\s+[aà]s?|of|for)\s+(?:as\s+|os\s+|the\s+)?(?:\d+\s+|duas\s+|dois\s+|tr[eê]s\s+)?(?:di[aá]rias?|noites?|hospedagem|limpeza|taxa|nights?|cleaning|fim\s+de\s+semana)|pel[ao]s\s+(?:duas|dois|tr[eê]s|\d+))(?!\p{L})/iu;

// Anexo que nomeia o próprio componente ("de diárias", "de limpeza"), e não só as noites
// ("pelas 3 noites" diz a que se refere, não que o valor é parte do total).
const REGEX_ANEXO_NOMINAL =
  /^\s*(?:de|das?|dos?|of)\s+(?:as\s+|os\s+|the\s+)?(?:di[aá]rias?|hospedagem|limpeza|taxa|cleaning)(?!\p{L})/iu;

// "total" antes do valor, exceto "total das (3) noites/diárias", "total sem a limpeza" e
// "subtotal"; e "já com a limpeza"/"incluindo a limpeza", que apresentam o valor como total.
const REGEX_TOTAL_ANTES =
  /(?<!\p{L})total(?!\s+(?:das?|de)\s+(?:\d+\s+)?(?:di[aá]rias?|noites?|hospedagem)|\s+sem\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza)(?!\p{L})|(?<!\p{L})(?:j[aá]\s+com\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|inclu\p{L}*\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|limpeza\s+inclu\p{L}*|in\s+total|comes?\s+to)(?!\p{L})/iu;

// "já com a (taxa de) limpeza de R$ X", "incluindo a limpeza de R$ X": rotula o próprio valor
// como limpeza, não como total.
const REGEX_LIMPEZA_DE_ANTES =
  /(?<!\p{L})(?:j[aá]\s+com|inclu\p{L}*)\s+(?:a\s+|the\s+)?(?:taxa\s+de\s+)?(?:limpeza|cleaning(?:\s+fee)?)\s+(?:de|of)\s*$/iu;

// "total" logo depois do valor ("R$ 2.006,00 no total", "R$ 2.006,00, já com a limpeza").
// "total" solto só conta se não vier outro valor na frase: em "limpeza R$ 150,00, total
// R$ 2.156,00" ele rotula o valor seguinte.
const REGEX_TOTAL_SOLTO_DEPOIS = /^[\s,;:(—–-]*total(?!\p{L})/iu;
const REGEX_TOTAL_DEPOIS =
  /^[\s,;:(—–-]*(?:(?:no|ao|in|de|em)\s+total|ao\s+todo|no\s+geral|altogether|j[aá]\s+com\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|inclu\p{L}*\s+(?:a\s+)?(?:taxa\s+de\s+)?limpeza|including\s+(?:the\s+)?cleaning)(?!\p{L})/iu;

// Rótulo posposto do valor ANTERIOR, que não vale para o valor seguinte.
const REGEX_POSPOSTO_ANTERIOR =
  /^\s*(?:cada\s+(?:uma|noite|di[aá]ria)|cada|each(?:\s+night)?|(?:por|per|a|\/)\s*(?:noite|night)|nightly|(?:no|in)\s+total|total)(?!\p{L})/iu;

// Concessão de preço: a construção de conceder, não a palavra solta ("Quem decide sobre
// desconto é o time" não concede). Vale na resposta inteira, exceto negada ("não consigo
// dar desconto") ou como pedido do hóspede ("seu pedido de desconto").
const ALVO_CONCESSAO = String.raw`(?:descontos?|abatimento|promo[cç]\p{L}*|pre[cç]o\s+especial|condi[cç][aã]o\s+especial|valor\s+especial|ofertas?)`;
const REGEX_CONCESSAO = new RegExp(
  String.raw`(?<!\p{L})(?:` +
    // "com desconto", "já com o desconto de gerente"
    String.raw`com\s+(?:o\s+|um\s+|uma\s+|esse\s+|este\s+|seu\s+)?(?:descontos?|abatimento|promo[cç]\p{L}*)` +
    // "consigo um desconto", "posso te dar um preço especial", "aplicamos uma promoção"
    String.raw`|(?:consigo|consegui\p{L}*|posso|podemos|vou|dou|damos|dar|fazer|fa[cç]o|fazemos|aplic\p{L}*|conced\p{L}*|ofere[cç]\p{L}*|libero|liberamos|temos|tenho|h[aá]|existe)\s+(?:(?:te|lhe|voc[eê]|a\s+voc[eê]|para\s+voc[eê]|dar|fazer|aplicar|oferecer|conceder|liberar)\s+)*(?:(?:um|uma|o|a|esse|este|essa|esta|de)\s+)?` +
    ALVO_CONCESSAO +
    // "desconto aplicado", "desconto de 10% liberado"
    String.raw`|(?:descontos?|promo[cç]\p{L}*)\s+(?:de\s+\d+\s*%\s+)?(?:aplicad|concedid|liberad|garantid|confirmad)\p{L}*` +
    String.raw`|pre[cç]o\s+especial|condi[cç][aã]o\s+especial|valor\s+especial` +
    String.raw`|fa[cç]o\s+por|fecho\s+por|fechamos\s+por|fechad[oa](?=\s*[!.,])` +
    String.raw`|with\s+(?:a\s+|the\s+|your\s+)?discount|(?:give|offer|apply|got|get)\s+(?:you\s+)?(?:a\s+)?discount|special\s+(?:price|rate|deal|offer)` +
    String.raw`)(?!\p{L})`,
  'giu'
);
// "Para você, cada uma sai por..." só conta antes do valor, na mesma frase e depois de ":".
const REGEX_PARA_VOCE = /(?<!\p{L})(?:para|pra)\s+voc[eê](?!\p{L})/giu;
const REGEX_NEGACAO =
  /(?<!\p{L})(?:n[aã]o|sem|nem|nenhuma?|not|without|never|cannot|unable|(?:can|isn|don|won|aren)[’']?t)(?!\p{L})/iu;
// Pedido ou consulta ao time na mesma frase: "Vou pedir ao time para avaliar e, se
// possível, te dar um desconto" não concede.
const REGEX_PEDIDO_NA_FRASE =
  /(?<!\p{L})(?:pedid\p{L}*|pedi(?:r|u)|pede|solicit\p{L}*|avaliar|verificar|consultar|request\p{L}*|ask\p{L}*)(?!\p{L})/iu;
const REGEX_NEGACAO_DEPOIS = /^\s*(?:n[aã]o|is\s+not|isn'?t|not)(?!\p{L})/iu;

// Contagem de noites, com até um qualificador antes do substantivo ("1 regular night",
// "2 Friday/Saturday nights") ou depois dos dois-pontos ("Noites: 2").
const REGEX_CONTAGEM =
  /(?<!\p{L})(\d+|uma?|dois|duas|tr[eê]s|quatro|cinco)\s+(?:[\p{L}/-]+\s+)?(?:noites?|nights?|weeknights?)(?!\p{L})|(?<!\p{L})(?:noites?|nights?)\s*:\s*(\d+)(?!\d)/giu;
// Contagem elíptica, sem repetir "noite", numa frase que abre com a contagem total seguida
// de ":", "(", vírgula ou travessão ("3 noites: 1 comum a R$ 590,00 e 2 de sexta e sábado a
// R$ 708,00 cada", "4 noites (2 comuns a R$ 1.150,00 e 2 de sexta ou sábado a R$ 1.380,00)").
const REGEX_CONTAGEM_ELIPTICA =
  /(?<!\p{L})(\d+|uma?|dois|duas|tr[eê]s|quatro|cinco)\s+(?:comu(?:m|ns)|de\s+(?:sexta|s[aá]bado|fim\s+de\s+semana)|regular|weekday|weekend|friday(?:\/saturday)?)(?!\p{L})/giu;
const REGEX_CABECALHO_NOITES = /(?<!\p{L})(?:noites?|nights?)\s*[:(,—–-]/iu;
const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5 };

const REGEX_SO_CONECTOR = /^[\s(]*(?:de|a|por|at|of)?\s*$/iu;

function formatarCentavos(c) {
  const reais = Math.trunc(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${String(c % 100).padStart(2, '0')}`;
}

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

function ultimaContagem(trecho, comElipse = false) {
  let n = null;
  let posicao = -1;
  const regexes = comElipse ? [REGEX_CONTAGEM, REGEX_CONTAGEM_ELIPTICA] : [REGEX_CONTAGEM];
  for (const regex of regexes) {
    for (const m of trecho.matchAll(regex)) {
      if (m.index < posicao) continue;
      const bruto = (m[1] || m[2]).toLowerCase();
      n = /^\d+$/.test(bruto) ? Number(bruto) : NUMEROS[bruto];
      posicao = m.index;
    }
  }
  return n;
}

function concessaoEm(texto, regex) {
  for (const m of texto.matchAll(regex)) {
    const antes = texto.slice(0, m.index);
    let ini = antes.length;
    while (ini > 0 && !ehQuebraDeFrase(antes, ini - 1) && antes[ini - 1] !== ',') ini--;
    let iniFrase = ini;
    while (iniFrase > 0 && !ehQuebraDeFrase(antes, iniFrase - 1)) iniFrase--;
    const clausulaAntes = antes.slice(ini).split(/(?<!\p{L})(?:mas|por[eé]m|but|however)(?!\p{L})/iu).pop();
    if (REGEX_NEGACAO.test(clausulaAntes) || REGEX_PEDIDO_NA_FRASE.test(antes.slice(iniFrase))) continue;
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
 * Diz por que um valor que coincide com um componente da estadia NÃO está apresentado como
 * componente, ou `null` quando está.
 *
 * @param {string} texto resposta inteira
 * @param {{ texto: string, centavos: number, indice: number }} valor
 * @param {Array<{ diaria: number, diariaFds: number, limpeza: number, noitesNormais: number|null, noitesFds: number|null }>} perfis
 *   uma entrada por estadia esperada; `noites*` nulos quando só o imóvel é conhecido (sem_total)
 * @param {{ concede?: boolean, totalCertoNaResposta?: boolean }} [contexto] resultado de
 *   `respostaConcedePreco(texto)`, para não recalcular, e se o total certo de alguma estadia aparece na resposta
 * @returns {string|null}
 */
export function motivoNaoComponente(texto, valor, perfis, contexto = {}) {
  const concede = contexto.concede ?? respostaConcedePreco(texto);
  if (concede) return 'a resposta concede preço (desconto, preço especial, "faço por")';

  const tam = valor.texto.length;
  const clausula = limitesAoRedor(texto, valor.indice, tam, true);
  const frase = limitesAoRedor(texto, valor.indice, tam, false);
  const antesNaFrase = cortarAposValorAnterior(texto.slice(frase.ini, valor.indice));
  if (concessaoEm(antesNaFrase.slice(antesNaFrase.lastIndexOf(':') + 1), REGEX_PARA_VOCE)) {
    return 'oferecido "para você"';
  }

  // Rótulo: na cláusula do valor; se antes dele, depois da vírgula, só vem conector
  // ("2 noites, de R$ 590,00 cada"), vale a cláusula anterior da mesma frase.
  const antesCurto = cortarAposValorAnterior(texto.slice(clausula.ini, valor.indice));
  // Também vale a frase quando a vírgula estava dentro de um parêntese explicativo do rótulo
  // ("Diária de sábado (noite que começa em sexta ou sábado, com acréscimo de 20%): R$ 372,00").
  const virgulaNoParentese = /^[^(]*\)/.test(antesCurto);
  const antes = REGEX_SO_CONECTOR.test(antesCurto) || virgulaNoParentese ? antesNaFrase : antesCurto;
  const restoDaClausula = texto.slice(valor.indice + tam, clausula.fim);
  const depois = ateProximoValor(restoDaClausula);
  const restoDaFrase = texto.slice(valor.indice + tam, frase.fim);
  const depoisNaFrase = ateProximoValor(restoDaFrase);
  const totalDepois =
    REGEX_TOTAL_DEPOIS.test(depoisNaFrase) ||
    (depoisNaFrase === restoDaFrase && REGEX_TOTAL_SOLTO_DEPOIS.test(depoisNaFrase));

  const porNoite = REGEX_POR_NOITE_POSPOSTO.test(depois) || REGEX_POR_NOITE_ANTES.test(antes);
  const anexo = REGEX_ROTULO_ANEXO.test(depois);
  if (!porNoite && !anexo && !REGEX_TERMO_COMPONENTE.test(`${antes} ${depois}`)) return 'sem rótulo';

  // Diária certa para as noites nomeadas: "de sexta e sábado" pede a diária com acréscimo,
  // "comum"/"de domingo" a diária comum; nomeando as duas, qualquer uma.
  // O tipo de noite escrito logo depois do valor, até o primeiro " e " ou "(", é do próprio
  // valor e vale antes do que veio antes dele, que pode ser do valor anterior ("R$ 590,00 de
  // domingo a quinta e R$ 708,00 na sexta"). "A diária é R$ 590,00 e a de sexta e sábado,
  // R$ 708,00" e "R$ 590,00 (fds R$ 708,00)" nomeiam o valor seguinte.
  const depoisProprio = depois.split(/\s(?:e|and|mas|but)\s|\(/iu)[0];
  const nomeiaDepois = REGEX_NOITE_FDS.test(depoisProprio) || REGEX_NOITE_COMUM.test(depoisProprio);
  // Parêntese explicativo no rótulo não nomeia o tipo de noite: "Diária de domingo (noite comum,
  // sem o acréscimo de fim de semana)" fala de domingo, não dos dois tipos.
  const antesSemParentese = antes.replace(/\([^()]*\)/g, ' ');
  const trechoTipo = nomeiaDepois ? depoisProprio : antesSemParentese;
  const nomeiaFds = REGEX_NOITE_FDS.test(trechoTipo);
  const nomeiaComum = REGEX_NOITE_COMUM.test(trechoTipo);
  const conhecidas = perfis.filter((p) => p.noitesNormais !== null);
  const diariaCabe = (p) => {
    if (nomeiaFds && !nomeiaComum) return valor.centavos === p.diariaFds;
    if (nomeiaComum && !nomeiaFds) return valor.centavos === p.diaria;
    if (nomeiaFds && nomeiaComum) return valor.centavos === p.diaria || valor.centavos === p.diariaFds;
    // Sem dizer quais noites: a diária de alguma noite da estadia (ou do imóvel, em sem_total).
    if (p.noitesNormais === null) return valor.centavos === p.diaria || valor.centavos === p.diariaFds;
    return (valor.centavos === p.diaria && p.noitesNormais > 0) || (valor.centavos === p.diariaFds && p.noitesFds > 0);
  };
  const ehDiaria = perfis.some((p) => valor.centavos === p.diaria || valor.centavos === p.diariaFds);

  // Valor dito por noite tem de ser a diária dessas noites.
  if (porNoite && !perfis.some(diariaCabe)) return 'dito por noite, mas não é a diária dessas noites';
  // Diária comum dita "por noite" sem dizer quais noites, numa estadia com sexta ou sábado e sem
  // a diária de sexta e sábado na frase: é tirar o acréscimo ("Posso fazer por R$ 590,00 a noite,
  // inclusive na sexta e no sábado"). "R$ 590,00 por noite (R$ 708,00 na sexta)" passa.
  const fraseInteira = texto.slice(frase.ini, frase.fim);
  if (
    REGEX_POR_NOITE_POSPOSTO.test(depois) &&
    !nomeiaFds &&
    !nomeiaComum &&
    conhecidas.length > 0 &&
    conhecidas.every(
      (p) => valor.centavos === p.diaria && p.noitesFds > 0 && !fraseInteira.includes(formatarCentavos(p.diariaFds))
    )
  ) {
    return 'diária comum "por noite" sem dizer quais noites, numa estadia com sexta ou sábado';
  }
  // Valor igual a uma diária e rotulado com o tipo de noite tem de ser a diária desse tipo
  // ("A noite de domingo sai por R$ 708,00" é a diária de sexta e sábado).
  if (!porNoite && ehDiaria && (nomeiaFds || nomeiaComum) && !perfis.some(diariaCabe)) {
    return 'não é a diária das noites nomeadas';
  }

  // Valor com "total" ao lado é total, e o total certo é conferido à parte. Só cede quando o
  // próprio valor vem nomeado como componente ("No total, R$ 1.180,00 de diárias"), quando o
  // anexo diz as noites e o total certo também aparece ("No total, R$ 1.180,00 pelas 2 noites
  // e R$ 150,00 de limpeza: R$ 1.330,00"), ou é uma diária dita por noite, já conferida acima.
  if (REGEX_LIMPEZA_DE_ANTES.test(antes)) {
    return perfis.some((p) => valor.centavos === p.limpeza) ? null : 'rotulado como limpeza, mas não é a taxa de limpeza';
  }
  const cedeAoAnexo = anexo && (REGEX_ANEXO_NOMINAL.test(depois) || contexto.totalCertoNaResposta === true);
  if ((REGEX_TOTAL_ANTES.test(antes) || totalDepois) && !cedeAoAnexo && !porNoite) return 'apresentado como total';

  if (conhecidas.length === 0) return null;

  // Contagem de noites ao lado do valor ("2 noites, de R$ 590,00 cada", "pelas 2 noites").
  const elipse = REGEX_CABECALHO_NOITES.test(texto.slice(frase.ini, valor.indice));
  const n = ultimaContagem(antes, elipse) ?? (anexo ? ultimaContagem(depois) : null);
  if (n !== null && !conhecidas.some((p) => cabeNaContagem(p, valor.centavos, n, porNoite))) {
    return `não corresponde a ${n} noite(s) da estadia`;
  }

  // "Cada noite sai por R$ 590,00" numa estadia com noites comuns e de sexta e sábado.
  const universal = REGEX_UNIVERSAL_ANTES.test(antes) || REGEX_UNIVERSAL_POSPOSTO.test(depois);
  if (
    universal &&
    n === null &&
    !nomeiaFds &&
    !nomeiaComum &&
    conhecidas.every((p) => p.noitesNormais > 0 && p.noitesFds > 0)
  ) {
    return '"cada noite" sem dizer quais, numa estadia com diárias diferentes';
  }

  return null;
}
