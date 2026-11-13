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

  const agenteProducao = await iniciarServidorMock(async (req, res) => {
    if (req.method === 'GET' && req.url === '/saude') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ambiente: 'producao', leads_destino: 'real', envio_leads: 'desligado' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
      chatRequests++;
      await lerCorpo(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Não aplicamos descontos, vou transferir para um humano.', handoff: true }));
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

  const tmpRel = path.join(os.tmpdir(), `trava-rel-${Date.now()}.json`);
  try {
    // 1. Bloco inteiro de confirmação contra producao: deve recusar tudo e sair != 0
    const rLeads = await rodarCli(
      ['--alvo', agenteProducao.url, '--conjunto', 'dev', '--bloco', 'funciona-leads', '--relatorio', tmpRel],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.notEqual(rLeads.code, 0, 'funciona-leads contra producao deveria falhar/recusar');
    assert.match(rLeads.stderr, /TRAVA/i);
    assert.equal(chatRequests, 0, 'Nenhum POST /chat deve sair para confirma: true em producao');
    assert.equal(webhookRequests, 0, 'Nenhuma consulta ao webhook deve sair fora de dev');

    // 2. Bloco misto (marco1) contra producao: pula marco1-01 (confirma: true) e roda só marco1-02
    const rMisto = await rodarCli(
      ['--alvo', agenteProducao.url, '--conjunto', 'dev', '--bloco', 'marco1', '--relatorio', tmpRel],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.equal(rMisto.code, 0, `marco1-02 deveria passar mesmo pulando marco1-01: ${rMisto.stdout}\n${rMisto.stderr}`);
    assert.match(rMisto.stderr, /1 caso\(s\) com confirmação recusado/);
    assert.match(rMisto.stdout, /\[PULADO\] marco1\/marco1-01-cotacao-e-lead/);
    assert.equal(chatRequests, 1, 'Apenas o caso sem confirmação deveria rodar');

    // 3. Alvo que não responde /saude: também recusa casos com confirmação
    chatRequests = 0;
    const rSemSaude = await rodarCli(
      ['--alvo', agenteSemSaude.url, '--conjunto', 'dev', '--bloco', 'funciona-leads', '--sem-relatorio'],
      { LEADS_URL_DEV: `${webhook.url}/leads/teste` }
    );
    assert.notEqual(rSemSaude.code, 0, 'Alvo sem /saude deve recusar confirma: true');
    assert.equal(chatRequests, 0);

    console.log('TRAVA OK');
  } finally {
    fs.rmSync(tmpRel, { force: true });
    await webhook.fechar();
    await agenteProducao.fechar();
    await agenteSemSaude.fechar();
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
  assert.ok(
    julgarPrecoResposta('Total R$ 1.900,00.', {
      imovel_id: 'GRM-301',
      checkin: '2027-01-15',
      checkout: '2027-01-18',
    }).length > 0
  );
}

async function testarRunner() {
  testarJuizPreco();

  let modo = 'feliz';
  let leads = [];
  const sessoes = new Map();
  let ultimoNome = '';
  let ultimoTelefone = '';

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

      if (modo === 'resposta_errada') {
        reply = 'Resposta completamente errada sem handoff.';
        handoff = false;
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
        } else if (/fechar/i.test(message)) {
          const mTel = message.match(/\(11\)\s*9\d{4}-\d{4}/);
          const mNome = message.match(/nome é ([^,.]+)|Sou ([^,]+)/i);
          ultimoNome = (mNome?.[1] || mNome?.[2] || 'Hospede').trim();
          ultimoTelefone = mTel ? mTel[0] : '';
          st.nome = ultimoNome;
          st.telefone = ultimoTelefone;
          if (modo === 'lead_antecipado') {
            leads.push({
              nome: st.nome,
              telefone: st.telefone,
              imovel_id: 'GRM-301',
              checkin: '2027-01-15',
              checkout: '2027-01-18',
              hospedes: 2,
              valor_total: 2156,
            });
          }
          reply = `Resumo: GRM-301, 15/01/2027 a 18/01/2027, 2 hóspedes, total R$ 2.156,00. Confirma?`;
        } else if (/confirmo/i.test(message)) {
          if (st.confirmado) {
            reply = 'Esta reserva já está registrada anteriormente.';
          } else {
            st.confirmado = true;
            if (modo !== 'lead_faltando') {
              leads.push({
                nome: st.nome,
                telefone: st.telefone,
                imovel_id: 'GRM-301',
                checkin: '2027-01-15',
                checkout: '2027-01-18',
                hospedes: 2,
                valor_total: 2156,
              });
            }
            if (modo === 'lead_duplicado') {
              leads.push({
                nome: st.nome,
                telefone: st.telefone,
                imovel_id: 'GRM-301',
                checkin: '2027-01-15',
                checkout: '2027-01-18',
                hospedes: 2,
                valor_total: 2156,
              });
            }
            reply = 'Pedido registrado com sucesso.';
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

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'x-uso-entrada': '400',
        'x-uso-saida': '100',
        'x-chamadas-modelo': '2',
      });
      res.end(JSON.stringify({ reply, handoff }));
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

    // 5. Negativo: lead antecipado antes da confirmação reprova
    modo = 'lead_antecipado';
    leads = [];
    const rAnt = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rAnt.code, 0, 'Lead antecipado deve reprovar');
    assert.match(rAnt.stdout, /EVAL REPROVADO/);

    // 6. Negativo: lead faltando reprova
    modo = 'lead_faltando';
    leads = [];
    const rFalt = await rodarCli(
      ['--alvo', agente.url, '--conjunto', 'dev', '--bloco', 'marco1', '--sem-relatorio'],
      envBase
    );
    assert.notEqual(rFalt.code, 0, 'Lead faltando deve reprovar');
    assert.match(rFalt.stdout, /EVAL REPROVADO/);

    // 7. Conjunto reservado via RESERVADO_DIR: força --so-agregado e nunca vaza id/mensagem/resposta
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
