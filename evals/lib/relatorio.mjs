import fs from 'node:fs';
import path from 'node:path';

export function mascararDadosPessoais(texto, segredos = []) {
  if (typeof texto !== 'string') return '';
  let out = texto;
  for (const item of segredos) {
    if (!item || !item.valor) continue;
    out = out.split(item.valor).join(item.rotulo);
  }
  return out;
}

export function calcularPercentil(valores, p) {
  if (!valores || valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1));
  return Math.round(ordenados[idx]);
}

export function montarResumoRelatorio({
  conjunto,
  ambiente,
  resultadosCasos,
  blocosResumo,
  aprovado,
  veredicto,
  motivosReprovacao,
  puladosTrava,
  soAgregado,
}) {
  const todasLatencias = [];
  let entradaTotal = 0;
  let saidaTotal = 0;
  let chamadasTotal = 0;
  let execCount = 0;
  let aprovadosTotal = 0;
  const conversas = [];

  for (const r of resultadosCasos) {
    if (r.pulado) continue;
    execCount++;
    if (r.passou) aprovadosTotal++;
    todasLatencias.push(...r.latenciasMs);
    entradaTotal += r.usoEntrada;
    saidaTotal += r.usoSaida;
    chamadasTotal += r.chamadasModelo;

    if (!soAgregado) {
      conversas.push({
        id: r.id,
        bloco: r.bloco,
        passou: r.passou,
        falhas: r.falhas,
        latencia_total_ms: r.latenciaTotalMs,
        uso_entrada: r.usoEntrada,
        uso_saida: r.usoSaida,
        chamadas_modelo: r.chamadasModelo,
      });
    }
  }

  const rel = {
    gerado_em: new Date().toISOString(),
    conjunto,
    ambiente,
    so_agregado: Boolean(soAgregado),
    aprovado: Boolean(aprovado),
    veredicto: veredicto || (aprovado ? 'OK' : 'REPROVADO'),
    motivos_reprovacao: motivosReprovacao,
    pulados_trava: puladosTrava,
    blocos: blocosResumo,
    agregado: {
      executados: execCount,
      aprovados: aprovadosTotal,
      taxa_pct: execCount > 0 ? Math.floor((aprovadosTotal * 100) / execCount) : 0,
    },
    latencia_ms: {
      p50: calcularPercentil(todasLatencias, 50),
      p95: calcularPercentil(todasLatencias, 95),
      max: todasLatencias.length > 0 ? Math.round(Math.max(...todasLatencias)) : 0,
      media:
        todasLatencias.length > 0
          ? Math.round(todasLatencias.reduce((a, b) => a + b, 0) / todasLatencias.length)
          : 0,
    },
    uso: {
      entrada_total: entradaTotal,
      saida_total: saidaTotal,
      chamadas_modelo_total: chamadasTotal,
      entrada_media_conversa: execCount > 0 ? Math.round(entradaTotal / execCount) : 0,
      saida_media_conversa: execCount > 0 ? Math.round(saidaTotal / execCount) : 0,
      chamadas_media_conversa: execCount > 0 ? Number((chamadasTotal / execCount).toFixed(2)) : 0,
    },
  };

  if (!soAgregado) {
    rel.conversas = conversas;
  }

  return rel;
}

export function gravarRelatorio(relatorio, destinoExplicito, repoRoot) {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const arquivo = destinoExplicito
    ? path.resolve(destinoExplicito)
    : path.join(repoRoot, 'evals', 'relatorios', `eval-${relatorio.conjunto}-${carimbo}.json`);

  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(relatorio, null, 2) + '\n', 'utf8');
  return arquivo;
}
