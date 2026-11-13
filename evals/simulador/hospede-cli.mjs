import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MODELO_PADRAO_HOSPEDE = 'gemini-3.8-flash-low';

export const MODELOS_PERMITIDOS_HOSPEDE = new Set([
  'gemini-3.8-flash-low',
  'gemini-3.8-flash-medium',
  'gemini-3.8-flash-high',
  'gemini-4-argon-low',
  'gemini-4-argon-medium',
  'gemini-4-argon-high',
  'gemini-4-hydrogen-low',
  'gemini-4-hydrogen-medium',
  'gemini-4-hydrogen-high',
  'gemini-4-hydrogen-xhigh',
  'claude-sonnet-5-5-low',
  'claude-sonnet-5-5-medium',
  'claude-sonnet-5-5-high',
  'claude-opus-5-5-low',
  'claude-opus-5-5-medium',
  'claude-opus-5-5-high',
]);

export function validarModeloPermitido(modelo) {
  if (!modelo || typeof modelo !== 'string' || !modelo.trim()) {
    throw new Error('Modelo do hóspede não informado. Passe --modelo <nome>.');
  }
  const limpo = modelo.trim();
  const norm = limpo.toLowerCase();
  if (!MODELOS_PERMITIDOS_HOSPEDE.has(norm)) {
    throw new Error(
      `Modelo não permitido para o simulador (fora da lista explícita permitida): ${limpo}`,
    );
  }
  return norm;
}

export function sanitizarTextoParaCli(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL_REMOVIDA]')
    .replace(/\b(?:CATALOGO_URL|LEADS_URL|CLOUDFLARE_API_TOKEN)\b/g, '[SEGREDO_REMOVIDO]');
}

export function montarPromptHospede({ persona, cenario, historico, objetivoTurno }) {
  const linhasHistorico =
    historico.length === 0
      ? '(início da conversa, ainda não houve mensagens)'
      : historico
          .map((item) => {
            const textoSeguro =
              item.papel === 'agente' ? sanitizarTextoParaCli(item.texto) : item.texto;
            return item.papel === 'hospede'
              ? `Hóspede: ${textoSeguro}`
              : `Agente: ${textoSeguro}`;
          })
          .join('\n');

  const instrucoes = [
    'Você está simulando um HÓSPEDE em um chat de aluguel por temporada no Brasil.',
    'Escreva APENAS a próxima mensagem do hóspede, em português do Brasil, natural e direta (1 a 3 frases, sem aspas externas, sem prefixo "Hóspede:", sem explicações).',
    'Sempre que mencionar datas, use o formato completo DD/MM/AAAA (ex.: 15/01/2027) e cite o código do imóvel quando aplicável.',
    `Persona: ${persona.descricaoPrompt}`,
    `Dados sintéticos desta conversa: imóvel ${cenario.imovel.id} (${cenario.imovel.nome}, ${cenario.imovel.cidade}), datas principais ${cenario.checkinBr} a ${cenario.checkoutBr}, ${cenario.hospedes} hóspedes, nome "${cenario.nome}", telefone "${cenario.telefone}".`,
    cenario.observacaoCenario ? `Detalhe adicional: ${cenario.observacaoCenario}` : null,
    'Histórico até agora:',
    linhasHistorico,
    `Objetivo específico DESTE turno: ${objetivoTurno}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Garantia de sigilo: nunca envia URL nem nome de variável secreta para a CLI externa
  if (/https?:\/\//i.test(instrucoes) || /\b(?:CATALOGO_URL|LEADS_URL|CLOUDFLARE_API_TOKEN)\b/.test(instrucoes)) {
    throw new Error('Prompt do hóspede bloqueado por conter URL ou identificador de segredo.');
  }

  return instrucoes;
}

export function sanitizarEnvParaSubprocesso() {
  return {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME || os.homedir(),
    LANG: process.env.LANG || 'C.UTF-8',
    LC_ALL: process.env.LC_ALL || 'C.UTF-8',
    TERM: process.env.TERM || 'xterm-256color',
  };
}

export async function gerarMensagemHospede({
  cli = 'agy',
  modelo = MODELO_PADRAO_HOSPEDE,
  prompt,
  timeoutMs = 50_000,
}) {
  const modeloValido = validarModeloPermitido(modelo);

  if (/https?:\/\//i.test(prompt)) {
    throw new Error('Texto enviado à CLI não pode conter URL.');
  }

  const args = ['-p', prompt, '--model', modeloValido];
  // Flags específicas suportadas pela CLI agy para saída limpa e sem slash commands
  if (cli === 'agy' || cli.endsWith('/agy')) {
    args.push('--output-format', 'text', '--disable-slash-commands', '--print-timeout', '45s');
  }

  const { stdout } = await execFileAsync(cli, args, {
    cwd: os.tmpdir(),
    env: sanitizarEnvParaSubprocesso(),
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });

  const texto = String(stdout || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^H[óo]spede:\s*/i, '')
    .trim();

  if (!texto) {
    throw new Error(`CLI do hóspede (${cli}) retornou resposta vazia.`);
  }

  return texto;
}
