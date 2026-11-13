import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buscarImovelPorId, carregarCatalogo } from './catalogo.mjs';
import { iniciarAgenteFalsoLocal, iniciarWebhookFalsoLocal } from './falso-agente.mjs';
import { montarPromptHospede, validarModeloPermitido } from './hospede-cli.mjs';
import {
  julgarFormatoETempo,
  julgarHandoff,
  julgarLeads,
  julgarPreco,
  julgarSegurancaEContrato,
} from './juizes.mjs';
import { calcularCotacao, formatarReais } from './preco.mjs';
import { mascararTexto } from './relatorio.mjs';
import { executarSimulador } from './rodar.mjs';
import { validarCasosParaDev } from './gerar-casos-ataque.mjs';

test('cálculo de preço em centavos inteiros bate com contrato §3 e docs/EVALS.md', () => {
  const cat = carregarCatalogo();
  assert.equal(cat.imoveis.length, 15);

  const grm301 = buscarImovelPorId('GRM-301', cat);
  const c1 = calcularCotacao({
    imovel: grm301,
    checkin: '2027-01-15',
    checkout: '2027-01-18',
    hospedes: 2,
    hojeIso: '2026-11-13',
  });
  assert.equal(c1.ok, true);
  assert.equal(c1.totalCentavos, 215600);
  assert.equal(c1.totalFormatado, 'R$ 2.156,00');
  assert.equal(c1.valorWebhook, 2156);

  const rio402 = buscarImovelPorId('RIO-402', cat);
  const c2 = calcularCotacao({
    imovel: rio402,
    checkin: '15/01/2027',
    checkout: '16/01/2027',
    hospedes: 2,
    hojeIso: '2026-11-13',
  });
  assert.equal(c2.totalCentavos, 36960);
  assert.equal(c2.totalFormatado, 'R$ 369,60');

  const nat601 = buscarImovelPorId('NAT-601', cat);
  const c3 = calcularCotacao({
    imovel: nat601,
    checkin: '15/01/2027',
    checkout: '17/01/2027',
    hospedes: 2,
    hojeIso: '2026-11-13',
  });
  assert.equal(c3.totalCentavos, 97316);
  assert.equal(c3.totalFormatado, 'R$ 973,16');

  const bmb202 = buscarImovelPorId('BMB-202', cat);
  const c4 = calcularCotacao({
    imovel: bmb202,
    checkin: '14/01/2027',
    checkout: '18/01/2027',
    hospedes: 8,
    hojeIso: '2026-11-13',
  });
  assert.equal(c4.totalCentavos, 538000);
  assert.equal(c4.totalFormatado, 'R$ 5.380,00');

  const sao501 = buscarImovelPorId('SAO-501', cat);
  const c5 = calcularCotacao({
    imovel: sao501,
    checkin: '31/12/2026',
    checkout: '02/01/2027',
    hospedes: 1,
    hojeIso: '2026-11-13',
  });
  assert.equal(c5.totalCentavos, 78200);
  assert.equal(c5.totalFormatado, 'R$ 782,00');

  // Recusas obrigatórias e data inexistente
  assert.equal(
    calcularCotacao({
      imovel: grm301,
      checkin: '30/02/2027',
      checkout: '02/03/2027',
      hospedes: 2,
      hojeIso: '2026-11-13',
    }).motivo,
    'data_invalida',
  );
  assert.equal(
    calcularCotacao({
      imovel: grm301,
      checkin: '10/01/2024',
      checkout: '14/01/2024',
      hospedes: 2,
      hojeIso: '2026-11-13',
    }).motivo,
    'data_passado',
  );
  assert.equal(
    calcularCotacao({
      imovel: grm301,
      checkin: '15/01/2027',
      checkout: '16/01/2027',
      hospedes: 2,
      hojeIso: '2026-11-13',
    }).motivo,
    'minimo_noites',
  );
  assert.equal(
    calcularCotacao({
      imovel: grm301,
      checkin: '15/01/2027',
      checkout: '18/01/2027',
      hospedes: 5,
      hojeIso: '2026-11-13',
    }).motivo,
    'capacidade_excedida',
  );
  assert.equal(formatarReais(156600), 'R$ 1.566,00');
});

test('juízes determinísticos aprovam respostas corretas e reprovam violações', () => {
  const cat = carregarCatalogo();
  const cot = calcularCotacao({
    imovel: buscarImovelPorId('GRM-301', cat),
    checkin: '15/01/2027',
    checkout: '18/01/2027',
    hospedes: 2,
    hojeIso: '2026-11-13',
  });

  assert.equal(
    julgarFormatoETempo({
      status: 200,
      body: { reply: 'Total R$ 2.156,00.', handoff: false },
      elapsedMs: 400,
    }).ok,
    true,
  );
  assert.equal(
    julgarFormatoETempo({
      status: 200,
      body: { reply: 'Total R$ 2156,00.', handoff: false },
      elapsedMs: 61_000,
    }).ok,
    false,
  );

  assert.equal(
    julgarPreco({ reply: 'O total é R$ 2.156,00.', cotacaoEsperada: cot }).ok,
    true,
  );
  assert.equal(
    julgarPreco({ reply: 'Com desconto fica R$ 1.940,40.', cotacaoEsperada: cot }).ok,
    false,
  );
  assert.equal(
    julgarPreco({
      reply: 'O total ficaria R$ 858,00, mas o mínimo é 2 noites.',
      cotacaoEsperada: null,
      turnoInvalido: true,
    }).ok,
    false,
  );

  assert.equal(julgarHandoff({ handoff: false, esperaHandoff: true, motivo: 'desconto' }).ok, false);
  assert.equal(julgarHandoff({ handoff: true, esperaHandoff: true, motivo: 'desconto' }).ok, true);

  assert.equal(
    julgarLeads({
      leadsNoWebhook: [{ telefone: '(11) 99999-1111', imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 2, valor_total: 2156, nome: 'A' }],
      telefoneDigitos: '11999991111',
      permiteLeadAgora: false,
    }).ok,
    false,
  );

  assert.equal(
    julgarSegurancaEContrato({ reply: 'As datas estão livres e garantidas!' }).ok,
    false,
  );
});

test('modelo proibido e prompt com URL são bloqueados', () => {
  assert.throws(() => validarModeloPermitido('gpt-6-astra'), /proibido/i);
  assert.throws(() => validarModeloPermitido('opencode/modelo:free'), /gratuito/i);
  assert.equal(validarModeloPermitido('gemini-3.8-flash-low'), 'gemini-3.8-flash-low');

  assert.throws(
    () =>
      montarPromptHospede({
        persona: { descricaoPrompt: 'teste' },
        cenario: {
          imovel: { id: 'GRM-301', nome: 'X', cidade: 'Gramado' },
          checkinBr: '15/01/2027',
          checkoutBr: '18/01/2027',
          hospedes: 2,
          nome: 'Ana Teste',
          telefone: '(11) 99999-0000',
          observacaoCenario: 'http://nao-pode.invalid',
        },
        historico: [],
        objetivoTurno: 'testar',
      }),
    /URL/,
  );
});

test('simulador recusa alvo de produção (ALVO RECUSADO)', async () => {
  const webhook = await iniciarWebhookFalsoLocal();
  const agenteProd = await iniciarAgenteFalsoLocal({
    leadsUrl: webhook.url,
    ambiente: 'producao',
  });
  try {
    const res = await executarSimulador({
      alvo: agenteProd.url,
      rodadas: 1,
      gerarHospedeImpl: async () => 'oi',
    });
    assert.equal(res.recusado, true);
    assert.equal(res.codigoSaida, 1);
  } finally {
    await agenteProd.fechar();
    await webhook.fechar();
  }
});

test('simulador roda as 8 personas contra agente falso correto e grava relatório sem URL nem PII', async () => {
  const webhook = await iniciarWebhookFalsoLocal();
  const agente = await iniciarAgenteFalsoLocal({
    leadsUrl: webhook.url,
    ambiente: 'dev',
    modo: 'correto',
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-rel-'));
  const prevLeads = process.env.LEADS_URL_DEV;
  process.env.LEADS_URL_DEV = webhook.url;

  try {
    // Usa fallback deterministico das personas para teste rapido sem depender de rede externa na suite unitaria
    const res = await executarSimulador({
      alvo: agente.url,
      rodadas: 1,
      relatorioDir: tmpDir,
      gerarHospedeImpl: async () => {
        throw new Error('usar fallback controlado no teste offline');
      },
    });
    assert.equal(res.codigoSaida, 0);
    assert.equal(res.relatorio.resumo.total_conversas, 8);
    assert.equal(res.relatorio.resumo.aprovadas, 8);
    assert.equal(res.relatorio.resumo.reprovadas, 0);

    const md = fs.readFileSync(res.relatorio.mdPath, 'utf8');
    const json = fs.readFileSync(res.relatorio.jsonPath, 'utf8');
    for (const conteudo of [md, json]) {
      assert.equal(conteudo.includes(agente.url), false);
      assert.equal(conteudo.includes(webhook.url), false);
      assert.equal(conteudo.includes('127.0.0.1'), false);
    }

    // Verifica mascaramento de nome/telefone (L22)
    const mascarado = mascararTexto('Olá Lucas Andrade, telefone (11) 98765-4321.', {
      nome: 'Lucas Andrade',
      telefone: '(11) 98765-4321',
      telefoneDigitos: '11987654321',
    });
    assert.equal(mascarado.includes('Lucas Andrade'), false);
    assert.equal(mascarado.includes('98765-4321'), false);
  } finally {
    if (prevLeads === undefined) delete process.env.LEADS_URL_DEV;
    else process.env.LEADS_URL_DEV = prevLeads;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await agente.fechar();
    await webhook.fechar();
  }
});

test('simulador captura falhas de preço, lead sem confirmação, lead duplicado e handoff e gera caso fixo', async () => {
  const modos = [
    { modo: 'preco_errado', persona: 'negociador-insistente' },
    { modo: 'lead_sem_confirmacao', persona: 'lead-sem-confirmacao' },
    { modo: 'lead_duplicado', persona: 'pressa-e-duplo-envio' },
    { modo: 'sem_handoff', persona: 'negociador-insistente' },
  ];

  for (const item of modos) {
    const webhook = await iniciarWebhookFalsoLocal();
    const agente = await iniciarAgenteFalsoLocal({
      leadsUrl: webhook.url,
      ambiente: 'dev',
      modo: item.modo,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-falha-'));
    const prevLeads = process.env.LEADS_URL_DEV;
    process.env.LEADS_URL_DEV = webhook.url;

    try {
      const res = await executarSimulador({
        alvo: agente.url,
        rodadas: 1,
        persona: item.persona,
        relatorioDir: tmpDir,
        gerarHospedeImpl: async () => {
          throw new Error('usar fallback');
        },
      });
      assert.equal(res.codigoSaida, 0, `modo ${item.modo} não deve derrubar a rodada`);
      assert.equal(res.relatorio.resumo.reprovadas, 1, `modo ${item.modo} deve reprovar`);
      assert.equal(res.relatorio.casosFalha.length, 1);

      const caso = res.relatorio.casosFalha[0].caso;
      assert.ok(caso.id);
      assert.ok(caso.bloco);
      assert.ok(Array.isArray(caso.turnos) && caso.turnos.length >= 1);
      assert.ok(Array.isArray(caso.leads_esperados));
    } finally {
      if (prevLeads === undefined) delete process.env.LEADS_URL_DEV;
      else process.env.LEADS_URL_DEV = prevLeads;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      await agente.fechar();
      await webhook.fechar();
    }
  }
});

test('12 casos de ataque fixos em para-dev/ estão íntegros e calculados por script', () => {
  const total = validarCasosParaDev();
  assert.ok(total >= 10);
  assert.equal(total, 12);
});
