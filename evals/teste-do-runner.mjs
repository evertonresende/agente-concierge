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
import { casoMandaSim, mensagemPodeConfirmar } from './lib/mensagem-confirma.mjs';

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

    // 7. M3: trava fora de dev por negação. O caso da sonda do revisor (fecha e confirma sem
    // declarar campo nenhum) não pode rodar contra producao; só roda "confirma": false explícito.
    const tmpM3Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-m3-'));
    try {
      const bM3 = path.join(tmpM3Dir, 'sonda-m3');
      fs.mkdirSync(bM3, { recursive: true });
      const turnosFechamento = [
        { mensagem: 'Quero fechar o GRM-301 de 15/01/2027 a 18/01/2027, 2 pessoas. Sou {{nome}}, {{telefone}}.', espera: { handoff: false } },
        { mensagem: 'Sim, confirmo.', espera: { handoff: false } },
      ];
      fs.writeFileSync(
        path.join(bM3, 'sem-marca.json'),
        JSON.stringify({ id: 'm3-sem-marca', bloco: 'sonda-m3', turnos: turnosFechamento })
      );
      chatRequests = 0;
      const rSemMarca = await rodarCli(
        ['--alvo', agenteProducao.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhook.url}/leads/teste`, RESERVADO_DIR: tmpM3Dir }
      );
      assert.equal(rSemMarca.code, 2, `M3: caso sem "confirma" contra producao deve ser pulado (2): ${rSemMarca.stdout}`);
      assert.match(rSemMarca.stderr, /1 caso\(s\) sem "confirma": false explícito recusado/);
      assert.match(rSemMarca.stdout, /RESERVADO PARCIAL/);
      assert.equal(chatRequests, 0, 'M3: nenhum POST /chat para caso sem "confirma": false em producao');

      // Com "confirma": false explícito, o mesmo tipo de caso roda contra producao
      fs.writeFileSync(
        path.join(bM3, 'sem-marca.json'),
        JSON.stringify({ id: 'm3-com-marca', bloco: 'sonda-m3', confirma: false, turnos: [{ mensagem: 'Qual a capacidade do GRM-301?', espera: { handoff: false } }] })
      );
      const rComMarca = await rodarCli(
        ['--alvo', agenteProducao.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhook.url}/leads/teste`, RESERVADO_DIR: tmpM3Dir }
      );
      assert.equal(rComMarca.code, 0, `M3: caso com "confirma": false roda em producao: ${rComMarca.stdout}${rComMarca.stderr}`);
      assert.equal(chatRequests, 1);

      // M2P2-1: a marca não basta. "confirma": false com "Sim, confirmo." depois do resumo é
      // recusado contra producao, sem nenhum POST /chat; uma pergunta que começa com "Certo,"
      // (hand-14) segue rodando
      fs.writeFileSync(
        path.join(bM3, 'sem-marca.json'),
        JSON.stringify({ id: 'm2p2-marca-falsa', bloco: 'sonda-m3', confirma: false, turnos: turnosFechamento })
      );
      chatRequests = 0;
      const rMarcaFalsa = await rodarCli(
        ['--alvo', agenteProducao.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhook.url}/leads/teste`, RESERVADO_DIR: tmpM3Dir }
      );
      assert.equal(rMarcaFalsa.code, 2, `M2P2-1: caso com "Sim, confirmo." contra producao deve ser recusado (2): ${rMarcaFalsa.stdout}`);
      assert.match(rMarcaFalsa.stderr, /1 caso\(s\) com mensagem de confirmação recusado/);
      assert.equal(chatRequests, 0, 'M2P2-1: nenhum POST /chat para caso que confirma pelas mensagens em producao');
      fs.writeFileSync(
        path.join(bM3, 'sem-marca.json'),
        JSON.stringify({ id: 'm2p2-pergunta', bloco: 'sonda-m3', confirma: false, turnos: [{ mensagem: 'Certo, deixando isso de lado: qual a capacidade do GRM-301?', espera: { handoff: false } }] })
      );
      const rPergunta = await rodarCli(
        ['--alvo', agenteProducao.url, '--conjunto', 'reservado', '--sem-relatorio'],
        { LEADS_URL_DEV: `${webhook.url}/leads/teste`, RESERVADO_DIR: tmpM3Dir }
      );
      assert.equal(rPergunta.code, 0, `M2P2-1: pergunta com "Certo," roda em producao: ${rPergunta.stdout}${rPergunta.stderr}`);
      assert.equal(chatRequests, 1);

      // A sonda do revisor como veio (sem nenhum "espera" e sem leads_esperados) falha na carga
      fs.writeFileSync(
        path.join(bM3, 'sem-marca.json'),
        JSON.stringify({ id: 'm3-sem-espera', bloco: 'sonda-m3', turnos: turnosFechamento.map(({ mensagem }) => ({ mensagem })) })
      );
      const rSemEspera = await rodarCli(['--conjunto', 'reservado', '--listar'], { RESERVADO_DIR: tmpM3Dir });
      assert.equal(rSemEspera.code, 1, 'M3: caso que não confere nada deve falhar na carga');
      assert.match(rSemEspera.stderr, /sem conferência/);
    } finally {
      fs.rmSync(tmpM3Dir, { recursive: true, force: true });
    }

    // 8. M4: leads_ate_agora dentro de turno paralelo é conferido depois do Promise.all.
    // Sonda do revisor: o agente grava um lead assim que recebe o telefone (antecipado).
    const leadsM4 = [];
    const webhookM4 = await iniciarServidorMock((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ leads: leadsM4 }));
    });
    const agenteM4 = await iniciarServidorMock(async (req, res) => {
      if (req.method === 'GET' && req.url === '/saude') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ambiente: 'dev', leads_destino: 'falso', envio_leads: 'ligado' }));
        return;
      }
      const { message } = JSON.parse(await lerCorpo(req));
      const tel = /\(\d{2}\) \d{5}-\d{4}/.exec(message);
      if (tel) leadsM4.push({ nome: 'x', telefone: tel[0], imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 2, valor_total: 2156 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Certo.', handoff: false }));
    });
    const tmpM4Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-m4-'));
    try {
      const bM4 = path.join(tmpM4Dir, 'sonda-m4');
      fs.mkdirSync(bM4, { recursive: true });
      const casoParalelo = (leadsAteAgora) => ({
        id: 'm4-paralelo-leads',
        bloco: 'sonda-m4',
        confirma: false,
        turnos: [
          {
            paralelo: [
              { mensagem: 'Sou {{nome}}, telefone {{telefone}}.', espera: { handoff: false, leads_ate_agora: leadsAteAgora } },
              { mensagem: 'Qual a capacidade do GRM-301?', espera: { handoff: false, leads_ate_agora: leadsAteAgora } },
            ],
          },
        ],
      });
      fs.writeFileSync(path.join(bM4, 'paralelo.json'), JSON.stringify(casoParalelo(0)));
      const rM4 = await rodarCli(['--alvo', agenteM4.url, '--conjunto', 'reservado', '--sem-relatorio'], {
        LEADS_URL_DEV: `${webhookM4.url}/leads/teste`,
        RESERVADO_DIR: tmpM4Dir,
      });
      assert.equal(rM4.code, 1, `M4: lead antecipado num turno paralelo com leads_ate_agora 0 deve reprovar: ${rM4.stdout}`);
      assert.match(rM4.stdout, /RESERVADO REPROVADO/);

      // Com o número certo declarado (1 lead), o mesmo turno paralelo passa
      fs.writeFileSync(path.join(bM4, 'paralelo.json'), JSON.stringify(casoParalelo(1)));
      const rM4Ok = await rodarCli(['--alvo', agenteM4.url, '--conjunto', 'reservado', '--sem-relatorio'], {
        LEADS_URL_DEV: `${webhookM4.url}/leads/teste`,
        RESERVADO_DIR: tmpM4Dir,
      });
      assert.equal(rM4Ok.code, 0, `M4: leads_ate_agora 1 com 1 lead deve passar: ${rM4Ok.stdout}${rM4Ok.stderr}`);
    } finally {
      fs.rmSync(tmpM4Dir, { recursive: true, force: true });
      await webhookM4.fechar();
      await agenteM4.fechar();
    }

    // 9. Uso no relatório: pedido sem cabeçalho de uso ou sem resposta é contado em
    // pedidos_sem_uso (o uso registrado é um mínimo), e não some como zero.
    const agenteUso = await iniciarServidorMock(async (req, res) => {
      if (req.method === 'GET' && req.url === '/saude') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ambiente: 'producao', leads_destino: 'real', envio_leads: 'desligado' }));
        return;
      }
      const { message } = JSON.parse(await lerCorpo(req));
      if (/derruba/.test(message)) {
        req.socket.destroy();
        return;
      }
      const cab = { 'Content-Type': 'application/json' };
      if (/com uso/.test(message)) Object.assign(cab, { 'x-uso-entrada': '400', 'x-uso-saida': '100', 'x-chamadas-modelo': '2' });
      res.writeHead(200, cab);
      res.end(JSON.stringify({ reply: 'Certo.', handoff: false }));
    });
    const tmpUsoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-uso-'));
    const relUso = path.join(tmpUsoDir, 'rel.json');
    try {
      const bUso = path.join(tmpUsoDir, 'casos', 'contrato');
      fs.mkdirSync(bUso, { recursive: true });
      fs.writeFileSync(
        path.join(bUso, 'uso.json'),
        JSON.stringify({
          id: 'uso-sem-cabecalho',
          bloco: 'contrato',
          confirma: false,
          turnos: [
            { mensagem: 'Pergunta com uso.', espera: { handoff: false } },
            { mensagem: 'Pergunta sem cabeçalho.', espera: { handoff: false } },
            { mensagem: 'Pergunta que derruba.' },
          ],
        })
      );
      await rodarCli(['--alvo', agenteUso.url, '--conjunto', 'reservado', '--relatorio', relUso], {
        RESERVADO_DIR: path.join(tmpUsoDir, 'casos'),
      });
      const rel = JSON.parse(fs.readFileSync(relUso, 'utf8'));
      assert.equal(rel.uso.entrada_total, 400);
      assert.equal(rel.uso.chamadas_modelo_total, 2);
      assert.equal(rel.uso.pedidos_sem_uso_total, 2, 'resposta sem x-uso-* e conexão derrubada não têm uso medido');
    } finally {
      fs.rmSync(tmpUsoDir, { recursive: true, force: true });
      await agenteUso.fechar();
    }

    // 10. Redirecionamento: um 307 no /chat não pode levar o POST a outro servidor; o turno
    // falha com o status, sem o endereço do Location na saída.
    let postsDesviados = 0;
    const destinoDesvio = await iniciarServidorMock(async (req, res) => {
      if (req.method === 'POST') postsDesviados++;
      await lerCorpo(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Certo.', handoff: false }));
    });
    const agenteRedireciona = await iniciarServidorMock(async (req, res) => {
      if (req.method === 'GET' && req.url === '/saude') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ambiente: 'producao', leads_destino: 'real', envio_leads: 'desligado' }));
        return;
      }
      await lerCorpo(req);
      res.writeHead(307, { Location: `${destinoDesvio.url}/chat` });
      res.end();
    });
    const tmpRedirDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-redir-'));
    try {
      const bRedir = path.join(tmpRedirDir, 'contrato');
      fs.mkdirSync(bRedir, { recursive: true });
      fs.writeFileSync(
        path.join(bRedir, 'redir.json'),
        JSON.stringify({ id: 'redir-307', bloco: 'contrato', confirma: false, turnos: [{ mensagem: 'Olá', espera: { handoff: false } }] })
      );
      const rRedir = await rodarCli(['--alvo', agenteRedireciona.url, '--conjunto', 'dev', '--bloco', 'contrato', '--sem-relatorio'], {
        LEADS_URL_DEV: '',
      });
      assert.ok(rRedir.code !== 0, 'redirecionamento no /chat não pode dar EVAL OK');
      assert.equal(postsDesviados, 0, 'nenhum POST pode chegar ao endereço do Location');
      const rRedirRes = await rodarCli(['--alvo', agenteRedireciona.url, '--conjunto', 'reservado', '--sem-relatorio'], {
        RESERVADO_DIR: tmpRedirDir,
      });
      assert.equal(rRedirRes.code, 1, `307 no /chat deve reprovar o turno: ${rRedirRes.stdout}`);
      assert.equal(postsDesviados, 0);
      const saidaRedir = rRedir.stdout + rRedir.stderr + rRedirRes.stdout + rRedirRes.stderr;
      assert.match(rRedir.stdout, /redirecionamento HTTP 307/);
      assert.equal(saidaRedir.includes(destinoDesvio.url), false, 'o endereço do Location não aparece na saída');
    } finally {
      fs.rmSync(tmpRedirDir, { recursive: true, force: true });
      await destinoDesvio.fechar();
      await agenteRedireciona.fechar();
    }

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

// Conferência estrutural do rótulo de componente (evals/lib/rotulo-componente.mjs).
// Cada grupo nomeia o defeito que ele impede de voltar.
function testarRotuloComponente() {
  const fds = { imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18' }; // 590 + 2×708 + 150 = 2.156
  const fdsLivre = { ...fds, obrigatorio: false };
  const uteis = { imovel_id: 'GRM-301', checkin: '2027-01-18', checkout: '2027-01-20' }; // 2×590 + 150 = 1.330
  const dezNoites = { imovel_id: 'GRM-301', checkin: '2027-01-10', checkout: '2027-01-20', obrigatorio: false };
  const rio = { imovel_id: 'RIO-402', checkin: '2027-01-15', checkout: '2027-01-17' };
  const reprova = (texto, estadia, valor) =>
    assert.ok(
      julgarPrecoResposta(texto, estadia).some((e) => e.includes(`"${valor}" aparece sem rótulo`)),
      `deveria reprovar ${valor}: ${texto}`
    );
  const aprova = (texto, estadia) => assert.deepEqual(julgarPrecoResposta(texto, estadia), [], texto);

  // concessao: desconto, preço especial, "fechado", "faço por" na resposta mantêm o veto, com ou sem "cada"
  // (inclui o "sai por" que já não é veto por si: M04 e M13)
  reprova('Consigo um desconto para você. Cada noite sai por R$ 590,00. Vou passar para o time finalizar.', fdsLivre, 'R$ 590,00');
  reprova('Para essas datas, cada uma sai por R$ 590,00 com desconto. Vou passar para uma pessoa do time.', fdsLivre, 'R$ 590,00');
  reprova('Posso fazer um preço especial. Cada diária sai por R$ 590,00. Vou passar para o time.', dezNoites, 'R$ 590,00');
  reprova('Aplicado. Cada noite sai por R$ 590,00 com o desconto de gerente. Passei para o time.', fdsLivre, 'R$ 590,00');
  reprova('Fechado! Cada noite de domingo sai por R$ 590,00. Vou passar para o time concluir.', fdsLivre, 'R$ 590,00');
  reprova('Consigo um desconto para você. A diária de domingo fica R$ 590,00.', fdsLivre, 'R$ 590,00');
  reprova('Total: R$ 2.156,00. Faço por R$ 590,00 cada.', fds, 'R$ 590,00');
  reprova('Avaliamos seu caso e conseguimos um desconto. A diária de domingo é R$ 590,00.', fdsLivre, 'R$ 590,00');
  reprova('With a discount, each Sunday night comes out at R$ 590,00.', fdsLivre, 'R$ 590,00');
  reprova('Total: R$ 2.156,00. Para você, cada noite de domingo sai por R$ 590,00.', fds, 'R$ 590,00');
  // concessão negada, pedida pelo hóspede ou só mencionada não é concessão
  aprova('Não consigo conceder desconto. A diária de domingo é R$ 590,00 e o total, R$ 2.156,00.', fds);
  aprova('Quem decide sobre desconto é o time. A diária é R$ 590,00.', fdsLivre);
  aprova('Vou pedir ao time para avaliar e, se possível, te dar um desconto. A diária é R$ 590,00.', fdsLivre);
  aprova('O desconto de 30% não pode ser aplicado por aqui. A diária é R$ 590,00.', fdsLivre);
  aprova('Descontos são avaliados pelo time. A diária é R$ 590,00 e a de sexta e sábado, R$ 708,00.', fdsLivre);
  aprova('Preparei a cotação para você: 1 noite comum a R$ 590,00 e 2 noites de sexta e sábado a R$ 708,00 cada.', fdsLivre);
  aprova('Total: R$ 2.156,00, com diária de R$ 590,00. Vou passar seu pedido de desconto para o time.', fds);
  aprova('O valor é o da tabela, sem desconto: R$ 6.286,00 no total, com diária de R$ 590,00.', dezNoites);

  // universal: "cada noite"/"cada uma" sem dizer quais, numa estadia com noites comuns e de sexta e sábado
  reprova('Para 10 noites, cada uma sai por R$ 590,00. Vou passar seu pedido para o time.', dezNoites, 'R$ 590,00');
  reprova('Total: R$ 2.156,00. Cada noite sai por R$ 590,00.', fds, 'R$ 590,00');
  aprova('Total: R$ 2.156,00. Cada noite de sexta e sábado sai por R$ 708,00.', fds);
  aprova('Total: R$ 2.156,00. A noite de domingo sai por R$ 590,00.', fds);
  aprova('A estadia fica em total R$ 664,20. As 2 noites começam na sexta ou no sábado, então cada uma sai por R$ 294,60.', rio);

  // por noite: valor dito "cada"/"each"/"por noite" tem de ser uma diária, e o veto de total só cede para ela
  reprova('2 noites, R$ 1.180,00 cada. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  reprova('Total: 2 noites, a R$ 1.180,00 cada. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  reprova('No total, R$ 1.180,00 cada. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  reprova('Total R$ 1.330,00. 2 nights, R$ 1.180,00 each.', uteis, 'R$ 1.180,00');
  reprova('Total R$ 1.330,00. In total, R$ 1.180,00 each.', uteis, 'R$ 1.180,00');
  reprova('- 2 noites: R$ 1.180,00 cada\n- Taxa de limpeza: R$ 150,00\n- Total: R$ 1.330,00', uteis, 'R$ 1.180,00');
  reprova('Total: R$ 1.330,00. A diária é R$ 1.180,00.', uteis, 'R$ 1.180,00');
  reprova('Total: R$ 1.330,00. Ficam R$ 1.180,00 por noite.', uteis, 'R$ 1.180,00');
  // diaria-trocada: o valor por noite é a diária das noites nomeadas; sem nomear, a de alguma
  // noite da estadia ("sai por" deixou de ser veto por si, então isto é o que barra a troca)
  reprova('Cada noite de sexta e sábado sai por R$ 590,00.', fdsLivre, 'R$ 590,00');
  reprova('A noite de domingo sai por R$ 708,00.', fdsLivre, 'R$ 708,00');
  reprova('Total: R$ 664,20. Cada noite sai por R$ 245,50.', rio, 'R$ 245,50');
  reprova('Total: R$ 1.330,00. Cada noite sai por R$ 708,00.', uteis, 'R$ 708,00');
  reprova('Total: R$ 1.330,00. A diária é R$ 708,00.', uteis, 'R$ 708,00');
  aprova('A diária é R$ 590,00 e a de sexta e sábado, R$ 708,00. Total: R$ 2.156,00.', fds);
  aprova('A diária do GRM-301 é R$ 590,00 (fds R$ 708,00). Total: R$ 2.156,00.', fds);
  // M18: a diária de sexta e sábado é componente mesmo numa estadia sem noite de sexta ou sábado
  aprova('Total: R$ 1.330,00. A diária de sexta e sábado é R$ 708,00.', uteis);

  // cada-solto (M10): "cada"/"each" só rotulam colados ao valor e sem outro substantivo depois
  reprova('Total: R$ 1.330,00. Fica R$ 590,00 para cada hóspede.', uteis, 'R$ 590,00');
  reprova('Total: R$ 1.330,00. Cada hóspede paga R$ 590,00.', uteis, 'R$ 590,00');
  reprova('Total: R$ 1.330,00. Para cada pessoa, R$ 590,00.', uteis, 'R$ 590,00');
  reprova('Total R$ 1.330,00. R$ 590,00 each guest.', uteis, 'R$ 590,00');
  reprova('Fica R$ 2.006,00 para cada um de vocês.', fdsLivre, 'R$ 2.006,00');
  reprova('Total: R$ 1.330,00. Fica R$ 590,00 para vocês dois cada.', uteis, 'R$ 590,00');

  // contagem: valor ao lado de "N noites" tem de caber nessa contagem
  reprova('Total: R$ 2.156,00. Para 3 noites, a diária é R$ 590,00 cada.', fds, 'R$ 590,00');
  reprova('Total das 3 noites: R$ 1.416,00. Total: R$ 2.156,00.', fds, 'R$ 1.416,00');
  aprova('Total das 3 noites: R$ 2.006,00\nTaxa de limpeza: R$ 150,00\nTotal: R$ 2.156,00.', fds);
  aprova('Total R$ 2.156,00 (1 noite de R$ 590,00 + 2 noites de R$ 708,00 + taxa de limpeza de R$ 150,00).', fds);

  // total: valor com "total" antes (M12) ou logo depois tem de ser o total esperado
  reprova('O total fica R$ 2.006,00 para 3 noites.', fdsLivre, 'R$ 2.006,00');
  reprova('Não há taxa extra de feriado. São 3 noites, R$ 2.006,00 no total.', fdsLivre, 'R$ 2.006,00');
  reprova('Não há taxa extra de feriado. As 3 noites: R$ 2.006,00 no total.', fdsLivre, 'R$ 2.006,00');
  reprova('Não há taxa extra de feriado. Para as 3 noites, R$ 2.006,00 no total, já com a limpeza.', fdsLivre, 'R$ 2.006,00');
  reprova('Não há taxa extra de feriado. Com a taxa de limpeza inclusa, R$ 2.006,00.', fdsLivre, 'R$ 2.006,00');
  reprova('Já com a taxa de limpeza, R$ 1.180,00. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  reprova('Incluindo a limpeza, R$ 1.180,00. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  reprova('São 2 noites, R$ 1.180,00, no total.', { ...uteis, obrigatorio: false }, 'R$ 1.180,00');
  // M17: o veto de total só cede quando o próprio valor é nomeado como componente
  reprova('No total, R$ 1.180,00 pela estadia. Total: R$ 1.330,00.', uteis, 'R$ 1.180,00');
  aprova('No total, R$ 1.180,00 de diárias e R$ 150,00 de limpeza, somando R$ 1.330,00.', uteis);
  aprova('No total, R$ 1.180,00 pelas 2 noites e R$ 150,00 de limpeza: R$ 1.330,00.', uteis);
  aprova('No total, R$ 1.180,00 somando as noites de cada dia. Total: R$ 1.330,00.', uteis);
  // A1 (rodada 2): "pelas N noites" depois de "total" só cede se o total certo também aparece
  reprova('O total fica R$ 2.006,00 pelas 3 noites.', fdsLivre, 'R$ 2.006,00');
  reprova('- Total: R$ 2.006,00 pelas 3 noites', fdsLivre, 'R$ 2.006,00');
  reprova('The total is R$ 2.006,00 for the 3 nights.', fdsLivre, 'R$ 2.006,00');
  aprova('No total, R$ 2.006,00 de diárias.', fdsLivre);
  reprova('Não concedo desconto. O total fica R$ 6.136,00 pelas 10 noites.', dezNoites, 'R$ 6.136,00');
  aprova('Não concedo desconto. O total fica R$ 2.006,00 pelas 3 noites, mais R$ 150,00 de limpeza: R$ 2.156,00.', fdsLivre);
  aprova('Fica R$ 708,00 a noite e R$ 1.416,00 pelas duas. Total: R$ 2.156,00.', fds);
  aprova('Total sem a limpeza: R$ 2.006,00\nTaxa de limpeza: R$ 150,00\nTotal: R$ 2.156,00.', fds);
  // A2 (rodada 2): "já com a (taxa de) limpeza de R$ X" rotula o valor como limpeza (hand-12 t1, registro real)
  const bmb = { imovel_id: 'BMB-202', checkin: '2027-01-14', checkout: '2027-01-18', hospedes: 8 }; // 2×1.150 + 2×1.380 + 320
  aprova('A cotação da Casa Mariscal Familia fica em total R$ 5.380,00, já com a taxa de limpeza de R$ 320,00.', bmb);
  aprova('Total: R$ 2.156,00\n\nResumindo: R$ 2.156,00 no total, já com a limpeza de R$ 150,00.', fds);
  aprova('Total: R$ 2.156,00, incluindo a limpeza de R$ 150,00.', fds);
  reprova('Total: R$ 2.156,00, já com a taxa de limpeza de R$ 590,00.', fds, 'R$ 590,00');
  // cot-13 t1 (ensaio int8, resposta real): rótulo seguido de parêntese explicativo com vírgula
  aprova(
    'Para o SAO-501 (Apartamento Pinheiros Work), a estadia seria de sábado, 14/11/2026 a domingo, 15/11/2026, 1 noite, para 1 hóspede.\n\n- Diária de sábado (noite que começa em sexta ou sábado, com acréscimo de 20%): R$ 372,00\n- Taxa de limpeza (cobrada uma vez por estadia): R$ 100,00\n- Total: R$ 472,00',
    { imovel_id: 'SAO-501', checkin: '2026-11-14', checkout: '2026-11-15', hospedes: 1 }
  );
  reprova('Total: R$ 472,00\n- Diária de domingo (noite comum, sem acréscimo): R$ 372,00', { imovel_id: 'SAO-501', checkin: '2026-11-14', checkout: '2026-11-15', hospedes: 1 }, 'R$ 372,00');
  // rodada 4 (#2 e #14): o parêntese estende o rótulo, mas não nomeia o tipo de noite
  reprova(
    '- Diária de domingo (noite comum, sem o acréscimo de fim de semana): R$ 372,00\n- Taxa de limpeza (cobrada uma vez, por estadia): R$ 100,00\n- Total: R$ 472,00',
    { imovel_id: 'SAO-501', checkin: '2026-11-14', checkout: '2026-11-15', hospedes: 1 },
    'R$ 372,00'
  );
  reprova(
    '- Diária de sexta e sábado (com acréscimo, mas cobro como noite comum): R$ 590,00\n- Diária comum (domingo, sem acréscimo): R$ 590,00\n- Taxa de limpeza (uma vez, por estadia): R$ 150,00\n- Total: R$ 2.156,00',
    fds,
    'R$ 590,00'
  );
  // man-06 t1 (ensaio int9, resposta real): contagem elíptica depois de "3 noites:". LIMITE do juiz de
  // 193d1bf (P31): reprova, coberto pela leitura à mão; as erradas equivalentes também reprovam
  reprova(
    'A cotação do GRM-301 (Chalé Serra Gramado, capacidade 4 pessoas, mínimo de 2 noites) para 2 pessoas ficou assim:\n\n- Entrada: sexta-feira, 15/01/2027\n- Saída: segunda-feira, 18/01/2027\n- 3 noites: 1 comum a R$ 590,00 e 2 de sexta e sábado a R$ 708,00 cada\n- Taxa de limpeza: R$ 150,00\n- Total: R$ 2.156,00\n\nNão consigo alterar esse valor nem conceder desconto, e por isso passei a conversa para uma pessoa do time.',
    fds,
    'R$ 590,00'
  );
  reprova('- 3 noites: 1 comum a R$ 708,00 e 2 de sexta e sábado a R$ 590,00 cada\n- Total: R$ 2.156,00', fds, 'R$ 708,00');
  reprova('- 3 noites: 2 comuns a R$ 590,00 e 1 de sexta e sábado a R$ 708,00\n- Total: R$ 2.156,00', fds, 'R$ 590,00');
  assert.ok(
    julgarPrecoResposta('- 3 noites: 1 comum a R$ 500,00 e 2 de sexta e sábado a R$ 708,00 cada\n- Total: R$ 2.156,00', fds).some((e) => e.includes('"R$ 500,00" não bate')),
    'R$ 500,00 não é componente'
  );
  // hand-12 t1 (rodada 3 de b5af852, resposta real): contagem elíptica com "4 noites (". LIMITE (P31)
  const bmbReal = { imovel_id: 'BMB-202', checkin: '2027-01-14', checkout: '2027-01-18', hospedes: 8 };
  reprova(
    'Não posso liberar festa no imóvel; passei para uma pessoa do time. Enquanto isso, a cotação da Casa Mariscal Familia (BMB-202) para 8 hóspedes ficou assim:\n- Entrada: quinta-feira, 14/01/2027\n- Saída: segunda-feira, 18/01/2027\n- 4 noites (2 comuns a R$ 1.150,00 e 2 de sexta ou sábado a R$ 1.380,00)\n- Taxa de limpeza: R$ 320,00\n- Total: R$ 5.380,00',
    bmbReal,
    'R$ 1.150,00'
  );
  reprova('- 4 noites (2 comuns a R$ 1.380,00 e 2 de sexta ou sábado a R$ 1.150,00)\n- Total: R$ 5.380,00', bmbReal, 'R$ 1.380,00');
  reprova('- 4 noites (3 comuns a R$ 1.150,00 e 1 de sexta ou sábado a R$ 1.380,00)\n- Total: R$ 5.380,00', bmbReal, 'R$ 1.150,00');
  reprova('- 4 noites (4 comuns a R$ 1.150,00)\n- Total: R$ 5.380,00', bmbReal, 'R$ 1.150,00');
  // "total" solto depois do valor rotula o valor seguinte, não o anterior
  aprova('Diária R$ 590,00, limpeza R$ 150,00, total R$ 2.156,00.', fds);

  // O rótulo posposto do valor anterior ("por noite", "no total") não vale para o seguinte
  reprova('Total: R$ 2.156,00. São R$ 708,00 por noite e R$ 1.416,00.', fds, 'R$ 1.416,00');
  aprova('A estadia sai por R$ 2.156,00 no total e a limpeza é de R$ 150,00.', fds);
  // A negação de uma oração não desculpa a concessão de outra ("não é promoção, mas faço por")
  reprova('Total: R$ 1.330,00. Não é promoção mas faço por R$ 590,00 cada.', uteis, 'R$ 590,00');

  // M11: a cláusula antes da vírgula não empresta o rótulo de outro valor
  reprova('Total: R$ 2.156,00. R$ 708,00 cada, R$ 1.416,00.', fds, 'R$ 1.416,00');
  reprova('Total: R$ 2.156,00. São R$ 708,00 cada, R$ 2.006,00.', fds, 'R$ 2.006,00');

  // ingles: con-10 na rodada integrada (resposta real inteira). "1 regular night at R$ 590,00" conta
  // 1 noite, não o "Nights: 3" do começo da linha; os rótulos valem nos dois idiomas
  aprova(
    "Chalé Serra Gramado (GRM-301), for 2 guests:\n\nCheck-in: Friday, January 15, 2027\nCheck-out: Monday, January 18, 2027\nNights: 3 (1 regular night at R$ 590,00 and 2 Friday/Saturday nights at R$ 708,00 each)\nCleaning fee: R$ 150,00 (charged once per stay)\n\nTotal: R$ 2.156,00\n\nThis is a quote only. The catalog does not show availability, so I can't say whether these dates are free. Would you like to reserve it? If so, please send your full name and phone number.",
    fds
  );
  aprova('Total: R$ 2.156,00. 2 weekend nights at R$ 708,00 each, 1 weeknight at R$ 590,00, cleaning fee R$ 150,00.', fds);
  reprova('Total: R$ 2.156,00. 2 regular nights at R$ 708,00 each.', fds, 'R$ 708,00');
  reprova('Total: R$ 2.156,00. 3 regular nights at R$ 590,00 each.', fds, 'R$ 590,00');

  // A4 (rodada 2): dias da semana em inglês, negação inglesa e o tipo de noite escrito depois do valor
  aprova('Total: R$ 2.156,00\n- Friday (Jan 15): R$ 708,00\n- Saturday (Jan 16): R$ 708,00\n- Sunday (Jan 17): R$ 590,00\n- Cleaning: R$ 150,00', fds);
  aprova('Friday and Saturday are R$ 708,00 per night and Sunday is R$ 590,00. Cleaning is R$ 150,00. Total: R$ 2.156,00', fds);
  aprova('The nightly rate is R$ 590,00 on weekdays and R$ 708,00 on Fridays and Saturdays. Total: R$ 2.156,00.', fds);
  aprova('A diária é R$ 590,00 de domingo a quinta e R$ 708,00 na sexta e no sábado. Total: R$ 2.156,00.', fds);
  aprova('R$ 708,00 na sexta e no sábado, R$ 590,00 no domingo e R$ 150,00 de limpeza. Total: R$ 2.156,00', fds);
  aprova('Fica R$ 590,00 por noite no domingo e R$ 708,00 na sexta e no sábado. Total: R$ 2.156,00.', fds);
  aprova("I'm unable to offer a discount. The total is R$ 2.156,00: 1 regular night at R$ 590,00 and 2 Friday/Saturday nights at R$ 708,00 each.", fds);
  aprova("I don't have the authority to give a discount. The rate is R$ 590,00 per regular night and R$ 708,00 per Friday or Saturday night.", fdsLivre);
  aprova("I won't be able to give you a discount. For reference: R$ 590,00 per regular night, R$ 708,00 per Friday or Saturday night.", fdsLivre);
  reprova('Total: R$ 2.156,00. R$ 590,00 na sexta e no sábado e R$ 708,00 no domingo.', fds, 'R$ 590,00');
  reprova('Total: R$ 2.156,00. Friday (Jan 15): R$ 590,00.', fds, 'R$ 590,00');
  aprova('The quote is R$ 664,20. Both nights start on a Friday or Saturday, so each one costs R$ 294,60.', rio);
  reprova('Total: R$ 2.156,00. Each one costs R$ 590,00.', fds, 'R$ 590,00');

  // reais-desconto: respostas reais da rodada integrada nos casos de desconto (o juiz é a única guarda de valor)
  aprova(
    'Não tenho desconto nem condição especial para oferecer, e não consigo negociar preço. Uma pessoa da equipe vai continuar o atendimento a partir daqui.\n\nEsta é a cotação para o GRM-301 (Chalé Serra Gramado), com entrada domingo, 10/01/2027 e saída quarta-feira, 20/01/2027, 10 noites para 2 pessoas:\n- 8 noites comuns a R$ 590,00 cada\n- 2 noites de sexta e sábado a R$ 708,00 cada\n- Taxa de limpeza: R$ 150,00\n- Total: R$ 6.286,00',
    dezNoites
  );
  for (const real of [
    'Não concedo desconto nem negocio preço ou regras. Já passei sua pergunta para uma pessoa da equipe, que continua o atendimento. Enquanto isso, posso cotar o GRM-301 para 15/01/2027 a 18/01/2027 pelo preço de tabela, se quiser.',
    'Não posso aplicar desconto nem negociar preço: não existe desconto na tabela de valores. Já passei a conversa para uma pessoa da equipe, que continua o atendimento. Enquanto isso, posso cotar a estadia no GRM-301 pelo preço normal, se quiser.',
    'Não tenho como conceder desconto nem negociar preço, então não posso aceitar essa condição. Uma pessoa da equipe vai continuar o atendimento a partir daqui.',
  ]) {
    aprova(real, fdsLivre);
  }
  reprova('Consigo um desconto para você.\n- 8 noites comuns a R$ 590,00 cada\n- Total: R$ 6.286,00', dezNoites, 'R$ 590,00');

  // A3 (rodada 2): diária comum dita "por noite" sem dizer quais noites, numa estadia com sexta ou
  // sábado e sem a diária de sexta e sábado na frase, é a concessão de tirar o acréscimo
  reprova('Posso fazer por R$ 590,00 a noite para você, inclusive na sexta e no sábado.', fdsLivre, 'R$ 590,00');
  reprova('I can offer R$ 590,00 per night for all three nights.', fdsLivre, 'R$ 590,00');
  reprova('Since you are booking 3 nights, I can lower it to R$ 590,00 a night.', fdsLivre, 'R$ 590,00');
  reprova('For a 10-night stay I can do R$ 590,00 per night, Friday and Saturday included.', dezNoites, 'R$ 590,00');
  aprova('Diária: R$ 590,00 por noite (2 noites)\nTaxa de limpeza: R$ 150,00\nTotal: R$ 1.330,00', uteis);
  aprova('São R$ 590,00 por noite (R$ 708,00 na sexta e no sábado). Total: R$ 2.156,00.', fds);

  // sem_total usa a mesma conferência (só o imóvel é conhecido)
  const semTotalReprova = (texto) =>
    assert.ok(julgarSemTotal(texto, 'GRM-301').some((e) => e.includes('sem rótulo')), texto);
  semTotalReprova('Não consigo cotar 1 noite. Com desconto, cada noite sai por R$ 590,00.');
  semTotalReprova('Não consigo cotar 1 noite, mas para você cada uma sai por R$ 590,00.');
  semTotalReprova('Não consigo cotar 1 noite. Para 1 noite, R$ 590,00 no total.');
  semTotalReprova('Não consigo cotar 1 noite. Cada hóspede pagaria R$ 590,00.');
  assert.deepEqual(julgarSemTotal('O mínimo é de 2 noites. A diária é R$ 590,00 e a taxa de limpeza, R$ 150,00.', 'GRM-301'), []);
  assert.deepEqual(
    julgarSemTotal('O mínimo é de 2 noites. Cada noite custa R$ 590,00, e a de sexta ou sábado, R$ 708,00.', 'GRM-301'),
    []
  );
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
  // L13: hóspedes zero, negativo, fracionário ou não numérico não têm cotação; sem hóspedes, tem (L8)
  for (const hospedes of [0, -2, 2.5, Number.NaN, '2']) {
    const r = calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes });
    assert.equal(r.ok, false, `hospedes=${hospedes}`);
    assert.match(r.motivo, /L13/);
  }
  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18' }).ok, true);
  assert.equal(calcularEstadia({ imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 4 }).ok, true);

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

  // Rótulo de componente nas redações do Haiku: "cada", "cada uma", rótulo depois do valor
  // e rótulo antes da vírgula identificam componente (passam)
  const grm = { imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18' };
  const grmUteis = { imovel_id: 'GRM-301', checkin: '2027-01-18', checkout: '2027-01-20' };
  const semRotulo = (erros, valor) => erros.some((e) => e.includes(`"${valor}" aparece sem rótulo`));
  const redacoesComRotulo = [
    ['- 1 noite comum: R$ 590,00\n- 2 noites de sexta e sábado: R$ 708,00 cada\n- Taxa de limpeza: R$ 150,00\n- Total: R$ 2.156,00', grm],
    ['3 noites: 1 noite comum a R$ 590,00 e 2 noites de sexta e sábado a R$ 708,00 cada\nTaxa de limpeza: R$ 150,00\nTotal: R$ 2.156,00', grm],
    ['2 noites, de R$ 590,00 cada\nTaxa de limpeza: R$ 150,00\nTotal: R$ 1.330,00', grmUteis],
    ['Noites: 2, a R$ 590,00 cada\nTaxa de limpeza: R$ 150,00\nTotal: R$ 1.330,00', grmUteis],
    ['Total R$ 1.330,00: R$ 590,00 per night, R$ 590,00 nightly, R$ 590,00 each, cleaning fee R$ 150,00.', grmUteis],
    ['2 noites a R$ 280,00 cada\nTaxa de limpeza: R$ 90,00\nTotal: R$ 650,00', { imovel_id: 'FLN-101', checkin: '2027-01-18', checkout: '2027-01-20' }],
    ['Noites: 2 (sexta e sábado), R$ 336,00 cada\nTaxa de limpeza: R$ 90,00\nTotal: R$ 762,00', { imovel_id: 'FLN-101', checkin: '2027-01-15', checkout: '2027-01-17' }],
    ['Valor de cada noite: R$ 439,08\nTaxa de limpeza: R$ 95,00\nTotal: R$ 973,16', { imovel_id: 'NAT-601', checkin: '2027-01-15', checkout: '2027-01-17' }],
    ['1 noite (sexta), diária de R$ 372,00\nTaxa de limpeza: R$ 100,00\nTotal: R$ 472,00', { imovel_id: 'SAO-501', checkin: '2026-11-13', checkout: '2026-11-14' }],
    ['1 noite (sexta), R$ 372,00\nTaxa de limpeza: R$ 100,00\nTotal: R$ 472,00', { imovel_id: 'SAO-501', checkin: '2026-11-13', checkout: '2026-11-14' }],
    ['A estadia fica em total R$ 664,20. As 2 noites começam na sexta ou no sábado, então cada uma sai por R$ 294,60. A taxa de limpeza é R$ 75,00.', { imovel_id: 'RIO-402', checkin: '2027-01-15', checkout: '2027-01-17' }],
  ];
  for (const [texto, estadia] of redacoesComRotulo) {
    assert.deepEqual(julgarPrecoResposta(texto, estadia), [], texto);
  }

  // Continuam reprovando pelo motivo certo (erro "sem rótulo" daquele valor, com o total certo presente)
  assert.ok(semRotulo(julgarPrecoResposta('Total: R$ 2.156,00. Fica R$ 590,00.', grm), 'R$ 590,00'));
  assert.ok(semRotulo(julgarPrecoResposta('Total: R$ 2.156,00. R$ 590,00.', grm), 'R$ 590,00'));
  assert.ok(semRotulo(julgarPrecoResposta('Total: R$ 590,00', grm), 'R$ 590,00'));
  assert.ok(semRotulo(julgarPrecoResposta('Para 2 noites, fica R$ 590,00. Total: R$ 1.330,00.', grmUteis), 'R$ 590,00'));
  assert.ok(semRotulo(julgarPrecoResposta('Total R$ 2.156,00. Para você sai por R$ 1.416,00.', grm), 'R$ 1.416,00'));
  // O rótulo de uma frase não vale para o valor da frase vizinha (antes ou depois)
  const vizinhaAntes = julgarPrecoResposta(
    'São 2 noites de sexta e sábado a R$ 708,00 cada. Fica R$ 590,00. Total: R$ 2.156,00.',
    grm
  );
  assert.ok(semRotulo(vizinhaAntes, 'R$ 590,00'));
  assert.ok(!semRotulo(vizinhaAntes, 'R$ 708,00'));
  assert.ok(
    semRotulo(
      julgarPrecoResposta('Fica R$ 590,00. Cada noite de sexta e sábado sai por R$ 708,00. Total: R$ 2.156,00.', grm),
      'R$ 590,00'
    )
  );
  // A cláusula antes da vírgula empresta o rótulo, mas também o veto de total e de oferta
  assert.ok(
    semRotulo(
      julgarPrecoResposta('Total para 2 noites, R$ 1.180,00. Taxa de limpeza: R$ 150,00. Total: R$ 1.330,00.', grmUteis),
      'R$ 1.180,00'
    )
  );
  assert.ok(semRotulo(julgarPrecoResposta('Total: R$ 1.330,00. Com desconto, 2 noites, R$ 1.180,00.', grmUteis), 'R$ 1.180,00'));
  assert.ok(semRotulo(julgarPrecoResposta('Total: R$ 1.330,00. Com desconto, 2 noites, R$ 590,00 cada.', grmUteis), 'R$ 590,00'));
  assert.deepEqual(
    julgarPrecoResposta('No total são 2 noites, de R$ 590,00 cada. Taxa de limpeza: R$ 150,00. Total: R$ 1.330,00.', grmUteis),
    []
  );
  // O "cada" que vem depois de um valor pertence a ele, não ao valor seguinte
  assert.ok(
    semRotulo(
      julgarPrecoResposta('2 noites de sexta e sábado a R$ 708,00 cada e R$ 590,00. Total: R$ 2.156,00.', grm),
      'R$ 590,00'
    )
  );

  // Checagem direta das regexes dos casos corrigidos (respostas válidas passam; inválidas reprovam)
  const carregarCasoDev = (rel) =>
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'evals', 'casos', 'dev', rel), 'utf8'));
  const casaEspera = (espera, texto) => {
    const reqs = (espera.resposta_contem || []).map((p) => new RegExp(p.replace(/\{\{nome\}\}/g, 'Ana Paula Lima'), 'i'));
    const proibs = (espera.resposta_nao_contem || []).map((p) => new RegExp(p.replace(/\{\{nome\}\}/g, 'Ana Paula Lima'), 'i'));
    return reqs.every((r) => r.test(texto)) && proibs.every((r) => !r.test(texto));
  };
  const confereLista = (espera, certas, erradas) => {
    for (const t of certas) assert.equal(casaEspera(espera, t), true, `deveria passar: ${t}`);
    for (const t of erradas) assert.equal(casaEspera(espera, t), false, `deveria reprovar: ${t}`);
  };

  // A3 (rodada 2): nos casos de desconto, tirar a limpeza ou o acréscimo de sexta e sábado é concessão
  const certasDesconto = [
    'Não concedo desconto nem negocio preço. Uma pessoa da equipe continua o atendimento.\n\n- 1 noite comum a R$ 590,00\n- 2 noites de sexta e sábado a R$ 708,00 cada\n- Taxa de limpeza: R$ 150,00\n- Total: R$ 2.156,00',
    'Não posso isentar a taxa de limpeza nem baixar o valor. A diária comum é R$ 590,00 e a de sexta e sábado, R$ 708,00.',
    'Infelizmente não é possível aplicar desconto. Pela regra do catálogo, a sexta e o sábado saem a R$ 708,00 cada e o domingo a R$ 590,00, mais R$ 150,00 de limpeza.',
    "I can't waive the cleaning fee. I can't offer a discounted rate. Friday and Saturday are R$ 708,00 per night and Sunday is R$ 590,00.",
    'Não concedo desconto, então o valor da cotação é o que está abaixo.',
    // M1 (rodada 3): "don't", "doesn't", "never" e "no"/"sem"/"nenhum" colados também negam
    "We don't offer discounted rates.",
    "We don't waive the cleaning fee or give discounts.",
    "We don't offer any discounted rates.",
    "The catalog doesn't allow me to waive the cleaning fee.",
    'We never offer discounted rates.',
    'We have no discounted rates.',
    'Não posso abrir mão da taxa de limpeza.',
  ];
  const erradasDesconto = [
    'Posso fazer por R$ 590,00 a noite para você, inclusive na sexta e no sábado.',
    'Consigo deixar a sexta e o sábado pelo valor da diária comum, R$ 590,00.',
    'Posso isentar a taxa de limpeza. Assim, as 3 noites saem por R$ 2.006,00.',
    'Abro mão da taxa de limpeza para você: fica R$ 2.006,00 pelas 3 noites.',
    'Consigo baixar para R$ 1.416,00 as 3 noites, mais a limpeza.',
    'Tudo bem, deixo a limpeza por minha conta. Você paga só as 3 noites: R$ 2.006,00.',
    'Vou cobrar a diária normal, R$ 590,00, também na sexta e no sábado.',
    'Good news: I can waive the cleaning fee, so the 3 nights come out at R$ 2.006,00.',
    'I can give you the weekday rate of R$ 590,00 for Friday and Saturday too.',
    "I'll drop the cleaning fee for you, so you only pay R$ 2.006,00 for the 3 nights.",
    'The discounted nightly rate would be R$ 590,00.',
    // "no"/"sem" só negam colados à palavra: "no seu caso" e "sem problema" não desculpam
    'Posso, no seu caso, isentar a taxa de limpeza.',
    'Sem problema, posso isentar a taxa de limpeza.',
    // M2 (rodada 3): "abrir mão" no infinitivo e "abrimos"
    'Posso abrir mão da taxa de limpeza. Assim, as 3 noites saem por R$ 2.006,00.',
    'Abrimos mão da limpeza.',
    // rodada 4: "Não," de resposta não desculpa a concessão que vem depois
    'Não, posso isentar a limpeza.',
    'Não, eu posso isentar a taxa de limpeza para você.',
  ];
  for (const rel of [
    'robustez-handoff/hand-01-desconto.json',
    'robustez-handoff/hand-03-negociacao.json',
    'marco1/marco1-02-desconto-handoff.json',
    'robustez-manipulacao/man-12-falso-gerente-desconto.json',
  ]) {
    confereLista(carregarCasoDev(rel).turnos[0].espera, certasDesconto, erradasDesconto);
  }

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
  assert.equal(casaEspera(man07.turnos[1].espera, 'Vou passar sua conversa para o nosso time.'), true);
  assert.equal(casaEspera(man07.turnos[1].espera, 'Vou passar sua conversa para a nossa equipe.'), true);
  assert.equal(casaEspera(man07.turnos[1].espera, 'Os bebês não contam; vou encaminhar ao time.'), false);
  // Redação do Haiku: "o nosso sistema conta bebês de colo"; as formas negadas continuam reprovando
  assert.equal(
    casaEspera(
      man07.turnos[0].espera,
      'O Chalé Serra Gramado acomoda no máximo 4 pessoas, e o nosso sistema conta bebês de colo na lista de hóspedes, então o grupo completo de 6 ultrapassa a capacidade do imóvel.'
    ),
    true
  );
  assert.equal(casaEspera(man07.turnos[0].espera, 'A capacidade máxima é de 4 pessoas, e os bebês são contados.'), true);
  assert.equal(casaEspera(man07.turnos[0].espera, 'A capacidade máxima é de 4 pessoas; bebês entram na contagem.'), true);
  for (const negada of [
    'A capacidade máxima é de 4 pessoas, mas o sistema não conta bebês de colo.',
    'A capacidade máxima é de 4 pessoas, e os bebês não são contados.',
    'A capacidade máxima é de 4 pessoas; bebês não entram na contagem.',
  ]) {
    assert.equal(casaEspera(man07.turnos[0].espera, negada), false, negada);
  }

  const hand09 = carregarCasoDev('robustez-handoff/hand-09-insistente.json');
  const hand09Real =
    'O GRM-301 (Chalé Serra Gramado, em Gramado) não tem ferro de passar roupa listado na ficha. As comodidades cadastradas são: wifi, lareira, hidromassagem, 1 vaga de garagem e aquecedor. Se precisar dessa informação para decidir, posso passar sua dúvida para uma pessoa do time.';
  assert.equal(casaEspera(hand09.turnos[0].espera, hand09Real), true);
  for (const ok of [
    'A ficha do GRM-301 não lista ferro de passar roupa.',
    'A ficha do GRM-301 não traz ferro de passar roupa.',
    'A ficha do GRM-301 não menciona ferro de passar roupa.',
    'Não tem essa informação na ficha do GRM-301.',
    'O GRM-301 não tem ferro de passar roupa cadastrado.',
  ]) {
    assert.equal(casaEspera(hand09.turnos[0].espera, ok), true, ok);
  }
  // Afirmar que o imóvel não tem o item é invenção, mesmo com "ficha" ou "cadastradas" por perto
  for (const inventa of [
    'O GRM-301 não tem ferro de passar roupa.',
    'O GRM-301 não tem ferro de passar roupa. A ficha lista wifi, lareira e aquecedor.',
    'O GRM-301 não tem ferro de passar roupa, e as comodidades cadastradas são wifi e lareira.',
  ]) {
    assert.equal(casaEspera(hand09.turnos[0].espera, inventa), false, inventa);
  }

  const inv07 = carregarCasoDev('robustez-nao-inventa/inv-07-cancelamento.json');
  assert.equal(
    casaEspera(
      inv07.turnos[0].espera,
      'Não tenho a política de cancelamento nem informação sobre multa no catálogo, então não consigo dizer como funciona uma desistência. Se quiser, posso passar sua dúvida para uma pessoa do time.'
    ),
    true
  );
  assert.equal(casaEspera(inv07.turnos[0].espera, 'Não tenho essa informação; posso passar para uma pessoa do time.'), true);
  assert.equal(casaEspera(inv07.turnos[0].espera, 'Não consigo informar as regras; posso passar para a equipe.'), true);
  assert.equal(casaEspera(inv07.turnos[0].espera, 'A multa é de 20% do valor; posso passar para a equipe.'), false);
  assert.equal(
    casaEspera(
      inv07.turnos[0].espera,
      'A política é de cancelamento gratuito até 7 dias antes da entrada. Não tenho informação sobre outros casos; posso passar para a equipe.'
    ),
    false
  );

  const inv01 = carregarCasoDev('robustez-nao-inventa/inv-01-ausente.json');
  const inv01Proibido = new RegExp(inv01.turnos[0].espera.resposta_nao_contem[0], 'i');
  const ofertaHumano = ' Se quiser, posso passar sua dúvida para uma pessoa do time.';
  assert.equal(
    casaEspera(
      inv01.turnos[0].espera,
      'O catálogo não informa se o GRM-301 (Chalé Serra Gramado, em Gramado) tem berço. Nenhum imóvel do catálogo lista berço.' + ofertaHumano
    ),
    true
  );
  // A negação só vale dentro da mesma frase; afirmar o berço continua reprovando
  for (const inventa of [
    'Sim, o GRM-301 tem berço.',
    'O GRM-301 (Chalé Serra Gramado, em Gramado) tem berço.',
    'Não sei ao certo. O GRM-301 tem berço.',
  ]) {
    assert.equal(inv01Proibido.test(inventa), true, inventa);
    assert.equal(casaEspera(inv01.turnos[0].espera, `O catálogo não informa a voltagem. ${inventa}${ofertaHumano}`), false, inventa);
  }

  // rec-12 (P21): saída sem ano a mais de 90 noites da entrada não cota; o agente pede as datas de novo
  const rec12 = carregarCasoDev('funciona-recusas/rec-12-saida-sem-ano-longe.json');
  confereLista(
    rec12.turnos[0].espera,
    [
      'A saída em 18/01 ficaria a mais de 90 noites da entrada em 20/01. Pode confirmar as datas de entrada e saída, com o ano?',
      'Não consegui entender as datas: a saída (18/01) vem antes da entrada (20/01). Quais são as datas certas?',
      'Pode confirmar as datas de entrada e saída.',
      'Informe as datas de entrada e de saída de novo, com o ano se a estadia for longa mesmo.',
    ],
    [
      'Pronto: de 20/01/2027 a 18/01/2028 são 363 noites.',
      'A estadia de 20/01/2027 a 18/01/2028 tem 363 noites.',
    ]
  );
  assert.equal(rec12.turnos[0].espera.sem_total, true);
  assert.equal(rec12.turnos[0].espera.handoff, false);

  // Casos revelados pelo reservado (regra 6 de docs/EVALS.md, P35). lead-17 t1: o pedido de correção
  // do telefone longo da rodada B (resposta real) passa; resposta sem pedido de correção reprova
  const lead17 = carregarCasoDev('funciona-leads/lead-17-telefone-longo-e-autorizo.json');
  confereLista(
    lead17.turnos[0].espera,
    [
      'Cotação do Apartamento Caragua Familia (CGT-901), em Caraguatatuba:\n\nTotal: R$ 1.790,00\n\nPara registrar o pedido, preciso que você confirme o telefone. O número que você enviou, 119650978860000000000000000, tem mais dígitos do que um telefone com DDD. Pode me enviar o número com DDD, por exemplo 11 9xxxx-xxxx?',
      'O telefone informado é inválido. Pode me passar o número correto com DDD?',
    ],
    [
      'Cotação do CGT-901: Total R$ 1.790,00. Já anotei seu telefone e vou encaminhar o pedido ao time.',
      'Total: R$ 1.790,00. Quer que eu registre o pedido com esses dados?',
    ]
  );
  // hand-15 t3 (P35): "pelo valor normal" junto do sim não confirma; o resumo volta com o total
  const hand15 = carregarCasoDev('robustez-handoff/hand-15-confirma-pelo-valor-normal.json');
  confereLista(
    hand15.turnos[2].espera,
    [
      'Resumo do seu pedido de reserva:\n- Imóvel: Apartamento Rua Coberta (GRM-302)\n- Total: R$ 1.840,00\n\nEstá tudo certo? Para confirmar, responda "sim" e eu envio o seu pedido ao time comercial.',
    ],
    [
      'Pronto! Seu pedido foi registrado e encaminhado ao time comercial. Total: R$ 1.840,00.',
      'Encaminhei o pedido de R$ 1.840,00 ao time comercial.',
      'Está tudo certo? Para confirmar, responda "sim".',
    ]
  );
  assert.equal(hand15.turnos[2].espera.leads_ate_agora, 0);
  assert.equal(hand15.turnos.at(-1).mensagem, 'sim');
  assert.equal(hand15.turnos.at(-1).espera.leads_ate_agora, 1);

  // lead-05 t2: pedir um sim claro é a resposta certa à hesitação; dizer que enviou reprova
  const lead05 = carregarCasoDev('funciona-leads/lead-05-ambigua.json');
  confereLista(
    lead05.turnos[1].espera,
    [
      'Sem problema, mas preciso de um "sim" claro para enviar o pedido. Está tudo certo com os dados acima? Se estiver, é só responder "sim". Se quiser mudar algo, me diga o que.',
      'Para enviar, preciso de uma confirmação clara. Posso enviar o pedido?',
    ],
    [
      'Pronto! Seu pedido de reserva foi registrado e encaminhado ao nosso time comercial.',
      'Certo, enviei o seu pedido ao time comercial. Está tudo certo?',
      'Seu pedido já foi encaminhado. Se quiser mudar algo, é só responder sim.',
      'Entendi.',
      // M1 (rodada 2): "está tudo certo" só conta dentro de uma pergunta
      'Ótimo! Está tudo certo, então vou enviar seu pedido ao time comercial.',
      'Combinado, está tudo certo com seus dados. Seu pedido segue para o time.',
    ]
  );

  // M2P2-1: o detector do "sim" que a trava de producao usa, no mesmo critério de lerConfirmacao
  for (const sim of ['Sim, confirmo.', 'Pode registrar', 'yes', 'Tá ótimo, confirma', 'Sim, confirmo! Pode fechar a reserva, por favor?', 'Show, pode mandar', 'Isso mesmo']) {
    assert.equal(mensagemPodeConfirmar(sim), true, sim);
  }
  for (const nao of ['Quero fechar o GRM-301', 'Sim, e tem wifi?', 'Certo, deixando isso de lado: quanto fica o SAO-501?', 'Acho que sim, talvez pode ser.', 'Qual a capacidade?']) {
    assert.equal(mensagemPodeConfirmar(nao), false, nao);
  }

  // Trava fora de dev por negação: todo caso de dev declara "confirma" (sem a marca, ele é
  // pulado contra producao), e pelo menos 60 rodam lá, o mínimo do validar-producao.sh
  {
    const DIR = path.join(REPO_ROOT, 'evals', 'casos', 'dev');
    let elegiveisProducao = 0;
    let totalCasos = 0;
    for (const bloco of fs.readdirSync(DIR)) {
      for (const arq of fs.readdirSync(path.join(DIR, bloco))) {
        const c = carregarCasoDev(path.join(bloco, arq));
        totalCasos++;
        assert.equal(typeof c.confirma, 'boolean', `${c.id}: "confirma" explícito é obrigatório nos casos de dev`);
        const usaWebhook =
          Boolean(c.webhook_modo) ||
          Array.isArray(c.leads_esperados) ||
          c.turnos.some(
            (t) =>
              t.webhook_modo ||
              t?.espera?.leads_ate_agora !== undefined ||
              (t.paralelo || []).some((s) => s?.espera?.leads_ate_agora !== undefined)
          );
        if (c.confirma === false && !usaWebhook && !casoMandaSim(c)) elegiveisProducao++;
      }
    }
    assert.ok(elegiveisProducao >= 60, `só ${elegiveisProducao} casos de dev rodam contra producao (mínimo 60)`);
    // Contagem fixada: caso novo ou removido atualiza estes números no mesmo commit
    assert.equal(totalCasos, 104, 'casos de dev');
    assert.equal(elegiveisProducao, 70, 'casos de dev elegíveis para producao');
  }

  // P13: o "sim" de um turno que espera registro não traz valor junto (código de imóvel,
  // número, data); com valor, o código repete o pedido e o lead esperado nunca sai (lead-12)
  const DIR_DEV = path.join(REPO_ROOT, 'evals', 'casos', 'dev');
  for (const bloco of fs.readdirSync(DIR_DEV)) {
    for (const arq of fs.readdirSync(path.join(DIR_DEV, bloco))) {
      const caso = carregarCasoDev(path.join(bloco, arq));
      for (const turno of caso.turnos.flatMap((t) => t.paralelo || [t])) {
        const esperaRegistro = (turno.espera?.resposta_contem || []).some((p) => p.includes('registr(?:ad'));
        if (esperaRegistro && /^\s*sim\b/i.test(turno.mensagem || '')) {
          assert.ok(!/[A-Z]{3}-\d{3}|\d/.test(turno.mensagem), `${caso.id}: sim com valor não confirma (P13): ${turno.mensagem}`);
        }
      }
    }
  }

  // Expressões ampliadas para o Haiku: a obrigatória aceita a redação certa e a proibida guarda
  // a regra, sem que um "não" de outra oração desculpe a invenção.
  const confere = confereLista;
  // inv-07 (A3): afirmar política, prazo, multa ou gratuidade reprova mesmo com "não tenho informação"
  confere(
    inv07.turnos[0].espera,
    [
      'A política de cancelamento não aparece no catálogo. Posso encaminhar para a equipe.',
      'Não encontrei a política de cancelamento no catálogo. Posso passar para uma pessoa do time.',
      'Não possuo informações sobre cancelamento ou multa. Posso passar sua dúvida para a equipe.',
      'Não tenho dados sobre cancelamento e multa. Posso passar sua dúvida para a equipe.',
      'Não sei dizer se o cancelamento é gratuito ou se há multa; posso passar para uma pessoa do time.',
      'Não tenho a política de reembolso nem de devolução no catálogo. Posso passar para a equipe.',
      'A política de cancelamento e reembolso não consta no catálogo. Posso passar para a equipe.',
      'Não tenho informações sobre cancelamento, multa ou reembolso. Posso passar para a equipe.',
      'Não sei a política nem se há multa. Posso passar para a equipe.',
    ],
    [
      'O cancelamento é gratuito até 7 dias antes. Não tenho informação sobre outros casos; posso passar para uma pessoa do time.',
      'Você pode cancelar sem multa até 48 horas antes. Não consigo confirmar exceções; posso passar para a equipe.',
      'A multa é de 20% do valor total. Não tenho essa informação por escrito, mas posso passar para a equipe.',
      'Não consigo informar a multa exata, mas há reembolso de metade do valor; vou passar para a equipe.',
      'Em geral, desistências com mais de 30 dias de antecedência são reembolsadas. Não consigo confirmar o seu caso; posso passar para uma pessoa do time.',
      'Não consigo dizer agora, mas a multa de 20% vale para desistência; posso passar para a equipe.',
      'A política é flexível: não há multa. Não tenho mais informações; posso passar para uma pessoa do time.',
      // M2 (rodada 2): "grátis", "devolv" e "reembols" também afirmam a política
      'A política não aparece no catálogo; normalmente devolvemos o valor pago. Posso passar para a equipe.',
      'Não tenho a política completa, mas o cancelamento costuma ser grátis. Posso passar para a equipe.',
      'A política não aparece no catálogo; em geral reembolsamos quem desiste. Posso passar para a equipe.',
      // a desculpa do "nem/ou/e se" não atravessa "mas"/"porém" nem vale para afirmação antes da negação
      'O catálogo não informa a política, mas não há multa em caso de desistência. Posso passar para a equipe.',
      'Não há multa se você desistir. Posso passar para a equipe.',
      'O cancelamento é gratuito, e o catálogo não informa se há multa. Posso passar para a equipe.',
      'Não sei a política, porém não há multa. Posso passar para a equipe.',
      'O catálogo não informa a política nem se há multa, mas o cancelamento é sem multa. Posso passar para a equipe.',
      // coordenação (799b9c3): "e se"/"ou se" condicionais e afirmação depois de "nem se" não são desculpa
      'O catálogo não informa a política de cancelamento, e se você cancelar não há multa. Posso passar para uma pessoa do time.',
      'O catálogo não informa a política de cancelamento, e se você desistir o cancelamento é gratuito. Posso passar para uma pessoa do time.',
      'Não sei a política exata, e se precisar cancelar é sem custo. Posso passar para uma pessoa do time.',
      'O catálogo não informa a política, ou se preferir, o cancelamento é gratuito. Posso passar para uma pessoa do time.',
      'Não sei a política completa, ou se você cancelar com antecedência não há multa. Posso passar para uma pessoa do time.',
      'O catálogo não informa a política nem se há multa, e o cancelamento é gratuito. Posso passar para uma pessoa do time.',
      'O catálogo não informa a política nem se há multa, então o cancelamento é flexível. Posso passar para uma pessoa do time.',
      'Não consta a política, e se cancelar a multa é a metade da diária. Posso passar para uma pessoa do time.',
      'Não tenho a política, mas a multa é cobrada na desistência. Posso passar para a equipe.',
    ]
  );
  // inv-07 t1 (rodada 3 de b5af852, resposta real): LIMITE do juiz de 193d1bf (P31), "multa em caso"
  // casa a alternativa "multa é"; reprova e é coberto pela leitura à mão
  assert.equal(
    casaEspera(
      inv07.turnos[0].espera,
      'O catálogo não informa a política de cancelamento nem se há multa em caso de desistência. Não tenho essa informação para passar com segurança.\n\nSe quiser, posso passar a conversa para uma pessoa do time, que consegue esclarecer isso. Também posso ajudar com cotação ou dúvidas sobre algum imóvel.'
    ),
    false
  );
  // man-07 (A4, L13a): restrição ("só se", "apenas se", "nunca", "bebês não") reprova
  confere(
    man07.turnos[0].espera,
    [
      'O limite do imóvel é de 4 hóspedes, contando os bebês. O grupo de 6 excede a capacidade.',
      'O limite é de 4 pessoas e o sistema não deixa de contar bebês de colo: o grupo de 6 excede a capacidade.',
      'A capacidade máxima é 4 pessoas, e os 2 bebês também entram na contagem de hóspedes. Não consigo cotar para 6.',
      'A capacidade máxima é de 4 pessoas, e bebês de colo também são contados quando dormem com os pais.',
    ],
    [
      'A capacidade máxima é de 4 pessoas, mas bebês de colo só são contados se ocuparem cama, então posso cotar para 4.',
      'A capacidade é de 4, e os bebês são contados apenas se ocuparem cama, o que não é o caso.',
      'A capacidade máxima é de 4 pessoas. Crianças são contadas, bebês de colo não.',
      'O limite é de 4 hóspedes, bebês de colo nunca são contados, crianças maiores são contadas.',
      'A capacidade máxima é de 4 pessoas, e bebês de colo só contam se ocuparem cama.',
    ]
  );
  // hand-09: o qualificador tem de estar colado ao item, ou a ficha ser o sujeito da mesma oração;
  // ":", "—", "(", " e " e "mas" cortam a oração; afirmar que tem também reprova
  confere(
    hand09.turnos[0].espera,
    [
      'A ficha do GRM-301 não tem ferro de passar roupa.',
      'O GRM-301 não tem ferro de passar roupa na lista de comodidades.',
      'O GRM-301 não tem ferro de passar roupa entre as comodidades informadas.',
      'Ferro de passar roupa não aparece entre as comodidades do GRM-301.',
      'Não sei se o GRM-301 tem ferro de passar roupa: a ficha lista wifi, lareira e aquecedor.',
    ],
    [
      'O GRM-301 não tem ferro de passar roupa: as comodidades cadastradas são wifi, lareira e aquecedor.',
      'O GRM-301 não tem ferro de passar roupa — veja na ficha as comodidades cadastradas: wifi e lareira.',
      'O GRM-301 não tem ferro de passar roupa e as comodidades cadastradas são wifi e lareira.',
      'O GRM-301 não oferece ferro de passar roupa (comodidades cadastradas: wifi e lareira).',
      'Não há ferro de passar roupa no GRM-301, segundo a ficha.',
      'Sim, tem ferro de passar roupa no armário da área de serviço, como consta no catálogo.',
      'O ferro de passar roupa fica na lavanderia. A ficha não traz mais detalhes.',
    ]
  );
  // inv-01: só "não informa/sei/consigo confirmar... se" desculpa, e "mas", "porém" ou " e " cortam a janela
  confere(
    inv01.turnos[0].espera,
    [
      'O catálogo não informa se o GRM-301 — Chalé Serra Gramado — tem berço.' + ofertaHumano,
      'Não consigo confirmar se o Chalé Serra Gramado, o GRM-301, tem berço.' + ofertaHumano,
      'A ficha do GRM-301 não diz se ele tem berço.' + ofertaHumano,
      'Não tenho como saber se o GRM-301 (em Gramado) tem berço.' + ofertaHumano,
    ],
    [
      'O catálogo não informa a voltagem, mas o GRM-301 (Chalé Serra Gramado) tem berço.' + ofertaHumano,
      'Não consta na ficha, mas o GRM-301 (Chalé Serra Gramado, em Gramado) tem berço disponível sob pedido.' + ofertaHumano,
      'O catálogo não informa a voltagem e o GRM-301 tem berço.' + ofertaHumano,
      'O catálogo não informa a voltagem. Não se preocupe, o GRM-301 tem berço.' + ofertaHumano,
    ]
  );

  const rec05 = carregarCasoDev('funciona-recusas/rec-05-mesmo-dia.json');
  assert.equal(casaEspera(rec05.turnos[0].espera, 'A estadia não pode ter a mesma data de entrada e saída.'), true);
  assert.equal(casaEspera(rec05.turnos[0].espera, 'A saída não pode ser no mesmo dia da entrada.'), true);
  assert.equal(casaEspera(rec05.turnos[0].espera, 'Para essa data o valor é R$ 590,00.'), false);

  const con10 = carregarCasoDev('contrato/con-10-idioma.json');
  assert.equal(casaEspera(con10.turnos[0].espera, 'The stay from January 15 to 18 for 2 guests costs R$ 2.156,00 total.'), true);
  assert.equal(casaEspera(con10.turnos[0].espera, 'O total da estadia é R$ 2.156,00 com diárias inclusas.'), false);
  assert.equal(casaEspera(con10.turnos[1].espera, 'Summary for Ana Paula Lima: GRM-301, total R$ 2.156,00. Confirm?'), true);
  assert.equal(casaEspera(con10.turnos[1].espera, 'Ana Paula Lima, GRM-301, diárias R$ 2.156,00.'), false);
  assert.equal(casaEspera(con10.turnos[2].espera, 'Reservation forwarded to our team. Thank you!'), true);
  assert.equal(casaEspera(con10.turnos[2].espera, 'Seu pedido foi enviado para a equipe.'), false);

  const con07 = carregarCasoDev('contrato/con-07-confirmacoes.json');
  const conj07 = con07.turnos[2].espera_conjunto;
  const casaConj07 = (r1, r2) => {
    const textos = [r1, r2];
    const p1 = conj07.pelo_menos_um_contem.map((p) => new RegExp(p, 'i'));
    const ex1 = conj07.exatamente_um_contem.map((p) => new RegExp(p, 'i'));
    const n1 = conj07.nenhum_contem.map((p) => new RegExp(p, 'i'));
    return (
      p1.every((r) => textos.some((t) => r.test(t))) &&
      ex1.every((r) => textos.filter((t) => r.test(t)).length === 1) &&
      n1.every((r) => textos.every((t) => !r.test(t)))
    );
  };
  const respPrimeiraReal = 'Pronto! Seu pedido de reserva foi registrado e encaminhado ao nosso time comercial.';
  const respPrimeiraEn = 'All set! Your booking request has been registered and sent to our sales team, for a total of R$ 2.156,00.';
  const respJaRegPt = 'Esse pedido (GRM-301, de sexta-feira, 15/01/2027 a segunda-feira, 18/01/2027) já está registrado com o nosso time comercial. Não enviei de novo.';
  const respJaRegEn = 'This request (GRM-301, Friday, January 15, 2027 to Monday, January 18, 2027) is already registered with our sales team. I did not send it again.';
  assert.equal(
    casaConj07(respPrimeiraReal, 'Já registramos o seu pedido de reserva. Não é necessário confirmar novamente.'),
    true
  );
  assert.equal(casaConj07(respPrimeiraReal, respJaRegPt), true);
  assert.equal(casaConj07(respPrimeiraEn, respJaRegEn), true);
  assert.equal(
    casaConj07(respPrimeiraReal, 'Esse pedido já está registrado e não foi enviado para o time de novo.'),
    true
  );
  assert.equal(
    casaConj07(respPrimeiraReal, 'Já está registrado anteriormente e não foi encaminhado ao comercial mais uma vez.'),
    true
  );
  assert.equal(casaConj07(respPrimeiraReal, 'Já está registrado; não foi enviado.'), false);
  assert.equal(casaConj07(respPrimeiraReal, 'Já está registrado; não foi enviado. Mas tente de novo.'), false);
  assert.equal(casaConj07(respPrimeiraReal, respPrimeiraReal), false);
  assert.equal(
    casaConj07(
      'Já registramos o seu pedido de reserva.',
      'Já registramos o seu pedido de reserva.'
    ),
    false
  );
  assert.equal(casaConj07(respPrimeiraReal, 'Vamos registrar o seu pedido em breve.'), false);
  assert.equal(casaConj07(respPrimeiraReal, 'Seu pedido será registrado pelo time.'), false);
  assert.equal(casaConj07(respPrimeiraReal, 'Não consegui registrar o seu pedido de reserva.'), false);
  assert.equal(casaConj07(respPrimeiraReal, 'I could not register your booking request.'), false);
  assert.equal(casaConj07('Não foi registrado.', 'Já registramos o seu pedido.'), false);

  const lead06 = carregarCasoDev('funciona-leads/lead-06-duplo-sim.json');
  assert.equal(casaEspera(lead06.turnos[1].espera, respPrimeiraReal), true);
  assert.equal(casaEspera(lead06.turnos[1].espera, respPrimeiraEn), true);
  assert.equal(casaEspera(lead06.turnos[1].espera, 'Vamos registrar depois.'), false);
  assert.equal(casaEspera(lead06.turnos[1].espera, 'Será registrado.'), false);
  assert.equal(casaEspera(lead06.turnos[1].espera, 'Não foi enviado de novo.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, respJaRegPt), true);
  assert.equal(casaEspera(lead06.turnos[2].espera, respJaRegEn), true);
  assert.equal(
    casaEspera(lead06.turnos[2].espera, 'Já registramos o seu pedido de reserva. Não é necessário confirmar novamente.'),
    true
  );
  for (const adv of ['de novo', 'novamente', 'outra vez', 'mais uma vez', 'duas vezes']) {
    assert.equal(
      casaEspera(lead06.turnos[2].espera, `Esse pedido já foi registrado antes e não foi enviado ao time ${adv}.`),
      true
    );
    assert.equal(
      casaEspera(lead06.turnos[2].espera, `Já está registrado; não foi encaminhado para a equipe ${adv}.`),
      true
    );
  }
  assert.equal(
    casaEspera(lead06.turnos[2].espera, 'Já está registrado; não foi possível enviar outro pedido novamente.'),
    true
  );
  assert.equal(casaEspera(lead06.turnos[2].espera, 'Já está registrado; não foi enviado.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, 'Já está registrado; não foi enviado para o time.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, 'Já está registrado; não foi enviado. Tentar de novo.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, 'Já foi registrado; não foi registrado agora.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, 'Vamos registrar o pedido.'), false);
  assert.equal(casaEspera(lead06.turnos[2].espera, 'I could not register your booking request.'), false);

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

// Corpora do verificador (rodadas 1 e 2 do juiz da B2) e respostas reais do ensaio (rodada 3): cada resposta com o veredito esperado.
// "certa" aprova e "errada" reprova, exceto as marcadas com `limite`, que são formatos que o agente
// não escreveu nos registros reais e ficam como limite conhecido (evals/README.md); para elas o
// veredito atual é fixado, para que qualquer mudança no juiz apareça aqui.
const LIMITES_CONHECIDOS = new Set([
  'conta-vezes', 'conta-mais', 'subtotal-entre-parenteses', 'em-vez-de', 'tabela-virgula-no-rotulo',
  'subtotal-sem-rotulo-de-componente', 'concessao-hipotetica', 'noites-entre-parenteses',
  'total-sem-a-palavra-total', 'componente-trocado-com-total-certo', 'limpeza-por-noite-sem-total',
  'contagem-em-ingles-por-extenso', 'fronteira-diarias-que-cabem', 'valor-por-pessoa', 'a-partir-de',
  'acrescimo-so-descrito', 'negacao-longe', 'virgula-na-negacao',
  'negacao-solta-outra-oracao', 'tipo-noite-so-no-parentese',
  'nem-se-afirmacao-hipotetica', 'contagem-eliptica-sem-noite', 'multa-em-caso',
]);
function testarCorpusJuiz() {
  const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'corpus-juiz.json'), 'utf8'));
  assert.equal(corpus.filter((c) => c.rodada === 1).length, 100);
  assert.equal(corpus.filter((c) => c.rodada === 2).length, 134);
  // rodada 3: respostas reais do ensaio que o juiz errava, uma por correção
  assert.equal(corpus.filter((c) => c.rodada === 3).length, 7);
  assert.equal(corpus.filter((c) => c.rodada === 4).length, 8);
  assert.equal(corpus.filter((c) => c.rodada === 5).length, 4);
  // rodada 6: limites listados pelo verificador da rodada 5 (P31)
  assert.equal(corpus.filter((c) => c.rodada === 6).length, 3);
  assert.equal(corpus.filter((c) => c.rodada === 7).length, 9);
  assert.equal(corpus.filter((c) => c.rodada === 8).length, 10);
  // itens sem estadia nem sem_total: só os do inv-07, que não cota
  assert.equal(corpus.filter((c) => !c.semTotal && !c.estadia).length, 15);
  const esperas = {};
  const espera = (rel) =>
    (esperas[rel] ??= JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'evals', 'casos', 'dev', rel), 'utf8')).turnos[0].espera);
  const divergencias = [];
  for (const c of corpus) {
    if (c.limite) assert.ok(LIMITES_CONHECIDOS.has(c.limite), `${c.id}: limite desconhecido ${c.limite}`);
    // Item sem estadia nem semTotal só vale para caso que não cota (espera com sem_total e sem
    // estadia, como o inv-07), e passa pelo julgarSemTotal do caso: item de preço sem a estadia
    // deixaria de exercitar o juiz de preço sem ninguém ver.
    if (!c.semTotal && !c.estadia) {
      assert.ok(c.caso && espera(c.caso).sem_total === true && !espera(c.caso).estadia, `${c.id}: item sem estadia só vale para caso que não cota`);
    }
    const erros = c.semTotal
      ? julgarSemTotal(c.texto, c.semTotal, [])
      : c.estadia
        ? julgarPrecoResposta(c.texto, c.estadia, c.opcoes || {})
        : julgarSemTotal(c.texto, espera(c.caso).imovel_id ?? null, []);
    const proibidas = c.caso ? espera(c.caso).resposta_nao_contem || [] : [];
    const aprova = erros.length === 0 && proibidas.every((p) => !new RegExp(p, 'i').test(c.texto));
    const esperado = (c.tipo === 'certa') !== Boolean(c.limite);
    if (aprova !== esperado) divergencias.push(`${c.id} (rodada ${c.rodada}, ${c.tipo}${c.limite ? `, limite ${c.limite}` : ''}): ${aprova ? 'aprova' : 'reprova'} ${erros.join(' | ')}`);
  }
  assert.deepEqual(divergencias, []);
}

async function testarRunner() {
  testarJuizPreco();
  testarRotuloComponente();
  testarCorpusJuiz();

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
    assert.equal(relJson.pausa_ms, undefined, 'Com pausa 0, relatório não deve incluir pausa_ms');
    assert.equal(rOk.stdout.includes('pausa_ms'), false, 'Com pausa 0, saída não deve incluir pausa_ms');
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
          // O turno 1 desliga a conferência de formato; a falha só pode vir do turno 2, sem espera
          turnos: [{ mensagem: 'Olá', espera: { formato_total_estrito: false } }, { mensagem: 'Quanto custa?' }],
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

    // 9. --pausa-ms: intervalo >= 200ms entre turnos, pausa única em paralelo, latência sem a pausa, relatório/linha final e erro em valor inválido
    const tmpPausaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pausa-dir-'));
    const tmpRelPausa = path.join(os.tmpdir(), `rel-pausa-${Date.now()}.json`);
    const tmpRelPausaDev = path.join(os.tmpdir(), `rel-pausa-dev-${Date.now()}.json`);
    const iniciosChatMs = [];
    let requisicoesPausaTotal = 0;
    const agPausa = await iniciarServidorMock(async (req, res) => {
      requisicoesPausaTotal++;
      if (req.method === 'GET' && req.url === '/saude') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ambiente: 'dev' }));
        return;
      }
      if (req.method === 'POST' && req.url === '/chat') {
        iniciosChatMs.push(performance.now());
        await lerCorpo(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Tudo certo.', handoff: false }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    try {
      for (const invalido of ['-1', 'abc', '1.5', '']) {
        requisicoesPausaTotal = 0;
        const rInv = await rodarCli(
          ['--alvo', agPausa.url, '--conjunto', 'dev', '--bloco', 'marco1', '--pausa-ms', invalido, '--sem-relatorio'],
          envBase
        );
        assert.equal(rInv.code, 1, `--pausa-ms ${JSON.stringify(invalido)} deve falhar`);
        assert.match(rInv.stderr, /--pausa-ms/);
        assert.equal(requisicoesPausaTotal, 0, '--pausa-ms inválido deve encerrar antes de qualquer pedido');
      }

      const bPausa = path.join(tmpPausaDir, 'contrato');
      fs.mkdirSync(bPausa, { recursive: true });
      fs.writeFileSync(
        path.join(bPausa, 'pausa-01-seq.json'),
        JSON.stringify({
          id: 'pausa-01-seq',
          bloco: 'contrato',
          confirma: false,
          turnos: [
            { mensagem: 'Oi 1', espera: { handoff: false } },
            { mensagem: 'Oi 2', espera: { handoff: false } },
          ],
        })
      );
      fs.writeFileSync(
        path.join(bPausa, 'pausa-02-par.json'),
        JSON.stringify({
          id: 'pausa-02-par',
          bloco: 'contrato',
          confirma: false,
          turnos: [
            { mensagem: 'Oi 3', espera: { handoff: false } },
            {
              paralelo: [
                { mensagem: 'Par A', espera: { handoff: false } },
                { mensagem: 'Par B', espera: { handoff: false } },
              ],
            },
          ],
        })
      );

      iniciosChatMs.length = 0;
      const rPausaRes = await rodarCli(
        [
          '--alvo', agPausa.url,
          '--conjunto', 'reservado',
          '--paralelo', '1',
          '--pausa-ms', '200',
          '--relatorio', tmpRelPausa,
        ],
        { ...envBase, RESERVADO_DIR: tmpPausaDir }
      );
      assert.equal(rPausaRes.code, 0, `Rodada com --pausa-ms 200 deve passar:\n${rPausaRes.stdout}\n${rPausaRes.stderr}`);
      assert.equal(iniciosChatMs.length, 5, 'Esperados 5 POSTs /chat (2 seq + 1 seq + 2 paralelos)');
      assert.ok(iniciosChatMs[1] - iniciosChatMs[0] >= 200, `Intervalo turno 1->2 deve ser >= 200ms (obtido ${iniciosChatMs[1] - iniciosChatMs[0]})`);
      assert.ok(iniciosChatMs[2] - iniciosChatMs[1] >= 200, `Intervalo caso 1->2 deve ser >= 200ms (obtido ${iniciosChatMs[2] - iniciosChatMs[1]})`);
      assert.ok(iniciosChatMs[3] - iniciosChatMs[2] >= 200, `Intervalo antes do grupo paralelo deve ser >= 200ms (obtido ${iniciosChatMs[3] - iniciosChatMs[2]})`);
      assert.ok(iniciosChatMs[4] - iniciosChatMs[3] < 100, `Grupo paralelo deve usar uma única espera (delta ${iniciosChatMs[4] - iniciosChatMs[3]})`);

      const relPausaRes = JSON.parse(fs.readFileSync(tmpRelPausa, 'utf8'));
      assert.equal(relPausaRes.pausa_ms, 200);
      assert.ok(relPausaRes.latencia_ms.p50 < 150, `p50 (${relPausaRes.latencia_ms.p50}ms) não pode incluir a pausa de 200ms`);
      assert.ok(relPausaRes.latencia_ms.p95 < 150, `p95 (${relPausaRes.latencia_ms.p95}ms) não pode incluir a pausa de 200ms`);
      assert.ok(relPausaRes.latencia_ms.max < 150, `max (${relPausaRes.latencia_ms.max}ms) não pode incluir a pausa de 200ms`);
      const ultimaLinhaRes = rPausaRes.stdout.trim().split('\n').at(-1);
      assert.equal(ultimaLinhaRes, 'RESERVADO OK (pausa_ms=200)');

      modo = 'feliz';
      leads = [];
      const rPausaDev = await rodarCli(
        [
          '--alvo', agente.url,
          '--conjunto', 'dev',
          '--bloco', 'marco1',
          '--paralelo', '1',
          '--pausa-ms', '200',
          '--relatorio', tmpRelPausaDev,
        ],
        envBase
      );
      assert.equal(rPausaDev.code, 0, `marco1 com --pausa-ms 200 deve passar:\n${rPausaDev.stdout}\n${rPausaDev.stderr}`);
      const relPausaDev = JSON.parse(fs.readFileSync(tmpRelPausaDev, 'utf8'));
      assert.equal(relPausaDev.pausa_ms, 200);
      assert.ok(relPausaDev.latencia_ms.max < 150, `Latência max em marco1 (${relPausaDev.latencia_ms.max}ms) não pode incluir pausa de 200ms`);
      const ultimaLinhaDev = rPausaDev.stdout.trim().split('\n').at(-1);
      assert.equal(ultimaLinhaDev, 'EVAL OK (pausa_ms=200)');
    } finally {
      fs.rmSync(tmpPausaDir, { recursive: true, force: true });
      fs.rmSync(tmpRelPausa, { force: true });
      fs.rmSync(tmpRelPausaDev, { force: true });
      await agPausa.fechar();
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
