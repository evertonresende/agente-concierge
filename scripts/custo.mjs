#!/usr/bin/env node
// Custo por conversa a partir dos relatórios JSON de eval (um caso = uma conversa).
// Uso: node scripts/custo.mjs <pasta-ou-arquivos...> [--modelo <id>]
//        [--preco-entrada <US$/milhão>] [--preco-saida <US$/milhão>] [--json]
// Node 24, sem dependências. Não faz rede. Lê só os números de uso; não imprime
// mensagens, nomes nem telefones dos relatórios.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Preços em US$ por milhão de tokens (entrada / saída), da tabela "Candidatos" de
// docs/revisoes/modelos.md (que cita as páginas de modelos da Cloudflare). Guardados em
// microdólar por milhão, inteiros, para a conta não ter erro de ponto flutuante.
export const PRINCIPAL = 'anthropic/claude-haiku-5.5'; // DECISOES.md X24
export const RESERVA = '@cf/zai-org/glm-5.3-flash'; // DECISOES.md X24, provisório
export const PRECOS = {
  'anthropic/claude-haiku-5.5': { entrada: 100_000, saida: 500_000 },
  '@cf/zai-org/glm-5.3-flash': { entrada: 150_000, saida: 500_000 },
  '@cf/deepseek-ai/deepseek-v4.1-flash-1017': { entrada: 300_000, saida: 1_200_000 },
  '@cf/zai-org/glm-5.3': { entrada: 1_400_000, saida: 4_400_000 },
  '@cf/openai/gpt-oss-120b': { entrada: 350_000, saida: 750_000 },
};

class ErroDeUso extends Error {}

/** "0,10" ou "0.10" (US$ por milhão) → microdólar por milhão, inteiro, sem passar por float. */
export function lerPreco(texto) {
  const m = /^(\d+)(?:[.,](\d{1,6}))?$/.exec(String(texto ?? '').trim());
  if (!m) throw new ErroDeUso(`preço inválido: ${texto} (use, por exemplo, 0,10)`);
  return Number(m[1]) * 1_000_000 + Number((m[2] ?? '').padEnd(6, '0'));
}

// Custos internos em picodólar (1e-12 US$) como BigInt: tokens × microdólar por milhão.
const PICO_POR_UNIDADE = 10_000_000n; // 1e-5 US$ (centésimo de milésimo de dólar)

/** Divide e arredonda meio para cima, em BigInt não negativo. */
function dividirArredondando(a, b) {
  return (2n * a + b) / (2n * b);
}

/** Picodólar → número de US$ com 5 casas (exato: inteiro / 1e5). */
export function emDolares(pico) {
  return Number(dividirArredondando(pico, PICO_POR_UNIDADE)) / 100_000;
}

/** Mesma definição do calcularPercentil do runner (posto mais próximo). */
function percentil(ordenados, p) {
  const idx = Math.max(0, Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[idx];
}

function inteiro(v) {
  return Number.isInteger(v) && v >= 0;
}

/**
 * Extrai o uso de um relatório já lido. Retorna { tipo, conversas } (por conversa),
 * { tipo, agregado } (relatório só agregado) ou { semUso: motivo }.
 */
export function extrairUso(rel) {
  if (!rel || typeof rel !== 'object') return { semUso: 'não é um objeto JSON' };
  const tipo = rel.tipo ?? (rel.conjunto ? `eval ${rel.conjunto}` : 'desconhecido');
  if (Array.isArray(rel.conversas) && rel.conversas.length > 0) {
    const conversas = rel.conversas.filter(
      (c) => c && inteiro(c.uso_entrada) && inteiro(c.uso_saida) && inteiro(c.chamadas_modelo),
    );
    if (conversas.length === 0) return { semUso: 'conversas sem campos de uso' };
    if (conversas.every((c) => c.uso_entrada + c.uso_saida + c.chamadas_modelo === 0)) {
      return { semUso: 'uso zerado em todas as conversas' };
    }
    return {
      tipo,
      ignoradas: rel.conversas.length - conversas.length,
      conversas: conversas.map((c) => ({
        entrada: c.uso_entrada,
        saida: c.uso_saida,
        chamadas: c.chamadas_modelo,
      })),
    };
  }
  const u = rel.uso;
  const n = rel.agregado?.executados;
  if (u && inteiro(u.entrada_total) && inteiro(u.saida_total) && inteiro(n) && n > 0
      && u.entrada_total + u.saida_total > 0) {
    return {
      tipo,
      agregado: {
        n,
        entrada: u.entrada_total,
        saida: u.saida_total,
        chamadas: inteiro(u.chamadas_modelo_total) ? u.chamadas_modelo_total : 0,
      },
    };
  }
  return { semUso: 'sem dados de uso' };
}

/** Estatísticas de custo de uma lista de conversas { entrada, saida, chamadas }. */
export function resumirConversas(conversas, preco) {
  const pE = BigInt(preco.entrada);
  const pS = BigInt(preco.saida);
  const custos = conversas.map((c) => BigInt(c.entrada) * pE + BigInt(c.saida) * pS);
  const ordenados = [...custos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const n = conversas.length;
  const soma = (k) => conversas.reduce((t, c) => t + c[k], 0);
  const total = custos.reduce((t, c) => t + c, 0n);
  return {
    conversas: n,
    sem_chamadas: conversas.filter((c) => c.chamadas === 0).length,
    entrada_total: soma('entrada'),
    saida_total: soma('saida'),
    chamadas_total: soma('chamadas'),
    entrada_media: Math.round(soma('entrada') / n),
    saida_media: Math.round(soma('saida') / n),
    chamadas_media: Number((soma('chamadas') / n).toFixed(2)),
    custo_medio_usd: emDolares(dividirArredondando(total, BigInt(n))),
    custo_p50_usd: emDolares(percentil(ordenados, 50)),
    custo_p95_usd: emDolares(percentil(ordenados, 95)),
    custo_max_usd: emDolares(ordenados[n - 1]),
    custo_total_usd: emDolares(total),
  };
}

/** Relatório só agregado: média e total, sem percentis. */
function resumirAgregado(a, preco) {
  const total = BigInt(a.entrada) * BigInt(preco.entrada) + BigInt(a.saida) * BigInt(preco.saida);
  return {
    conversas: a.n,
    sem_chamadas: null,
    entrada_total: a.entrada,
    saida_total: a.saida,
    chamadas_total: a.chamadas,
    entrada_media: Math.round(a.entrada / a.n),
    saida_media: Math.round(a.saida / a.n),
    chamadas_media: Number((a.chamadas / a.n).toFixed(2)),
    custo_medio_usd: emDolares(dividirArredondando(total, BigInt(a.n))),
    custo_p50_usd: null,
    custo_p95_usd: null,
    custo_max_usd: null,
    custo_total_usd: emDolares(total),
  };
}

function lerArgs(argv) {
  const opcoes = { entradas: [], modelo: PRINCIPAL, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      if (i + 1 >= argv.length) throw new ErroDeUso(`${a} precisa de um valor`);
      return argv[++i];
    };
    if (a === '--json') opcoes.json = true;
    else if (a === '--modelo') opcoes.modelo = valor();
    else if (a === '--preco-entrada') opcoes.precoEntrada = lerPreco(valor());
    else if (a === '--preco-saida') opcoes.precoSaida = lerPreco(valor());
    else if (a.startsWith('--')) throw new ErroDeUso(`opção desconhecida: ${a}`);
    else opcoes.entradas.push(a);
  }
  if (opcoes.entradas.length === 0) throw new ErroDeUso('informe uma pasta ou arquivos de relatório');
  const tabela = PRECOS[opcoes.modelo];
  if (!tabela && (opcoes.precoEntrada === undefined || opcoes.precoSaida === undefined)) {
    throw new ErroDeUso(
      `modelo sem preço na tabela: ${opcoes.modelo}; passe --preco-entrada e --preco-saida`,
    );
  }
  opcoes.preco = {
    entrada: opcoes.precoEntrada ?? tabela.entrada,
    saida: opcoes.precoSaida ?? tabela.saida,
  };
  return opcoes;
}

/** Expande pastas em seus *.json (sem recursão), mantendo o caminho como foi passado. */
function listarArquivos(entradas) {
  const arquivos = [];
  for (const e of entradas) {
    let st;
    try {
      st = fs.statSync(e);
    } catch {
      throw new ErroDeUso(`não encontrado: ${e}`);
    }
    if (st.isDirectory()) {
      for (const nome of fs.readdirSync(e).sort()) {
        if (nome.endsWith('.json')) arquivos.push(path.join(e, nome));
      }
    } else arquivos.push(e);
  }
  return arquivos;
}

/** Calcula tudo. Retorna { resultado, avisos }; resultado.geral é null sem uso nenhum. */
export function calcular(arquivos, preco, modelo, sobrescrito = false) {
  const avisos = [];
  const relatorios = [];
  const todas = [];
  for (const arq of arquivos) {
    let rel;
    try {
      rel = JSON.parse(fs.readFileSync(arq, 'utf8'));
    } catch {
      avisos.push(`ignorado ${arq}: não é JSON legível`);
      continue;
    }
    const u = extrairUso(rel);
    if (u.semUso) {
      avisos.push(`ignorado ${arq}: ${u.semUso}`);
      continue;
    }
    if (u.agregado) {
      avisos.push(`${arq}: só agregado, sem percentis; fica fora da linha geral`);
      relatorios.push({ arquivo: arq, tipo: u.tipo, so_agregado: true, ...resumirAgregado(u.agregado, preco) });
      continue;
    }
    if (u.ignoradas > 0) avisos.push(`${arq}: ${u.ignoradas} conversa(s) sem campos de uso ignorada(s)`);
    relatorios.push({ arquivo: arq, tipo: u.tipo, so_agregado: false, ...resumirConversas(u.conversas, preco) });
    todas.push(...u.conversas);
  }
  const semModelo = relatorios.length > 0;
  if (semModelo) {
    avisos.push(
      'os relatórios não dizem qual modelo respondeu cada chamada: tudo calculado com '
      + (sobrescrito ? 'o preço passado na linha de comando' : `o preço de ${modelo}`)
      + (modelo === PRINCIPAL && !sobrescrito
        ? ` (principal); turnos respondidos pelo reserva (${RESERVA}) saem com o preço errado`
        : ''),
    );
    avisos.push('tokens de cache entram como entrada a preço cheio (src/modelo.ts soma cache na entrada)');
  }
  return {
    avisos,
    resultado: {
      modelo,
      preco_usd_por_milhao: { entrada: preco.entrada / 1_000_000, saida: preco.saida / 1_000_000 },
      preco_sobrescrito: sobrescrito,
      modelo_por_chamada_no_relatorio: false,
      relatorios,
      geral: todas.length > 0 ? resumirConversas(todas, preco) : null,
    },
  };
}

const usd = (v) => (v === null ? '—' : v.toFixed(5).replace('.', ','));
const num = (v) => (v === null ? '—' : String(v).replace('.', ','));
/** Microdólar por milhão (inteiro) → "0,10", "4,40", "0,075". */
function formatarPreco(micro) {
  const frac = String(micro % 1_000_000).padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${Math.floor(micro / 1_000_000)},${frac}`;
}

function tabela(r) {
  const cab = ['relatório', 'tipo', 'conversas', 'sem chamada', 'entrada méd', 'saída méd', 'chamadas méd',
    'US$ médio', 'US$ p50', 'US$ p95', 'US$ máx', 'US$ total'];
  const linha = (nome, tipo, s) => [nome, tipo, num(s.conversas), num(s.sem_chamadas), num(s.entrada_media),
    num(s.saida_media), num(s.chamadas_media), usd(s.custo_medio_usd), usd(s.custo_p50_usd),
    usd(s.custo_p95_usd), usd(s.custo_max_usd), usd(s.custo_total_usd)];
  const linhas = r.relatorios.map((x) => linha(path.basename(x.arquivo), x.tipo, x));
  if (r.geral) linhas.push(linha('GERAL (por conversa)', '', r.geral));
  const larg = cab.map((c, i) => Math.max(c.length, ...linhas.map((l) => l[i].length)));
  const fmt = (l) => l.map((c, i) => (i < 2 ? c.padEnd(larg[i]) : c.padStart(larg[i]))).join('  ');
  return [fmt(cab), larg.map((n) => '-'.repeat(n)).join('  '), ...linhas.map(fmt)].join('\n');
}

export function main(argv, saida = process.stdout, erro = process.stderr) {
  let opcoes;
  let calc;
  try {
    opcoes = lerArgs(argv);
    const sobrescrito = opcoes.precoEntrada !== undefined || opcoes.precoSaida !== undefined;
    calc = calcular(listarArquivos(opcoes.entradas), opcoes.preco, opcoes.modelo, sobrescrito);
  } catch (e) {
    if (!(e instanceof ErroDeUso)) throw e;
    erro.write(`CUSTO ERRO: ${e.message}\n`);
    return 2;
  }
  const { resultado, avisos } = calc;
  if (!resultado.geral) {
    for (const a of avisos) erro.write(`aviso: ${a}\n`);
    erro.write('CUSTO FALHOU: nenhum relatório com dados de uso por conversa\n');
    if (opcoes.json) saida.write(`${JSON.stringify({ ...resultado, avisos }, null, 2)}\n`);
    return 1;
  }
  if (opcoes.json) {
    for (const a of avisos) erro.write(`aviso: ${a}\n`);
    saida.write(`${JSON.stringify({ ...resultado, avisos }, null, 2)}\n`);
    return 0;
  }
  // Na saída legível, os avisos (inclusive o limite do modelo) vão para o stdout.
  const origem = resultado.preco_sobrescrito ? ', preço sobrescrito' : '';
  saida.write(`Modelo: ${resultado.modelo} (US$ ${formatarPreco(opcoes.preco.entrada)} / `
    + `${formatarPreco(opcoes.preco.saida)} por milhão, entrada / saída${origem})\n`);
  for (const a of avisos) saida.write(`aviso: ${a}\n`);
  saida.write(`${tabela(resultado)}\n`);
  saida.write(`CUSTO OK US$ ${usd(resultado.geral.custo_medio_usd)} por conversa (média de ${resultado.geral.conversas})\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
