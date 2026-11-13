#!/usr/bin/env node
// Teste do webhook falso (node falso/teste.mjs <url-do-segmento>).
// Node 24, sem dependências. Usa segmentos próprios desta rodada para não
// depender de lista vazia e não apagar dados de ninguém.

const alvo = process.argv[2];
if (!alvo) {
  console.error("uso: node falso/teste.mjs http://127.0.0.1:8795/leads/<segmento>");
  process.exit(1);
}

let base;
try {
  base = new URL(alvo);
} catch {
  console.error(`FALHOU: URL invalida: ${alvo}`);
  process.exit(1);
}

const partesAlvo = base.pathname.split("/").filter((parte) => parte !== "");
if (partesAlvo.length !== 2 || partesAlvo[0] !== "leads") {
  console.error(`FALHOU: a URL precisa terminar em /leads/<segmento>: ${alvo}`);
  process.exit(1);
}

const nomeBase = decodeURIComponent(partesAlvo[1]) || "teste";
const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const segmento = (nome) => `${nomeBase}-${nome}-${nonce}`;
const urlLeads = (seg) => new URL(`/leads/${encodeURIComponent(seg)}`, base.origin).toString();
const urlModos = (seg) => new URL(`/modos/${encodeURIComponent(seg)}`, base.origin).toString();

let falhas = 0;

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function conferir(condicao, descricao, detalhe) {
  if (condicao) return true;
  falhas += 1;
  console.error(`FALHOU: ${descricao}${detalhe ? ` (${detalhe})` : ""}`);
  return false;
}

// Cada teste imprime "ok" só se nenhuma checagem dele falhou.
async function teste(nome, funcao) {
  const antes = falhas;
  try {
    await funcao();
  } catch (erro) {
    falhas += 1;
    console.error(`FALHOU: ${nome}: erro inesperado: ${erro.message}`);
  }
  if (falhas === antes) console.log(`ok - ${nome}`);
}

async function chamar(url, opcoes = {}) {
  const resposta = await fetch(url, opcoes);
  const texto = await resposta.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    corpo = texto;
  }
  return { status: resposta.status, corpo };
}

function postarLead(seg, lead, cabecalhos = {}) {
  return chamar(urlLeads(seg), {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(lead),
  });
}

function putModo(seg, corpo) {
  return chamar(urlModos(seg), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

function putModoBruto(seg, corpo) {
  return chamar(urlModos(seg), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: corpo,
  });
}

function getModos(seg) {
  return chamar(urlModos(seg));
}

function deleteModos(seg, telefone) {
  const url = new URL(urlModos(seg));
  if (telefone !== undefined) url.searchParams.set("telefone", telefone);
  return chamar(url.toString(), { method: "DELETE" });
}

async function listar(seg) {
  return chamar(urlLeads(seg));
}

async function esperarLead(seg, telefone, limiteMs = 3000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const lista = await listar(seg);
    if (lista.corpo?.leads?.some((lead) => lead.telefone === telefone)) return true;
    await dormir(100);
  }
  return false;
}

function leadValido(telefone) {
  return {
    nome: "Ana Lima",
    telefone,
    imovel_id: "GRM-301",
    checkin: "2027-01-15",
    checkout: "2027-01-18",
    hospedes: 2,
    valor_total: 2156.0,
  };
}

const CAMPOS = [
  "nome",
  "telefone",
  "imovel_id",
  "checkin",
  "checkout",
  "hospedes",
  "valor_total",
];

async function testePostValido() {
  const seg = segmento("valido");
  const lead = leadValido("(11) 90000-0001");

  const resposta = await postarLead(seg, lead);
  conferir(resposta.status === 201, "POST valido devolve 201", `status ${resposta.status}`);

  const lista = await listar(seg);
  if (!conferir(lista.status === 200, "GET devolve 200", `status ${lista.status}`)) return;
  if (!conferir(Array.isArray(lista.corpo?.leads), "GET devolve { leads: [...] }")) return;
  if (!conferir(lista.corpo.leads.length === 1, "lead aceito aparece uma vez no GET", `${lista.corpo.leads.length} lead(s)`)) return;

  const guardado = lista.corpo.leads[0];
  for (const [campo, valor] of Object.entries(lead)) {
    conferir(guardado[campo] === valor, `GET traz ${campo} igual ao enviado`);
  }
  conferir(
    typeof guardado.recebido_em === "string" && !Number.isNaN(Date.parse(guardado.recebido_em)),
    "lead guarda a hora de chegada (recebido_em)",
  );
}

async function testeSemCadaCampo() {
  for (const campo of CAMPOS) {
    const seg = segmento(`sem-${campo}`);
    const lead = leadValido("(11) 90000-0002");
    delete lead[campo];

    const resposta = await postarLead(seg, lead);
    conferir(resposta.status === 422, `POST sem ${campo} devolve 422`, `status ${resposta.status}`);
    conferir(
      Array.isArray(resposta.corpo?.erros) &&
        resposta.corpo.erros.some((erro) => erro.campo === campo),
      `422 lista o campo ${campo} em erros`,
    );
    const lista = await listar(seg);
    conferir(
      Array.isArray(lista.corpo?.leads) && lista.corpo.leads.length === 0,
      `lead sem ${campo} nao e guardado`,
    );
  }
}

async function testeTipoErradoDeCadaCampo() {
  const casos = [
    ["nome", { nome: 42 }],
    ["telefone", { telefone: 42 }],
    ["imovel_id", { imovel_id: 42 }],
    ["checkin", { checkin: 42 }],
    ["checkin", { checkin: "15/01/2027" }],
    ["checkin", { checkin: "2027-02-30" }],
    ["checkout", { checkout: 42 }],
    ["checkout", { checkout: "18/01/2027" }],
    ["checkout", { checkout: "2027-13-01" }],
    ["hospedes", { hospedes: "2" }],
    ["hospedes", { hospedes: 2.5 }],
    ["valor_total", { valor_total: "2156.00" }],
  ];
  const seg = segmento("tipo-errado");

  for (const [campo, mudanca] of casos) {
    const descricao = `${campo} = ${JSON.stringify(mudanca[campo])}`;
    const resposta = await postarLead(seg, { ...leadValido("(11) 90000-0003"), ...mudanca });
    conferir(resposta.status === 422, `tipo errado (${descricao}) devolve 422`, `status ${resposta.status}`);
    conferir(
      Array.isArray(resposta.corpo?.erros) &&
        resposta.corpo.erros.some((erro) => erro.campo === campo),
      `tipo errado (${descricao}) lista o campo em erros`,
    );
  }

  const lista = await listar(seg);
  conferir(
    Array.isArray(lista.corpo?.leads) && lista.corpo.leads.length === 0,
    "nenhum lead com tipo errado foi guardado",
  );
}

async function testeSegmentosIsolados() {
  const segA = segmento("isolado-a");
  const segB = segmento("isolado-b");
  const leadA = leadValido("(11) 90000-0004");
  const leadB = leadValido("(11) 90000-0005");

  conferir((await postarLead(segA, leadA)).status === 201, "POST no segmento A devolve 201");
  conferir((await postarLead(segB, leadB)).status === 201, "POST no segmento B devolve 201");

  const listaA = await listar(segA);
  const listaB = await listar(segB);
  conferir(
    listaA.corpo?.leads?.length === 1 && listaA.corpo.leads[0].telefone === leadA.telefone,
    "segmento A so enxerga o proprio lead",
  );
  conferir(
    listaB.corpo?.leads?.length === 1 && listaB.corpo.leads[0].telefone === leadB.telefone,
    "segmento B so enxerga o proprio lead",
  );
}

async function testeModosPorCabecalho() {
  const seg500 = segmento("cabecalho-500");
  const resposta500 = await postarLead(seg500, leadValido("(11) 90000-0006"), { "x-falso-modo": "500" });
  conferir(resposta500.status === 500, "x-falso-modo: 500 devolve 500", `status ${resposta500.status}`);
  conferir((await listar(seg500)).corpo?.leads?.length === 0, "modo 500 por cabecalho nao guarda");

  const seg422 = segmento("cabecalho-422");
  const resposta422 = await postarLead(seg422, leadValido("(11) 90000-0007"), { "x-falso-modo": "422" });
  conferir(resposta422.status === 422, "x-falso-modo: 422 devolve 422", `status ${resposta422.status}`);
  conferir(Array.isArray(resposta422.corpo?.erros), "modo 422 por cabecalho devolve { erros: [...] }");
  conferir((await listar(seg422)).corpo?.leads?.length === 0, "modo 422 por cabecalho nao guarda");

  const segAtraso = segmento("cabecalho-atraso");
  const inicio = Date.now();
  const respostaAtraso = await postarLead(segAtraso, leadValido("(11) 90000-0008"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "150",
  });
  const decorrido = Date.now() - inicio;
  conferir(respostaAtraso.status === 201, "modo atraso termina com 201", `status ${respostaAtraso.status}`);
  conferir(decorrido >= 120, "modo atraso espera o x-falso-atraso-ms pedido", `${decorrido} ms`);
  conferir(decorrido < 1150, "modo atraso nao espera mais que o x-falso-atraso-ms pedido", `${decorrido} ms`);
  conferir((await listar(segAtraso)).corpo?.leads?.length === 1, "lead em modo atraso e guardado");

  const segZero = segmento("cabecalho-atraso-zero");
  const respostaZero = await postarLead(segZero, leadValido("(11) 90000-0009"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "0",
  });
  conferir(respostaZero.status === 201, "atraso 0 e aceito e termina com 201", `status ${respostaZero.status}`);

  const segInvalidoBaixo = segmento("cabecalho-atraso-baixo");
  const baixo = await postarLead(segInvalidoBaixo, leadValido("(11) 90000-0010"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "-1",
  });
  conferir(baixo.status === 400, "atraso abaixo do limite devolve 400", `status ${baixo.status}`);
  conferir((await listar(segInvalidoBaixo)).corpo?.leads?.length === 0, "atraso invalido nao guarda");

  const segInvalidoAlto = segmento("cabecalho-atraso-alto");
  const alto = await postarLead(segInvalidoAlto, leadValido("(11) 90000-0011"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "120001",
  });
  conferir(alto.status === 400, "atraso acima do limite devolve 400", `status ${alto.status}`);
}

async function testeModoGravado500e422() {
  const seg500 = segmento("gravado-500");
  conferir((await putModo(seg500, { modo: "500" })).status === 200, "PUT grava modo 500");
  const resposta500 = await postarLead(seg500, leadValido("(11) 90000-0012"));
  conferir(resposta500.status === 500, "modo 500 gravado devolve 500", `status ${resposta500.status}`);
  conferir((await listar(seg500)).corpo?.leads?.length === 0, "modo 500 gravado nao guarda");

  const seg422 = segmento("gravado-422");
  conferir((await putModo(seg422, { modo: "422" })).status === 200, "PUT grava modo 422");
  const resposta422 = await postarLead(seg422, leadValido("(11) 90000-0013"));
  conferir(resposta422.status === 422, "modo 422 gravado devolve 422", `status ${resposta422.status}`);
  conferir(Array.isArray(resposta422.corpo?.erros), "modo 422 gravado devolve { erros: [...] }");
  conferir((await listar(seg422)).corpo?.leads?.length === 0, "modo 422 gravado nao guarda");
}

async function testePrecedenciaDoCabecalho() {
  const seg = segmento("precedencia");
  conferir((await putModo(seg, { modo: "500" })).status === 200, "PUT grava modo 500 antes da precedencia");

  const com422 = await postarLead(seg, leadValido("(11) 90000-0014"), { "x-falso-modo": "422" });
  conferir(com422.status === 422, "cabecalho 422 vence o modo 500 gravado", `status ${com422.status}`);

  conferir((await putModo(seg, { modo: "422" })).status === 200, "PUT troca o modo gravado para 422");
  const com500 = await postarLead(seg, leadValido("(11) 90000-0015"), { "x-falso-modo": "500" });
  conferir(com500.status === 500, "cabecalho 500 vence o modo 422 gravado", `status ${com500.status}`);

  const comAtraso = await postarLead(seg, leadValido("(11) 90000-0016"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "50",
  });
  conferir(comAtraso.status === 201, "cabecalho atraso vence o modo 422 gravado e guarda", `status ${comAtraso.status}`);
  conferir((await listar(seg)).corpo?.leads?.length === 1, "lead do cabecalho atraso aparece no GET");
}

async function testeModoPorTelefone() {
  const seg = segmento("telefone");
  const phoneA = "(11) 98888-0020";
  const phoneB = "+55 11 97777-0020";

  conferir((await putModo(seg, { modo: "500", telefone: phoneA })).status === 200, "PUT grava modo 500 do telefone A");
  conferir((await putModo(seg, { modo: "422", telefone: phoneB })).status === 200, "PUT grava modo 422 do telefone B");

  const respostaA = await postarLead(seg, leadValido(phoneA));
  conferir(respostaA.status === 500, "telefone A cai no modo 500", `status ${respostaA.status}`);

  // O modo de B foi gravado com +55; o POST manda sem +55 e precisa casar.
  const respostaB = await postarLead(seg, leadValido("(11) 97777-0020"));
  conferir(respostaB.status === 422, "telefone B casa sem o prefixo 55 e cai no modo 422", `status ${respostaB.status}`);

  const respostaC = await postarLead(seg, leadValido("(11) 96666-0020"));
  conferir(respostaC.status === 201, "outro telefone passa pelo mesmo segmento", `status ${respostaC.status}`);
  conferir((await listar(seg)).corpo?.leads?.length === 1, "so o lead do telefone sem modo foi guardado");
}

async function testeModoGeralVersusTelefone() {
  const seg = segmento("geral-telefone");
  conferir((await putModo(seg, { modo: "500" })).status === 200, "PUT grava modo geral 500");
  conferir((await putModo(seg, { modo: "422", telefone: "(11) 95555-0030" })).status === 200, "PUT grava modo 422 do telefone");

  const doTelefone = await postarLead(seg, leadValido("(11) 95555-0030"));
  conferir(doTelefone.status === 422, "modo do telefone vence o modo geral", `status ${doTelefone.status}`);

  const outro = await postarLead(seg, leadValido("(11) 94444-0030"));
  conferir(outro.status === 500, "sem modo do telefone vale o modo geral", `status ${outro.status}`);
}

async function testeModoAtrasoGravado() {
  const seg = segmento("gravado-atraso");
  conferir((await putModo(seg, { modo: "atraso", atraso_ms: 200 })).status === 200, "PUT grava atraso de 200 ms");

  const inicio = Date.now();
  const resposta = await postarLead(seg, leadValido("(11) 90000-0031"));
  const decorrido = Date.now() - inicio;
  conferir(resposta.status === 201, "atraso gravado termina com 201", `status ${resposta.status}`);
  conferir(decorrido >= 170, "atraso gravado espera o atraso_ms pedido", `${decorrido} ms`);
  conferir(decorrido < 1200, "atraso gravado nao espera mais que o atraso_ms pedido", `${decorrido} ms`);
  conferir((await listar(seg)).corpo?.leads?.length === 1, "lead do atraso gravado e guardado");

  const segZero = segmento("gravado-atraso-zero");
  conferir((await putModo(segZero, { modo: "atraso", atraso_ms: 0 })).status === 200, "PUT aceita atraso 0");
  conferir((await postarLead(segZero, leadValido("(11) 90000-0032"))).status === 201, "atraso 0 gravado termina com 201");

  const segMaximo = segmento("gravado-atraso-maximo");
  conferir((await putModo(segMaximo, { modo: "atraso", atraso_ms: 120000 })).status === 200, "PUT aceita atraso no limite superior");
  const modosMax = await getModos(segMaximo);
  conferir(
    modosMax.corpo?.modos?.some((modo) => modo.modo === "atraso" && modo.atraso_ms === 120000),
    "GET /modos mostra o atraso no limite superior",
  );
  await deleteModos(segMaximo);

  const segAcima = segmento("gravado-atraso-acima");
  const acima = await putModo(segAcima, { modo: "atraso", atraso_ms: 120001 });
  conferir(acima.status === 400, "PUT recusa atraso acima do limite", `status ${acima.status}`);
  const abaixo = await putModo(segAcima, { modo: "atraso", atraso_ms: -1 });
  conferir(abaixo.status === 400, "PUT recusa atraso abaixo do limite", `status ${abaixo.status}`);
}

async function testeAtrasoGuardaAntesDeEsperar() {
  const seg = segmento("abandono");
  const lead = leadValido("(11) 90000-0040");
  const controle = new AbortController();

  const promessa = fetch(urlLeads(seg), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-falso-modo": "atraso",
      "x-falso-atraso-ms": "1000",
    },
    body: JSON.stringify(lead),
    signal: controle.signal,
  });

  let desistiu = false;
  try {
    await dormir(150);
    controle.abort();
    await promessa;
  } catch {
    desistiu = true;
  }

  conferir(desistiu, "cliente desiste antes do fim do atraso");
  conferir(
    await esperarLead(seg, lead.telefone),
    "lead aparece no GET mesmo com o cliente desistindo antes do fim do atraso",
  );
}

async function testeValidadeEModosAtivos() {
  const seg = segmento("validade");
  const phone = "(11) 93333-0050";
  conferir((await putModo(seg, { modo: "500", validade_s: 300 })).status === 200, "PUT grava modo geral com validade");
  conferir((await putModo(seg, { modo: "422", telefone: phone, validade_s: 300 })).status === 200, "PUT grava modo por telefone com validade");

  const modos = await getModos(seg);
  conferir(Array.isArray(modos.corpo?.modos), "GET /modos devolve { modos: [...] }");
  const geral = modos.corpo.modos.find((modo) => modo.telefone === null && modo.modo === "500");
  const porTelefone = modos.corpo.modos.find((modo) => modo.telefone === "11933330050" && modo.modo === "422");
  conferir(Boolean(geral), "GET /modos mostra o modo geral");
  conferir(Boolean(porTelefone), "GET /modos mostra o modo por telefone");
  conferir(
    Boolean(geral) && Date.parse(geral.expira_em) > Date.now(),
    "GET /modos mostra quando o modo expira",
  );

  const limpezaTelefone = await deleteModos(seg, "+55 (11) 93333-0050");
  conferir(limpezaTelefone.status === 200, "DELETE /modos?telefone devolve 200", `status ${limpezaTelefone.status}`);
  const depoisTelefone = await getModos(seg);
  conferir(
    depoisTelefone.corpo?.modos?.length === 1 &&
      depoisTelefone.corpo.modos[0].telefone === null,
    "DELETE ?telefone remove so o modo daquele telefone",
  );

  const limpezaTudo = await deleteModos(seg);
  conferir(limpezaTudo.status === 200, "DELETE /modos devolve 200", `status ${limpezaTudo.status}`);
  conferir((await getModos(seg)).corpo?.modos?.length === 0, "DELETE /modos limpa todos os modos");
  conferir((await postarLead(seg, leadValido("(11) 90000-0051"))).status === 201, "sem modos o POST volta a devolver 201");
}

async function testeExpiracaoCurta() {
  const seg = segmento("expiracao");
  conferir((await putModo(seg, { modo: "500", validade_s: 1 })).status === 200, "PUT grava modo com validade de 1 s");
  conferir((await getModos(seg)).corpo?.modos?.length === 1, "modo curto aparece no GET antes de expirar");

  await dormir(1200);

  conferir((await getModos(seg)).corpo?.modos?.length === 0, "modo expirado some do GET /modos");
  const resposta = await postarLead(seg, leadValido("(11) 90000-0060"));
  conferir(resposta.status === 201, "modo expirado nao vale mais e o POST devolve 201", `status ${resposta.status}`);
  conferir((await listar(seg)).corpo?.leads?.length === 1, "lead do POST sem modo expirado e guardado");
}

async function testePutInvalidoNaoAltera() {
  const seg = segmento("put-invalido");
  conferir((await putModo(seg, { modo: "500", validade_s: 300 })).status === 200, "PUT valido inicial grava modo 500");

  const invalidos = [
    ["corpo vazio", "{}"],
    ["modo desconhecido", JSON.stringify({ modo: "999" })],
    ["validade zero", JSON.stringify({ modo: "500", validade_s: 0 })],
    ["validade acima do teto", JSON.stringify({ modo: "500", validade_s: 901 })],
    ["validade fracionaria", JSON.stringify({ modo: "500", validade_s: 1.5 })],
    ["telefone nao texto", JSON.stringify({ modo: "500", telefone: 42 })],
    ["telefone sem digitos", JSON.stringify({ modo: "500", telefone: "sem numero" })],
    ["atraso negativo", JSON.stringify({ modo: "atraso", atraso_ms: -1 })],
    ["atraso acima do teto", JSON.stringify({ modo: "atraso", atraso_ms: 120001 })],
    ["atraso nao numero", JSON.stringify({ modo: "atraso", atraso_ms: "200" })],
    ["array no corpo", "[]"],
    ["texto no corpo", JSON.stringify("modo 500")],
  ];

  for (const [descricao, corpo] of invalidos) {
    const resposta = await putModoBruto(seg, corpo);
    conferir(resposta.status === 400, `PUT invalido (${descricao}) devolve 400`, `status ${resposta.status}`);
  }

  const modos = await getModos(seg);
  conferir(
    modos.corpo?.modos?.length === 1 && modos.corpo.modos[0].modo === "500",
    "PUT invalido nao altera o modo gravado",
  );
  const resposta = await postarLead(seg, leadValido("(11) 90000-0070"));
  conferir(resposta.status === 500, "o modo gravado original continua valendo", `status ${resposta.status}`);
}

async function testeDeleteLeadsNaoLimpaModos() {
  const seg = segmento("delete-leads-modos");
  conferir((await postarLead(seg, leadValido("(11) 90000-0080"))).status === 201, "POST antes do DELETE /leads devolve 201");
  conferir((await putModo(seg, { modo: "500", validade_s: 300 })).status === 200, "PUT grava modo antes do DELETE /leads");

  const resposta = await chamar(urlLeads(seg), { method: "DELETE" });
  conferir(resposta.status === 200, "DELETE /leads devolve 200", `status ${resposta.status}`);
  conferir((await listar(seg)).corpo?.leads?.length === 0, "DELETE /leads limpa a lista daquele segmento");

  const depois = await postarLead(seg, leadValido("(11) 90000-0081"));
  conferir(depois.status === 500, "DELETE /leads nao limpa os modos do segmento", `status ${depois.status}`);
  conferir((await getModos(seg)).corpo?.modos?.length === 1, "o modo continua no GET /modos depois do DELETE /leads");
}

async function principal() {
  await teste("POST valido devolve 201 e aparece no GET", testePostValido);
  await teste("POST sem cada um dos 7 campos devolve 422 e nao guarda", testeSemCadaCampo);
  await teste("tipo errado de cada um dos 7 campos devolve 422 e nao guarda", testeTipoErradoDeCadaCampo);
  await teste("segmentos diferentes nao se misturam", testeSegmentosIsolados);
  await teste("modos por cabecalho (500, 422, atraso e limites)", testeModosPorCabecalho);
  await teste("modos gravados 500 e 422 valem para o segmento", testeModoGravado500e422);
  await teste("cabecalho x-falso-modo vence o modo gravado", testePrecedenciaDoCabecalho);
  await teste("modo por telefone isola conversas no mesmo segmento", testeModoPorTelefone);
  await teste("modo do telefone vence o modo geral", testeModoGeralVersusTelefone);
  await teste("atraso gravado respeita o valor e os limites", testeModoAtrasoGravado);
  await teste("atraso guarda o lead antes de esperar", testeAtrasoGuardaAntesDeEsperar);
  await teste("validade, GET /modos e limpeza por telefone", testeValidadeEModosAtivos);
  await teste("modo expira sozinho com validade curta", testeExpiracaoCurta);
  await teste("PUT invalido devolve 400 e nao altera nada", testePutInvalidoNaoAltera);
  await teste("DELETE /leads nao limpa modos", testeDeleteLeadsNaoLimpaModos);

  if (falhas > 0) {
    console.error(`FALHAS: ${falhas}`);
    process.exit(1);
  }
  console.log("FALSO OK");
}

principal().catch((erro) => {
  console.error(`FALHOU: erro inesperado: ${erro.message}`);
  process.exit(1);
});
