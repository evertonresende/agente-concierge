import { DurableObject } from "cloudflare:workers";

// Webhook de leads falso. Replica o contrato §5 do docs/CONTRATO.md para o
// ambiente dev: POST valida os 7 campos e guarda o lead, GET lista por segmento.
// Modos de teste (500, 422 e atraso) existem só aqui, nunca no webhook real.
//
// Cada segmento da URL (/leads/<segmento>) tem a sua própria instância deste
// Durable Object, logo a sua própria lista. Segmentos diferentes nunca se misturam.

const CAMPOS_TEXTO = ["nome", "telefone", "imovel_id"];
const CAMPOS_DATA = ["checkin", "checkout"];
const MODOS = ["500", "422", "atraso"];
const ATRASO_PADRAO_MS = 30000;
const ATRASO_MAXIMO_MS = 120000;

export class ListaDeLeads extends DurableObject {
  #pronta = false;

  constructor(ctx, env) {
    super(ctx, env);
  }

  #preparar() {
    if (this.#pronta) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recebido_em TEXT NOT NULL,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        imovel_id TEXT NOT NULL,
        checkin TEXT NOT NULL,
        checkout TEXT NOT NULL,
        hospedes INTEGER NOT NULL,
        valor_total REAL NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS modos (
        chave TEXT PRIMARY KEY,
        modo TEXT,
        atraso_ms INTEGER
      )
    `);
    this.#pronta = true;
  }

  listar() {
    this.#preparar();
    return this.ctx.storage.sql
      .exec(
        `SELECT id, recebido_em, nome, telefone, imovel_id, checkin, checkout,
                hospedes, valor_total
           FROM leads ORDER BY id`,
      )
      .toArray();
  }

  inserir(lead) {
    this.#preparar();
    const recebidoEm = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `INSERT INTO leads
         (recebido_em, nome, telefone, imovel_id, checkin, checkout, hospedes, valor_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      recebidoEm,
      lead.nome,
      lead.telefone,
      lead.imovel_id,
      lead.checkin,
      lead.checkout,
      lead.hospedes,
      lead.valor_total,
    );
    const { id } = this.ctx.storage.sql
      .exec("SELECT last_insert_rowid() AS id")
      .one();
    return { id, recebido_em: recebidoEm, ...lead };
  }

  limpar() {
    this.#preparar();
    const { total } = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS total FROM leads")
      .one();
    this.ctx.storage.sql.exec("DELETE FROM leads");
    return total;
  }

  lerModo() {
    this.#preparar();
    const linha = this.ctx.storage.sql
      .exec("SELECT modo, atraso_ms FROM modos WHERE chave = 'atual'")
      .toArray()[0];
    return {
      modo: linha?.modo ?? null,
      atraso_ms: linha?.atraso_ms ?? null,
    };
  }

  gravarModo(modo, atrasoMs) {
    this.#preparar();
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO modos (chave, modo, atraso_ms)
       VALUES ('atual', ?, ?)`,
      modo,
      atrasoMs,
    );
    return this.lerModo();
  }
}

function json(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function dataCivilValida(texto) {
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

// Valida presença e tipo dos 7 campos do contrato §5. Devolve a lista de erros
// vazia quando o lead pode ser guardado.
function validarLead(corpo) {
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return [{ campo: "corpo", erro: "precisa ser um objeto JSON" }];
  }

  const erros = [];
  const presente = (campo) => Object.prototype.hasOwnProperty.call(corpo, campo);

  for (const campo of CAMPOS_TEXTO) {
    if (!presente(campo)) erros.push({ campo, erro: "obrigatorio" });
    else if (typeof corpo[campo] !== "string") {
      erros.push({ campo, erro: "precisa ser texto" });
    } else if (corpo[campo].trim() === "") {
      erros.push({ campo, erro: "nao pode ser vazio" });
    }
  }

  for (const campo of CAMPOS_DATA) {
    if (!presente(campo)) erros.push({ campo, erro: "obrigatorio" });
    else if (typeof corpo[campo] !== "string") {
      erros.push({ campo, erro: "precisa ser texto" });
    } else if (
      !/^\d{4}-\d{2}-\d{2}$/.test(corpo[campo]) ||
      !dataCivilValida(corpo[campo])
    ) {
      erros.push({ campo, erro: "precisa ser data AAAA-MM-DD" });
    }
  }

  if (!presente("hospedes")) erros.push({ campo: "hospedes", erro: "obrigatorio" });
  else if (typeof corpo.hospedes !== "number" || !Number.isInteger(corpo.hospedes)) {
    erros.push({ campo: "hospedes", erro: "precisa ser inteiro" });
  }

  if (!presente("valor_total")) {
    erros.push({ campo: "valor_total", erro: "obrigatorio" });
  } else if (
    typeof corpo.valor_total !== "number" ||
    !Number.isFinite(corpo.valor_total)
  ) {
    erros.push({ campo: "valor_total", erro: "precisa ser numero" });
  }

  return erros;
}

function doLead(corpo) {
  return {
    nome: corpo.nome,
    telefone: corpo.telefone,
    imovel_id: corpo.imovel_id,
    checkin: corpo.checkin,
    checkout: corpo.checkout,
    hospedes: corpo.hospedes,
    valor_total: corpo.valor_total,
  };
}

function normalizarModo(valor) {
  const modo = String(valor).trim().toLowerCase();
  return MODOS.includes(modo) ? modo : null;
}

function normalizarAtraso(valor, padrao) {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > ATRASO_MAXIMO_MS) {
    return undefined;
  }
  return numero;
}

async function esperar(ms) {
  if (ms > 0) await new Promise((resolver) => setTimeout(resolver, ms));
}

// Modo efetivo do POST: o cabeçalho manda; sem ele, vale o modo gravado no
// segmento pelo controle (/modos/<segmento>). GET e DELETE nunca são afetados.
async function resolverModo(request, stub) {
  const cabecalho = request.headers.get("x-falso-modo");
  if (cabecalho !== null) {
    const modo = normalizarModo(cabecalho);
    if (!modo) {
      return {
        erro: json(
          { erro: `x-falso-modo invalido; use ${MODOS.join(", ")}` },
          400,
        ),
      };
    }
    if (modo !== "atraso") return { modo, atrasoMs: 0 };

    const atrasoMs = normalizarAtraso(
      request.headers.get("x-falso-atraso-ms"),
      ATRASO_PADRAO_MS,
    );
    if (atrasoMs === undefined) {
      return {
        erro: json(
          { erro: `x-falso-atraso-ms precisa ser inteiro entre 0 e ${ATRASO_MAXIMO_MS}` },
          400,
        ),
      };
    }
    return { modo, atrasoMs };
  }

  const salvo = await stub.lerModo();
  const modo = salvo.modo ? normalizarModo(salvo.modo) : null;
  return {
    modo,
    atrasoMs: modo === "atraso" ? (salvo.atraso_ms ?? ATRASO_PADRAO_MS) : 0,
  };
}

async function tratarLeads(request, stub, segmento) {
  const metodo = request.method;

  if (metodo === "GET") {
    return json({ leads: await stub.listar() });
  }

  if (metodo === "DELETE") {
    const removidos = await stub.limpar();
    return json({ ok: true, segmento, removidos });
  }

  if (metodo !== "POST") {
    return json({ erro: "metodo nao permitido" }, 405);
  }

  let resolvido;
  try {
    resolvido = await resolverModo(request, stub);
  } catch (erro) {
    return json({ erro: `falha ao ler o modo: ${erro.message}` }, 500);
  }
  if (resolvido.erro) return resolvido.erro;

  if (resolvido.modo === "500") {
    return json({ erro: "falha forcada (500)" }, 500);
  }
  if (resolvido.modo === "422") {
    return json({ erros: [{ campo: "modo", erro: "422 forcado" }] }, 422);
  }
  if (resolvido.modo === "atraso") {
    // O atraso acontece antes da validação; se o cliente desistir no meio, o
    // resultado fica incerto, como num tempo esgotado de verdade.
    await esperar(resolvido.atrasoMs);
  }

  const texto = await request.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return json({ erros: [{ campo: "corpo", erro: "JSON invalido" }] }, 422);
  }

  const erros = validarLead(corpo);
  if (erros.length > 0) return json({ erros }, 422);

  const lead = await stub.inserir(doLead(corpo));
  return json({ ok: true, lead }, 201);
}

async function tratarModos(request, stub, segmento) {
  if (request.method === "GET") {
    return json({ segmento, ...(await stub.lerModo()) });
  }

  if (request.method === "DELETE") {
    const salvo = await stub.gravarModo(null, null);
    return json({ ok: true, segmento, ...salvo });
  }

  if (request.method !== "PUT") {
    return json({ erro: "metodo nao permitido" }, 405);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ erro: "corpo precisa ser JSON" }, 400);
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return json({ erro: "corpo precisa ser um objeto JSON" }, 400);
  }

  const modoPedido =
    corpo.modo === null || corpo.modo === undefined || corpo.modo === "nenhum"
      ? null
      : normalizarModo(corpo.modo);
  if (corpo.modo !== null && corpo.modo !== undefined && corpo.modo !== "nenhum" && !modoPedido) {
    return json({ erro: `modo invalido; use ${MODOS.join(", ")} ou "nenhum"` }, 400);
  }

  let atrasoMs = null;
  if (modoPedido === "atraso") {
    atrasoMs = normalizarAtraso(corpo.atraso_ms, ATRASO_PADRAO_MS);
    if (atrasoMs === undefined) {
      return json(
        { erro: `atraso_ms precisa ser inteiro entre 0 e ${ATRASO_MAXIMO_MS}` },
        400,
      );
    }
  }

  const salvo = await stub.gravarModo(modoPedido, atrasoMs);
  return json({ ok: true, segmento, ...salvo });
}

export default {
  async fetch(request, env) {
    try {
      return await rotear(request, env);
    } catch (erro) {
      return json({ erro: `falha interna do falso: ${erro.message}` }, 500);
    }
  },
};

async function rotear(request, env) {
  const url = new URL(request.url);
  const partes = url.pathname.split("/").filter((parte) => parte !== "");

  if (partes.length === 0) {
    if (request.method !== "GET") {
      return json({ erro: "metodo nao permitido" }, 405);
    }
    return json({ ok: true, servico: "webhook-falso" });
  }

  if (partes.length !== 2) {
    return json({ erro: "rota nao encontrada" }, 404);
  }

  const [recurso, segmentoCru] = partes;
  let segmento;
  try {
    segmento = decodeURIComponent(segmentoCru);
  } catch {
    return json({ erro: "segmento invalido" }, 400);
  }
  if (segmento === "") return json({ erro: "segmento vazio" }, 404);

  const stub = env.LISTA_DE_LEADS.get(env.LISTA_DE_LEADS.idFromName(segmento));

  if (recurso === "leads") return tratarLeads(request, stub, segmento);
  if (recurso === "modos") return tratarModos(request, stub, segmento);

  return json({ erro: "rota nao encontrada" }, 404);
}
