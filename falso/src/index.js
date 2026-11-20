import { DurableObject } from "cloudflare:workers";
import { tratarCatalogo } from "./catalogo.js";
import { corteDaRetencao, RETENCAO_MS } from "./retencao.js";

// Webhook de leads falso. Replica o contrato §5 do docs/CONTRATO.md para o
// ambiente dev: POST valida os 7 campos e guarda o lead, GET lista por segmento.
// Modos de teste (500, 422 e atraso) existem só aqui, nunca no webhook real.
//
// Cada segmento da URL (/leads/<segmento>) tem a sua própria instância deste
// Durable Object, logo a sua própria lista de leads e os seus próprios modos de
// teste. Segmentos diferentes nunca se misturam.

const CAMPOS_TEXTO = ["nome", "telefone", "imovel_id"];
const CAMPOS_DATA = ["checkin", "checkout"];
const MODOS = ["500", "422", "atraso"];
const ATRASO_PADRAO_MS = 30000;
const ATRASO_MAXIMO_MS = 120000;
const VALIDADE_PADRAO_S = 120;
const VALIDADE_MAXIMA_S = 900;

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
    // Tabela nova (a versão anterior guardava um modo único em "modos"): cada
    // telefone tem no máximo um modo ativo, e o telefone vazio é o modo geral do
    // segmento. Modos antigos ficam para trás e não passam a valer sozinhos.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS modos_ativos (
        telefone TEXT PRIMARY KEY,
        modo TEXT NOT NULL,
        atraso_ms INTEGER,
        expira_em INTEGER NOT NULL
      )
    `);
    this.#pronta = true;
  }

  /** Segmento com lead e sem alarme (leads de antes da retenção): o alarme roda já e reagenda. */
  #garantirAlarme() {
    this.ctx.storage.getAlarm()
      .then((alarme) => alarme ?? this.ctx.storage.setAlarm(Date.now() + 1000))
      .catch(() => {}); // sem o alarme, o lead só fica mais tempo; nada falha por isso
  }

  listar() {
    this.#preparar();
    this.#garantirAlarme();
    return this.ctx.storage.sql
      .exec(
        `SELECT id, recebido_em, nome, telefone, imovel_id, checkin, checkout,
                hospedes, valor_total
           FROM leads ORDER BY id`,
      )
      .toArray();
  }

  /** Alarme da retenção: apaga os leads vencidos e reagenda para o próximo a vencer. */
  async alarm() {
    this.#preparar();
    this.ctx.storage.sql.exec("DELETE FROM leads WHERE recebido_em < ?", corteDaRetencao(Date.now()));
    const [proximo] = this.ctx.storage.sql.exec("SELECT MIN(recebido_em) AS r FROM leads").toArray();
    if (proximo?.r) await this.ctx.storage.setAlarm(Date.parse(proximo.r) + RETENCAO_MS);
  }

  inserir(lead) {
    this.#preparar();
    // Todo lead guardado tem prazo: sem alarme, o alarme roda já, não apaga nada e reagenda
    // para quando o lead mais antigo vencer.
    this.#garantirAlarme();
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

  // Devolve só os modos ainda válidos e apaga os expirados no caminho.
  lerModos(agora) {
    this.#preparar();
    this.ctx.storage.sql.exec(
      "DELETE FROM modos_ativos WHERE expira_em <= ?",
      agora,
    );
    return this.ctx.storage.sql
      .exec(
        `SELECT telefone, modo, atraso_ms, expira_em
           FROM modos_ativos ORDER BY telefone`,
      )
      .toArray();
  }

  gravarModo(registro) {
    this.#preparar();
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO modos_ativos (telefone, modo, atraso_ms, expira_em)
       VALUES (?, ?, ?, ?)`,
      registro.telefone,
      registro.modo,
      registro.atraso_ms,
      registro.expira_em,
    );
    return this.lerModos(Date.now());
  }

  // telefone null limpa todos os modos do segmento; com dígitos, só o daquele
  // telefone.
  limparModos(telefone) {
    this.#preparar();
    const { total } =
      telefone === null
        ? this.ctx.storage.sql
            .exec("SELECT COUNT(*) AS total FROM modos_ativos")
            .one()
        : this.ctx.storage.sql
            .exec(
              "SELECT COUNT(*) AS total FROM modos_ativos WHERE telefone = ?",
              telefone,
            )
            .one();
    if (telefone === null) {
      this.ctx.storage.sql.exec("DELETE FROM modos_ativos");
    } else {
      this.ctx.storage.sql.exec(
        "DELETE FROM modos_ativos WHERE telefone = ?",
        telefone,
      );
    }
    return total;
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

// Compara telefone só pelos dígitos, aceitando o prefixo 55 de um lado e não do
// outro. Devolve null quando não sobra dígito.
function digitosTelefone(texto) {
  if (typeof texto !== "string") return null;
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return null;
  if (
    digitos.length >= 12 &&
    digitos.length <= 13 &&
    digitos.startsWith("55")
  ) {
    return digitos.slice(2);
  }
  return digitos;
}

// Atraso vindo de cabeçalho (string); undefined é inválido.
function atrasoDoCabecalho(valor, padrao) {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > ATRASO_MAXIMO_MS) {
    return undefined;
  }
  return numero;
}

// Atraso vindo de JSON (tem que ser número inteiro); undefined é inválido.
function atrasoDoCorpo(valor) {
  if (!Number.isInteger(valor) || valor < 0 || valor > ATRASO_MAXIMO_MS) {
    return undefined;
  }
  return valor;
}

function validadeDoCorpo(valor) {
  if (!Number.isInteger(valor) || valor < 1 || valor > VALIDADE_MAXIMA_S) {
    return undefined;
  }
  return valor;
}

function modoParaJson(linha) {
  return {
    modo: linha.modo,
    telefone: linha.telefone === "" ? null : linha.telefone,
    atraso_ms: linha.atraso_ms ?? null,
    expira_em: new Date(linha.expira_em).toISOString(),
  };
}

// O modo de um telefone vale mais que o modo geral do segmento. Modos
// expirados já foram removidos por lerModos.
function escolherModo(modos, corpo) {
  const digitos = digitosTelefone(corpo?.telefone);
  const especifico = digitos
    ? modos.find((linha) => linha.telefone === digitos)
    : null;
  return especifico ?? modos.find((linha) => linha.telefone === "") ?? null;
}

async function esperar(ms) {
  if (ms > 0) await new Promise((resolver) => setTimeout(resolver, ms));
}

// Lê e valida o cabeçalho x-falso-modo, que tem precedência sobre o modo gravado.
function modoDoCabecalho(request) {
  const cabecalho = request.headers.get("x-falso-modo");
  if (cabecalho === null) return { modo: null, atrasoMs: 0 };

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

  const atrasoMs = atrasoDoCabecalho(
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

  const cabecalho = modoDoCabecalho(request);
  if (cabecalho.erro) return cabecalho.erro;
  if (cabecalho.modo === "500") return json({ erro: "falha forcada (500)" }, 500);
  if (cabecalho.modo === "422") {
    return json({ erros: [{ campo: "modo", erro: "422 forcado" }] }, 422);
  }

  const texto = await request.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return json({ erros: [{ campo: "corpo", erro: "JSON invalido" }] }, 422);
  }

  let modo = cabecalho.modo;
  let atrasoMs = cabecalho.atrasoMs;
  if (!modo) {
    const modos = await stub.lerModos(Date.now());
    const escolhido = escolherModo(modos, corpo);
    if (escolhido) {
      modo = escolhido.modo;
      atrasoMs =
        escolhido.modo === "atraso"
          ? (escolhido.atraso_ms ?? ATRASO_PADRAO_MS)
          : 0;
    }
  }

  if (modo === "500") return json({ erro: "falha forcada (500)" }, 500);
  if (modo === "422") {
    return json({ erros: [{ campo: "modo", erro: "422 forcado" }] }, 422);
  }

  const erros = validarLead(corpo);
  if (erros.length > 0) return json({ erros }, 422);

  // Lead válido: guarda antes de qualquer espera. Se o cliente desistir durante
  // o atraso, o lead já está na lista — é o resultado incerto do L11.
  const lead = await stub.inserir(doLead(corpo));
  if (modo === "atraso") await esperar(atrasoMs);
  return json({ ok: true, lead }, 201);
}

async function tratarModos(request, stub, segmento) {
  if (request.method === "GET") {
    const modos = await stub.lerModos(Date.now());
    return json({ segmento, modos: modos.map(modoParaJson) });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const telefoneCru = url.searchParams.get("telefone");
    let telefone = null;
    if (telefoneCru !== null) {
      telefone = digitosTelefone(telefoneCru);
      if (!telefone) {
        return json({ erro: "telefone precisa ter digitos" }, 400);
      }
    }
    const removidos = await stub.limparModos(telefone);
    return json({ ok: true, segmento, removidos });
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
  const tem = (campo) => Object.prototype.hasOwnProperty.call(corpo, campo);

  if (!tem("modo")) {
    return json({ erro: "modo e obrigatorio" }, 400);
  }
  const modo = normalizarModo(corpo.modo);
  if (!modo) {
    return json({ erro: `modo invalido; use ${MODOS.join(", ")}` }, 400);
  }

  let telefone = "";
  if (tem("telefone") && corpo.telefone !== null) {
    if (typeof corpo.telefone !== "string") {
      return json({ erro: "telefone precisa ser texto" }, 400);
    }
    telefone = digitosTelefone(corpo.telefone) ?? "";
    if (!telefone) {
      return json({ erro: "telefone precisa ter digitos" }, 400);
    }
  }

  let validadeS = VALIDADE_PADRAO_S;
  if (tem("validade_s")) {
    validadeS = validadeDoCorpo(corpo.validade_s);
    if (validadeS === undefined) {
      return json(
        {
          erro: `validade_s precisa ser inteiro entre 1 e ${VALIDADE_MAXIMA_S}`,
        },
        400,
      );
    }
  }

  let atrasoMs = null;
  if (modo === "atraso") {
    atrasoMs = tem("atraso_ms")
      ? atrasoDoCorpo(corpo.atraso_ms)
      : ATRASO_PADRAO_MS;
    if (atrasoMs === undefined) {
      return json(
        { erro: `atraso_ms precisa ser inteiro entre 0 e ${ATRASO_MAXIMO_MS}` },
        400,
      );
    }
  }

  const registro = {
    telefone,
    modo,
    atraso_ms: atrasoMs,
    expira_em: Date.now() + validadeS * 1000,
  };
  await stub.gravarModo(registro);
  return json({ ok: true, segmento, modo: modoParaJson(registro) });
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

  // Catálogo próprio: /catalogo/<segmento>/<rota>. O resto vem do caminho cru, para a
  // barra final continuar sendo rota inexistente.
  if (partes[0] === "catalogo" && partes.length >= 3) {
    const prefixo = `/catalogo/${partes[1]}/`;
    return tratarCatalogo(request, url.pathname.slice(prefixo.length));
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
