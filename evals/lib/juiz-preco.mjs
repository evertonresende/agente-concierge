import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARIFAS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tarifas.json'), 'utf8')
);

const MS_DIA = 86_400_000;

const DIAS_SEMANA_PT = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

export function obterHojeSaoPauloMs(agora = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);
  return Date.UTC(year, month - 1, day);
}

export function formatarDataIso(ms) {
  const d = new Date(ms);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBr(ms) {
  const d = new Date(ms);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${dia}/${mes}/${ano}`;
}

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatarDataExtenso(ms) {
  const d = new Date(ms);
  const ano = d.getUTCFullYear();
  const mes = MESES_PT[d.getUTCMonth()];
  const dia = d.getUTCDate();
  return `${dia} de ${mes} de ${ano}`;
}

export function resolverPlaceholderData(chave, hojeMs = obterHojeSaoPauloMs()) {
  const formatar = (ms, fmt) => {
    if (fmt === 'iso') return formatarDataIso(ms);
    if (fmt === 'extenso') return formatarDataExtenso(ms);
    return formatarDataBr(ms);
  };

  if (chave === 'hoje_iso') return formatar(hojeMs, 'iso');
  if (chave === 'hoje_br') return formatar(hojeMs, 'br');
  if (chave === 'hoje_extenso') return formatar(hojeMs, 'extenso');
  if (chave === 'amanha_iso') return formatar(hojeMs + MS_DIA, 'iso');
  if (chave === 'amanha_br') return formatar(hojeMs + MS_DIA, 'br');
  if (chave === 'amanha_extenso') return formatar(hojeMs + MS_DIA, 'extenso');

  let m = /^hoje_mais_(\d+)_(iso|br|extenso)$/.exec(chave);
  if (m) {
    const dias = Number(m[1]);
    return formatar(hojeMs + dias * MS_DIA, m[2]);
  }

  m = /^hoje_menos_(\d+)_(iso|br|extenso)$/.exec(chave);
  if (m) {
    const dias = Number(m[1]);
    return formatar(hojeMs - dias * MS_DIA, m[2]);
  }

  m = /^prox_(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:_mais_(\d+))?_(iso|br|extenso)$/.exec(
    chave
  );
  if (m) {
    const dowAlvo = DIAS_SEMANA_PT[m[1]];
    const dowHoje = new Date(hojeMs).getUTCDay();
    const deltaProx = (dowAlvo - dowHoje + 7) % 7 || 7;
    const extra = m[2] ? Number(m[2]) : 0;
    return formatar(hojeMs + (deltaProx + extra) * MS_DIA, m[3]);
  }

  return null;
}

export function obterTarifa(imovelId) {
  const chave = String(imovelId || '').toUpperCase();
  return TARIFAS[chave] ?? null;
}

/**
 * Faz o parse de data civil ISO (AAAA-MM-DD) ou BR (DD/MM/AAAA) para UTC midnight ms.
 * Retorna null se a data for inválida no calendário (ex: 30/02/2027).
 */
export function parseDataCivilUtc(texto) {
  if (typeof texto !== 'string') return null;
  let ano;
  let mes;
  let dia;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());

  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (br) {
    dia = Number(br[1]);
    mes = Number(br[2]);
    ano = Number(br[3]);
  } else {
    return null;
  }

  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null;
  }
  return ms;
}

/**
 * Formata centavos inteiros no padrão do contrato: "R$ 2.156,00".
 */
export function formatarReais(centavos) {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error(`Centavos inválidos: ${centavos}`);
  }
  const reaisInt = Math.trunc(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const reaisStr = String(reaisInt).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reaisStr},${resto}`;
}

/**
 * Converte string numérica BRL ("2.156,00" ou "369,60" ou "300") para centavos inteiros.
 */
export function parseValorBrlParaCentavos(valorStr) {
  if (typeof valorStr !== 'string') return null;
  const semPrefixo = valorStr.trim().replace(/^R\$\s*/i, '');
  const limpo = semPrefixo.replace(/\./g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(limpo);
  if (!match) return null;
  const reais = Number(match[1]);
  const cents = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  return reais * 100 + cents;
}

export function parseValorToleradoCentavos(valor) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return null;
    const vezesCem = valor * 100;
    const cent = Math.round(vezesCem);
    if (Math.abs(vezesCem - cent) > 1e-6) return null;
    return cent;
  }
  if (typeof valor === 'string') {
    return parseValorBrlParaCentavos(valor);
  }
  return null;
}

/**
 * Calcula a estadia em centavos inteiros conforme contrato §3 e L14:
 * - sexta (5) e sábado (6) têm +20% com arredondamento por noite:
 *   Math.trunc((120 * diariaCentavos + 50) / 100)
 * - taxa_limpeza somada uma única vez.
 */
export function calcularEstadia({ imovel_id, checkin, checkout, hospedes }) {
  const tarifa = obterTarifa(imovel_id);
  if (!tarifa) {
    return { ok: false, motivo: `Imóvel desconhecido no tarifário: ${imovel_id}` };
  }

  const entradaMs = parseDataCivilUtc(checkin);
  const saidaMs = parseDataCivilUtc(checkout);
  if (entradaMs === null || saidaMs === null) {
    return { ok: false, motivo: `Data civil inválida (${checkin} -> ${checkout})` };
  }

  const noites = (saidaMs - entradaMs) / MS_DIA;
  if (!Number.isInteger(noites) || noites <= 0) {
    return { ok: false, motivo: `Saída deve ser posterior à entrada (${noites} noites)` };
  }
  if (noites < tarifa.minimo_noites) {
    return {
      ok: false,
      motivo: `Mínimo de ${tarifa.minimo_noites} noites não atingido (${noites})`,
    };
  }
  if (hospedes !== undefined && hospedes !== null && hospedes > tarifa.capacidade) {
    return {
      ok: false,
      motivo: `Capacidade de ${tarifa.capacidade} excedida (${hospedes})`,
    };
  }

  const diaria = tarifa.diaria_centavos;
  const diariaFds = Math.trunc((120 * diaria + 50) / 100);
  let subtotalNoites = 0;
  let noitesNormais = 0;
  let noitesFds = 0;

  for (let i = 0; i < noites; i++) {
    const dow = new Date(entradaMs + i * MS_DIA).getUTCDay();
    if (dow === 5 || dow === 6) {
      noitesFds++;
      subtotalNoites += diariaFds;
    } else {
      noitesNormais++;
      subtotalNoites += diaria;
    }
  }

  const subtotalNormais = noitesNormais * diaria;
  const subtotalFds = noitesFds * diariaFds;
  const totalCentavos = subtotalNoites + tarifa.taxa_limpeza_centavos;

  return {
    ok: true,
    noites,
    noitesNormais,
    noitesFds,
    diariaCentavos: diaria,
    diariaFdsCentavos: diariaFds,
    subtotalNormaisCentavos: subtotalNormais,
    subtotalFdsCentavos: subtotalFds,
    subtotalNoitesCentavos: subtotalNoites,
    taxaLimpezaCentavos: tarifa.taxa_limpeza_centavos,
    totalCentavos,
    totalFormatado: formatarReais(totalCentavos),
  };
}

const REGEX_TERMO_COMPONENTE =
  /\b(?:di[aá]rias?|noites?|hospedagem|sub-?total|limpeza|taxa(?:\s+de\s+limpeza)?|fim\s+de\s+semana|fds|(?:\d+|uma?)\s+norma(?:l|is)|sexta(?:-feira)?|s[aá]bado|domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|dias?\s+[uú]te(?:l|is)|semana|unit[aá]ri[oa]|por\s+noite|cada\s+noite|daily|night(?:s)?|rate(?:s)?|weekend|weekday(?:s)?|cleaning|fee)\b/i;

function temPrefixoR$(texto, indice) {
  const antes = texto.slice(Math.max(0, indice - 10), indice);
  return /R\$\s*$/i.test(antes);
}

/**
 * Detecta valores monetários escritos sem o prefixo obrigatório "R$"
 * (ex.: "1.900 reais", "1900,00", "faço por 1.900").
 */
export function verificarValoresSemR$(texto) {
  const erros = [];
  const avisados = new Set();
  const registrar = (indice, trecho) => {
    const chave = `${indice}:${trecho}`;
    if (avisados.has(chave)) return;
    avisados.add(chave);
    erros.push(`Valor monetário sem prefixo "R$": "${trecho.trim()}"`);
  };

  // 1) Número seguido de palavra monetária explícita ("1.900 reais", "500 BRL")
  const reMoedaPalavra = /\b\d+(?:[.,]\d+)*\s+(?:reais|real|brl)\b/gi;
  let m;
  while ((m = reMoedaPalavra.exec(texto)) !== null) {
    if (!temPrefixoR$(texto, m.index)) {
      registrar(m.index, m[0]);
    }
  }

  // 2) Valor com duas casas decimais separado por vírgula sem "R$" (ex.: "1.900,00", "590,00")
  const reDecimalSemR = /(?<!\d[.,])\b(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\b(?!\d)/g;
  while ((m = reDecimalSemR.exec(texto)) !== null) {
    if (temPrefixoR$(texto, m.index)) continue;
    const charAntes = m.index > 0 ? texto[m.index - 1] : '';
    if (charAntes === '/' || charAntes === ':' || charAntes === '-') continue;
    const depois = texto.slice(m.index + m[0].length);
    if (
      /^\s*(?:%|reais\b|real\b|brl\b|km\b|metros?\b|m[²2]?\b|pessoas?\b|h[oó]spedes?\b|noites?\b|dias?\b|horas?\b|h\b|min(?:utos?)?\b|segundos?\b|caracteres?\b|kg\b|g\b|l\b|litros?\b)/i.test(
        depois
      )
    ) {
      continue;
    }
    registrar(m.index, m[0]);
  }

  // 3) Contexto monetário seguido de número inteiro/milhar sem "R$" (ex.: "faço por 1.900", "total de 1900")
  const reContextoSemR =
    /\b(?:valor(?:\s+total)?|total(?:\s+(?:geral|final|da\s+estadia|das?\s+di[aá]rias?))?|pre[cç]o|di[aá]ria|taxa(?:\s+de\s+limpeza)?|limpeza|sub-?total|fa[cç]o|fecho|fechamos|cobr(?:o|amos)|custa(?:m)?|or[cç]amento|desconto|(?:sai|fica(?:r[aá])?))\s+(?:de\s+|em\s+|por\s+|é\s+|seria\s+|fica(?:\s+em|\s+por)?\s+|cerca\s+de\s+|aproximadamente\s+|[:=]\s*)*(\d{1,3}(?:\.\d{3})+|\d{2,})(?![.,:/-]\d)(?!\s*(?:%|por\s+cento\b|reais\b|real\b|brl\b|pessoas?\b|h[oó]spedes?\b|noites?\b|dias?\b|quartos?\b|banheiros?\b|vagas?\b|im[oó]ve(?:l|is)\b|op[cç](?:[aã]o|[oõ]es)\b|cidades?\b|anos?\b|mes(?:es)?\b|metros?\b|km\b|m[²2]?\b|horas?\b|h\b|min(?:utos?)?\b|segundos?\b|caracteres?\b|letras?\b|palavras?\b|vezes?\b|x\b|de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b))/gi;
  while ((m = reContextoSemR.exec(texto)) !== null) {
    const idxNum = m.index + m[0].lastIndexOf(m[1]);
    if (temPrefixoR$(texto, idxNum)) continue;
    const prefixoEntre = texto.slice(m.index, idxNum);
    if (/\b(?:para|entre)\b/i.test(prefixoEntre)) continue;
    registrar(idxNum, m[1]);
  }

  return erros;
}

/**
 * Verifica todas as ocorrências de "R$ ..." na resposta quanto ao formato estrito
 * do contrato (§2 e con-05): "R$ d.ddd,dd" (ponto de milhar obrigatório >= 1000,
 * espaço após R$, vírgula e duas casas decimais), além de acusar valores monetários sem "R$".
 */
export function verificarFormatoMoeda(texto) {
  const erros = [];
  const regexBruto = /R\$\s*[\d.,]+/g;
  const regexEstrito = /^R\$ (?:[1-9]\d{0,2}(?:\.\d{3})*|0),\d{2}$/;

  let m;
  while ((m = regexBruto.exec(texto)) !== null) {
    // Limpa pontuação de fim de frase (ex: "R$ 2.156,00." -> "R$ 2.156,00")
    const bruto = m[0].replace(/[.,]+$/, '');
    if (!regexEstrito.test(bruto)) {
      erros.push(`Formato monetário inválido: "${bruto}" (esperado "R$ d.ddd,dd")`);
    }
  }

  erros.push(...verificarValoresSemR$(texto));
  return erros;
}

/**
 * Extrai valores monetários válidos em centavos de uma resposta.
 */
export function extrairValoresCentavos(texto) {
  const valores = [];
  const regexEstrito = /R\$ ((?:[1-9]\d{0,2}(?:\.\d{3})*|0),\d{2})(?!\d)/g;
  let m;
  while ((m = regexEstrito.exec(texto)) !== null) {
    const centavos = parseValorBrlParaCentavos(m[1]);
    if (centavos !== null) {
      valores.push({ texto: m[0], centavos, indice: m.index });
    }
  }
  return valores;
}

function extrairClausulaAoRedor(texto, indice, tamanho) {
  let ini = indice;
  while (ini > 0) {
    const ch = texto[ini - 1];
    if (ch === '\n' || ch === ';' || ch === '!' || ch === '?') break;
    if (ch === '.' && !(/\d/.test(texto[ini - 2] || '') && /\d/.test(texto[ini] || ''))) break;
    if (ch === ',' && !/\d{2}/.test(texto.slice(ini, ini + 2))) break;
    ini--;
  }

  let fim = indice + tamanho;
  while (fim < texto.length) {
    const ch = texto[fim];
    if (ch === '\n' || ch === ';' || ch === '!' || ch === '?') break;
    if (ch === '.' && !(/\d/.test(texto[fim - 1] || '') && /\d/.test(texto[fim + 1] || ''))) break;
    if (ch === ',' && !/\d{2}/.test(texto.slice(fim + 1, fim + 3))) break;
    fim++;
  }

  return {
    antes: texto.slice(ini, indice),
    depois: texto.slice(indice + tamanho, fim),
  };
}

function subtotalNomeadoComoComponente(texto, valorObj) {
  const { antes, depois } = extrairClausulaAoRedor(texto, valorObj.indice, valorObj.texto.length);

  // Isola o trecho desde a ocorrência anterior de "R$ ..." (se houver) nesta cláusula
  const reAnterior = /R\$\s*(?:[1-9]\d{0,2}(?:\.\d{3})*|0),\d{2}/g;
  let fimAnterior = 0;
  let mAnt;
  while ((mAnt = reAnterior.exec(antes)) !== null) {
    fimAnterior = mAnt.index + mAnt[0].length;
  }
  const antesSemValorAnterior = antes.slice(fimAnterior);

  const idxParen = antesSemValorAnterior.lastIndexOf('(');
  const trechoAposParen = idxParen >= 0 ? antesSemValorAnterior.slice(idxParen + 1) : antesSemValorAnterior;
  const prefixoOferta =
    idxParen >= 0 && trechoAposParen.trim() === ''
      ? antesSemValorAnterior.slice(0, idxParen)
      : trechoAposParen;

  // Não aceita subtotal disfarçado de desconto/oferta ou de total geral da estadia
  if (/(?:fa[cç]o|fecho|fechamos|sai)\s+por|desconto\s+(?:de|para)|com\s+desconto/i.test(prefixoOferta)) {
    return false;
  }
  if (/(?<!\bsub)\btotal\b(?!\s+(?:das?|de)\s+(?:di[aá]rias?|noites?|hospedagem))/i.test(prefixoOferta)) {
    return false;
  }

  const mProx = /R\$\s*(?:[1-9]\d{0,2}(?:\.\d{3})*|0),\d{2}/.exec(depois);
  const depoisAteProx = mProx ? depois.slice(0, mProx.index) : depois;

  const trechoContextoAntes =
    idxParen >= 0 && !REGEX_TERMO_COMPONENTE.test(trechoAposParen)
      ? antesSemValorAnterior
      : trechoAposParen;

  return REGEX_TERMO_COMPONENTE.test(`${trechoContextoAntes} ${depoisAteProx}`);
}

/**
 * Juiz determinístico de preço para uma resposta (CA-05):
 * - Confere o total calculado pela regra do contrato §3 em centavos inteiros.
 * - Se obrigatorio=true (padrão), exige que o total calculado apareça formatado na resposta.
 * - Qualquer outro valor em R$ citado na resposta só é aceito se pertencer a `valoresTolerados`
 *   ou aos componentes/subtotais coerentes da estadia nomeados como componente no texto.
 * - Acusa valores monetários escritos sem "R$".
 */
export function julgarPrecoResposta(texto, estadiasInput, opcoes = {}) {
  const lista = Array.isArray(estadiasInput) ? estadiasInput : [estadiasInput];
  const erros = [];
  const totaisOuTolerados = new Set();
  const componentesPermitidos = new Set();

  const valoresTolerados = Array.isArray(opcoes.valoresTolerados) ? opcoes.valoresTolerados : [];
  for (const vt of valoresTolerados) {
    const cent = parseValorToleradoCentavos(vt);
    if (cent !== null) {
      totaisOuTolerados.add(cent);
    }
  }

  for (const item of lista) {
    const calc = calcularEstadia(item);
    if (!calc.ok) {
      erros.push(`Erro ao calcular estadia esperada (${item.imovel_id}): ${calc.motivo}`);
      continue;
    }

    const obrigatorio = item.obrigatorio !== false;
    if (obrigatorio && !texto.includes(calc.totalFormatado)) {
      erros.push(
        `Total esperado ${calc.totalFormatado} (${item.imovel_id} ${item.checkin}..${item.checkout}) não encontrado na resposta`
      );
    }

    totaisOuTolerados.add(calc.totalCentavos);
    componentesPermitidos.add(calc.diariaCentavos);
    componentesPermitidos.add(calc.diariaFdsCentavos);
    componentesPermitidos.add(calc.subtotalNormaisCentavos);
    componentesPermitidos.add(calc.subtotalFdsCentavos);
    componentesPermitidos.add(calc.subtotalNoitesCentavos);
    componentesPermitidos.add(calc.taxaLimpezaCentavos);

    if (calc.noites <= 31) {
      for (let k = 0; k <= calc.noitesNormais; k++) {
        for (let m = 0; m <= calc.noitesFds; m++) {
          if (k + m > 0) {
            componentesPermitidos.add(k * calc.diariaCentavos + m * calc.diariaFdsCentavos);
          }
        }
      }
    }
  }

  const encontrados = extrairValoresCentavos(texto);
  for (const v of encontrados) {
    if (totaisOuTolerados.has(v.centavos)) continue;
    if (componentesPermitidos.has(v.centavos)) {
      if (!subtotalNomeadoComoComponente(texto, v)) {
        erros.push(`Valor "${v.texto}" aparece sem rótulo de componente (diária/taxa)`);
      }
      continue;
    }
    erros.push(`Valor citado "${v.texto}" não bate com o cálculo determinístico da estadia`);
  }

  erros.push(...verificarValoresSemR$(texto));
  return erros;
}

/**
 * Verifica `sem_total` (CA-06):
 * - Sem `imovelId`: qualquer valor em R$ (salvo `valoresTolerados`) é proibido.
 * - Com `imovelId`: tolera a diária, diária de fds e taxa de limpeza daquele imóvel
 *   quando nomeados como componente, proibindo qualquer outro valor (como um total calculado).
 * - Também acusa valores monetários sem "R$".
 */
export function julgarSemTotal(texto, imovelId = null, valoresTolerados = []) {
  const erros = [];
  const tolerados = new Set();
  const componentes = new Set();

  if (Array.isArray(valoresTolerados)) {
    for (const vt of valoresTolerados) {
      const cent = parseValorToleradoCentavos(vt);
      if (cent !== null) {
        tolerados.add(cent);
      }
    }
  }

  if (imovelId) {
    const tarifa = obterTarifa(imovelId);
    if (!tarifa) {
      erros.push(`Imóvel desconhecido em sem_total: ${imovelId}`);
      return erros;
    }
    componentes.add(tarifa.diaria_centavos);
    componentes.add(Math.trunc((120 * tarifa.diaria_centavos + 50) / 100));
    componentes.add(tarifa.taxa_limpeza_centavos);
  }

  const valores = extrairValoresCentavos(texto);
  for (const v of valores) {
    if (tolerados.has(v.centavos)) continue;
    if (componentes.has(v.centavos)) {
      if (!subtotalNomeadoComoComponente(texto, v)) {
        erros.push(`não deveria citar valor em R$ sem rótulo de componente (${v.texto})`);
      }
      continue;
    }
    erros.push(`não deveria citar valor total em R$ (${v.texto})`);
  }

  if (valores.length === 0 && /R\$\s*\d/i.test(texto)) {
    erros.push('não deveria citar valor total em R$');
  }

  erros.push(...verificarValoresSemR$(texto));
  return erros;
}
