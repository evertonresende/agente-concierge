#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  gerarMensagemHospede,
  MODELO_PADRAO_HOSPEDE,
  montarPromptHospede,
  validarModeloPermitido,
} from './hospede-cli.mjs';
import {
  classificarConfirmacaoHospede,
  detectarGatilhoHandoff,
  julgarFormatoETempo,
  julgarHandoff,
  julgarLeads,
  julgarPreco,
  julgarSegurancaEContrato,
  respostaContemResumo,
} from './juizes.mjs';
import { catalogoPadraoSimulador, selecionarPersonas } from './personas.mjs';
import { gravarRelatorios } from './relatorio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(__dirname, '../..');

export async function verificarSaudeAlvo(alvoBaseUrl, fetchImpl = fetch) {
  let parsed;
  try {
    parsed = new URL(alvoBaseUrl);
  } catch {
    return { ok: false, saude: null };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, saude: null };
  }

  const base = alvoBaseUrl.replace(/\/+$/, '');
  try {
    const resp = await fetchImpl(`${base}/saude`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.status !== 200) {
      return { ok: false, saude: null };
    }
    const json = await resp.json();
    if (!json || typeof json !== 'object' || json.ambiente !== 'dev') {
      return { ok: false, saude: json || null };
    }
    return { ok: true, saude: json, base };
  } catch {
    return { ok: false, saude: null };
  }
}

async function consultarLeadsWebhook(leadsUrl, fetchImpl = fetch) {
  const resp = await fetchImpl(leadsUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao consultar webhook de leads (status ${resp.status})`);
  }
  const data = await resp.json();
  return Array.isArray(data?.leads) ? data.leads : [];
}

async function enviarChat(alvoBase, sessionId, message, fetchImpl = fetch) {
  const inicio = performance.now();
  const resp = await fetchImpl(`${alvoBase}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal: AbortSignal.timeout(65_000),
  });
  const elapsedMs = Math.round(performance.now() - inicio);

  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }

  const usoEntrada = Number(resp.headers.get('x-uso-entrada') || 0);
  const usoSaida = Number(resp.headers.get('x-uso-saida') || 0);
  const chamadasModelo = Number(resp.headers.get('x-chamadas-modelo') || 0);

  return {
    status: resp.status,
    body,
    elapsedMs,
    usoEntrada: Number.isFinite(usoEntrada) ? usoEntrada : 0,
    usoSaida: Number.isFinite(usoSaida) ? usoSaida : 0,
    chamadasModelo: Number.isFinite(chamadasModelo) ? chamadasModelo : 0,
  };
}

export async function executarConversa({
  persona,
  rodada,
  alvoBase,
  leadsUrl,
  modeloHospede,
  cli,
  catalogo,
  fetchImpl = fetch,
  gerarHospedeImpl = gerarMensagemHospede,
}) {
  const sessionId = `sim-${persona.id}-${crypto.randomUUID()}`;
  const cenario = persona.criarCenario(rodada, catalogo);
  const planoTurnos = persona.turnos(cenario);

  const historico = [];
  const turnosExecutados = [];
  const falhasConversa = [];
  const latenciasMs = [];
  let usoEntrada = 0;
  let usoSaida = 0;
  let chamadasModelo = 0;
  let resumoVisto = false;

  for (let i = 0; i < planoTurnos.length; i++) {
    const passo = planoTurnos[i];
    const numeroTurno = i + 1;

    if (Array.isArray(passo.paralelo)) {
      const mensagens = [];
      for (const sub of passo.paralelo) {
        const prompt = montarPromptHospede({
          persona,
          cenario,
          historico,
          objetivoTurno: sub.objetivo,
        });
        let msg;
        try {
          msg = await gerarHospedeImpl({ cli, modelo: modeloHospede, prompt });
        } catch {
          msg = sub.fallback;
        }
        mensagens.push(msg);
      }

      const respostas = await Promise.all(
        mensagens.map((m) => enviarChat(alvoBase, sessionId, m, fetchImpl)),
      );

      const falhasTurno = [];
      for (let k = 0; k < respostas.length; k++) {
        const r = respostas[k];
        latenciasMs.push(r.elapsedMs);
        usoEntrada += r.usoEntrada;
        usoSaida += r.usoSaida;
        chamadasModelo += r.chamadasModelo;

        const jFormato = julgarFormatoETempo({
          status: r.status,
          body: r.body,
          elapsedMs: r.elapsedMs,
        });
        falhasTurno.push(...jFormato.falhas);

        if (r.body?.reply) {
          const jSeg = julgarSegurancaEContrato({ reply: r.body.reply });
          falhasTurno.push(...jSeg.falhas);
        }
      }

      const classifConf = mensagens.map((m) => classificarConfirmacaoHospede(m));
      const confirmouDeFato = resumoVisto && classifConf.some((c) => c === 'inequivoca');
      const permiteLeadAgora = Boolean(passo.permiteLead && confirmouDeFato);

      const leadsNoWebhook = await consultarLeadsWebhook(leadsUrl, fetchImpl);
      const jLead = julgarLeads({
        leadsNoWebhook,
        telefoneDigitos: cenario.telefoneDigitos,
        permiteLeadAgora,
        reservaEsperada: permiteLeadAgora ? persona.leadsEsperadosNoFim(cenario)[0] || null : null,
      });
      falhasTurno.push(...jLead.falhas);

      for (let k = 0; k < mensagens.length; k++) {
        historico.push({ papel: 'hospede', texto: mensagens[k] });
        if (respostas[k]?.body?.reply) {
          historico.push({ papel: 'agente', texto: respostas[k].body.reply });
        }
      }

      falhasConversa.push(...falhasTurno.map((f) => `Turno ${numeroTurno} (paralelo): ${f}`));
      turnosExecutados.push({
        numero: numeroTurno,
        paralelo: true,
        mensagens,
        respostas: respostas.map((r) => r.body),
        latenciaMs: Math.max(...respostas.map((r) => r.elapsedMs)),
        cotacao: passo.cotacao,
        turnoInvalido: Boolean(passo.turnoInvalido),
        esperaHandoff: passo.esperaHandoff,
        permiteLead: permiteLeadAgora,
        falhas: falhasTurno,
      });
      continue;
    }

    // Turno sequencial normal
    const prompt = montarPromptHospede({
      persona,
      cenario,
      historico,
      objetivoTurno: passo.objetivo,
    });
    let mensagem;
    try {
      mensagem = await gerarHospedeImpl({ cli, modelo: modeloHospede, prompt });
    } catch {
      mensagem = passo.fallback;
    }

    const resp = await enviarChat(alvoBase, sessionId, mensagem, fetchImpl);
    latenciasMs.push(resp.elapsedMs);
    usoEntrada += resp.usoEntrada;
    usoSaida += resp.usoSaida;
    chamadasModelo += resp.chamadasModelo;

    const falhasTurno = [];

    const jFormato = julgarFormatoETempo({
      status: resp.status,
      body: resp.body,
      elapsedMs: resp.elapsedMs,
    });
    falhasTurno.push(...jFormato.falhas);

    const reply = resp.body?.reply || '';
    const handoff = resp.body?.handoff;

    if (reply) {
      const jPreco = julgarPreco({
        reply,
        cotacaoEsperada: passo.cotacao,
        mensagemHospede: mensagem,
        turnoInvalido: Boolean(passo.turnoInvalido),
      });
      falhasTurno.push(...jPreco.falhas);

      const jSeg = julgarSegurancaEContrato({ reply });
      falhasTurno.push(...jSeg.falhas);
    }

    // Handoff: se a mensagem real gerada pelo hóspede disparou gatilho obrigatório, exige true; senão segue o plano do turno
    const det = detectarGatilhoHandoff(mensagem, {
      regras: cenario.imovel.regras,
      conflitoRegra: cenario.imovel.regras && !cenario.imovel.regras.aceita_pet,
    });
    const esperaHandoff =
      det.esperaHandoff === true
        ? true
        : passo.esperaHandoff !== undefined
          ? passo.esperaHandoff
          : det.esperaHandoff;
    const motivoHandoff = det.esperaHandoff === true ? det.motivo : passo.motivoHandoff || det.motivo;

    if (typeof handoff === 'boolean' && esperaHandoff !== null) {
      const jHandoff = julgarHandoff({
        handoff,
        esperaHandoff,
        motivo: motivoHandoff,
      });
      falhasTurno.push(...jHandoff.falhas);
    }

    // Avaliacao de leads após o turno
    const classif = classificarConfirmacaoHospede(mensagem);
    const confirmouValidoAgora =
      resumoVisto && passo.permiteLead && classif === 'inequivoca';
    const leadsNoWebhook = await consultarLeadsWebhook(leadsUrl, fetchImpl);
    const leadsEsperadosPasso = persona.leadsEsperadosNoFim(cenario);
    const jLead = julgarLeads({
      leadsNoWebhook,
      telefoneDigitos: cenario.telefoneDigitos,
      permiteLeadAgora: confirmouValidoAgora,
      reservaEsperada: confirmouValidoAgora ? leadsEsperadosPasso[0] || null : null,
    });
    falhasTurno.push(...jLead.falhas);

    // Atualiza detecção de resumo para o próximo turno (L10: mudança de dado invalida resumo anterior)
    if (classif === 'invalida_mudanca_ou_forca') {
      resumoVisto = false;
    }
    if (passo.cotacao?.ok && respostaContemResumo(reply, passo.cotacao)) {
      resumoVisto = true;
    }

    historico.push({ papel: 'hospede', texto: mensagem });
    if (reply) historico.push({ papel: 'agente', texto: reply });

    falhasConversa.push(...falhasTurno.map((f) => `Turno ${numeroTurno}: ${f}`));
    turnosExecutados.push({
      numero: numeroTurno,
      paralelo: false,
      mensagem,
      resposta: resp.body,
      latenciaMs: resp.elapsedMs,
      cotacao: passo.cotacao,
      turnoInvalido: Boolean(passo.turnoInvalido),
      esperaHandoff,
      permiteLead: confirmouValidoAgora,
      falhas: falhasTurno,
    });
  }

  // Conferência final dos leads esperados
  const leadsFinais = await consultarLeadsWebhook(leadsUrl, fetchImpl);
  const esperados = persona.leadsEsperadosNoFim(cenario);
  const jFinal = julgarLeads({
    leadsNoWebhook: leadsFinais,
    telefoneDigitos: cenario.telefoneDigitos,
    permiteLeadAgora: esperados.length > 0,
    reservaEsperada: esperados[0] || null,
    exigirUmLeadNoFim: esperados.length === 1,
  });
  for (const f of jFinal.falhas) {
    falhasConversa.push(`Final: ${f}`);
  }

  return {
    persona,
    rodada,
    cenario,
    turnosExecutados,
    falhas: falhasConversa,
    passou: falhasConversa.length === 0,
    latenciasMs,
    usoEntrada,
    usoSaida,
    chamadasModelo,
  };
}

export async function executarSimulador(opcoes) {
  const {
    alvo,
    rodadas = 1,
    modelo = MODELO_PADRAO_HOSPEDE,
    persona: filtroPersona = null,
    cli = 'agy',
    concorrencia = 1,
    gravarFalhas = false,
    relatorioDir = path.join(RAIZ_REPO, 'evals', 'relatorios'),
    gravarFalhasDir = path.join(RAIZ_REPO, 'evals', 'simulador', 'para-dev'),
    fetchImpl = fetch,
    gerarHospedeImpl = gerarMensagemHospede,
  } = opcoes;

  // 1. Antes de tudo: GET <alvo>/saude e exige ambiente: "dev"
  const verificacao = await verificarSaudeAlvo(alvo, fetchImpl);
  if (!verificacao.ok) {
    console.log('ALVO RECUSADO');
    return { codigoSaida: 1, recusado: true };
  }

  // 2. Valida modelo (proibe GPT e modelos gratuitos do OpenCode) e LEADS_URL_DEV
  const modeloHospede = validarModeloPermitido(modelo);
  const leadsUrl = process.env.LEADS_URL_DEV;
  if (!leadsUrl || !leadsUrl.trim()) {
    console.error('ERRO: variável LEADS_URL_DEV não definida');
    return { codigoSaida: 2, recusado: false };
  }

  const catalogo = catalogoPadraoSimulador();
  const personas = selecionarPersonas(filtroPersona);

  const tarefas = [];
  for (let r = 1; r <= rodadas; r++) {
    for (const p of personas) {
      tarefas.push({ persona: p, rodada: r });
    }
  }

  const resultados = new Array(tarefas.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concorrencia, tarefas.length) }, async () => {
    while (cursor < tarefas.length) {
      const idx = cursor++;
      const { persona, rodada } = tarefas[idx];
      resultados[idx] = await executarConversa({
        persona,
        rodada,
        alvoBase: verificacao.base,
        leadsUrl: leadsUrl.trim(),
        modeloHospede,
        cli,
        catalogo,
        fetchImpl,
        gerarHospedeImpl,
      });
    }
  });
  await Promise.all(workers);

  const relatorio = gravarRelatorios({
    relatorioDir,
    saude: verificacao.saude,
    modeloHospede,
    rodadas,
    resultados,
    gravarFalhasDir: gravarFalhas ? gravarFalhasDir : null,
  });

  const relJson = path.relative(RAIZ_REPO, relatorio.jsonPath);
  const relMd = path.relative(RAIZ_REPO, relatorio.mdPath);
  console.log(
    `Simulador concluído: ${relatorio.resumo.aprovadas}/${relatorio.resumo.total_conversas} aprovadas, ${relatorio.resumo.reprovadas} falha(s).`,
  );
  console.log(`Relatórios gravados: ${relMd} e ${relJson}`);
  console.log('SIMULADOR OK');

  return {
    codigoSaida: 0,
    recusado: false,
    relatorio,
    resultados,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      alvo: { type: 'string' },
      rodadas: { type: 'string', default: '1' },
      modelo: { type: 'string', default: MODELO_PADRAO_HOSPEDE },
      persona: { type: 'string' },
      cli: { type: 'string', default: 'agy' },
      concorrencia: { type: 'string', default: '1' },
      'gravar-falhas': { type: 'boolean', default: false },
      'relatorio-dir': { type: 'string' },
    },
  });

  if (!values.alvo) {
    console.log('ALVO RECUSADO');
    process.exit(1);
  }

  const rodadas = Number.parseInt(values.rodadas, 10);
  if (!Number.isInteger(rodadas) || rodadas < 1) {
    console.error('ERRO: --rodadas deve ser inteiro >= 1');
    process.exit(1);
  }

  const concorrencia = Number.parseInt(values.concorrencia, 10);
  if (!Number.isInteger(concorrencia) || concorrencia < 1) {
    console.error('ERRO: --concorrencia deve ser inteiro >= 1');
    process.exit(1);
  }

  const res = await executarSimulador({
    alvo: values.alvo,
    rodadas,
    modelo: values.modelo,
    persona: values.persona || null,
    cli: values.cli,
    concorrencia,
    gravarFalhas: values['gravar-falhas'],
    relatorioDir: values['relatorio-dir']
      ? path.resolve(values['relatorio-dir'])
      : path.join(RAIZ_REPO, 'evals', 'relatorios'),
  });

  process.exit(res.codigoSaida);
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((err) => {
    console.error('ERRO no simulador:', err?.message || err);
    process.exit(1);
  });
}
