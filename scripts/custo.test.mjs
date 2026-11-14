// Teste do scripts/custo.mjs: node --test scripts/custo.test.mjs
// Relatórios de mentira só com números e ids neutros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, lerPreco } from './custo.mjs';

function pasta(arquivos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'custo-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(dir, nome), JSON.stringify(conteudo));
  }
  return dir;
}

function rodar(args) {
  let out = '';
  let err = '';
  const codigo = main(args, { write: (s) => { out += s; } }, { write: (s) => { err += s; } });
  return { codigo, out, err };
}

const conversa = (id, entrada, saida, chamadas) => ({
  id, bloco: 'b', passou: true, falhas: [], uso_entrada: entrada, uso_saida: saida, chamadas_modelo: chamadas,
});

// Haiku (0,10 / 0,50 por milhão):
// c1: 1000 × 0,10 + 100 × 0,50 = 0,00010 + 0,00005 = US$ 0,00015
// c2: 12838 × 0,10 + 676 × 0,50 = 0,0012838 + 0,000338 = US$ 0,0016218 → 0,00162
// c3: 0 tokens (pedido que falhou) = 0
// total 0,0017718 → 0,00177; média 0,0005906 → 0,00059; p50 = c1; p95 = máx = c2
const conhecido = {
  conjunto: 'dev',
  uso: {},
  conversas: [conversa('c1', 1000, 100, 1), conversa('c2', 12838, 676, 3), conversa('c3', 0, 0, 0)],
};

test('números conhecidos dão o custo exato', () => {
  const r = rodar([pasta({ 'a.json': conhecido }), '--json']);
  assert.equal(r.codigo, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.modelo, 'anthropic/claude-haiku-5.5');
  assert.deepEqual(
    [j.geral.custo_medio_usd, j.geral.custo_p50_usd, j.geral.custo_p95_usd, j.geral.custo_max_usd, j.geral.custo_total_usd],
    [0.00059, 0.00015, 0.00162, 0.00162, 0.00177],
  );
  assert.equal(j.geral.sem_chamadas, 1);
  assert.equal(j.geral.entrada_total, 13838);
  assert.match(r.err, /não dizem qual modelo/);
});

test('saída legível termina com CUSTO OK e o valor médio, sem ruído de ponto flutuante', () => {
  const r = rodar([pasta({ 'a.json': conhecido })]);
  assert.equal(r.codigo, 0);
  const linhas = r.out.trimEnd().split('\n');
  assert.equal(linhas.at(-1), 'CUSTO OK US$ 0,00059 por conversa (média de 3)');
  assert.doesNotMatch(r.out, /\d{7,}|e-\d/);
});

test('preço sobrescrito pela linha de comando, sem float', () => {
  // c1 com 0,15 / 0,50: 0,00015 + 0,00005 = 0,00020
  const dir = pasta({ 'a.json': { conjunto: 'dev', conversas: [conversa('c1', 1000, 100, 1)] } });
  const j = JSON.parse(rodar([dir, '--json', '--preco-entrada', '0,15']).out);
  assert.equal(j.geral.custo_medio_usd, 0.0002);
  assert.equal(lerPreco('0.1'), 100_000);
  assert.equal(lerPreco('1,40'), 1_400_000);
  assert.equal(rodar([dir, '--modelo', 'x/sem-preco']).codigo, 2);
});

test('relatório sem dados de uso falha limpo, sem CUSTO OK', () => {
  const dir = pasta({ 's.json': { tipo: 'outro', conversas: [{ id: 'x', passou: true }] } });
  const r = rodar([dir]);
  assert.equal(r.codigo, 1);
  assert.doesNotMatch(r.out + r.err, /CUSTO OK/);
  assert.match(r.err, /CUSTO FALHOU: nenhum relatório com dados de uso/);
  assert.match(r.err, /ignorado .*s\.json/);
});

test('mistura: ignora o que não tem uso, avisa e calcula o resto', () => {
  const dir = pasta({
    'a.json': conhecido,
    'b.json': { tipo: 'outro', conversas: [{ id: 'x' }] },
    'c.json': { conjunto: 'reservado', so_agregado: true, agregado: { executados: 2 },
      uso: { entrada_total: 2000, saida_total: 200, chamadas_modelo_total: 2 } },
  });
  const r = rodar([dir]);
  assert.equal(r.codigo, 0);
  assert.match(r.err, /ignorado .*b\.json/);
  assert.match(r.err, /c\.json: só agregado/);
  assert.match(r.out, /CUSTO OK US\$ 0,00059 por conversa \(média de 3\)\n$/);
});
