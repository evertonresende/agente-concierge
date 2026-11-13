import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularPercentil, gravarRelatorio, mascararDadosPessoais } from '../lib/relatorio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(__dirname, '../..');

export function mascararTexto(texto, cenario) {
  if (typeof texto !== 'string') return '';
  let out = texto;

  // Remove eventuais URLs por seguranca
  out = out.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL_REMOVIDA]');

  if (cenario?.nome) {
    const escapedNome = cenario.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escapedNome, 'gi'), '[NOME]');
  }

  out = mascararDadosPessoais(out, [
    cenario?.nome ? { valor: cenario.nome, rotulo: '[NOME]' } : null,
    cenario?.telefone ? { valor: cenario.telefone, rotulo: '(XX) XXXXX-XXXX' } : null,
    cenario?.telefoneDigitos ? { valor: cenario.telefoneDigitos, rotulo: 'XXXXXXXXXXX' } : null,
  ]);

  // Mascara telefones brasileiros residuais no texto
  out = out.replace(/(?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, '(XX) XXXXX-XXXX');
  return out;
}

function substituirPlaceholdersCaso(texto, cenario) {
  if (typeof texto !== 'string') return '';
  let out = texto;
  if (cenario?.nome) {
    const escapedNome = cenario.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escapedNome, 'gi'), '{{nome}}');
  }
  if (cenario?.telefone) {
    const escapedTel = cenario.telefone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escapedTel, 'g'), '{{telefone}}');
  }
  if (cenario?.telefoneDigitos) {
    out = out.replace(new RegExp(cenario.telefoneDigitos, 'g'), '{{telefone}}');
  }
  return out;
}

function regexLiteralSeguro(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reduz uma conversa que falhou aos turnos necessários até o ponto da falha,
 * já no formato final de evals/README.md (com estadia, leads_ate_agora, sem_total,
 * sessao e espera_conjunto em turnos paralelos).
 */
export function gerarCasoFixoDeFalha(resultadoConversa) {
  const { persona, cenario, rodada, turnosExecutados } = resultadoConversa;

  const indicePrimeiraFalha = turnosExecutados.findIndex((t) => t.falhas.length > 0);
  const limite = indicePrimeiraFalha >= 0 ? indicePrimeiraFalha + 1 : turnosExecutados.length;
  const turnosReduzidos = turnosExecutados.slice(0, limite);

  const turnosCaso = turnosReduzidos.map((t) => {
    if (t.paralelo && Array.isArray(t.mensagens)) {
      const turnoParalelo = {
        paralelo: t.mensagens.map((m, idx) => {
          const resp = t.respostas?.[idx] || {};
          const espera = {};
          if (typeof t.esperaHandoff === 'boolean') espera.handoff = t.esperaHandoff;
          if (!t.permiteLead) espera.resposta_nao_contem = ['registrad'];
          if (resp.reply && t.cotacao?.ok && idx === 0 && !t.turnoInvalido) {
            espera.estadia = {
              imovel_id: t.cotacao.imovel_id,
              checkin: t.cotacao.checkin,
              checkout: t.cotacao.checkout,
              hospedes: t.cotacao.hospedes,
              obrigatorio: false,
            };
          }
          const sub = {
            mensagem: substituirPlaceholdersCaso(m, cenario),
            espera,
          };
          if (t.sessao) sub.sessao = t.sessao;
          return sub;
        }),
      };

      if (t.permiteLead) {
        turnoParalelo.espera_conjunto = {
          todos_contem: ['registrad'],
          exatamente_um_contem: ['j[aá]\\s+(?:foi|estava|se\\s+encontra)?\\s*registrad'],
        };
      } else {
        turnoParalelo.espera_conjunto = {
          nenhum_contem: ['registrad'],
        };
      }

      return turnoParalelo;
    }

    const espera = {};
    if (typeof t.esperaHandoff === 'boolean') {
      espera.handoff = t.esperaHandoff;
    }
    if (t.turnoInvalido) {
      espera.sem_total = true;
    } else if (t.cotacao?.ok) {
      const falhouPreco = t.falhas.some((f) => /total|valor|pre[çc]o|c[áa]lculo/i.test(f));
      espera.estadia = {
        imovel_id: t.cotacao.imovel_id,
        checkin: t.cotacao.checkin,
        checkout: t.cotacao.checkout,
        hospedes: t.cotacao.hospedes,
        obrigatorio: falhouPreco,
      };
      if (falhouPreco) {
        espera.resposta_contem = [regexLiteralSeguro(t.cotacao.totalFormatado)];
      }
    }
    if (!t.permiteLead) {
      espera.resposta_nao_contem = ['registrad'];
      if (persona.bloco === 'funciona-leads') {
        espera.leads_ate_agora = 0;
      }
    }

    const turno = {
      mensagem: substituirPlaceholdersCaso(t.mensagem, cenario),
      espera,
    };
    if (t.sessao) turno.sessao = t.sessao;
    return turno;
  });

  const leadsEsperados =
    typeof persona.leadsEsperadosNoFim === 'function' && limite === turnosExecutados.length
      ? persona.leadsEsperadosNoFim(cenario).map((l) => ({
          imovel_id: l.imovel_id,
          checkin: l.checkin,
          checkout: l.checkout,
          hospedes: l.hospedes,
          valor_total: l.valor_total,
        }))
      : [];

  const sufixoId = Math.random().toString(36).slice(2, 6);
  const id = `sim-${persona.id}-r${rodada}-${sufixoId}`;

  return {
    caminhoSugerido: `evals/simulador/para-dev/${persona.bloco}/${id}.json`,
    caso: {
      id,
      bloco: persona.bloco,
      confirma: persona.bloco === 'funciona-leads',
      turnos: turnosCaso,
      leads_esperados: leadsEsperados,
    },
  };
}

export function gravarRelatorios({
  relatorioDir,
  saude,
  modeloHospede,
  rodadas,
  resultados,
  gravarFalhasDir = null,
}) {
  fs.mkdirSync(relatorioDir, { recursive: true });

  const agora = new Date();
  const carimbo = agora.toISOString().replace(/[:.]/g, '-');

  const totalConversas = resultados.length;
  const aprovadas = resultados.filter((r) => r.passou).length;
  const reprovadas = totalConversas - aprovadas;

  const todasLatencias = resultados.flatMap((r) => r.latenciasMs);
  const latenciaP50Ms = calcularPercentil(todasLatencias, 50);
  const latenciaP95Ms = calcularPercentil(todasLatencias, 95);
  const latenciaMaximaMs = todasLatencias.length > 0 ? Math.round(Math.max(...todasLatencias)) : 0;
  const latenciaMediaMs =
    todasLatencias.length > 0
      ? Math.round(todasLatencias.reduce((a, b) => a + b, 0) / todasLatencias.length)
      : 0;

  const casosFalha = resultados
    .filter((r) => !r.passou)
    .map((r) => ({
      persona: r.persona.id,
      rodada: r.rodada,
      falhas: r.falhas.map((f) => mascararTexto(f, r.cenario)),
      ...gerarCasoFixoDeFalha(r),
    }));

  if (gravarFalhasDir) {
    for (const item of casosFalha) {
      const destDir = path.join(gravarFalhasDir, item.caso.bloco);
      fs.mkdirSync(destDir, { recursive: true });
      const destFile = path.join(destDir, `${item.caso.id}.json`);
      fs.writeFileSync(destFile, `${JSON.stringify(item.caso, null, 2)}\n`, 'utf8');
    }
  }

  // Relatório estruturado (sem URL do alvo, sem URL do webhook, sem PII sem máscara)
  const dadosJson = {
    tipo: 'simulador-hostil',
    criado_em: agora.toISOString(),
    ambiente: saude.ambiente,
    leads_destino: saude.leads_destino ?? null,
    envio_leads: saude.envio_leads ?? null,
    modelo_hospede: modeloHospede,
    rodadas,
    resumo: {
      total_conversas: totalConversas,
      aprovadas,
      reprovadas,
      latencia_p50_ms: latenciaP50Ms,
      latencia_p95_ms: latenciaP95Ms,
      latencia_media_ms: latenciaMediaMs,
      latencia_maxima_ms: latenciaMaximaMs,
    },
    latencia_ms: {
      p50: latenciaP50Ms,
      p95: latenciaP95Ms,
      media: latenciaMediaMs,
      max: latenciaMaximaMs,
    },
    conversas: resultados.map((r) => ({
      persona: r.persona.id,
      bloco: r.persona.bloco,
      criterios: r.persona.criterios,
      rodada: r.rodada,
      passou: r.passou,
      falhas: r.falhas.map((f) => mascararTexto(f, r.cenario)),
      latencias_ms: r.latenciasMs,
      uso_entrada: r.usoEntrada,
      uso_saida: r.usoSaida,
      chamadas_modelo: r.chamadasModelo,
      turnos: r.turnosExecutados.map((t) => ({
        turno: t.numero,
        mensagem: t.paralelo
          ? t.mensagens.map((m) => mascararTexto(m, r.cenario))
          : mascararTexto(t.mensagem, r.cenario),
        handoff: t.paralelo
          ? t.respostas.map((resp) => resp?.handoff ?? null)
          : (t.resposta?.handoff ?? null),
        latencia_ms: t.latenciaMs,
        falhas: t.falhas.map((f) => mascararTexto(f, r.cenario)),
      })),
    })),
    casos_falha: casosFalha,
  };

  const destinoJson = path.join(relatorioDir, `simulador-${carimbo}.json`);
  const jsonPath = gravarRelatorio(dadosJson, destinoJson, RAIZ_REPO);

  const linhasMd = [
    '# Relatório do Simulador de Hóspede Hostil (Nível 3)',
    '',
    `- **Data**: ${agora.toISOString()}`,
    `- **Ambiente (/saude)**: \`${saude.ambiente}\``,
    `- **Modelo do hóspede**: \`${modeloHospede}\``,
    `- **Rodadas por persona**: ${rodadas}`,
    `- **Resultado**: ${aprovadas}/${totalConversas} conversas aprovadas (${reprovadas} falha(s))`,
    `- **Latência (p50 / p95 / média / máxima)**: ${latenciaP50Ms} ms / ${latenciaP95Ms} ms / ${latenciaMediaMs} ms / ${latenciaMaximaMs} ms`,
    '',
    '## Resumo por conversa',
    '',
    '| Persona | Bloco | Rodada | Status | Latência máx (ms) | Falhas |',
    '|---|---|---|---|---|---|',
    ...resultados.map((r) => {
      const maxLat = r.latenciasMs.length > 0 ? Math.max(...r.latenciasMs) : 0;
      const status = r.passou ? 'PASSOU' : 'FALHOU';
      const resumoFalhas =
        r.falhas.length === 0
          ? '—'
          : mascararTexto(r.falhas.join('; '), r.cenario).replace(/\|/g, '/');
      return `| ${r.persona.id} | ${r.persona.bloco} | ${r.rodada} | ${status} | ${maxLat} | ${resumoFalhas} |`;
    }),
    '',
  ];

  if (casosFalha.length > 0) {
    linhasMd.push('## Casos fixos gerados a partir das falhas (prontos para gravar)', '');
    for (const item of casosFalha) {
      linhasMd.push(`### ${item.caso.id} (\`${item.caminhoSugerido}\`)`, '');
      linhasMd.push('```json');
      linhasMd.push(JSON.stringify(item.caso, null, 2));
      linhasMd.push('```', '');
    }
  }

  const mdPath = path.join(relatorioDir, `simulador-${carimbo}.md`);
  fs.writeFileSync(mdPath, `${linhasMd.join('\n')}\n`, 'utf8');

  return { jsonPath, mdPath, resumo: dadosJson.resumo, casosFalha };
}
