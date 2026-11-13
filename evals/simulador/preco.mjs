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
  if (typeof texto !== 'string') return null;
  const limpo = texto.trim();
  let ano;
  let mes;
  let dia;

  const isoMatch = limpo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    ano = Number(isoMatch[1]);
    mes = Number(isoMatch[2]);
    dia = Number(isoMatch[3]);
  } else if (brMatch) {
    dia = Number(brMatch[1]);
    mes = Number(brMatch[2]);
    ano = Number(brMatch[3]);
  } else {
    return null;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const utcMs = Date.UTC(ano, mes - 1, dia);
  const dt = new Date(utcMs);
  if (
    dt.getUTCFullYear() !== ano ||
    dt.getUTCMonth() !== mes - 1 ||
    dt.getUTCDate() !== dia
  ) {
    return null;
  }

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

export function formatarReais(centavos) {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error(`Centavos inválidos para formatação: ${centavos}`);
  }
  const reais = Math.floor(centavos / 100);
  const resto = centavos % 100;
  const inteiroStr = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centStr = String(resto).padStart(2, '0');
  return `R$ ${inteiroStr},${centStr}`;
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
    const semMilhar = limpo.replace(/\./g, '').replace(',', '.');
    return Math.round(Number(semMilhar) * 100);
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

export function calcularDiariaFimDeSemanaCentavos(diariaCentavos) {
  // Contrato L14: meio centavo arredonda para cima, por noite: (120 * diaria em centavos + 50) / 100 em divisao inteira
  return Math.floor((120 * diariaCentavos + 50) / 100);
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

  if (noites < imovel.minimo_noites) {
    return {
      ok: false,
      motivo: 'minimo_noites',
      minimo_noites: imovel.minimo_noites,
      noites,
    };
  }

  if (!Number.isInteger(hospedes) || hospedes <= 0) {
    return { ok: false, motivo: 'hospedes_invalido' };
  }

  if (hospedes > imovel.capacidade) {
    return {
      ok: false,
      motivo: 'capacidade_excedida',
      capacidade: imovel.capacidade,
      hospedes,
    };
  }

  const diariaCentavos = Math.round(Number(imovel.diaria) * 100);
  const diariaFimDeSemanaCentavos = calcularDiariaFimDeSemanaCentavos(diariaCentavos);
  const limpezaCentavos = Math.round(Number(imovel.taxa_limpeza) * 100);

  let totalNoitesCentavos = 0;
  for (let i = 0; i < noites; i++) {
    const noiteDt = new Date(ci.utcMs + i * MS_DIA);
    const dow = noiteDt.getUTCDay();
    // Sexta (5) e sabado (6) tem acrescimo de 20%
    if (dow === 5 || dow === 6) {
      totalNoitesCentavos += diariaFimDeSemanaCentavos;
    } else {
      totalNoitesCentavos += diariaCentavos;
    }
  }

  const totalCentavos = totalNoitesCentavos + limpezaCentavos;

  return {
    ok: true,
    imovel_id: imovel.id,
    checkin: ci.iso,
    checkout: co.iso,
    checkinBr: ci.br,
    checkoutBr: co.br,
    hospedes,
    noites,
    diariaCentavos,
    diariaFimDeSemanaCentavos,
    limpezaCentavos,
    totalNoitesCentavos,
    totalCentavos,
    totalFormatado: formatarReais(totalCentavos),
    valorWebhook: centavosParaWebhook(totalCentavos),
  };
}

export function extrairValoresReais(texto) {
  if (typeof texto !== 'string') return [];
  const resultados = [];
  const regex = /R\$\s*\d[\d.,]*/g;
  for (const match of texto.matchAll(regex)) {
    const bruto = match[0].replace(/[.,]+$/, '');
    const formatoValido = /^R\$ (?:0|[1-9]\d{0,2}(?:\.\d{3})*),\d{2}$/.test(bruto);
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
