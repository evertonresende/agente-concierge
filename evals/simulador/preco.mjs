import {
  calcularEstadia,
  extrairValoresCentavos,
  formatarReais,
  parseDataCivilUtc,
  parseValorBrlParaCentavos,
  verificarFormatoMoeda,
} from '../lib/juiz-preco.mjs';

export { extrairValoresCentavos, formatarReais, parseValorBrlParaCentavos, verificarFormatoMoeda };

const MS_DIA = 86_400_000;

export function hojeSaoPauloIso(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export function parseDataCivil(texto) {
  const utcMs = parseDataCivilUtc(texto);
  if (utcMs === null) return null;
  const dt = new Date(utcMs);
  const ano = dt.getUTCFullYear();
  const mes = dt.getUTCMonth() + 1;
  const dia = dt.getUTCDate();
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return {
    ano,
    mes,
    dia,
    utcMs,
    diaSemana: dt.getUTCDay(),
    iso: `${ano}-${mm}-${dd}`,
    br: `${dd}/${mm}/${ano}`,
  };
}

export function centavosParaWebhook(centavos) {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error(`Centavos inválidos para webhook: ${centavos}`);
  }
  return Number((centavos / 100).toFixed(2));
}

export function reaisParaCentavos(numeroOuTexto) {
  if (typeof numeroOuTexto === 'number') {
    if (!Number.isFinite(numeroOuTexto) || numeroOuTexto < 0) return null;
    return Math.round(numeroOuTexto * 100);
  }
  if (typeof numeroOuTexto !== 'string') return null;
  const limpo = numeroOuTexto.replace(/^R\$\s*/i, '').trim();
  const brValido = limpo.match(/^(?:0|[1-9]\d{0,2}(?:\.\d{3})*|\d+),(\d{2})$/);
  if (brValido) {
    return parseValorBrlParaCentavos(limpo);
  }
  const usMatch = limpo.match(/^(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/);
  if (usMatch) {
    const semMilhar = limpo.replace(/,/g, '');
    return Math.round(Number(semMilhar) * 100);
  }
  const inteiroMatch = limpo.match(/^\d+$/);
  if (inteiroMatch) {
    return Number(limpo) * 100;
  }
  return null;
}

export function calcularCotacao({ imovel, checkin, checkout, hospedes, hojeIso = hojeSaoPauloIso() }) {
  if (!imovel) {
    return { ok: false, motivo: 'imovel_nao_encontrado' };
  }

  const ci = parseDataCivil(checkin);
  const co = parseDataCivil(checkout);
  if (!ci || !co) {
    return { ok: false, motivo: 'data_invalida' };
  }

  if (ci.iso < hojeIso) {
    return { ok: false, motivo: 'data_passado' };
  }

  const noites = Math.round((co.utcMs - ci.utcMs) / MS_DIA);
  if (noites <= 0) {
    return { ok: false, motivo: 'saida_nao_posterior' };
  }

  if (!Number.isInteger(hospedes) || hospedes <= 0) {
    return { ok: false, motivo: 'hospedes_invalido' };
  }

  if (noites < imovel.minimo_noites) {
    return {
      ok: false,
      motivo: 'minimo_noites',
      minimo_noites: imovel.minimo_noites,
      noites,
    };
  }

  if (hospedes > imovel.capacidade) {
    return {
      ok: false,
      motivo: 'capacidade_excedida',
      capacidade: imovel.capacidade,
      hospedes,
    };
  }

  const calc = calcularEstadia({
    imovel_id: imovel.id,
    checkin: ci.iso,
    checkout: co.iso,
    hospedes,
  });
  if (!calc.ok) {
    return { ok: false, motivo: calc.motivo };
  }

  return {
    ok: true,
    imovel_id: imovel.id,
    checkin: ci.iso,
    checkout: co.iso,
    checkinBr: ci.br,
    checkoutBr: co.br,
    hospedes,
    noites: calc.noites,
    diariaCentavos: calc.diariaCentavos,
    diariaFimDeSemanaCentavos: calc.diariaFdsCentavos,
    limpezaCentavos: calc.taxaLimpezaCentavos,
    totalNoitesCentavos: calc.subtotalNoitesCentavos,
    totalCentavos: calc.totalCentavos,
    totalFormatado: calc.totalFormatado,
    valorWebhook: centavosParaWebhook(calc.totalCentavos),
  };
}

export function extrairValoresReais(texto) {
  if (typeof texto !== 'string') return [];
  const resultados = [];
  const regex = /R\$\s*\d[\d.,]*/g;
  for (const match of texto.matchAll(regex)) {
    const bruto = match[0].replace(/[.,]+$/, '');
    const formatoValido = verificarFormatoMoeda(bruto).length === 0;
    const centavos = reaisParaCentavos(bruto);
    resultados.push({
      bruto,
      indice: match.index ?? 0,
      formatoValido,
      centavos,
    });
  }
  return resultados;
}
