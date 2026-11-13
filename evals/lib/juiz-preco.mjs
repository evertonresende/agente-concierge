import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARIFAS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tarifas.json'), 'utf8')
);

const MS_DIA = 86_400_000;

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
 * Converte string numérica BRL ("2.156,00" ou "369,60") para centavos inteiros.
 */
export function parseValorBrlParaCentavos(valorStr) {
  const limpo = valorStr.replace(/\./g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{2}))?$/.exec(limpo);
  if (!match) return null;
  const reais = Number(match[1]);
  const cents = match[2] ? Number(match[2]) : 0;
  return reais * 100 + cents;
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

  for (let i = 0; i < noites; i++) {
    const dow = new Date(entradaMs + i * MS_DIA).getUTCDay();
    subtotalNoites += dow === 5 || dow === 6 ? diariaFds : diaria;
  }

  const totalCentavos = subtotalNoites + tarifa.taxa_limpeza_centavos;

  return {
    ok: true,
    noites,
    diariaCentavos: diaria,
    diariaFdsCentavos: diariaFds,
    subtotalNoitesCentavos: subtotalNoites,
    taxaLimpezaCentavos: tarifa.taxa_limpeza_centavos,
    totalCentavos,
    totalFormatado: formatarReais(totalCentavos),
  };
}

/**
 * Verifica todas as ocorrências de "R$ ..." na resposta quanto ao formato estrito
 * do contrato (§2 e con-05): "R$ d.ddd,dd" (ponto de milhar obrigatório >= 1000,
 * espaço após R$, vírgula e duas casas decimais).
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
      valores.push({ texto: m[0], centavos });
    }
  }
  return valores;
}

/**
 * Juiz determinístico de preço para uma resposta (CA-05):
 * - Confere o total calculado pela regra do contrato §3 em centavos inteiros.
 * - Se obrigatorio=true (padrão), exige que o total calculado apareça formatado na resposta.
 * - Qualquer outro valor em R$ citado na resposta só é aceito se pertencer aos
 *   componentes legítimos daquela estadia (diária, diária fds, subtotal noites,
 *   taxa de limpeza, ou um total de outra estadia permitida no mesmo turno).
 */
export function julgarPrecoResposta(texto, estadiasInput) {
  const lista = Array.isArray(estadiasInput) ? estadiasInput : [estadiasInput];
  const erros = [];
  const permitidos = new Set();

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

    permitidos.add(calc.totalCentavos);
    permitidos.add(calc.diariaCentavos);
    permitidos.add(calc.diariaFdsCentavos);
    permitidos.add(calc.subtotalNoitesCentavos);
    permitidos.add(calc.taxaLimpezaCentavos);
  }

  const encontrados = extrairValoresCentavos(texto);
  for (const v of encontrados) {
    if (!permitidos.has(v.centavos)) {
      erros.push(`Valor citado "${v.texto}" não bate com o cálculo determinístico da estadia`);
    }
  }

  return erros;
}
