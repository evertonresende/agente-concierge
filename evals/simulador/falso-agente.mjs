import http from 'node:http';
import { carregarCatalogo, detectarImovelNoTexto } from './catalogo.mjs';
import {
  classificarConfirmacaoHospede,
  detectarGatilhoHandoff,
  normalizarDigitosTelefone,
} from './juizes.mjs';
import { calcularCotacao, parseDataCivil } from './preco.mjs';

function lerJsonReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function responderJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(payload);
}

export async function iniciarWebhookFalsoLocal(porta = 0) {
  const leads = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname.startsWith('/leads')) {
      return responderJson(res, 200, { leads: [...leads] });
    }
    if (req.method === 'POST' && url.pathname.startsWith('/leads')) {
      try {
        const corpo = await lerJsonReq(req);
        const obrigatorios = [
          'nome',
          'telefone',
          'imovel_id',
          'checkin',
          'checkout',
          'hospedes',
          'valor_total',
        ];
        const erros = obrigatorios.filter(
          (c) => corpo[c] === undefined || corpo[c] === null || corpo[c] === '',
        );
        if (erros.length > 0) {
          return responderJson(res, 422, { erros });
        }
        leads.push({ ...corpo, recebido_em: new Date().toISOString() });
        return responderJson(res, 201, { ok: true });
      } catch {
        return responderJson(res, 400, { erro: 'json invalido' });
      }
    }
    return responderJson(res, 404, { erro: 'nao encontrado' });
  });

  await new Promise((resolve) => server.listen(porta, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}/leads/local-sim`;

  return {
    url: baseUrl,
    leads,
    fechar: () => new Promise((resolve) => server.close(resolve)),
  };
}

function extrairDatasBrOuIso(texto) {
  const regex = /\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g;
  const encontradas = [];
  for (const m of texto.matchAll(regex)) {
    encontradas.push(m[1]);
  }
  return encontradas;
}

function extrairHospedes(texto) {
  // Soma adultos + criancas/bebes primeiro se vierem separados (L13)
  const ad = texto.match(/(\d+)\s*adultos?/i);
  const cr = texto.match(/(\d+)\s*(?:crian[çc]as?|beb[êe]s?)/i);
  if (ad && cr) return Number(ad[1]) + Number(cr[1]);
  const m = texto.match(
    /\b(\d+)\s*(?:h[óo]spede|h[óo]spedes|pessoa|pessoas|adulto|adultos|crian[çc]as?)\b/i,
  );
  if (m) return Number(m[1]);
  return null;
}

function extrairTelefone(texto) {
  const m = texto.match(/(?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
  return m ? m[0].trim() : null;
}

function formatarTelefoneBr(raw) {
  const dig = normalizarDigitosTelefone(raw);
  if (dig.length === 11) {
    return `(${dig.slice(0, 2)}) ${dig.slice(2, 7)}-${dig.slice(7)}`;
  }
  if (dig.length === 10) {
    return `(${dig.slice(0, 2)}) ${dig.slice(2, 6)}-${dig.slice(6)}`;
  }
  return raw;
}

function extrairNome(texto) {
  const m = texto.match(/(?:sou|meu\s+nome\s+[ée]|nome[:\s]+)\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/i);
  return m ? m[1].trim() : null;
}

export async function iniciarAgenteFalsoLocal({
  leadsUrl,
  ambiente = 'dev',
  modo = 'correto',
  porta = 0,
}) {
  const catalogo = carregarCatalogo();
  const sessoes = new Map();
  const filas = new Map();

  function enfileirarSessao(sessionId, fn) {
    if (modo === 'lead_duplicado') {
      // Simula falha de concorrencia sem fila
      return fn();
    }
    const anterior = filas.get(sessionId) || Promise.resolve();
    const proxima = anterior.then(fn, fn);
    filas.set(sessionId, proxima);
    return proxima;
  }

  async function processarMensagem(sessionId, message) {
    let estado = sessoes.get(sessionId);
    if (!estado) {
      estado = {
        imovel: null,
        checkin: null,
        checkout: null,
        hospedes: null,
        nome: null,
        telefone: null,
        resumoPendente: null,
        reservasRegistradas: new Set(),
      };
      sessoes.set(sessionId, estado);
    }

    if (modo === 'vaza_url') {
      return { reply: `Consulte em ${leadsUrl}`, handoff: false };
    }
    if (modo === 'formato_errado') {
      return { reply: 'O total é R$ 2156', handoff: 'nao' };
    }

    const imovelDetectado = detectarImovelNoTexto(message, catalogo);
    if (imovelDetectado) estado.imovel = imovelDetectado;

    const datas = extrairDatasBrOuIso(message);
    if (datas.length >= 2) {
      estado.checkin = datas[0];
      estado.checkout = datas[1];
    }

    const hosp = extrairHospedes(message);
    if (hosp !== null) estado.hospedes = hosp;

    const tel = extrairTelefone(message);
    if (tel) estado.telefone = formatarTelefoneBr(tel);

    const nome = extrairNome(message);
    if (nome) estado.nome = nome;

    // Detecta gatilhos de handoff / manipulacao
    const det = detectarGatilhoHandoff(message, {
      conflitoRegra: estado.imovel && !estado.imovel.regras?.aceita_pet,
    });

    if (det.esperaHandoff === true) {
      if (modo === 'sem_handoff') {
        return { reply: 'Não podemos conceder desconto, mas seguimos por aqui.', handoff: false };
      }
      return {
        reply: 'Não é possível negociar valores ou abrir exceções por aqui. Vou transferir você para um atendente humano.',
        handoff: true,
      };
    }

    if (det.esperaHandoff === false && det.motivo === 'manipulacao_pura_L16') {
      return {
        reply: 'Sou o concierge de imóveis de temporada e não posso alterar minhas regras ou revelar informações internas.',
        handoff: false,
      };
    }

    // Pedido de alteracao apos resumo invalida resumo anterior (L10)
    const classif = classificarConfirmacaoHospede(message);
    if (classif === 'invalida_mudanca_ou_forca') {
      estado.resumoPendente = null;
    }

    // Se pediu dados invalidos de data/capacidade/minimo
    if (datas.length >= 2 || (estado.imovel && estado.checkin && estado.checkout && estado.hospedes)) {
      const ciValido = parseDataCivil(estado.checkin || '');
      const coValido = parseDataCivil(estado.checkout || '');
      if (datas.length >= 2 && (!ciValido || !coValido)) {
        return {
          reply: 'A data informada não existe no calendário. Por favor, envie datas válidas de entrada e saída.',
          handoff: false,
        };
      }
      if (estado.imovel && estado.checkin && estado.checkout) {
        const cotacao = calcularCotacao({
          imovel: estado.imovel,
          checkin: estado.checkin,
          checkout: estado.checkout,
          hospedes: estado.hospedes || 1,
        });
        if (!cotacao.ok) {
          return {
            reply: `Não é possível cotar essa estadia (motivo: ${cotacao.motivo}). Por favor, revise as datas ou o número de hóspedes.`,
            handoff: false,
          };
        }

        if (modo === 'preco_errado') {
          return {
            reply: `O valor total da estadia no ${estado.imovel.id} é R$ 1.000,00.`,
            handoff: false,
          };
        }

        // Modo bugado: envia lead sem esperar confirmacao em outro turno
        if (
          modo === 'lead_sem_confirmacao' &&
          estado.nome &&
          estado.telefone &&
          leadsUrl
        ) {
          await fetch(leadsUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              nome: estado.nome,
              telefone: estado.telefone,
              imovel_id: cotacao.imovel_id,
              checkin: cotacao.checkin,
              checkout: cotacao.checkout,
              hospedes: cotacao.hospedes,
              valor_total: cotacao.valorWebhook,
            }),
          });
          return {
            reply: `Lead registrado para ${cotacao.imovel_id}, total ${cotacao.totalFormatado}.`,
            handoff: false,
          };
        }

        // Confirmacao inequivoca de um resumo pendente
        if (estado.resumoPendente && classif === 'inequivoca') {
          const chave = `${cotacao.imovel_id}|${cotacao.checkin}|${cotacao.checkout}|${cotacao.hospedes}|${estado.telefone}`;
          if (estado.reservasRegistradas.has(chave) && modo !== 'lead_duplicado') {
            return {
              reply: `Seu pedido de reserva no ${cotacao.imovel_id} já foi registrado anteriormente (${cotacao.totalFormatado}).`,
              handoff: false,
            };
          }

          if (leadsUrl) {
            const respLead = await fetch(leadsUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                nome: estado.nome,
                telefone: estado.telefone,
                imovel_id: cotacao.imovel_id,
                checkin: cotacao.checkin,
                checkout: cotacao.checkout,
                hospedes: cotacao.hospedes,
                valor_total: cotacao.valorWebhook,
              }),
            });
            if (respLead.status === 201) {
              estado.reservasRegistradas.add(chave);
              estado.resumoPendente = null;
              return {
                reply: `Pedido registrado com sucesso para o ${cotacao.imovel_id} de ${cotacao.checkinBr} a ${cotacao.checkoutBr}, total ${cotacao.totalFormatado}. Nosso time comercial entrará em contato.`,
                handoff: false,
              };
            }
          }
        }

        // Se ja tem nome e telefone e ainda nao apresentou o resumo atual (ou houve mudanca)
        if (estado.nome && estado.telefone && estado.hospedes) {
          estado.resumoPendente = { ...cotacao };
          return {
            reply: `Resumo do pedido: imóvel ${cotacao.imovel_id}, entrada ${cotacao.checkinBr}, saída ${cotacao.checkoutBr}, ${cotacao.hospedes} hóspedes, nome ${estado.nome}, telefone ${estado.telefone}, total ${cotacao.totalFormatado}. Você confirma os dados para envio ao time comercial?`,
            handoff: false,
          };
        }

        return {
          reply: `Para o imóvel ${cotacao.imovel_id} de ${cotacao.checkinBr} a ${cotacao.checkoutBr} (${cotacao.noites} noites), o total fica em ${cotacao.totalFormatado}. Lembrete: esta cotação não garante disponibilidade das datas.`,
          handoff: false,
        };
      }
    }

    return {
      reply: 'Posso ajudar com dúvidas sobre nossos imóveis, cotações de estadia ou encaminhar seu interesse.',
      handoff: false,
    };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/saude') {
      return responderJson(res, 200, {
        ok: true,
        ambiente,
        leads_destino: 'falso',
        envio_leads: 'ligado',
      });
    }
    if (req.method === 'POST' && url.pathname === '/chat') {
      try {
        const corpo = await lerJsonReq(req);
        if (
          typeof corpo?.session_id !== 'string' ||
          typeof corpo?.message !== 'string'
        ) {
          return responderJson(res, 400, {
            reply: 'Corpo inválido: informe session_id e message em texto.',
            handoff: false,
          });
        }
        const resultado = await enfileirarSessao(corpo.session_id, () =>
          processarMensagem(corpo.session_id, corpo.message),
        );
        return responderJson(res, 200, resultado, {
          'x-uso-entrada': '120',
          'x-uso-saida': '45',
          'x-chamadas-modelo': '1',
        });
      } catch {
        return responderJson(res, 400, {
          reply: 'JSON inválido.',
          handoff: false,
        });
      }
    }
    return responderJson(res, 404, { erro: 'nao encontrado' });
  });

  await new Promise((resolve) => server.listen(porta, '127.0.0.1', resolve));
  const addr = server.address();
  return {
    url: `http://127.0.0.1:${addr.port}`,
    fechar: () => new Promise((resolve) => server.close(resolve)),
  };
}
