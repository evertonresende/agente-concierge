#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import {
  extrairValoresCentavos,
  julgarPrecoResposta,
  julgarSemTotal,
  obterHojeSaoPauloMs,
  parseValorToleradoCentavos,
  resolverPlaceholderData,
  verificarFormatoMoeda,
} from './lib/juiz-preco.mjs';
import {
  gravarRelatorio,
  mascararDadosPessoais,
  montarResumoRelatorio,
} from './lib/relatorio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const BLOCOS_OBRIGATORIOS = [
  'funciona-respostas',
  'funciona-cotacoes',
  'funciona-recusas',
  'funciona-leads',
  'robustez-nao-inventa',
  'robustez-manipulacao',
  'robustez-handoff',
  'contrato',
];

const NOMES_PRIMEIROS = [
  'Ana', 'Bruno', 'Camila', 'Diego', 'Eduarda',
  'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Joao',
];
const NOMES_MEIO = [
  'Paula', 'Cesar', 'Beatriz', 'Lucas', 'Fernanda',
  'Mateus', 'Renata', 'Rafael', 'Juliana', 'Thiago',
];
const NOMES_ULTIMOS = [
  'Lima', 'Silva', 'Souza', 'Costa', 'Oliveira',
  'Santos', 'Pereira', 'Almeida', 'Ferreira', 'Rocha',
];

function usoCli() {
  console.error(
    'Uso: node evals/rodar.mjs [--alvo <url>] [--conjunto dev|reservado] [--bloco <nome>] [--so-agregado] [--listar] [--paralelo <n>] [--pausa-ms <n>] [--relatorio <arquivo>] [--sem-relatorio]'
  );
}

function parseArgs(argv) {
  const args = {
    alvo: null,
    conjunto: 'dev',
    blocos: [],
    soAgregado: false,
    listar: false,
    paralelo: 2,
    pausaMs: 0,
    relatorio: null,
    semRelatorio: false,
    timeoutMs: 60_000,
  };

  const exigirValor = (flag, idx) => {
    if (idx + 1 >= argv.length || argv[idx + 1].startsWith('--')) {
      throw new Error(`Opção ${flag} exige um valor`);
    }
    return argv[idx + 1];
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--alvo') {
      args.alvo = exigirValor(a, i++);
    } else if (a === '--conjunto') {
      args.conjunto = exigirValor(a, i++);
    } else if (a === '--bloco') {
      args.blocos.push(exigirValor(a, i++));
    } else if (a === '--so-agregado') {
      args.soAgregado = true;
    } else if (a === '--listar') {
      args.listar = true;
    } else if (a === '--paralelo') {
      const n = Number(exigirValor(a, i++));
      if (!Number.isInteger(n) || n < 1 || n > 32) {
        throw new Error('--paralelo deve ser inteiro entre 1 e 32');
      }
      args.paralelo = n;
    } else if (a === '--pausa-ms') {
      const bruto = exigirValor(a, i++);
      const n = Number(bruto);
      if (!bruto.trim() || !Number.isInteger(n) || n < 0) {
        throw new Error('--pausa-ms deve ser inteiro maior ou igual a 0');
      }
      args.pausaMs = n;
    } else if (a === '--relatorio') {
      args.relatorio = exigirValor(a, i++);
    } else if (a === '--sem-relatorio') {
      args.semRelatorio = true;
    } else if (a === '--timeout-ms') {
      const t = Number(exigirValor(a, i++));
      if (!Number.isFinite(t) || t < 100) {
        throw new Error('--timeout-ms inválido');
      }
      args.timeoutMs = t;
    } else if (a === '-h' || a === '--help') {
      usoCli();
      process.exit(0);
    } else if (a.startsWith('--')) {
      const nomeOpcao = a.split('=')[0];
      if (a.includes('=')) {
        throw new Error(`Opção ${nomeOpcao} não aceita "=", use "${nomeOpcao} <valor>"`);
      }
      throw new Error(`Opção desconhecida: ${nomeOpcao}`);
    } else if (a.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${a.split('=')[0]}`);
    } else {
      throw new Error('Argumento posicional não suportado (use --opção <valor>)');
    }
  }

  if (args.conjunto !== 'dev' && args.conjunto !== 'reservado') {
    throw new Error('--conjunto inválido (use dev ou reservado)');
  }
  if (args.conjunto === 'reservado') {
    args.soAgregado = true;
  }
  if (!args.listar && !args.alvo) {
    throw new Error('--alvo <url> é obrigatório (exceto com --listar)');
  }
  if (args.alvo) {
    args.alvo = args.alvo.replace(/\/+$/, '');
  }
  return args;
}

function resolverDiretorioConjunto(conjunto) {
  if (conjunto === 'dev') {
    return path.join(REPO_ROOT, 'evals', 'casos', 'dev');
  }
  if (process.env.RESERVADO_DIR && process.env.RESERVADO_DIR.trim()) {
    return path.resolve(process.env.RESERVADO_DIR.trim());
  }
  const dentroRepo = path.join(REPO_ROOT, 'evals', 'casos', 'reservado');
  if (fs.existsSync(dentroRepo)) {
    return dentroRepo;
  }
  return path.join(os.homedir(), '.config', 'agente-concierge', 'reservado');
}

function validarListaRegex(lista, cacheRegex, mascararErros, casoId, campo) {
  if (lista === undefined) return;
  if (!Array.isArray(lista)) {
    throw new Error(
      mascararErros
        ? 'Estrutura de regex inválida no conjunto reservado.'
        : `Caso ${casoId}: campo "${campo}" deve ser um array`
    );
  }
  for (const padrao of lista) {
    if (typeof padrao !== 'string') {
      throw new Error(
        mascararErros
          ? 'Padrão de regex inválido no conjunto reservado.'
          : `Caso ${casoId}: padrão em "${campo}" deve ser string`
      );
    }
    const temPlaceholder = /\{\{[a-zA-Z0-9_]+\}\}/.test(padrao);
    const exprTeste = temPlaceholder
      ? padrao.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, 'PLACEHOLDER_SEGURA')
      : padrao;
    let re;
    try {
      re = new RegExp(exprTeste, 'i');
    } catch {
      throw new Error(
        mascararErros
          ? 'Expressão regular inválida no conjunto reservado.'
          : `Regex inválida no caso ${casoId} (${campo}): /${padrao}/i`
      );
    }
    if (!temPlaceholder) {
      cacheRegex.set(padrao, re);
    }
  }
}

function validarEsperaCaso(espera, cacheRegex, mascararErros, casoId) {
  if (!espera || typeof espera !== 'object') return;
  validarListaRegex(espera.resposta_contem, cacheRegex, mascararErros, casoId, 'resposta_contem');
  validarListaRegex(
    espera.resposta_contem_algum,
    cacheRegex,
    mascararErros,
    casoId,
    'resposta_contem_algum'
  );
  validarListaRegex(
    espera.resposta_nao_contem,
    cacheRegex,
    mascararErros,
    casoId,
    'resposta_nao_contem'
  );
  if (espera.valores_tolerados !== undefined) {
    if (!Array.isArray(espera.valores_tolerados)) {
      throw new Error(
        mascararErros
          ? 'Configuração de valores tolerados inválida no conjunto reservado.'
          : `Caso ${casoId}: "valores_tolerados" deve ser um array`
      );
    }
    for (const vt of espera.valores_tolerados) {
      if (parseValorToleradoCentavos(vt) === null) {
        throw new Error(
          mascararErros
            ? 'Valor tolerado inválido no conjunto reservado.'
            : `Caso ${casoId}: valor inválido em "valores_tolerados": ${vt}`
        );
      }
    }
  }
}

function validarECompilarCaso(caso, cacheRegex, mascararErros) {
  for (const turno of caso.turnos) {
    if (Array.isArray(turno.paralelo)) {
      for (const sub of turno.paralelo) {
        validarEsperaCaso(sub?.espera, cacheRegex, mascararErros, caso.id);
      }
      if (turno.espera_conjunto && typeof turno.espera_conjunto === 'object') {
        validarListaRegex(
          turno.espera_conjunto.todos_contem,
          cacheRegex,
          mascararErros,
          caso.id,
          'todos_contem'
        );
        validarListaRegex(
          turno.espera_conjunto.pelo_menos_um_contem,
          cacheRegex,
          mascararErros,
          caso.id,
          'pelo_menos_um_contem'
        );
        validarListaRegex(
          turno.espera_conjunto.exatamente_um_contem,
          cacheRegex,
          mascararErros,
          caso.id,
          'exatamente_um_contem'
        );
        validarListaRegex(
          turno.espera_conjunto.nenhum_contem,
          cacheRegex,
          mascararErros,
          caso.id,
          'nenhum_contem'
        );
      }
    } else {
      validarEsperaCaso(turno?.espera, cacheRegex, mascararErros, caso.id);
    }
  }
}

function carregarCasos(baseDir, blocosFiltro, mascararErros = false) {
  if (!fs.existsSync(baseDir)) {
    throw new Error(
      mascararErros
        ? 'Diretório do conjunto não encontrado.'
        : `Diretório do conjunto não encontrado: ${baseDir}`
    );
  }

  const entradas = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const blocosSelecionados =
    blocosFiltro.length > 0
      ? entradas.filter((b) => blocosFiltro.includes(b))
      : entradas;

  if (blocosFiltro.length > 0) {
    for (const req of blocosFiltro) {
      if (!entradas.includes(req)) {
        throw new Error(`Bloco não encontrado: ${req}`);
      }
    }
  }

  const porBloco = new Map();
  const idsVistos = new Set();

  for (const bloco of blocosSelecionados) {
    const dirBloco = path.join(baseDir, bloco);
    const arquivos = fs
      .readdirSync(dirBloco, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.json'))
      .map((f) => f.name)
      .sort();

    const lista = [];
    for (const arq of arquivos) {
      const caminho = path.join(dirBloco, arq);
      let caso;
      try {
        caso = JSON.parse(fs.readFileSync(caminho, 'utf8'));
      } catch {
        throw new Error(
          mascararErros
            ? `JSON inválido no bloco ${bloco}`
            : `JSON inválido em ${caminho}`
        );
      }
      if (!caso.id || typeof caso.id !== 'string') {
        throw new Error(
          mascararErros
            ? `Caso sem id no bloco ${bloco}`
            : `Caso sem campo "id" válido em ${caminho}`
        );
      }
      if (idsVistos.has(caso.id)) {
        throw new Error(
          mascararErros
            ? `ID duplicado no bloco ${bloco}`
            : `ID de caso duplicado: ${caso.id}`
        );
      }
      idsVistos.add(caso.id);
      if (caso.bloco !== undefined && caso.bloco !== bloco) {
        throw new Error(
          mascararErros
            ? `Campo "bloco" incompatível com a pasta ${bloco}`
            : `Caso ${caso.id}: campo "bloco" ("${caso.bloco}") difere da pasta ("${bloco}")`
        );
      }
      if (caso.confirma !== undefined && typeof caso.confirma !== 'boolean') {
        throw new Error(
          mascararErros
            ? `Campo "confirma" inválido no bloco ${bloco}`
            : `Caso ${caso.id}: campo "confirma" deve ser booleano`
        );
      }
      if (caso.leads_esperados !== undefined && !Array.isArray(caso.leads_esperados)) {
        throw new Error(
          mascararErros
            ? `Campo "leads_esperados" inválido no bloco ${bloco}`
            : `Caso ${caso.id}: campo "leads_esperados" deve ser um array`
        );
      }
      if (!Array.isArray(caso.turnos) || caso.turnos.length === 0) {
        throw new Error(
          mascararErros
            ? `Caso sem turnos no bloco ${bloco}`
            : `Caso ${caso.id} precisa de "turnos" não vazio`
        );
      }
      const cacheRegex = new Map();
      validarECompilarCaso(caso, cacheRegex, mascararErros);
      lista.push({ ...caso, bloco, _cacheRegex: cacheRegex });
    }
    porBloco.set(bloco, lista);
  }

  return porBloco;
}

function executarListar(args, porBloco) {
  if (args.conjunto === 'reservado') {
    let total = 0;
    for (const [bloco, casos] of porBloco.entries()) {
      console.log(`BLOCO ${bloco}: ${casos.length} caso(s)`);
      total += casos.length;
    }
    if (total === 0) {
      console.error('RESERVADO VAZIO');
      process.exit(1);
    }
    process.exit(0);
  }

  for (const [bloco, casos] of porBloco.entries()) {
    console.log(`BLOCO ${bloco}: ${casos.length} caso(s)`);
    if (!args.soAgregado) {
      for (const c of casos) {
        const tag = c.confirma ? ' [confirma]' : '';
        console.log(`  - ${c.id}${tag}`);
      }
    }
  }

  const faltando = [];
  for (const obrigatorio of BLOCOS_OBRIGATORIOS) {
    const qtd = porBloco.get(obrigatorio)?.length ?? 0;
    if (qtd < 6) {
      faltando.push(`${obrigatorio} (${qtd}/6)`);
    }
  }

  if (faltando.length === 0) {
    console.log('CASOS OK');
    process.exit(0);
  } else {
    console.log(`CASOS INCOMPLETOS: ${faltando.join(', ')}`);
    process.exit(1);
  }
}

async function consultarSaude(alvo) {
  try {
    const res = await fetch(`${alvo}/saude`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, ambiente: 'desconhecido' };
    }
    const dados = await res.json();
    const ambiente =
      dados && typeof dados.ambiente === 'string' && dados.ambiente.trim()
        ? dados.ambiente.trim()
        : 'desconhecido';
    return { ok: true, ambiente };
  } catch {
    return { ok: false, ambiente: 'desconhecido' };
  }
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function gerarIdentidadeUnica(indice, telefonesUsados) {
  const nome =
    `${NOMES_PRIMEIROS[indice % NOMES_PRIMEIROS.length]} ` +
    `${NOMES_MEIO[Math.floor(indice / 10) % NOMES_MEIO.length]} ` +
    `${NOMES_ULTIMOS[Math.floor(indice / 100) % NOMES_ULTIMOS.length]}`;

  let digitos;
  do {
    const sufixo = String(crypto.randomInt(10_000_000, 99_999_999));
    digitos = `119${sufixo}`;
  } while (telefonesUsados.has(digitos));
  telefonesUsados.add(digitos);

  const telefoneFormatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  const telefoneE164 = `+55${digitos}`;

  let estrDigitos;
  do {
    estrDigitos = `1415${crypto.randomInt(1_000_000, 9_999_999)}`;
  } while (telefonesUsados.has(estrDigitos));
  telefonesUsados.add(estrDigitos);

  return {
    nome,
    primeiroNome: NOMES_PRIMEIROS[indice % NOMES_PRIMEIROS.length],
    telefone: telefoneFormatado,
    telefoneDigitos: digitos,
    telefoneE164,
    telefoneEstrangeiro: `+${estrDigitos}`,
    telefoneEstrangeiroDigitos: estrDigitos,
    hojeMs: obterHojeSaoPauloMs(),
  };
}

function substituirTexto(texto, ctx, sessionId, paraRegex = false) {
  if (typeof texto !== 'string') return texto;
  const mapa = {
    '{{nome}}': ctx.nome,
    '{{primeiro_nome}}': ctx.primeiroNome || ctx.nome.split(' ')[0],
    '{{telefone}}': ctx.telefone,
    '{{telefone_digitos}}': ctx.telefoneDigitos,
    '{{telefone_e164}}': ctx.telefoneE164,
    '{{telefone_estrangeiro}}': ctx.telefoneEstrangeiro,
    '{{session_id}}': sessionId,
  };
  let out = texto;
  for (const [chave, val] of Object.entries(mapa)) {
    if (out.includes(chave)) {
      out = out.split(chave).join(paraRegex ? escaparRegex(val) : val);
    }
  }
  if (out.includes('{{')) {
    out = out.replace(/\{\{([a-z0-9_]+)\}\}/g, (match, chave) => {
      const dataResolvida = resolverPlaceholderData(chave, ctx.hojeMs);
      if (dataResolvida === null) return match;
      return paraRegex ? escaparRegex(dataResolvida) : dataResolvida;
    });
  }
  return out;
}

function substituirValor(valor, ctx, sessionId) {
  if (typeof valor === 'string') return substituirTexto(valor, ctx, sessionId, false);
  if (Array.isArray(valor)) return valor.map((v) => substituirValor(v, ctx, sessionId));
  if (valor && typeof valor === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(valor)) {
      res[k] = substituirValor(v, ctx, sessionId);
    }
    return res;
  }
  return valor;
}

function normalizarTelefoneComparacao(tel) {
  const digitos = String(tel ?? '').replace(/\D/g, '');
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return digitos.slice(2);
  }
  return digitos;
}

async function buscarLeadsPorTelefones(leadsUrl, conjuntoDigitos) {
  let res;
  try {
    res = await fetch(leadsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('Falha de rede ao consultar GET no webhook falso');
  }
  if (!res.ok) {
    throw new Error(`Webhook falso devolveu HTTP ${res.status} no GET`);
  }
  const dados = await res.json();
  if (!dados || !Array.isArray(dados.leads)) {
    throw new Error('Resposta do webhook falso sem array "leads"');
  }
  return dados.leads.filter((lead) =>
    conjuntoDigitos.has(normalizarTelefoneComparacao(lead?.telefone))
  );
}

function derivarUrlModos(leadsUrl) {
  if (!leadsUrl || !leadsUrl.includes('/leads/')) {
    throw new Error('LEADS_URL_DEV inválida para derivar rota /modos/');
  }
  return leadsUrl.replace('/leads/', '/modos/');
}

async function ligarModoWebhook(leadsUrl, telefoneDigitos, cfg) {
  if (!telefoneDigitos) {
    throw new Error('Telefone obrigatório para ligar modo do webhook');
  }
  const modosUrl = derivarUrlModos(leadsUrl);
  const corpo = {
    modo: cfg.modo,
    telefone: telefoneDigitos,
    validade_s: cfg.validade_s ?? 60,
  };
  if (cfg.atraso_ms !== undefined) {
    corpo.atraso_ms = cfg.atraso_ms;
  }

  let res;
  try {
    res = await fetch(modosUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Falha de rede ao ligar modo do webhook falso');
  }
  if (!res.ok) {
    throw new Error(`Webhook falso devolveu HTTP ${res.status} ao ligar modo`);
  }
}

async function desligarModoWebhook(leadsUrl, telefoneDigitos) {
  if (!telefoneDigitos || !leadsUrl) return;
  const modosUrl = derivarUrlModos(leadsUrl);
  const url = `${modosUrl}?telefone=${encodeURIComponent(telefoneDigitos)}`;
  try {
    await fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Melhor esforço na limpeza; validade_s garante expiração
  }
}

function verificarLeadsEsperados(recebidos, esperadosRaw, ctx) {
  const erros = [];
  let violacaoLead = false;
  const esperados = substituirValor(esperadosRaw, ctx, '');

  if (recebidos.length !== esperados.length) {
    erros.push(`Leads recebidos: ${recebidos.length}, esperado: ${esperados.length}`);
    if (recebidos.length > esperados.length) {
      violacaoLead = true;
    }
    return { erros, violacaoLead };
  }

  const usados = new Set();
  for (let idx = 0; idx < esperados.length; idx++) {
    const exp = esperados[idx];
    const matchIdx = recebidos.findIndex((rec, rIdx) => {
      if (usados.has(rIdx)) return false;
      const mesmoImovel =
        String(rec.imovel_id || '').toUpperCase() === String(exp.imovel_id || '').toUpperCase();
      const mesmoCheckin = rec.checkin === exp.checkin;
      const mesmoCheckout = rec.checkout === exp.checkout;
      return mesmoImovel && mesmoCheckin && mesmoCheckout;
    });

    if (matchIdx === -1) {
      erros.push(
        `Lead esperado #${idx + 1} (${exp.imovel_id} ${exp.checkin}..${exp.checkout}) não encontrado`
      );
      continue;
    }

    usados.add(matchIdx);
    const rec = recebidos[matchIdx];

    const nomeExp = exp.nome !== undefined ? String(exp.nome) : ctx.nome;
    if (typeof rec.nome !== 'string' || rec.nome.trim().length === 0) {
      erros.push(`Lead #${idx + 1}: campo "nome" ausente ou vazio`);
    } else if (rec.nome.trim().toLowerCase() !== nomeExp.trim().toLowerCase()) {
      erros.push(`Lead #${idx + 1}: "nome" diferente do esperado`);
    }

    if (typeof rec.telefone !== 'string' || rec.telefone.trim().length === 0) {
      erros.push(`Lead #${idx + 1}: campo "telefone" ausente ou vazio`);
    } else if (exp.formato_telefone === 'estrangeiro') {
      if (!/^\+\d{8,15}$/.test(rec.telefone)) {
        erros.push(`Lead #${idx + 1}: telefone estrangeiro fora do formato +digitos`);
      }
    } else if (!/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(rec.telefone)) {
      erros.push(`Lead #${idx + 1}: telefone fora do formato (DD) NNNNN-NNNN`);
    }

    if (Number(rec.hospedes) !== Number(exp.hospedes)) {
      erros.push(
        `Lead #${idx + 1}: hospedes=${rec.hospedes}, esperado=${exp.hospedes}`
      );
    }

    const brutoVal = rec.valor_total;
    const numVal =
      brutoVal === null || brutoVal === '' || typeof brutoVal === 'boolean'
        ? NaN
        : Number(brutoVal);
    const vezesCem = numVal * 100;
    const valorRecCent = Math.round(vezesCem);
    const valorExpCent = Math.round(Number(exp.valor_total) * 100);
    if (
      !Number.isFinite(numVal) ||
      Math.abs(vezesCem - valorRecCent) > 1e-6 ||
      valorRecCent !== valorExpCent
    ) {
      erros.push(
        `Lead #${idx + 1}: valor_total=${rec.valor_total}, esperado=${exp.valor_total}`
      );
    }
  }

  return { erros, violacaoLead };
}

async function enviarChat(alvo, corpoTexto, timeoutMs) {
  const inicio = performance.now();
  let res;
  let textoCorpo = '';
  try {
    res = await fetch(`${alvo}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpoTexto,
      signal: AbortSignal.timeout(timeoutMs),
    });
    textoCorpo = await res.text();
  } catch (err) {
    const latenciaMs = performance.now() - inicio;
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      okRede: false,
      erroRede: timeout ? `Timeout (> ${timeoutMs}ms) em POST /chat` : 'Erro de rede em POST /chat',
      latenciaMs,
      status: 0,
      usoEntrada: 0,
      usoSaida: 0,
      chamadasModelo: 0,
      dados: null,
    };
  }

  const latenciaMs = performance.now() - inicio;
  const numHeader = (nome) => {
    const v = Number(res.headers.get(nome));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  let dados = null;
  let erroJson = false;
  try {
    dados = JSON.parse(textoCorpo);
  } catch {
    erroJson = true;
  }

  return {
    okRede: true,
    erroRede: null,
    latenciaMs,
    status: res.status,
    usoEntrada: numHeader('x-uso-entrada'),
    usoSaida: numHeader('x-uso-saida'),
    chamadasModelo: numHeader('x-chamadas-modelo'),
    dados,
    erroJson,
  };
}

function obterRegex(padrao, ctx, sessionId, cacheRegex) {
  if (cacheRegex && cacheRegex.has(padrao)) {
    return { ok: true, re: cacheRegex.get(padrao) };
  }
  const expr = substituirTexto(padrao, ctx, sessionId, true);
  try {
    return { ok: true, re: new RegExp(expr, 'i') };
  } catch {
    return { ok: false };
  }
}

function erroRegexEmExecucao(rotuloTurno, padrao, mascararErros) {
  if (mascararErros) {
    return `${rotuloTurno}: regex inválida em execução`;
  }
  return `${rotuloTurno}: regex inválida em execução após substituição: /${padrao}/i`;
}

function avaliarRespostaTurno(
  resp,
  espera,
  ctx,
  sessionId,
  rotuloTurno,
  cacheRegex,
  mascararErros = false
) {
  const falhas = [];
  if (!resp.okRede) {
    falhas.push(`${rotuloTurno}: ${resp.erroRede}`);
    return falhas;
  }

  if (resp.latenciaMs >= 60_000) {
    falhas.push(`${rotuloTurno}: latência ${Math.round(resp.latenciaMs)}ms >= 60000ms`);
  }

  const statusEsperado = espera?.status ?? 200;
  if (resp.status !== statusEsperado) {
    falhas.push(`${rotuloTurno}: HTTP ${resp.status}, esperado ${statusEsperado}`);
  }

  if (resp.erroJson || !resp.dados || typeof resp.dados !== 'object') {
    falhas.push(`${rotuloTurno}: resposta não é JSON válido`);
    return falhas;
  }

  const { reply, handoff } = resp.dados;
  if (typeof reply !== 'string' || reply.trim().length === 0) {
    falhas.push(`${rotuloTurno}: campo "reply" ausente ou vazio`);
    return falhas;
  }
  if (typeof handoff !== 'boolean') {
    falhas.push(`${rotuloTurno}: campo "handoff" não é booleano`);
  }

  const checarFormatoMoeda = (espera?.formato_total_estrito ?? true) && statusEsperado === 200;
  if (checarFormatoMoeda) {
    const errosMoeda = verificarFormatoMoeda(reply);
    for (const em of errosMoeda) {
      falhas.push(`${rotuloTurno}: ${em}`);
    }
  }

  if (!espera) return falhas;

  if (espera.handoff !== undefined && handoff !== espera.handoff) {
    falhas.push(`${rotuloTurno}: handoff=${handoff}, esperado=${espera.handoff}`);
  }

  const valoresTolerados = Array.isArray(espera.valores_tolerados)
    ? espera.valores_tolerados
    : [];

  if (espera.sem_total === true || (espera.sem_total && typeof espera.sem_total === 'object')) {
    const imovelSemTotal =
      typeof espera.sem_total === 'object'
        ? espera.sem_total.imovel_id
        : espera.imovel_id ?? null;
    const errosSemTotal = julgarSemTotal(reply, imovelSemTotal, valoresTolerados);
    for (const est of errosSemTotal) {
      falhas.push(`${rotuloTurno}: ${est}`);
    }
  }

  if (espera.estadia) {
    const estadiaResolvida = substituirValor(espera.estadia, ctx, sessionId);
    const errosPreco = julgarPrecoResposta(reply, estadiaResolvida, {
      valoresTolerados,
    });
    for (const ep of errosPreco) {
      falhas.push(`${rotuloTurno}: ${ep}`);
    }
  }

  if (Array.isArray(espera.resposta_contem)) {
    for (const padrao of espera.resposta_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (!resRe.re.test(reply)) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: resposta não casou regex obrigatório`
            : `${rotuloTurno}: resposta não casou regex obrigatório /${padrao}/i`
        );
      }
    }
  }

  if (Array.isArray(espera.resposta_contem_algum) && espera.resposta_contem_algum.length > 0) {
    let algumCasou = false;
    let teveErroRegex = false;
    for (const padrao of espera.resposta_contem_algum) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        teveErroRegex = true;
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (resRe.re.test(reply)) {
        algumCasou = true;
      }
    }
    if (!algumCasou && !teveErroRegex) {
      falhas.push(
        mascararErros
          ? `${rotuloTurno}: resposta não casou nenhum padrão esperado`
          : `${rotuloTurno}: resposta não casou nenhum dos padrões [${espera.resposta_contem_algum.join(' | ')}]`
      );
    }
  }

  if (Array.isArray(espera.resposta_nao_contem)) {
    for (const padrao of espera.resposta_nao_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (resRe.re.test(reply)) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: resposta casou regex proibido`
            : `${rotuloTurno}: resposta casou regex proibido /${padrao}/i`
        );
      }
    }
  }

  return falhas;
}

function avaliarConjuntoParalelo(
  respostas,
  esperaConjunto,
  ctx,
  sessionId,
  rotuloTurno,
  cacheRegex,
  mascararErros = false
) {
  const falhas = [];
  if (!esperaConjunto) return falhas;

  const textos = respostas.map((r) => (typeof r?.dados?.reply === 'string' ? r.dados.reply : ''));

  if (Array.isArray(esperaConjunto.todos_contem)) {
    for (const padrao of esperaConjunto.todos_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (!textos.every((t) => resRe.re.test(t))) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: nem todas as respostas paralelas casaram regex obrigatório`
            : `${rotuloTurno}: nem todas as respostas paralelas casaram /${padrao}/i`
        );
      }
    }
  }

  if (Array.isArray(esperaConjunto.pelo_menos_um_contem)) {
    for (const padrao of esperaConjunto.pelo_menos_um_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (!textos.some((t) => resRe.re.test(t))) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: nenhuma resposta paralela casou regex obrigatório`
            : `${rotuloTurno}: nenhuma resposta paralela casou /${padrao}/i`
        );
      }
    }
  }

  if (Array.isArray(esperaConjunto.exatamente_um_contem)) {
    for (const padrao of esperaConjunto.exatamente_um_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      const qtd = textos.filter((t) => resRe.re.test(t)).length;
      if (qtd !== 1) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: esperado exatamente 1 resposta paralela, obtido ${qtd}`
            : `${rotuloTurno}: esperado exatamente 1 resposta casando /${padrao}/i, obtido ${qtd}`
        );
      }
    }
  }

  if (Array.isArray(esperaConjunto.nenhum_contem)) {
    for (const padrao of esperaConjunto.nenhum_contem) {
      const resRe = obterRegex(padrao, ctx, sessionId, cacheRegex);
      if (!resRe.ok) {
        falhas.push(erroRegexEmExecucao(rotuloTurno, padrao, mascararErros));
        continue;
      }
      if (textos.some((t) => resRe.re.test(t))) {
        falhas.push(
          mascararErros
            ? `${rotuloTurno}: alguma resposta paralela casou regex proibido`
            : `${rotuloTurno}: alguma resposta paralela casou regex proibido /${padrao}/i`
        );
      }
    }
  }

  return falhas;
}

async function aguardarMs(ms) {
  const alvo = performance.now() + ms;
  while (true) {
    const restante = alvo - performance.now();
    if (restante <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(restante)));
  }
}

async function executarCaso({ caso, indice, args, ehDev, leadsUrlDev, runId, telefonesUsados }) {
  const ctx = gerarIdentidadeUnica(indice, telefonesUsados);
  const segredosMascara = [
    { valor: ctx.nome, rotulo: '[nome]' },
    { valor: ctx.telefone, rotulo: '[telefone]' },
    { valor: ctx.telefoneDigitos, rotulo: '[telefone]' },
    { valor: ctx.telefoneE164, rotulo: '[telefone]' },
    { valor: ctx.telefoneEstrangeiro, rotulo: '[telefone]' },
    { valor: ctx.telefoneEstrangeiroDigitos, rotulo: '[telefone]' },
  ];
  const conjuntoDigitos = new Set([
    normalizarTelefoneComparacao(ctx.telefoneDigitos),
    normalizarTelefoneComparacao(ctx.telefoneEstrangeiroDigitos),
  ]);

  const sessaoBase = `eval-${runId}-${indice}-${crypto.randomUUID().slice(0, 6)}`;
  const obterSessionId = (chave = 'principal') =>
    chave === 'principal' ? sessaoBase : `${sessaoBase}-${chave}`;

  const falhas = [];
  const latenciasMs = [];
  let usoEntrada = 0;
  let usoSaida = 0;
  let chamadasModelo = 0;
  let violacaoLead = false;

  const prepararCorpo = (turno, sessionId) => {
    if (typeof turno.corpo_bruto === 'string') {
      return substituirTexto(turno.corpo_bruto, ctx, sessionId, false);
    }
    if (turno.payload && typeof turno.payload === 'object') {
      return JSON.stringify(substituirValor(turno.payload, ctx, sessionId));
    }
    return JSON.stringify({
      session_id: sessionId,
      message: substituirTexto(turno.mensagem ?? '', ctx, sessionId, false),
    });
  };

  let modoLigado = false;
  const modoCaso =
    caso.webhook_modo && typeof caso.webhook_modo === 'object' ? caso.webhook_modo : null;
  const turnoAlvoCaso =
    modoCaso && Number.isInteger(modoCaso.antes_do_turno)
      ? modoCaso.antes_do_turno
      : caso.turnos.length;

  try {
    for (let i = 0; i < caso.turnos.length; i++) {
      const turno = caso.turnos[i];
      const numTurno = i + 1;

      const cfgModo =
        (turno.webhook_modo && typeof turno.webhook_modo === 'object' ? turno.webhook_modo : null) ||
        (modoCaso && numTurno === turnoAlvoCaso ? modoCaso : null);

      if (cfgModo && ehDev && leadsUrlDev) {
        try {
          await ligarModoWebhook(leadsUrlDev, ctx.telefoneDigitos, cfgModo);
          modoLigado = true;
        } catch (err) {
          falhas.push(`turno ${numTurno}: ${err.message}`);
          break;
        }
      }

      if (args.pausaMs > 0) {
        await aguardarMs(args.pausaMs);
      }

      if (Array.isArray(turno.paralelo)) {
        const reqs = turno.paralelo.map((sub, j) => {
          const sid = obterSessionId(sub.sessao || 'principal');
          const corpo = prepararCorpo(sub, sid);
          return enviarChat(args.alvo, corpo, args.timeoutMs).then((resp) => ({
            resp,
            sub,
            sid,
            rotulo: `turno ${numTurno}.${j + 1}`,
          }));
        });

        const resultados = await Promise.all(reqs);
        for (const item of resultados) {
          latenciasMs.push(item.resp.latenciaMs);
          usoEntrada += item.resp.usoEntrada;
          usoSaida += item.resp.usoSaida;
          chamadasModelo += item.resp.chamadasModelo;
          falhas.push(
            ...avaliarRespostaTurno(
              item.resp,
              item.sub.espera,
              ctx,
              item.sid,
              item.rotulo,
              caso._cacheRegex,
              Boolean(args.soAgregado)
            )
          );
        }
        falhas.push(
          ...avaliarConjuntoParalelo(
            resultados.map((r) => r.resp),
            turno.espera_conjunto,
            ctx,
            sessaoBase,
            `turno ${numTurno}`,
            caso._cacheRegex,
            Boolean(args.soAgregado)
          )
        );
      } else {
        const sid = obterSessionId(turno.sessao || 'principal');
        const corpo = prepararCorpo(turno, sid);
        const resp = await enviarChat(args.alvo, corpo, args.timeoutMs);

        latenciasMs.push(resp.latenciaMs);
        usoEntrada += resp.usoEntrada;
        usoSaida += resp.usoSaida;
        chamadasModelo += resp.chamadasModelo;
        falhas.push(
          ...avaliarRespostaTurno(
            resp,
            turno.espera,
            ctx,
            sid,
            `turno ${numTurno}`,
            caso._cacheRegex,
            Boolean(args.soAgregado)
          )
        );

        if (turno.espera?.leads_ate_agora !== undefined && ehDev && leadsUrlDev) {
          try {
            const leadsAgora = await buscarLeadsPorTelefones(leadsUrlDev, conjuntoDigitos);
            if (leadsAgora.length !== turno.espera.leads_ate_agora) {
              falhas.push(
                `turno ${numTurno}: leads_ate_agora=${leadsAgora.length}, esperado=${turno.espera.leads_ate_agora}`
              );
              if (leadsAgora.length > turno.espera.leads_ate_agora) {
                violacaoLead = true;
              }
            }
          } catch (err) {
            falhas.push(`turno ${numTurno}: ${err.message}`);
          }
        }
      }
    }

    if (Array.isArray(caso.leads_esperados) && ehDev && leadsUrlDev) {
      try {
        const recebidos = await buscarLeadsPorTelefones(leadsUrlDev, conjuntoDigitos);
        const check = verificarLeadsEsperados(recebidos, caso.leads_esperados, ctx);
        falhas.push(...check.erros);
        if (check.violacaoLead) violacaoLead = true;
      } catch (err) {
        falhas.push(err.message);
      }
    }
  } finally {
    if (modoLigado && ehDev && leadsUrlDev) {
      await desligarModoWebhook(leadsUrlDev, ctx.telefoneDigitos);
    }
  }

  const falhasMascaradas = falhas.map((f) => mascararDadosPessoais(f, segredosMascara));
  const latenciaTotalMs = Math.round(latenciasMs.reduce((a, b) => a + b, 0));

  return {
    id: caso.id,
    bloco: caso.bloco,
    pulado: false,
    passou: falhasMascaradas.length === 0,
    falhas: falhasMascaradas,
    latenciasMs,
    latenciaTotalMs,
    usoEntrada,
    usoSaida,
    chamadasModelo,
    violacaoLead,
  };
}

async function rodarComParalelismo(itens, limite, workerFn) {
  const resultados = new Array(itens.length);
  let proximo = 0;

  async function trabalhador() {
    while (true) {
      const idx = proximo++;
      if (idx >= itens.length) return;
      resultados[idx] = await workerFn(itens[idx], idx);
    }
  }

  const nWorkers = Math.min(limite, Math.max(1, itens.length));
  await Promise.all(Array.from({ length: nWorkers }, () => trabalhador()));
  return resultados;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Erro: ${err.message}`);
    usoCli();
    process.exit(1);
  }

  const dirConjunto = resolverDiretorioConjunto(args.conjunto);
  let porBloco;
  try {
    porBloco = carregarCasos(dirConjunto, args.blocos, args.conjunto === 'reservado');
  } catch (err) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }

  if (args.listar) {
    executarListar(args, porBloco);
    return;
  }

  const saude = await consultarSaude(args.alvo);
  const ehDev = saude.ambiente === 'dev';
  const leadsUrlDev = process.env.LEADS_URL_DEV?.trim() || '';

  const todosCasos = [];
  for (const [, lista] of porBloco.entries()) {
    todosCasos.push(...lista);
  }

  const temWebhookModo = (caso) =>
    Boolean(caso.webhook_modo) ||
    (Array.isArray(caso.turnos) && caso.turnos.some((t) => Boolean(t.webhook_modo)));

  const temLeadsAteAgora = (caso) =>
    Array.isArray(caso.turnos) &&
    caso.turnos.some(
      (t) =>
        t?.espera?.leads_ate_agora !== undefined ||
        (Array.isArray(t?.paralelo) &&
          t.paralelo.some((s) => s?.espera?.leads_ate_agora !== undefined))
    );

  const requerDev = (caso) =>
    caso.confirma === true ||
    temWebhookModo(caso) ||
    Array.isArray(caso.leads_esperados) ||
    temLeadsAteAgora(caso);

  const casosElegiveis = [];
  const resultadosPulados = [];
  let puladosNaoDev = 0;
  let puladosSemLeadsUrl = 0;

  for (const caso of todosCasos) {
    const precisaDev = requerDev(caso);
    if (!ehDev && precisaDev) {
      puladosNaoDev++;
      resultadosPulados.push({
        id: caso.id,
        bloco: caso.bloco,
        pulado: true,
        motivoPulo: 'trava confirma fora de dev',
        passou: false,
        falhas: ['pulado pela trava não-dev'],
        latenciasMs: [],
        latenciaTotalMs: 0,
        usoEntrada: 0,
        usoSaida: 0,
        chamadasModelo: 0,
        violacaoLead: false,
      });
    } else if (ehDev && precisaDev && !leadsUrlDev) {
      puladosSemLeadsUrl++;
      resultadosPulados.push({
        id: caso.id,
        bloco: caso.bloco,
        pulado: true,
        motivoPulo: 'LEADS_URL_DEV ausente',
        passou: false,
        falhas: ['pulado: LEADS_URL_DEV ausente'],
        latenciasMs: [],
        latenciaTotalMs: 0,
        usoEntrada: 0,
        usoSaida: 0,
        chamadasModelo: 0,
        violacaoLead: false,
      });
    } else {
      casosElegiveis.push(caso);
    }
  }

  const puladosTrava = resultadosPulados.length;
  if (puladosNaoDev > 0) {
    console.warn(
      `TRAVA: alvo não é dev (ambiente=${saude.ambiente}); ${puladosNaoDev} caso(s) com confirmação recusado(s).`
    );
  }
  if (puladosSemLeadsUrl > 0) {
    console.warn(
      `TRAVA: LEADS_URL_DEV ausente em dev; ${puladosSemLeadsUrl} caso(s) com conferência de leads pulado(s).`
    );
  }

  const sufixoPausa = args.pausaMs > 0 ? ` (pausa_ms=${args.pausaMs})` : '';

  if (casosElegiveis.length === 0) {
    for (const [bloco] of porBloco.entries()) {
      const pul = resultadosPulados.filter((r) => r.bloco === bloco).length;
      if (pul > 0) {
        console.log(`BLOCO ${bloco}: PULADO (${pul} pulado(s) pela trava)`);
      }
    }
    console.error(
      `TRAVA: nenhum caso elegível para executar (ambiente=${saude.ambiente}, pulados=${puladosTrava}).`
    );
    console.log(
      (args.conjunto === 'reservado' ? 'RESERVADO PARCIAL' : 'EVAL PARCIAL') + sufixoPausa
    );
    process.exit(2);
  }

  const runId = crypto.randomUUID().slice(0, 8);
  const telefonesUsados = new Set();

  const resultadosExec = await rodarComParalelismo(
    casosElegiveis,
    args.paralelo,
    (caso, idx) =>
      executarCaso({
        caso,
        indice: idx,
        args,
        ehDev,
        leadsUrlDev,
        runId,
        telefonesUsados,
      })
  );

  const resultadosTodos = [...resultadosExec, ...resultadosPulados];

  if (!args.soAgregado) {
    for (const r of resultadosExec) {
      if (r.passou) {
        console.log(
          `[PASSOU] ${r.bloco}/${r.id} (${r.latenciasMs.length} turno(s), ${r.latenciaTotalMs}ms)`
        );
      } else {
        console.log(`[FALHOU] ${r.bloco}/${r.id} — ${r.falhas.join(' | ')}`);
      }
    }
    for (const r of resultadosPulados) {
      console.log(`[PULADO] ${r.bloco}/${r.id} — ${r.motivoPulo || 'trava'}`);
    }
  }

  const blocosResumo = {};
  const motivosReprovacao = [];
  let violacoesLead = 0;

  for (const [bloco] of porBloco.entries()) {
    const doBloco = resultadosTodos.filter((r) => r.bloco === bloco);
    const exec = doBloco.filter((r) => !r.pulado);
    const aprov = exec.filter((r) => r.passou).length;
    const pul = doBloco.filter((r) => r.pulado).length;
    violacoesLead += exec.filter((r) => r.violacaoLead).length;

    const taxaPct = exec.length > 0 ? Math.floor((aprov * 100) / exec.length) : null;
    blocosResumo[bloco] = {
      total: doBloco.length,
      executados: exec.length,
      aprovados: aprov,
      pulados: pul,
      taxa_pct: taxaPct,
    };

    if (exec.length === 0) {
      console.log(`BLOCO ${bloco}: PULADO (${pul} pulado(s) pela trava)`);
    } else {
      const sufixoPulado = pul > 0 ? ` (${pul} pulado(s) pela trava)` : '';
      console.log(`BLOCO ${bloco}: ${taxaPct}%${sufixoPulado}`);
      if (args.conjunto === 'dev' && aprov / exec.length < 0.95) {
        motivosReprovacao.push(`bloco ${bloco} abaixo de 95% (${aprov}/${exec.length})`);
      }
    }
  }

  const totalExec = resultadosExec.length;
  const totalAprov = resultadosExec.filter((r) => r.passou).length;
  const agregadoPct = totalExec > 0 ? Math.floor((totalAprov * 100) / totalExec) : 0;

  if (args.conjunto === 'reservado' && (totalExec === 0 || totalAprov / totalExec < 0.9)) {
    motivosReprovacao.push(`agregado reservado abaixo de 90% (${totalAprov}/${totalExec})`);
  }
  if (violacoesLead > 0) {
    motivosReprovacao.push(`violações de lead (antecipado ou duplicado): ${violacoesLead}`);
  }

  const relatorio = montarResumoRelatorio({
    conjunto: args.conjunto,
    ambiente: saude.ambiente,
    resultadosCasos: resultadosTodos,
    blocosResumo,
    aprovado: false,
    veredicto: 'REPROVADO',
    motivosReprovacao,
    puladosTrava,
    soAgregado: args.soAgregado,
    pausaMs: args.pausaMs,
  });

  if (relatorio.latencia_ms.max >= 60_000) {
    motivosReprovacao.push(`latência máxima ${relatorio.latencia_ms.max}ms >= 60000ms`);
  }
  if (relatorio.latencia_ms.p95 > 20_000) {
    motivosReprovacao.push(`latência p95 ${relatorio.latencia_ms.p95}ms > 20000ms`);
  }

  const limiaresOk = motivosReprovacao.length === 0 && totalExec > 0;
  const parcial = limiaresOk && puladosTrava > 0;
  const aprovado = limiaresOk && puladosTrava === 0;
  const veredicto = aprovado ? 'OK' : parcial ? 'PARCIAL' : 'REPROVADO';

  relatorio.aprovado = aprovado;
  relatorio.veredicto = veredicto;
  relatorio.motivos_reprovacao = motivosReprovacao;

  if (!args.semRelatorio) {
    const caminhoRel = gravarRelatorio(relatorio, args.relatorio, REPO_ROOT);
    const relRelativo = path.relative(REPO_ROOT, caminhoRel);
    console.log(
      `Relatório: ${relRelativo.startsWith('..') ? path.basename(caminhoRel) : relRelativo}`
    );
  }

  console.log(
    `Latência: p50=${relatorio.latencia_ms.p50}ms p95=${relatorio.latencia_ms.p95}ms max=${relatorio.latencia_ms.max}ms`
  );

  if (args.conjunto === 'reservado') {
    console.log(`AGREGADO RESERVADO: ${agregadoPct}%`);
    console.log(`RESERVADO ${veredicto}${sufixoPausa}`);
  } else {
    console.log(`EVAL ${veredicto}${sufixoPausa}`);
  }

  process.exit(aprovado ? 0 : parcial ? 2 : 1);
}

main().catch((err) => {
  console.error(`Erro fatal no runner: ${err?.message || 'desconhecido'}`);
  process.exit(1);
});
