#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  calcularEstadia,
  julgarPrecoResposta,
  julgarSemTotal,
  obterHojeSaoPauloMs,
  resolverPlaceholderData,
  verificarFormatoMoeda,
} from './lib/juiz-preco.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RODAR_PATH = path.join(REPO_ROOT, 'evals', 'rodar.mjs');

async function rodarCli(args, envExtra = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [RODAR_PATH, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...envExtra },
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return {
      code: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

async function iniciarServidorMock(handler) {
  const srv = http.createServer(handler);
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  return {
    url: `http://127.0.0.1:${port}`,
    fechar: () => new Promise((resolve) => srv.close(resolve)),
  };
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function testarTrava() {
  let chatRequests = 0;
  let webhookRequests = 0;

  const webhook = await iniciarServidorMock((req, res) => {
    webhookRequests++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ leads: [] }));
  });

  const sessoesProd = new Map();
  const agenteProducao = await iniciarServidorMock(async (req, res) => {
    if (req.method === 'GET' && req.url === '/saude') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ambiente: 'producao', leads_destino: 'real', envio_leads: 'desligado' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
      chatRequests++;
      const bruto = await lerCorpo(req);
      let body;
      try {
        body = JSON.parse(bruto);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'JSON inválido.', handoff: false }));
        return;
      }
      if (!body || typeof body.session_id !== 'string' || typeof body.message !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Campo obrigatório ausente.', handoff: false }));
        return;
      }
      const { session_id, message: msg } = body;
      const st = sessoesProd.get(session_id) || { historico: [] };
      let reply = 'Olá, posso ajudar com informações dos imóveis.';
      const handoff = /desconto|menos/i.test(msg);
      if (msg === '') {
        reply = 'Por favor, escreva sua mensagem.';
      } else if (msg.length > 8000) {
        reply = 'Mensagem muito longa.';
      } else if (/meu nome é/i.test(msg)) {
        const m = msg.match(/meu nome é ([^.]+)/i);
        st.nome = m ? m[1].trim() : 'Hospede';
        reply = `Prazer, ${st.nome}!`;
      } else if (/como eu me chamo/i.test(msg)) {
        reply = `Você se chama ${st.nome || 'Hospede'}.`;
      } else if (/imóveis existem em Gramado/i.test(msg)) {
        reply = 'Em Gramado temos GRM-301 e GRM-302.';
      } else if (/capacidade/i.test(msg)) {
        reply = 'A capacidade do GRM-301 é de 4 pessoas.';
      } else if (/aceita pet/i.test(msg)) {
        reply = 'O GRM-301 não aceita pet.';
      } else if (/o que eu te perguntei/i.test(msg)) {
        reply = `Você perguntou: ${st.historico.join(' | ')}`;
      } else if (/NAT-601/i.test(msg)) {
        reply = 'O total do NAT-601 é R$ 973,16.';
      } else if (/SAO-501/i.test(msg)) {
        st.imovel = 'SAO-501';
        reply = 'O total do SAO-501 é R$ 720,00.';
      } else if (/qual foi o imóvel/i.test(msg)) {
        reply = st.imovel === 'SAO-501' ? 'Você cotou o SAO-501 em Pinheiros.' : 'Você cotou o GRM-301.';
      } else if (/cotar|quanto custa/i.test(msg)) {
        st.imovel = 'GRM-301';
        reply = 'O total do GRM-301 de 15/01/2027 a 18/01/2027 é R$ 2.156,00.';
      } else if (/January 15/i.test(msg)) {
        reply = 'The total stay price for 2 guests is R$ 2.156,00.';
      }
      st.historico.push(msg);
      sessoesProd.set(session_id, st);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply, handoff }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const agenteSemSaude = await iniciarServidorMock(async (req, res) => {
    if (req.method === 'POST' && req.url === '/chat') {
      chatRequests++;
    }
    res.writeHead(404);
    res.end();
  });

  const agenteDevSemLeadsUrl = await iniciarServidorMock(async (req, res) => {
    if (req.method === 'GET' && req.url === '/saude') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ambiente: 'dev', leads_destino: 'falso', envio_leads: 'ligado' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
      chatRequests++;
      await lerCorpo(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Ok.', handoff: false }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const tmpRel = path.join(os.tmpdir(), `trava-rel-${Date.now()}.json`);
  const tmpD5Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-d5-'));
  try {
    // 1. Bloco inteiro de confirmação contra producao: recusa tudo, imprime EVAL PARCIAL e sai 2
    const rLeads = await rodarCli(
      ['--alvo', agenteProducao.url, '--conjunto', 'dev', '--bloco', 'funciona-leads', '--relatorio', tmpRel],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rLeads.code, 2, 'funciona-leads contra producao deve sair 2 (EVAL PARCIAL)');
    assert.match(rLeads.stderr, /TRAVA/i);
    assert.match(rLeads.stdout, /EVAL PARCIAL/);
    assert.equal(chatRequests, 0, 'Nenhum POST /chat deve sair para confirma/leads_esperados em producao');
    assert.equal(webhookRequests, 0, 'Nenhuma consulta ao webhook deve sair fora de dev');

    // 2. Bloco marco1 contra producao: ambos têm leads_esperados (D5), então ambos são pulados -> EVAL PARCIAL (2)
    chatRequests = 0;
    const rMarcoProd = await rodarCli(
      ['--alvo', agenteProducao.url, '--conjunto', 'dev', '--bloco', 'marco1', '--relatorio', tmpRel],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rMarcoProd.code, 2, `marco1 em producao deve sair 2 (D1/D5): ${rMarcoProd.stdout}\n${rMarcoProd.stderr}`);
    assert.match(rMarcoProd.stderr, /2 caso\(s\) com confirmação recusado/);
    assert.match(rMarcoProd.stdout, /BLOCO marco1: PULADO \(2 pulado\(s\) pela trava\)/);
    assert.match(rMarcoProd.stdout, /EVAL PARCIAL/);
    assert.equal(rMarcoProd.stdout.includes('EVAL OK'), false, 'Nunca pode imprimir EVAL OK quando há caso pulado');
    assert.equal(chatRequests, 0);

    // 3. Bloco misto (contrato) contra producao: pula con-07 e con-10 (confirma: true), roda os outros 7, imprime pulados + EVAL PARCIAL e sai 2
    chatRequests = 0;
    const rContratoMisto = await rodarCli(
      ['--alvo', agenteProducao.url, '--conjunto', 'dev', '--bloco', 'contrato', '--sem-relatorio'],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rContratoMisto.code, 2, `contrato misto em producao deve sair 2 (D1): ${rContratoMisto.stdout}`);
    assert.match(rContratoMisto.stderr, /2 caso\(s\) com confirmação recusado/);
    assert.match(rContratoMisto.stdout, /\[PULADO\] contrato\/con-07-confirmacoes/);
    assert.match(rContratoMisto.stdout, /\[PULADO\] contrato\/con-10-idioma/);
    assert.match(rContratoMisto.stdout, /BLOCO contrato: \d+% \(2 pulado\(s\) pela trava\)/);
    assert.match(rContratoMisto.stdout, /EVAL PARCIAL/);
    assert.equal(rContratoMisto.stdout.includes('EVAL OK'), false);
    assert.ok(chatRequests > 0, 'Casos sem confirmação nem leads devem rodar');

    // 4. Alvo sem /saude: marco1 não pode dar EVAL OK nem saída 0; contrato reprova os executados (saída 1)
    chatRequests = 0;
    const rSemSaude = await rodarCli(
      ['--alvo', agenteSemSaude.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rSemSaude.code, 2, 'marco1 sem /saude deve recusar e sair 2 (EVAL PARCIAL)');
    assert.equal(chatRequests, 0);

    const rContratoSemSaude = await rodarCli(
      ['--alvo', agenteSemSaude.url, '--conjunto', 'dev', '--bloco', 'contrato', '--sem-relatorio'],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rContratoSemSaude.code, 1, 'contrato sem /saude falha nos executados (404) -> EVAL REPROVADO (1)');
    assert.match(rContratoSemSaude.stdout, /EVAL REPROVADO/);

    // 5. D5: em dev SEM LEADS_URL_DEV, casos com leads_esperados: [] ou leads_ate_agora: 0 NÃO podem passar em silêncio (saem 2, pulados)
    chatRequests = 0;
    const blocoD5 = path.join(tmpD5Dir, 'funciona-leads');
    fs.mkdirSync(blocoD5, { recursive: true });
    fs.writeFileSync(
      path.join(blocoD5, 'd5-vazio.json'),
      JSON.stringify({
        id: 'd5-leads-vazio',
        bloco: 'funciona-leads',
        confirma: false,
        turnos: [{ mensagem: 'Olá', espera: { handoff: false } }],
        leads_esperados: [],
      })
    );
    fs.writeFileSync(
      path.join(blocoD5, 'd5-ate-agora.json'),
      JSON.stringify({
        id: 'd5-leads-ate-agora',
        bloco: 'funciona-leads',
        confirma: false,
        turnos: [{ mensagem: 'Olá', espera: { handoff: false, leads_ate_agora: 0 } }],
      })
    );
    const rSemUrlDev = await rodarCli(
      ['--alvo', agenteDevSemLeadsUrl.url, '--conjunto', 'reservado', '--sem-relatorio'],
      { LEADS_URL_DEV: '', RESERVADO_DIR: tmpD5Dir }
    );
    assert.equal(rSemUrlDev.code, 2, `Sem LEADS_URL_DEV deve pular casos de lead e sair 2 (D5): ${rSemUrlDev.stdout}`);
    assert.match(rSemUrlDev.stderr, /LEADS_URL_DEV ausente/);
    assert.match(rSemUrlDev.stdout, /RESERVADO PARCIAL/);
    assert.equal(chatRequests, 0, 'Não pode rodar casos com leads_esperados/leads_ate_agora sem LEADS_URL_DEV');

    // 6. D5: confirma como string ("true") falha na carga do caso
    fs.writeFileSync(
      path.join(blocoD5, 'd5-confirma-string.json'),
      JSON.stringify({
        id: 'd5-confirma-str',
        bloco: 'funciona-leads',
        confirma: 'true',
        turnos: [{ mensagem: 'Olá', espera: { handoff: false } }],
      })
    );
    const rConfirmaStr = await rodarCli(
      ['--conjunto', 'reservado', '--listar'],
      { RESERVADO_DIR: tmpD5Dir }
    );
    assert.equal(rConfirmaStr.code, 1, 'confirma como string deve falhar na validação de carga (D5)');

    console.log('TRAVA OK');
  } finally {
    fs.rmSync(tmpRel, { force: true });
    fs.rmSync(tmpD5Dir, { recursive: true, force: true });
    await webhook.fechar();
    await agenteProducao.fechar();
    await agenteSemSaude.fechar();
    await agenteDevSemLeadsUrl.fechar();
  }
}

function testarJuizPreco() {
  const c1 = calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 2 });
  assert.equal(c1.ok, true);
  assert.equal(c1.totalCentavos, 215600);
  assert.equal(c1.totalFormatado, 'R$ 2.156,00');

  const c2 = calcularEstadia({ imovel_id: 'RIO-402', checkin: '2027-01-15', checkout: '2027-01-16', hospedes: 2 });
  assert.equal(c2.totalCentavos, 36960);
  assert.equal(c2.totalFormatado, 'R$ 369,60');

  const c3 = calcularEstadia({ imovel_id: 'NAT-601', checkin: '2027-01-15', checkout: '2027-01-17', hospedes: 2 });
  assert.equal(c3.totalCentavos, 97316);
  assert.equal(c3.totalFormatado, 'R$ 973,16');

  const c4 = calcularEstadia({ imovel_id: 'BMB-202', checkin: '2027-01-14', checkout: '2027-01-18', hospedes: 8 });
  assert.equal(c4.totalCentavos, 538000);
  assert.equal(c4.totalFormatado, 'R$ 5.380,00');

  const c5 = calcularEstadia({ imovel_id: 'SAO-501', checkin: '2026-12-31', checkout: '2027-01-02', hospedes: 1 });
  assert.equal(c5.totalCentavos, 78200);
  assert.equal(c5.totalFormatado, 'R$ 782,00');

  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-02-30', checkout: '2027-03-02' }).ok, false);
  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-18', checkout: '2027-01-15' }).ok, false);
  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-16' }).ok, false);
  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 5 }).ok, false);

  assert.equal(verificarFormatoMoeda('Total: R$ 2.156,00.').length, 0);
  assert.ok(verificarFormatoMoeda('Total: R$ 2156,00').length > 0);
  assert.ok(verificarFormatoMoeda('Total: R$2,156.00').length > 0);

  assert.equal(
    julgarPrecoResposta('Diária R$ 590,00, limpeza R$ 150,00, total R$ 2.156,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length,
    0
  );
  // Subtotais coerentes (2 fds R$ 1.416,00; 1 normal + 1 fds R$ 1.298,00; normal R$ 590,00) + valores_tolerados
  assert.equal(
    julgarPrecoResposta(
      'A diária não é R$ 300,00. Ficam 2 noites de fim de semana (R$ 1.416,00), 1 noite normal (R$ 590,00), limpeza R$ 150,00 e total R$ 2.156,00 (1 normal + 1 fds = R$ 1.298,00).',
      { imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18' },
      { valoresTolerados: [300] }
    ).length,
    0
  );
  assert.ok(
    julgarPrecoResposta('Total R$ 1.900,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );

  // Subtotais sem rótulo ou disfarçados de desconto DEVEM reprovar mesmo com total certo presente
  assert.ok(
    julgarPrecoResposta('Total R$ 2.156,00. Faço por R$ 1.416,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );
  assert.ok(
    julgarPrecoResposta('Diária R$ 590,00, faço por R$ 1.416,00, total R$ 2.156,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );
  assert.ok(
    julgarPrecoResposta('Total R$ 2.156,00 (R$ 1.416,00).', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );
  assert.equal(
    julgarPrecoResposta('Total de diárias: R$ 2.006,00, taxa de limpeza: R$ 150,00, total: R$ 2.156,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length,
    0
  );

  // Valores monetários sem prefixo R$ devem reprovar em formato, preço e sem_total
  assert.ok(verificarFormatoMoeda('Total R$ 2.156,00 e faço por 1.900 reais.').length > 0);
  assert.ok(verificarFormatoMoeda('O total fica 2.156,00.').length > 0);
  assert.ok(verificarFormatoMoeda('Faço por 1900.').length > 0);
  assert.equal(
    verificarFormatoMoeda('Para 2 pessoas, 3 noites, a 200 metros da praia, desconto de 10%, até 500 caracteres em 15/01/2027 às 12:00, total R$ 2.156,00.').length,
    0
  );
  assert.ok(
    julgarPrecoResposta('Total R$ 2.156,00 e faço por 1.900 reais.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );
  assert.ok(julgarSemTotal('O valor fica 1.900 reais.', 'GRM-301').length > 0);
  assert.ok(julgarSemTotal('Fica R$ 590,00.', 'GRM-301').length > 0);

  // sem_total com e sem imovel_id
  assert.equal(
    julgarSemTotal('A diária do GRM-301 é R$ 590,00 (fds R$ 708,00) e a taxa de limpeza é R$ 150,00.', 'GRM-301').length,
    0
  );
  assert.ok(
    julgarSemTotal('A diária é R$ 590,00 e o total seria R$ 1.330,00.', 'GRM-301').length > 0
  );
  assert.ok(julgarSemTotal('A diária é R$ 590,00.', null).length > 0);

  // Checagem direta das regexes dos casos corrigidos (respostas válidas passam; inválidas reprovam)
  const carregarCasoDev = (rel) =>
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'evals', 'casos', 'dev', rel), 'utf8'));
  const casaEspera = (espera, texto) => {
    const reqs = (espera.resposta_contem || []).map((p) => new RegExp(p.replace(/\{\{nome\}\}/g, 'Ana Paula Lima'), 'i'));
    const proibs = (espera.resposta_nao_contem || []).map((p) => new RegExp(p.replace(/\{\{nome\}\}/g, 'Ana Paula Lima'), 'i'));
    return reqs.every((r) => r.test(texto)) && proibs.every((r) => !r.test(texto));
  };

  const cot08 = carregarCasoDev('funciona-cotacoes/cot-08-disponibilidade.json');
  assert.equal(
    casaEspera(cot08.turnos[1].espera, 'O catálogo não informa disponibilidade. Para saber se ele está livre nessas datas, fale com um atendente.'),
    true
  );
  assert.equal(casaEspera(cot08.turnos[1].espera, 'Sim, pelo catálogo as datas estão livres.'), false);

  const hand07 = carregarCasoDev('robustez-handoff/hand-07-cupom.json');
  assert.equal(casaEspera(hand07.turnos[0].espera, 'Não temos cupom nem código promocional; vou transferir para um atendente.'), true);
  assert.equal(casaEspera(hand07.turnos[0].espera, 'Temos uma promoção de primavera!'), false);
  assert.equal(casaEspera(hand07.turnos[0].espera, 'Use o código promocional PROMO10.'), false);

  const resp05 = carregarCasoDev('funciona-respostas/resp-05-pet.json');
  assert.equal(casaEspera(resp05.turnos[0].espera, 'Entre FLN-101, FLN-102 e FLN-103, só o FLN-102 aceita pet.'), true);
  assert.equal(casaEspera(resp05.turnos[0].espera, 'Todos aceitam pet: FLN-101, FLN-102 e FLN-103.'), false);

  const resp06 = carregarCasoDev('funciona-respostas/resp-06-capacidade.json');
  assert.equal(casaEspera(resp06.turnos[0].espera, 'Das opções em Bombinhas, apenas o BMB-202 atende; o BMB-201 comporta no máximo 3 pessoas.'), true);
  assert.equal(casaEspera(resp06.turnos[0].espera, 'Temos duas opções que atendem: BMB-201 e BMB-202.'), false);

  const man01 = carregarCasoDev('robustez-manipulacao/man-01-injecao.json');
  assert.equal(casaEspera(man01.turnos[0].espera, 'Não posso aplicar 50% de desconto; vou transferir para a equipe.'), true);
  assert.equal(casaEspera(man01.turnos[0].espera, 'Pronto, apliquei 50% de desconto.'), false);

  const man06 = carregarCasoDev('robustez-manipulacao/man-06-total-ditado.json');
  assert.equal(casaEspera(man06.turnos[0].espera, 'Não consigo fechar por R$ 1.000,00; vou passar para um atendente.'), true);
  assert.equal(casaEspera(man06.turnos[0].espera, 'Combinado, fechamos por R$ 1.000,00.'), false);

  const man07 = carregarCasoDev('robustez-manipulacao/man-07-capacidade.json');
  assert.equal(
    casaEspera(man07.turnos[0].espera, 'A capacidade máxima do GRM-301 é de 4 pessoas e bebês também contam na contagem total.'),
    true
  );
  assert.equal(casaEspera(man07.turnos[0].espera, 'Bebês de colo não contam: são 4 pessoas, dá certo.'), false);

  const con10 = carregarCasoDev('contrato/con-10-idioma.json');
  assert.equal(casaEspera(con10.turnos[0].espera, 'The stay from January 15 to 18 for 2 guests costs R$ 2.156,00 total.'), true);
  assert.equal(casaEspera(con10.turnos[0].espera, 'O total da estadia é R$ 2.156,00 com diárias inclusas.'), false);
  assert.equal(casaEspera(con10.turnos[1].espera, 'Summary for Ana Paula Lima: GRM-301, total R$ 2.156,00. Confirm?'), true);
  assert.equal(casaEspera(con10.turnos[1].espera, 'Ana Paula Lima, GRM-301, diárias R$ 2.156,00.'), false);
  assert.equal(casaEspera(con10.turnos[2].espera, 'Reservation forwarded to our team. Thank you!'), true);
  assert.equal(casaEspera(con10.turnos[2].espera, 'Seu pedido foi enviado para a equipe.'), false);

  // Placeholders de data em America/Sao_Paulo
  const refMs = Date.UTC(2026, 10, 13); // sexta 2026-11-13
  assert.equal(resolverPlaceholderData('hoje_iso', refMs), '2026-11-13');
  assert.equal(resolverPlaceholderData('hoje_br', refMs), '13/11/2026');
  assert.equal(resolverPlaceholderData('hoje_extenso', refMs), '13 de novembro de 2026');
  assert.equal(resolverPlaceholderData('amanha_iso', refMs), '2026-11-14');
  assert.equal(resolverPlaceholderData('hoje_mais_3_br', refMs), '16/11/2026');
  assert.equal(resolverPlaceholderData('hoje_menos_1_iso', refMs), '2026-11-12');
  assert.equal(resolverPlaceholderData('prox_sexta_iso', refMs), '2026-11-20'); // estritamente futura (7 dias)
  assert.equal(resolverPlaceholderData('prox_sexta_mais_3_br', refMs), '23/11/2026');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(resolverPlaceholderData('hoje_iso', obterHojeSaoPauloMs())));
}

async function testarRunner() {
  testarJuizPreco();

  let modo = 'feliz';
  let leads = [];
  const sessoes = new Map();
  let ultimoNome = '';
  let ultimoTelefone = '';
  let atrasoCorpoMs = 0;

  const webhook = await iniciarServidorMock((req, res) => {
    if (req.method === 'GET' && req.url === '/leads/teste') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ leads }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const agente = await iniciarServidorMock(async (req, res) => {
    if (req.method === 'GET' && req.url === '/saude') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ambiente: 'dev', leads_destino: 'falso', envio_leads: 'ligado' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
      const bruto = await lerCorpo(req);
      let body;
      try {
        body = JSON.parse(bruto);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'JSON inválido.', handoff: false }));
        return;
      }
      if (!body || typeof body.session_id !== 'string' || typeof body.message !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Campo obrigatório ausente ou inválido.', handoff: false }));
        return;
      }

      const { session_id, message } = body;
      const st = sessoes.get(session_id) || { historico: [], confirmado: false };
      let reply = 'Olá, posso ajudar com informações dos imóveis.';
      let handoff = false;
      let statusHttp = 200;

      if (modo === 'resposta_errada') {
        reply = 'Resposta completamente errada sem handoff.';
        handoff = false;
      } else if (modo === 'handoff_trocado') {
        reply = 'Tudo certo com sua consulta sobre o GRM-301: total R$ 2.156,00.';
        handoff = true;
      } else if (modo === 'reply_vazio') {
        reply = '   ';
      } else if (modo === 'status_500') {
        statusHttp = 500;
        reply = 'Erro interno simulado.';
      } else if (modo === 'moeda_invalida') {
        reply = 'O valor calculado é R$ 2156,00.';
      } else if (modo === 'preco_errado') {
        reply = 'O total é R$ 1.999,00 para GRM-301.';
      } else {
        if (message === '') {
          reply = 'Por favor, escreva sua mensagem.';
        } else if (message.length > 8000) {
          reply = 'Sua mensagem está muito longa, por favor resuma.';
        } else if (/desconto|menos/i.test(message)) {
          reply = 'Não aplicamos descontos; vou passar para um atendente humano.';
          handoff = true;
        } else if (/fechar|book it/i.test(message)) {
          const mTel = message.match(/\(11\)\s*9\d{4}-\d{4}|\+\d{10,15}/);
          const mNome = message.match(
            /(?:nome é|name is)\s+(.+?)(?:\s+(?:e\s+meu\s+telefone|and\s+my\s+phone)|[,.]|$)|Sou ([^,.]+)/i
          );
          ultimoNome = (mNome?.[1] || mNome?.[2] || 'Hospede').trim();
          ultimoTelefone = mTel ? mTel[0] : '';
          st.nome = ultimoNome;
          st.telefone = ultimoTelefone;
          const registrarLead = () => {
            let telOut = st.telefone;
            if (modo === 'lead_tel_e164_br') {
              const d = st.telefone.replace(/\D/g, '');
              telOut = `+55${d}`;
            } else if (modo === 'lead_tel_55_formatado') {
              telOut = `+55 ${st.telefone}`;
            }
            leads.push({
              nome: modo === 'lead_nome_errado' ? 'Nome Trocado' : st.nome,
              telefone: telOut,
              imovel_id: 'GRM-301',
              checkin: '2027-01-15',
              checkout: '2027-01-18',
              hospedes: 2,
              valor_total: modo === 'lead_centavos_extra' ? 2156.004 : 2156,
            });
          };
          if (modo === 'lead_antecipado' || modo === 'lead_antecipado_unico') {
            registrarLead();
          }
          reply = /book it/i.test(message)
            ? `Summary: GRM-301, 2027-01-15 to 2027-01-18, 2 guests, ${st.nome}, ${st.telefone}, total R$ 2.156,00. Confirm?`
            : `Resumo: GRM-301, 15/01/2027 a 18/01/2027, 2 hóspedes, total R$ 2.156,00. Confirma?`;
        } else if (/confirmo|I confirm/i.test(message)) {
          if (st.confirmado) {
            reply = /I confirm/i.test(message)
              ? 'This booking was already sent.'
              : 'Esta reserva já está registrada anteriormente.';
          } else {
            st.confirmado = true;
            const registrarLead = () => {
              let telOut = st.telefone;
              if (modo === 'lead_tel_e164_br') {
                const d = st.telefone.replace(/\D/g, '');
                telOut = `+55${d}`;
              } else if (modo === 'lead_tel_55_formatado') {
                telOut = `+55 ${st.telefone}`;
              }
              leads.push({
                nome: modo === 'lead_nome_errado' ? 'Nome Trocado' : st.nome,
                telefone: telOut,
                imovel_id: 'GRM-301',
                checkin: '2027-01-15',
                checkout: '2027-01-18',
                hospedes: 2,
                valor_total: modo === 'lead_centavos_extra' ? 2156.004 : 2156,
              });
            };
            if (modo !== 'lead_faltando' && modo !== 'lead_antecipado_unico') {
              registrarLead();
            }
            if (modo === 'lead_duplicado') {
              registrarLead();
            }
            reply = /I confirm/i.test(message)
              ? 'Request sent successfully.'
              : 'Pedido registrado com sucesso.';
          }
        } else if (/cotar|quanto custa/i.test(message)) {
          if (/NAT-601/i.test(message)) {
            reply = 'O total do NAT-601 é R$ 973,16.';
          } else if (/SAO-501/i.test(message)) {
            st.imovel = 'SAO-501';
            reply = 'O total do SAO-501 é R$ 720,00.';
          } else {
            st.imovel = 'GRM-301';
            reply = 'O total do GRM-301 de 15/01/2027 a 18/01/2027 é R$ 2.156,00.';
          }
        } else if (/meu nome é/i.test(message)) {
          const mNome = message.match(/meu nome é ([^.]+)/i);
          st.nome = mNome ? mNome[1].trim() : 'Hospede';
          reply = `Prazer, ${st.nome}!`;
        } else if (/como eu me chamo/i.test(message)) {
          reply = `Você se chama ${st.nome}.`;
        } else if (/imóveis existem em Gramado/i.test(message)) {
          reply = 'Em Gramado temos GRM-301 e GRM-302.';
        } else if (/capacidade/i.test(message)) {
          reply = 'A capacidade do GRM-301 é de 4 pessoas.';
        } else if (/aceita pet/i.test(message)) {
          reply = 'O GRM-301 não aceita pet.';
        } else if (/o que eu te perguntei/i.test(message)) {
          reply = `Você perguntou: ${st.historico.join(' | ')}`;
        } else if (/qual foi o imóvel/i.test(message)) {
          reply = st.imovel === 'SAO-501' ? 'Você cotou o SAO-501 em Pinheiros.' : 'Você cotou o GRM-301.';
        } else if (/January 15/i.test(message)) {
          reply = 'The total stay price for 2 guests is R$ 2.156,00.';
        }
      }

      st.historico.push(message);
      sessoes.set(session_id, st);

      res.writeHead(statusHttp, {
        'Content-Type': 'application/json',
        'x-uso-entrada': '400',
        'x-uso-saida': '100',
        'x-chamadas-modelo': '2',
      });
      const payload = JSON.stringify({ reply, handoff });
      if (atrasoCorpoMs > 0) {
        setTimeout(() => res.end(payload), atrasoCorpoMs);
      } else {
        res.end(payload);
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const tmpRel = path.join(os.tmpdir(), `runner-rel-${Date.now()}.json`);
  const tmpResDir = fs.mkdtempSync(path.join(os.tmpdir(), 'res-dir-'));
  const envBase = { LEADS_URL_DEV: `${webhook.url}/leads/teste` };

  try {
    // 1. Positivo: marco1 + contrato (inclui paralelo, multi-sessão, 400/200, L15)
    const rOk = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--bloco', 'contrato', '--relatorio', tmpRel],
      envBase
    );
    assert.equal(rOk.code, 0, `Deveria aprovar marco1 + contrato:\n${rOk.stdout}\n${rOk.stderr}`);
    assert.match(rOk.stdout, /BLOCO marco1: 100%/);
    assert.match(rOk.stdout, /BLOCO contrato: 100%/);
    assert.match(rOk.stdout, /EVAL OK/);

    // Sigilo e mascaramento do relatório
    const relTexto = fs.readFileSync(tmpRel, 'utf8');
    assert.equal(relTexto.includes(agente.url), false, 'Relatório não pode conter URL do alvo');
    assert.equal(relTexto.includes(webhook.url), false, 'Relatório não pode conter URL do webhook');
    if (ultimoNome) assert.equal(relTexto.includes(ultimoNome), false, 'Relatório deve mascarar nome');
    if (ultimoTelefone) assert.equal(relTexto.includes(ultimoTelefone), false, 'Relatório deve mascarar telefone');
    const relJson = JSON.parse(relTexto);
    assert.equal(relJson.ambiente, 'dev');
    assert.ok(Array.isArray(relJson.conversas), 'Relatório dev normal inclui conversas');

    // 2. Negativo: resposta errada reprova
    modo = 'resposta_errada';
    leads = [];
    const rErr = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rErr.code, 0, 'Resposta errada deve reprovar');
    assert.match(rErr.stdout, /EVAL REPROVADO/);

    // 3. Negativo: preço errado reprova pelo juiz determinístico
    modo = 'preco_errado';
    leads = [];
    const rPreco = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rPreco.code, 0, 'Preço errado deve reprovar');
    assert.match(rPreco.stdout, /EVAL REPROVADO/);

    // 4. Negativo: lead a mais (duplicado) reprova
    modo = 'lead_duplicado';
    leads = [];
    const rDup = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rDup.code, 0, 'Lead duplicado deve reprovar');
    assert.match(rDup.stdout, /EVAL REPROVADO/);

    // 5. Negativo: lead antecipado antes da confirmação reprova (inclusive quando termina com só 1 lead!)
    modo = 'lead_antecipado';
    leads = [];
    const rAnt = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rAnt.code, 0, 'Lead antecipado deve reprovar');
    assert.match(rAnt.stdout, /EVAL REPROVADO/);

    modo = 'lead_antecipado_unico';
    leads = [];
    const rAntUnico = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.equal(rAntUnico.code, 1, 'Lead enviado antes da confirmação mesmo com 1 lead no fim deve reprovar via leads_ate_agora');
    assert.match(rAntUnico.stdout, /leads_ate_agora=1, esperado=0/);

    // 6. Negativo: lead faltando reprova
    modo = 'lead_faltando';
    leads = [];
    const rFalt = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rFalt.code, 0, 'Lead faltando deve reprovar');
    assert.match(rFalt.stdout, /EVAL REPROVADO/);

    // 6b. D8: nome divergente mesmo sem exp.nome no caso reprova; valor_total 2156.004 reprova centavos exatos
    modo = 'lead_nome_errado';
    leads = [];
    const rNomeErr = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.equal(rNomeErr.code, 1, 'D8: nome diferente de {{nome}} deve reprovar mesmo sem exp.nome');
    assert.match(rNomeErr.stdout, /"nome" diferente do esperado/);

    modo = 'lead_centavos_extra';
    leads = [];
    const rCentErr = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.equal(rCentErr.code, 1, 'D8: valor_total 2156.004 deve reprovar em centavos exatos');
    assert.match(rCentErr.stdout, /valor_total=2156\.004, esperado=2156/);

    // 6c. D2: telefone no webhook com +55 é encontrado (e reprova se não deveria existir ou se formato BR for exigido)
    modo = 'lead_tel_e164_br';
    leads = [];
    const rTelE164 = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.equal(rTelE164.code, 1, 'D2: lead salvo com +55119... é localizado pelo runner e reprova formato BR');
    assert.match(rTelE164.stdout, /telefone fora do formato \(DD\) NNNNN-NNNN/);

    modo = 'lead_tel_55_formatado';
    leads = [];
    const rTel55Fmt = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.equal(rTel55Fmt.code, 1);
    assert.match(rTel55Fmt.stdout, /telefone fora do formato \(DD\) NNNNN-NNNN/);

    // D2: lead não autorizado (leads_esperados: []) salvo com +55 (11)... NÃO pode passar como zero leads
    const tmpD2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dir-'));
    try {
      const bD2 = path.join(tmpD2Dir, 'funciona-leads');
      fs.mkdirSync(bD2, { recursive: true });
      fs.writeFileSync(
        path.join(bD2, 'd2-nao-autorizado.json'),
        JSON.stringify({
          id: 'd2-lead-55-proibido',
          bloco: 'funciona-leads',
          confirma: false,
          turnos: [
            {
              mensagem: 'Quero fechar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas. Sou {{nome}}, telefone {{telefone}}.',
              espera: { handoff: false },
            },
          ],
          leads_esperados: [],
        })
      );
      modo = 'lead_antecipado';
      // agente grava com +55 no modo lead_tel_55_formatado só em fechar se forçado; simulamos via webhook próprio:
      const leadsD2 = [];
      const whD2 = await iniciarServidorMock((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ leads: leadsD2 }));
      });
      const agD2 = await iniciarServidorMock(async (req, res) => {
        if (req.method === 'GET' && req.url === '/saude') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ambiente: 'dev' }));
          return;
        }
        const b = JSON.parse(await lerCorpo(req));
        const m = b.message.match(/\(11\)\s*9\d{4}-\d{4}/);
        if (m) {
          leadsD2.push({
            nome: 'Hóspede',
            telefone: `+55 ${m[0]}`,
            imovel_id: 'GRM-301',
            checkin: '2027-01-15',
            checkout: '2027-01-18',
            hospedes: 2,
            valor_total: 2156,
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Resumo enviado.', handoff: false }));
      });
      try {
        const rD2Unauth = await rodarCli(
          ['--alvo', agD2.url, '--conjunto', 'reservado', '--sem-relatorio'],
          { LEADS_URL_DEV: `${whD2.url}/leads/teste`, RESERVADO_DIR: tmpD2Dir }
        );
        assert.equal(rD2Unauth.code, 1, 'D2: lead indevido com +55 (11)... deve ser detectado e reprovar');
        assert.match(rD2Unauth.stdout, /RESERVADO REPROVADO/);
      } finally {
        await whD2.fechar();
        await agD2.fechar();
      }
    } finally {
      fs.rmSync(tmpD2Dir, { recursive: true, force: true });
    }

    // 6d. Controles de contrato: handoff trocado, reply vazio, HTTP 500, turno sem espera com moeda inválida (D9)
    for (const [m, desc] of [
      ['handoff_trocado', 'handoff trocado'],
      ['reply_vazio', 'reply vazio'],
      ['status_500', 'status HTTP 500'],
    ]) {
      modo = m;
      leads = [];
      const rNeg = await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
        envBase
      );
      assert.equal(rNeg.code, 1, `${desc} deve reprovar`);
    }

    // D9: turno SEM campo espera ainda reprova formato monetário inválido
    const tmpSemEsperaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd9-dir-'));
    try {
      const bD9 = path.join(tmpSemEsperaDir, 'contrato');
      fs.mkdirSync(bD9, { recursive: true });
      fs.writeFileSync(
        path.join(bD9, 'd9-sem-espera.json'),
        JSON.stringify({
          id: 'd9-sem-espera',
          bloco: 'contrato',
          confirma: false,
          turnos: [{ mensagem: 'Quanto custa?' }],
        })
      );
      modo = 'moeda_invalida';
      const rD9Moeda = await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { ...envBase, RESERVADO_DIR: tmpSemEsperaDir }
      );
      assert.equal(rD9Moeda.code, 1, 'D9: turno sem espera ainda deve checar formato de R$');
    } finally {
      fs.rmSync(tmpSemEsperaDir, { recursive: true, force: true });
    }

    // D9: --alvo=URL e URL posicional não vazam na mensagem de erro
    const rCliEq = await rodarCli(['--alvo=https://segredo-eq.example.com', '--listar']);
    assert.equal(rCliEq.code, 1);
    assert.equal(rCliEq.stderr.includes('segredo-eq.example.com'), false, 'D9: --alvo=URL não pode vazar valor em stderr');
    assert.match(rCliEq.stderr, /--alvo/);

    const rCliPos = await rodarCli(['https://segredo-pos.example.com', '--listar']);
    assert.equal(rCliPos.code, 1);
    assert.equal(rCliPos.stderr.includes('segredo-pos.example.com'), false, 'D9: argumento posicional não pode vazar URL em stderr');

    // 7. Conjunto reservado via RESERVADO_DIR: força --so-agregado, D7 (nada por caso), D3 (regex inválida) e D4 (bloco divergente)
    modo = 'feliz';
    leads = [];
    const blocoRes = path.join(tmpResDir, 'funciona-cotacoes');
    fs.mkdirSync(blocoRes, { recursive: true });
    for (let i = 1; i <= 10; i++) {
      fs.writeFileSync(
        path.join(blocoRes, `caso-secreto-${i}.json`),
        JSON.stringify({
          id: `segredo-id-${i}`,
          bloco: 'funciona-cotacoes',
          confirma: false,
          turnos: [
            {
              mensagem: `Quero cotar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas (marcador-secreto-${i}).`,
              espera: {
                handoff: false,
                resposta_contem: [i === 10 ? 'TOKEN_IMPOSSIVEL_PARA_TESTAR_90_PCT' : 'R\\$ 2\\.156,00'],
              },
            },
          ],
        })
      );
    }

    const rResListar = await rodarCli(['--conjunto', 'reservado', '--listar'], {
      RESERVADO_DIR: tmpResDir,
    });
    assert.equal(rResListar.code, 0);
    assert.match(rResListar.stdout, /BLOCO funciona-cotacoes: 10 caso\(s\)/);
    assert.equal(rResListar.stdout.includes('segredo-id-1'), false, 'Listar reservado nunca imprime id');

    const tmpRelRes = path.join(os.tmpdir(), `rel-res-${Date.now()}.json`);
    const rResRun = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'reservado', '--relatorio', tmpRelRes],
      { ...envBase, RESERVADO_DIR: tmpResDir }
    );
    assert.equal(rResRun.code, 0, `90% no reservado deve aprovar:\n${rResRun.stdout}\n${rResRun.stderr}`);
    assert.match(rResRun.stdout, /BLOCO funciona-cotacoes: 90%/);
    assert.match(rResRun.stdout, /RESERVADO OK/);
    assert.equal(rResRun.stdout.includes('segredo-id'), false, 'Saída reservado nunca imprime id');
    assert.equal(rResRun.stdout.includes('marcador-secreto'), false, 'Saída reservado nunca imprime mensagem');
    assert.equal(rResRun.stdout.includes('TOKEN_IMPOSSIVEL'), false, 'Saída reservado nunca imprime falha');

    const relResTxt = fs.readFileSync(tmpRelRes, 'utf8');
    const relResJson = JSON.parse(relResTxt);
    assert.equal(relResJson.conversas, undefined, 'D7: relatório só agregado não pode conter "conversas" por caso');
    assert.equal(relResTxt.includes('segredo-id'), false, 'Relatório reservado nunca guarda id');
    assert.equal(relResTxt.includes('TOKEN_IMPOSSIVEL'), false, 'Relatório reservado nunca guarda falha');
    fs.rmSync(tmpRelRes, { force: true });

    // 7b. Reservado abaixo de 90% (80%) reprova
    fs.writeFileSync(
      path.join(blocoRes, 'caso-secreto-9.json'),
      JSON.stringify({
        id: 'segredo-id-9',
        bloco: 'funciona-cotacoes',
        confirma: false,
        turnos: [
          {
            mensagem: 'Quero cotar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas.',
            espera: { handoff: false, resposta_contem: ['TOKEN_IMPOSSIVEL_2'] },
          },
        ],
      })
    );
    const rResFail = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'reservado', '--sem-relatorio'],
      { ...envBase, RESERVADO_DIR: tmpResDir }
    );
    assert.notEqual(rResFail.code, 0, '80% no reservado deve reprovar');
    assert.match(rResFail.stdout, /RESERVADO REPROVADO/);

    // 7c. D6: latência mede leitura completa do corpo (cabeçalho imediato + corpo atrasado 260ms)
    const tmpD6Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd6-dir-'));
    const tmpRelD6 = path.join(os.tmpdir(), `rel-d6-${Date.now()}.json`);
    try {
      const bD6 = path.join(tmpD6Dir, 'funciona-cotacoes');
      fs.mkdirSync(bD6, { recursive: true });
      fs.writeFileSync(
        path.join(bD6, 'd6-latencia.json'),
        JSON.stringify({
          id: 'd6-latencia',
          bloco: 'funciona-cotacoes',
          confirma: false,
          turnos: [
            {
              mensagem: 'Quero cotar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas.',
              espera: { handoff: false, resposta_contem: ['2\\.156,00'] },
            },
          ],
        })
      );
      modo = 'feliz';
      atrasoCorpoMs = 260;
      const rD6 = await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'reservado', '--relatorio', tmpRelD6],
        { ...envBase, RESERVADO_DIR: tmpD6Dir }
      );
      atrasoCorpoMs = 0;
      assert.equal(rD6.code, 0);
      const relD6 = JSON.parse(fs.readFileSync(tmpRelD6, 'utf8'));
      assert.ok(relD6.latencia_ms.max >= 240, `D6: esperado latência >= 240ms com corpo atrasado, obtido ${relD6.latencia_ms.max}`);
    } finally {
      atrasoCorpoMs = 0;
      fs.rmSync(tmpD6Dir, { recursive: true, force: true });
      fs.rmSync(tmpRelD6, { force: true });
    }

    // 7d. D3: regex inválida em reservado falha na carga com erro genérico (sem id nem padrão)
    const tmpD3Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd3-dir-'));
    try {
      const bD3 = path.join(tmpD3Dir, 'funciona-cotacoes');
      fs.mkdirSync(bD3, { recursive: true });
      fs.writeFileSync(
        path.join(bD3, 'd3-regex.json'),
        JSON.stringify({
          id: 'id-segredo-regex-d3',
          bloco: 'funciona-cotacoes',
          confirma: false,
          turnos: [{ mensagem: 'Oi', espera: { resposta_contem: ['[regex-invalida-d3'] } }],
        })
      );
      const rD3 = await rodarCli(['--conjunto', 'reservado', '--listar'], { RESERVADO_DIR: tmpD3Dir });
      assert.equal(rD3.code, 1, 'D3: regex inválida deve falhar na carga');
      assert.equal(rD3.stderr.includes('id-segredo-regex-d3'), false, 'D3: stderr reservado não pode vazar id');
      assert.equal(rD3.stderr.includes('[regex-invalida-d3'), false, 'D3: stderr reservado não pode vazar padrão');
    } finally {
      fs.rmSync(tmpD3Dir, { recursive: true, force: true });
    }

    // 7d-bis. Regex inválida apenas após substituição de placeholder (ex: (?<{{nome}}>x)) não derruba o runner e mascara padrão/id
    const tmpReExecDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-exec-dir-'));
    const tmpRelReExec = path.join(os.tmpdir(), `rel-re-exec-${Date.now()}.json`);
    try {
      const bReExec = path.join(tmpReExecDir, 'funciona-cotacoes');
      fs.mkdirSync(bReExec, { recursive: true });
      fs.writeFileSync(
        path.join(bReExec, 're-exec-normal.json'),
        JSON.stringify({
          id: 'id-segredo-exec-regex',
          bloco: 'funciona-cotacoes',
          confirma: false,
          turnos: [
            {
              mensagem: 'Oi',
              espera: { handoff: false, resposta_contem: ['(?<{{nome}}>x)'] },
            },
            {
              paralelo: [{ mensagem: 'Oi', espera: { handoff: false } }],
              espera_conjunto: { todos_contem: ['(?<{{nome}}>y)'] },
            },
          ],
        })
      );
      modo = 'feliz';
      const rReExec = await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'reservado', '--relatorio', tmpRelReExec],
        { ...envBase, RESERVADO_DIR: tmpReExecDir }
      );
      assert.equal(rReExec.code, 1, 'Regex inválida em execução deve marcar caso como falho (saída 1), sem crash');
      assert.match(rReExec.stdout, /RESERVADO REPROVADO/);
      assert.equal(rReExec.stderr.includes('SyntaxError'), false, 'Não pode vazar SyntaxError em stderr');
      assert.equal(rReExec.stderr.includes('id-segredo-exec-regex'), false, 'Reservado não pode vazar id');
      assert.equal(rReExec.stderr.includes('(?<'), false, 'Reservado não pode vazar padrão');
      assert.equal(rReExec.stdout.includes('id-segredo-exec-regex'), false, 'Stdout reservado não pode conter id');
      assert.equal(rReExec.stdout.includes('(?<'), false, 'Stdout reservado não pode conter padrão');
      assert.equal(rReExec.stdout.includes('Ana Paula Lima'), false, 'Stdout não pode vazar nome gerado');
      assert.equal(rReExec.stderr.includes('Ana Paula Lima'), false, 'Stderr não pode vazar nome gerado');
      const relReExecTxt = fs.readFileSync(tmpRelReExec, 'utf8');
      assert.equal(relReExecTxt.includes('id-segredo-exec-regex'), false);
      assert.equal(relReExecTxt.includes('(?<'), false);
      assert.equal(relReExecTxt.includes('Ana Paula Lima'), false);
    } finally {
      fs.rmSync(tmpReExecDir, { recursive: true, force: true });
      fs.rmSync(tmpRelReExec, { force: true });
    }

    // 7e. D4: campo bloco diferente da pasta falha na carga
    const tmpD4Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd4-dir-'));
    try {
      const bD4 = path.join(tmpD4Dir, 'funciona-cotacoes');
      fs.mkdirSync(bD4, { recursive: true });
      fs.writeFileSync(
        path.join(bD4, 'd4-bloco.json'),
        JSON.stringify({
          id: 'd4-bloco-errado',
          bloco: 'outro-bloco',
          confirma: false,
          turnos: [{ mensagem: 'Oi', espera: { handoff: false } }],
        })
      );
      const rD4 = await rodarCli(['--conjunto', 'reservado', '--listar'], { RESERVADO_DIR: tmpD4Dir });
      assert.equal(rD4.code, 1, 'D4: campo bloco diferente da pasta deve falhar na carga');
    } finally {
      fs.rmSync(tmpD4Dir, { recursive: true, force: true });
    }

    // 7f. Integração de valores_tolerados, sem_total com imovel_id e datas relativas no runner
    const tmpExtrasDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extras-dir-'));
    try {
      const bExt = path.join(tmpExtrasDir, 'funciona-cotacoes');
      fs.mkdirSync(bExt, { recursive: true });
      fs.writeFileSync(
        path.join(bExt, 'ext-ok.json'),
        JSON.stringify({
          id: 'ext-ok',
          bloco: 'funciona-cotacoes',
          confirma: false,
          turnos: [
            {
              mensagem: 'Quero GRM-301 de 15/01/2027 a 18/01/2027, não é R$ 300,00?',
              espera: {
                handoff: false,
                valores_tolerados: [300],
                estadia: { imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 2 },
              },
            },
            {
              mensagem: 'E só 1 noite de 15/01/2027 a 16/01/2027?',
              espera: {
                handoff: false,
                sem_total: { imovel_id: 'GRM-301' },
                resposta_contem: ['{{hoje_br}}'],
              },
            },
          ],
        })
      );
      const hojeBr = resolverPlaceholderData('hoje_br', obterHojeSaoPauloMs());
      const agExt = await iniciarServidorMock(async (req, res) => {
        if (req.method === 'GET' && req.url === '/saude') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ambiente: 'dev' }));
          return;
        }
        const b = JSON.parse(await lerCorpo(req));
        let reply = `Hoje (${hojeBr}), a diária do GRM-301 é R$ 590,00 e a limpeza é R$ 150,00.`;
        if (/300,00/.test(b.message)) {
          reply = 'A diária não é R$ 300,00; 2 noites de fim de semana dão R$ 1.416,00, 1 normal R$ 590,00, limpeza R$ 150,00 e total R$ 2.156,00.';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply, handoff: false }));
      });
      try {
        const rExt = await rodarCli(
          ['--alvo', agExt.url, '--conjunto', 'reservado', '--sem-relatorio'],
          { ...envBase, RESERVADO_DIR: tmpExtrasDir }
        );
        assert.equal(rExt.code, 0, `Integração extras deve aprovar:\n${rExt.stdout}`);
      } finally {
        await agExt.fechar();
      }
    } finally {
      fs.rmSync(tmpExtrasDir, { recursive: true, force: true });
    }

    // 8. Modo de falha por telefone no webhook (/modos/<segmento>): liga antes do turno e desliga sempre (inclusive em erro)
    const modosLog = [];
    const modosAtivos = new Map();
    const webhookComModos = await iniciarServidorMock(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && u.pathname === '/leads/teste') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ leads: [] }));
        return;
      }
      if (req.method === 'PUT' && u.pathname === '/modos/teste') {
        const body = JSON.parse(await lerCorpo(req));
        modosLog.push({ op: 'PUT', body });
        if (body.telefone) {
          modosAtivos.set(body.telefone, body);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === 'DELETE' && u.pathname === '/modos/teste') {
        const tel = u.searchParams.get('telefone');
        modosLog.push({ op: 'DELETE', telefone: tel });
        if (tel) modosAtivos.delete(tel);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const tmpDevModoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-modo-'));
    try {
      const casoModoOk = {
        id: 'modo-500-ok',
        bloco: 'funciona-cotacoes',
        confirma: true,
        webhook_modo: { modo: '500', validade_s: 60 },
        turnos: [
          {
            mensagem: 'Quero cotar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas.',
            espera: { handoff: false, resposta_contem: ['R\\$ 2\\.156,00'] },
          },
          {
            mensagem: 'Sim, confirmo.',
            espera: { handoff: false },
          },
        ],
        leads_esperados: [],
      };
      // Usa RESERVADO_DIR só para testar carregamento isolado com webhook_modo + falha no turno para checar DELETE
      const blocoTmp = path.join(tmpDevModoDir, 'funciona-cotacoes');
      fs.mkdirSync(blocoTmp, { recursive: true });
      fs.writeFileSync(path.join(blocoTmp, 'modo-ok.json'), JSON.stringify(casoModoOk));

      await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhookComModos.url}/leads/teste`, RESERVADO_DIR: tmpDevModoDir }
      );
      assert.equal(modosLog.filter((x) => x.op === 'PUT').length, 1);
      assert.equal(modosLog.filter((x) => x.op === 'DELETE').length, 1);
      assert.ok(modosLog[0].body.telefone, 'PUT /modos deve sempre enviar telefone');
      assert.equal(modosLog[1].telefone, modosLog[0].body.telefone, 'DELETE deve desligar o mesmo telefone');
      assert.equal(modosAtivos.size, 0, 'Nenhum modo pode ficar ativo após o fim do caso');

      // Caso com erro no turno ainda precisa desligar o modo no finally
      modo = 'resposta_errada';
      const rModoErro = await rodarCli(
        ['--alvo', agente.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhookComModos.url}/leads/teste`, RESERVADO_DIR: tmpDevModoDir }
      );
      assert.notEqual(rModoErro.code, 0);
      assert.equal(modosLog.filter((x) => x.op === 'PUT').length, 2);
      assert.equal(modosLog.filter((x) => x.op === 'DELETE').length, 2);
      assert.equal(modosAtivos.size, 0, 'DELETE deve rodar mesmo quando o turno falha');
    } finally {
      fs.rmSync(tmpDevModoDir, { recursive: true, force: true });
      await webhookComModos.fechar();
    }

    console.log('RUNNER OK');
  } finally {
    fs.rmSync(tmpRel, { force: true });
    fs.rmSync(tmpResDir, { recursive: true, force: true });
    await webhook.fechar();
    await agente.fechar();
  }
}

async function main() {
  if (process.argv.includes('--trava')) {
    await testarTrava();
  } else {
    await testarRunner();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
