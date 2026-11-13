#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  gerarMensagemHospede,
  MODELO_PADRAO_HOSPEDE,
  montarPromptHospede,
  sanitizarTextoParaCli,
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

function sanitizarErroSemUrl(err) {
  let msg = err instanceof Error ? err.message : String(err || 'erro desconhecido');
  const leadsEnv = process.env.LEADS_URL_DEV?.trim();
  if (leadsEnv) {
    msg = msg.split(leadsEnv).join('[LEADS_URL_DEV_OMITIDA]');
  }
  msg = msg.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL_OMITIDA]');
  return msg;
}

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
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.type === 'opaqueredirect' || resp.status !== 200) {
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

async function consultarLeadsWebhookSeguro(leadsUrl, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(leadsUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.type === 'opaqueredirect' || !resp.ok) {
      return { ok: false, leads: [], erro: `Falha ao consultar webhook de leads (status ${resp.status})` };
    }
    const data = await resp.json();
    return { ok: true, leads: Array.isArray(data?.leads) ? data.leads : [] };
  } catch (err) {
    return { ok: false, leads: [], erro: `Falha ao consultar webhook de leads (${sanitizarErroSemUrl(err)})` };
  }
}

async function enviarChat(alvoBase, sessionId, message, fetchImpl = fetch) {
  const inicio = performance.now();
  let resp;
  try {
    resp = await fetchImpl(`${alvoBase}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message }),
      redirect: 'manual',
      signal: AbortSignal.timeout(65_000),
    });
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - inicio);
    return {
      status: 0,
      body: null,
      erroRede: `falha de rede/tempo ao chamar /chat (${sanitizarErroSemUrl(err)})`,
      elapsedMs,
      usoEntrada: 0,
      usoSaida: 0,
      chamadasModelo: 0,
    };
  }
  const elapsedMs = Math.round(performance.now() - inicio);

  if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) {
    return {
      status: resp.status || 302,
      body: null,
      erroRede: `redirecionamento HTTP recusado em /chat (status ${resp.status || 302})`,
      elapsedMs,
      usoEntrada: 0,
      usoSaida: 0,
      chamadasModelo: 0,
    };
  }

  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }

  const usoEntrada = Number(resp.headers?.get?.('x-uso-entrada') || 0);
  const usoSaida = Number(resp.headers?.get?.('x-uso-saida') || 0);
  const chamadasModelo = Number(resp.headers?.get?.('x-chamadas-modelo') || 0);

  return {
    status: resp.status,
    body,
    erroRede: null,
    elapsedMs,
    usoEntrada: Number.isFinite(usoEntrada) ? usoEntrada : 0,
    usoSaida: Number.isFinite(usoSaida) ? usoSaida : 0,
    chamadasModelo: Number.isFinite(chamadasModelo) ? chamadasModelo : 0,
  };
}

function resolverEsperaHandoff(passo, det) {
  if (passo.esperaHandoff === true) {
    if (det.esperaHandoff === true) {
      return { esperaHandoff: true, motivoHandoff: det.motivo || passo.motivoHandoff || null };
    }
    // Fala do hóspede divergiu do objetivo da persona (não pediu desconto/humano/reclamação) -> não julga
    return { esperaHandoff: null, motivoHandoff: null };
  }

  if (passo.esperaHandoff === false) {
    if (det.esperaHandoff === true) {
      // L16a ou variação real: a fala gerada realmente disparou gatilho obrigatório
      return { esperaHandoff: true, motivoHandoff: det.motivo || null };
    }
    if (passo.motivoHandoff === 'manipulacao_pura_L16' && det.esperaHandoff !== false) {
      return { esperaHandoff: null, motivoHandoff: null };
    }
    return { esperaHandoff: false, motivoHandoff: passo.motivoHandoff || det.motivo || null };
  }

  return {
    esperaHandoff: det.esperaHandoff,
    motivoHandoff: det.motivo || passo.motivoHandoff || null,
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
  cenario = null,
  outrosTelefonesDigitos = null,
  fetchImpl = fetch,
  gerarHospedeImpl = gerarMensagemHospede,
}) {
  const sessionId = `sim-${persona.id}-${crypto.randomUUID()}`;
  const cenarioFinal = cenario || persona.criarCenario(rodada, catalogo);
  const planoTurnos = persona.turnos(cenarioFinal);

  const historico = [];
  const turnosExecutados = [];
  const falhasConversa = [];
  const latenciasMs = [];
  let usoEntrada = 0;
  let usoSaida = 0;
  let chamadasModelo = 0;
  let resumoVisto = false;
  let ultimoResumo = null;
  let turnosTotais = 0;
  let turnosCliFalha = 0;

  const snapInicial = await consultarLeadsWebhookSeguro(leadsUrl, fetchImpl);
  let leadsAntes = null;
  if (!snapInicial.ok) {
    falhasConversa.push(`Inicial: ${snapInicial.erro}`);
  } else {
    leadsAntes = snapInicial.leads;
  }

  for (let i = 0; i < planoTurnos.length; i++) {
    const passo = planoTurnos[i];
    const numeroTurno = i + 1;

    if (Array.isArray(passo.paralelo)) {
      const mensagens = [];
      let cliFalhouNoParalelo = false;
      for (const sub of passo.paralelo) {
        turnosTotais += 1;
        let msg;
        try {
          const prompt = montarPromptHospede({
            persona,
            cenario: cenarioFinal,
            historico,
            objetivoTurno: sub.objetivo,
          });
          msg = await gerarHospedeImpl({ cli, modelo: modeloHospede, prompt });
        } catch {
          turnosCliFalha += 1;
          cliFalhouNoParalelo = true;
          msg = sub.fallback;
        }
        mensagens.push(msg);
      }

      const respostas = await Promise.all(
        mensagens.map((m) => enviarChat(alvoBase, sessionId, m, fetchImpl)),
      );

      const falhasTurno = [];
      const falhasPorSubturno = [];
      let esperaHandoffTurno = null;

      for (let k = 0; k < respostas.length; k++) {
        const r = respostas[k];
        const msgSub = mensagens[k];
        const falhasSub = [];
        latenciasMs.push(r.elapsedMs);
        usoEntrada += r.usoEntrada;
        usoSaida += r.usoSaida;
        chamadasModelo += r.chamadasModelo;

        if (r.erroRede) {
          falhasSub.push(r.erroRede);
        }

        const jFormato = julgarFormatoETempo({
          status: r.status,
          body: r.body,
          elapsedMs: r.elapsedMs,
        });
        falhasSub.push(...jFormato.falhas);

        const replySub = r.body?.reply || '';
        const handoffSub = r.body?.handoff;

        if (replySub) {
          const jPreco = julgarPreco({
            reply: replySub,
            cotacaoEsperada: passo.cotacao,
            mensagemHospede: msgSub,
            turnoInvalido: Boolean(passo.turnoInvalido),
          });
          falhasSub.push(...jPreco.falhas);

          const jSeg = julgarSegurancaEContrato({ reply: replySub });
          falhasSub.push(...jSeg.falhas);
        }

        const detSub = detectarGatilhoHandoff(msgSub, {
          regras: cenarioFinal.imovel.regras,
          conflitoRegra: cenarioFinal.imovel.regras && !cenarioFinal.imovel.regras.aceita_pet,
        });
        const { esperaHandoff, motivoHandoff } = resolverEsperaHandoff(passo, detSub);
        if (k === 0) esperaHandoffTurno = esperaHandoff;
        if (typeof handoffSub === 'boolean' && esperaHandoff !== null) {
          const jHandoff = julgarHandoff({
            handoff: handoffSub,
            esperaHandoff,
            motivo: motivoHandoff,
          });
          falhasSub.push(...jHandoff.falhas);
        }

        falhasPorSubturno.push(falhasSub);
        falhasTurno.push(...falhasSub);
      }

      const classifConf = mensagens.map((m) => classificarConfirmacaoHospede(m));
      const confirmouDeFato = Boolean(
        resumoVisto && passo.permiteLead && classifConf.some((c) => c === 'inequivoca'),
      );
      const permiteLeadAgora = confirmouDeFato;

      const snapTurno = await consultarLeadsWebhookSeguro(leadsUrl, fetchImpl);
      if (!snapTurno.ok) {
        falhasTurno.push(snapTurno.erro);
      } else {
        const jLead = julgarLeads({
          leadsNoWebhook: snapTurno.leads,
          leadsAntes,
          outrosTelefonesDigitos,
          telefoneDigitos: cenarioFinal.telefoneDigitos,
          permiteLeadAgora,
          reservaEsperada: permiteLeadAgora
            ? persona.leadsEsperadosNoFim(cenarioFinal)[0] || null
            : null,
          resumoAnterior: permiteLeadAgora ? ultimoResumo : null,
        });
        falhasTurno.push(...jLead.falhas);
      }

      // Atualiza estado de resumo para o próximo turno (zera se não mostrou resumo válido)
      const algumaRespostaComResumo =
        !confirmouDeFato &&
        passo.cotacao?.ok &&
        respostas.some((r) => respostaContemResumo(r.body?.reply || '', passo.cotacao, cenarioFinal));
      if (algumaRespostaComResumo) {
        resumoVisto = true;
        ultimoResumo = {
          imovel_id: passo.cotacao.imovel_id,
          checkin: passo.cotacao.checkin,
          checkout: passo.cotacao.checkout,
          hospedes: passo.cotacao.hospedes,
          totalCentavos: passo.cotacao.totalCentavos,
        };
      } else {
        resumoVisto = false;
        ultimoResumo = null;
      }

      for (let k = 0; k < mensagens.length; k++) {
        historico.push({ papel: 'hospede', texto: sanitizarTextoParaCli(mensagens[k]) });
        if (respostas[k]?.body?.reply) {
          historico.push({ papel: 'agente', texto: sanitizarTextoParaCli(respostas[k].body.reply) });
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
        esperaHandoff: esperaHandoffTurno,
        permiteLead: permiteLeadAgora,
        cliFalhou: cliFalhouNoParalelo,
        falhasPorSubturno,
        falhas: falhasTurno,
      });
      continue;
    }

    // Turno sequencial normal
    turnosTotais += 1;
    let mensagem;
    let cliFalhou = false;
    try {
      const prompt = montarPromptHospede({
        persona,
        cenario: cenarioFinal,
        historico,
        objetivoTurno: passo.objetivo,
      });
      mensagem = await gerarHospedeImpl({ cli, modelo: modeloHospede, prompt });
    } catch {
      turnosCliFalha += 1;
      cliFalhou = true;
      mensagem = passo.fallback;
    }

    const resp = await enviarChat(alvoBase, sessionId, mensagem, fetchImpl);
    latenciasMs.push(resp.elapsedMs);
    usoEntrada += resp.usoEntrada;
    usoSaida += resp.usoSaida;
    chamadasModelo += resp.chamadasModelo;

    const falhasTurno = [];
    if (resp.erroRede) {
      falhasTurno.push(resp.erroRede);
    }

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

    // Handoff: só julga quando a fala real do hóspede não diverge do objetivo da persona
    const det = detectarGatilhoHandoff(mensagem, {
      regras: cenarioFinal.imovel.regras,
      conflitoRegra: cenarioFinal.imovel.regras && !cenarioFinal.imovel.regras.aceita_pet,
    });
    const { esperaHandoff, motivoHandoff } = resolverEsperaHandoff(passo, det);

    if (typeof handoff === 'boolean' && esperaHandoff !== null) {
      const jHandoff = julgarHandoff({
        handoff,
        esperaHandoff,
        motivo: motivoHandoff,
      });
      falhasTurno.push(...jHandoff.falhas);
    }

    // Avaliação de leads após o turno
    const classif = classificarConfirmacaoHospede(mensagem);
    const confirmouValidoAgora = Boolean(
      resumoVisto && passo.permiteLead && classif === 'inequivoca',
    );
    const snapTurno = await consultarLeadsWebhookSeguro(leadsUrl, fetchImpl);
    const leadsEsperadosPasso = persona.leadsEsperadosNoFim(cenarioFinal);
    if (!snapTurno.ok) {
      falhasTurno.push(snapTurno.erro);
    } else {
      const jLead = julgarLeads({
        leadsNoWebhook: snapTurno.leads,
        leadsAntes,
        outrosTelefonesDigitos,
        telefoneDigitos: cenarioFinal.telefoneDigitos,
        permiteLeadAgora: confirmouValidoAgora,
        reservaEsperada: confirmouValidoAgora ? leadsEsperadosPasso[0] || null : null,
        resumoAnterior: confirmouValidoAgora ? ultimoResumo : null,
      });
      falhasTurno.push(...jLead.falhas);
    }

    // Atualiza detecção de resumo (Item 12: zera em todo turno sem novo resumo válido ou que confirmou)
    const resumoNoTurno = Boolean(
      passo.cotacao?.ok && respostaContemResumo(reply, passo.cotacao, cenarioFinal),
    );
    if (!confirmouValidoAgora && resumoNoTurno) {
      resumoVisto = true;
      ultimoResumo = {
        imovel_id: passo.cotacao.imovel_id,
        checkin: passo.cotacao.checkin,
        checkout: passo.cotacao.checkout,
        hospedes: passo.cotacao.hospedes,
        totalCentavos: passo.cotacao.totalCentavos,
      };
    } else {
      resumoVisto = false;
      ultimoResumo = null;
    }

    historico.push({ papel: 'hospede', texto: sanitizarTextoParaCli(mensagem) });
    if (reply) historico.push({ papel: 'agente', texto: sanitizarTextoParaCli(reply) });

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
      cliFalhou,
      falhas: falhasTurno,
    });
  }

  // Conferência final dos leads esperados
  const snapFinal = await consultarLeadsWebhookSeguro(leadsUrl, fetchImpl);
  if (!snapFinal.ok) {
    falhasConversa.push(`Final: ${snapFinal.erro}`);
  } else {
    const esperados = persona.leadsEsperadosNoFim(cenarioFinal);
    const jFinal = julgarLeads({
      leadsNoWebhook: snapFinal.leads,
      leadsAntes,
      outrosTelefonesDigitos,
      telefoneDigitos: cenarioFinal.telefoneDigitos,
      permiteLeadAgora: esperados.length > 0,
      reservaEsperada: esperados[0] || null,
      exigirUmLeadNoFim: esperados.length === 1,
    });
    for (const f of jFinal.falhas) {
      falhasConversa.push(`Final: ${f}`);
    }
  }

  return {
    persona,
    rodada,
    cenario: cenarioFinal,
    turnosExecutados,
    turnosTotais,
    turnosCliFalha,
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

  // 1. Antes de tudo: GET <alvo>/saude e exige ambiente: "dev" (sem seguir redirecionamentos)
  const verificacao = await verificarSaudeAlvo(alvo, fetchImpl);
  if (!verificacao.ok) {
    console.log('ALVO RECUSADO');
    return { codigoSaida: 1, recusado: true };
  }

  // 2. Valida modelo (lista explícita permitida) e LEADS_URL_DEV (nunca imprime o valor)
  const modeloHospede = validarModeloPermitido(modelo);
  const leadsUrlBruta = process.env.LEADS_URL_DEV;
  if (!leadsUrlBruta || !leadsUrlBruta.trim()) {
    console.error('ERRO: variável LEADS_URL_DEV não definida');
    return { codigoSaida: 2, recusado: false };
  }
  let leadsUrlParsed;
  try {
    leadsUrlParsed = new URL(leadsUrlBruta.trim());
  } catch {
    console.error('ERRO: variável LEADS_URL_DEV malformada (esperada URL http/https válida)');
    return { codigoSaida: 2, recusado: false };
  }
  if (leadsUrlParsed.protocol !== 'http:' && leadsUrlParsed.protocol !== 'https:') {
    console.error('ERRO: variável LEADS_URL_DEV deve usar protocolo http ou https');
    return { codigoSaida: 2, recusado: false };
  }
  const leadsUrl = leadsUrlParsed.toString();

  const catalogo = catalogoPadraoSimulador();
  const personas = selecionarPersonas(filtroPersona);

  const tarefas = [];
  for (let r = 1; r <= rodadas; r++) {
    for (const p of personas) {
      const cenario = p.criarCenario(r, catalogo);
      tarefas.push({ persona: p, rodada: r, cenario });
    }
  }

  const todosTelefones = tarefas.map((t) => t.cenario.telefoneDigitos);
  const resultados = new Array(tarefas.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concorrencia, tarefas.length) }, async () => {
    while (cursor < tarefas.length) {
      const idx = cursor++;
      const { persona, rodada, cenario } = tarefas[idx];
      const outrosTelefonesDigitos = new Set(todosTelefones.filter((_, i) => i !== idx));
      resultados[idx] = await executarConversa({
        persona,
        rodada,
        alvoBase: verificacao.base,
        leadsUrl,
        modeloHospede,
        cli,
        catalogo,
        cenario,
        outrosTelefonesDigitos,
        fetchImpl,
        gerarHospedeImpl,
      });
    }
  });
  await Promise.all(workers);

  const turnosTotais = resultados.reduce((acc, r) => acc + r.turnosTotais, 0);
  const turnosCliFalha = resultados.reduce((acc, r) => acc + r.turnosCliFalha, 0);
  const cliExcessiva = turnosTotais > 0 && turnosCliFalha / turnosTotais > 0.2;
  const simuladorOk = !cliExcessiva;

  const relatorio = gravarRelatorios({
    relatorioDir,
    saude: verificacao.saude,
    modeloHospede,
    rodadas,
    resultados,
    gravarFalhasDir: gravarFalhas ? gravarFalhasDir : null,
    simuladorAprovado: simuladorOk,
  });

  const relJson = path.relative(RAIZ_REPO, relatorio.jsonPath);
  const relMd = path.relative(RAIZ_REPO, relatorio.mdPath);
  console.log(
    `Simulador concluído: ${relatorio.resumo.aprovadas}/${relatorio.resumo.total_conversas} aprovadas, ${relatorio.resumo.reprovadas} falha(s), CLI falhou em ${turnosCliFalha}/${turnosTotais} turnos.`,
  );
  console.log(`Relatórios gravados: ${relMd} e ${relJson}`);

  if (cliExcessiva) {
    console.log(
      `SIMULADOR REPROVADO: CLI do hóspede falhou em ${turnosCliFalha}/${turnosTotais} turnos (limite 20%).`,
    );
    return {
      codigoSaida: 1,
      recusado: false,
      simuladorOk: false,
      relatorio,
      resultados,
    };
  }

  console.log('SIMULADOR OK');
  return {
    codigoSaida: 0,
    recusado: false,
    simuladorOk: true,
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
    console.error('ERRO no simulador:', sanitizarErroSemUrl(err));
    process.exit(1);
  });
}
