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

function conferir(condicao, descricao, detalhe) {
  if (condicao) return true;
  falhas += 1;
  console.error(`FALHOU: ${descricao}${detalhe ? ` (${detalhe})` : ""}`);
  return false;
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

async function listar(seg) {
  return chamar(urlLeads(seg));
}

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
  console.log("ok - POST valido devolve 201 e aparece no GET");
}

async function testeSemCampo() {
  const seg = segmento("sem-campo");
  const { telefone, ...semTelefone } = leadValido("(11) 90000-0002");

  const resposta = await postarLead(seg, semTelefone);
  conferir(resposta.status === 422, "POST sem campo devolve 422", `status ${resposta.status}`);
  conferir(
    Array.isArray(resposta.corpo?.erros) && resposta.corpo.erros.some((erro) => erro.campo === "telefone"),
    "422 traz o campo que faltou em erros",
  );

  const lista = await listar(seg);
  conferir(
    Array.isArray(lista.corpo?.leads) && lista.corpo.leads.length === 0,
    "lead recusado por falta de campo nao aparece no GET",
  );
  console.log("ok - POST sem campo devolve 422 e nao guarda");
}

async function testeTipoErrado() {
  const casos = [
    ["hospedes como texto", { hospedes: "2" }],
    ["hospedes fracionario", { hospedes: 2.5 }],
    ["valor_total como texto", { valor_total: "2156.00" }],
    ["checkin fora do formato", { checkin: "15/01/2027" }],
    ["checkin com data inexistente", { checkin: "2027-02-30" }],
    ["nome nao texto", { nome: 42 }],
  ];
  const seg = segmento("tipo-errado");

  for (const [descricao, mudanca] of casos) {
    const resposta = await postarLead(seg, { ...leadValido("(11) 90000-0003"), ...mudanca });
    conferir(resposta.status === 422, `tipo errado (${descricao}) devolve 422`, `status ${resposta.status}`);
    conferir(Array.isArray(resposta.corpo?.erros), `tipo errado (${descricao}) devolve { erros: [...] }`);
  }

  const lista = await listar(seg);
  conferir(
    Array.isArray(lista.corpo?.leads) && lista.corpo.leads.length === 0,
    "nenhum lead com tipo errado foi guardado",
  );
  console.log("ok - POST com tipo errado devolve 422 e nao guarda");
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
  console.log("ok - segmentos diferentes nao se misturam");
}

async function testeModoPorCabecalho() {
  const seg500 = segmento("modo-500");
  const resposta500 = await postarLead(seg500, leadValido("(11) 90000-0006"), { "x-falso-modo": "500" });
  conferir(resposta500.status === 500, "x-falso-modo: 500 devolve 500", `status ${resposta500.status}`);
  const lista500 = await listar(seg500);
  conferir(lista500.corpo?.leads?.length === 0, "lead em modo 500 nao e guardado");

  const seg422 = segmento("modo-422");
  const resposta422 = await postarLead(seg422, leadValido("(11) 90000-0007"), { "x-falso-modo": "422" });
  conferir(resposta422.status === 422, "x-falso-modo: 422 devolve 422", `status ${resposta422.status}`);
  conferir(Array.isArray(resposta422.corpo?.erros), "modo 422 devolve { erros: [...] }");
  const lista422 = await listar(seg422);
  conferir(lista422.corpo?.leads?.length === 0, "lead em modo 422 nao e guardado");

  const segAtraso = segmento("modo-atraso-cabecalho");
  const inicio = Date.now();
  const respostaAtraso = await postarLead(segAtraso, leadValido("(11) 90000-0008"), {
    "x-falso-modo": "atraso",
    "x-falso-atraso-ms": "150",
  });
  const decorrido = Date.now() - inicio;
  conferir(respostaAtraso.status === 201, "modo atraso termina com 201", `status ${respostaAtraso.status}`);
  conferir(decorrido >= 120, "modo atraso respeita x-falso-atraso-ms", `${decorrido} ms`);
  const listaAtraso = await listar(segAtraso);
  conferir(listaAtraso.corpo?.leads?.length === 1, "lead em modo atraso e guardado depois da espera");

  console.log("ok - modos de teste por cabecalho (500, 422 e atraso)");
}

async function testeModoPersistente() {
  const seg = segmento("modo-persistente");

  const controle = await chamar(urlModos(seg), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modo: "500" }),
  });
  conferir(controle.status === 200, "PUT /modos grava o modo 500", `status ${controle.status}`);

  const resposta500 = await postarLead(seg, leadValido("(11) 90000-0009"));
  conferir(resposta500.status === 500, "modo 500 gravado vale para POST sem cabecalho", `status ${resposta500.status}`);
  const lista500 = await listar(seg);
  conferir(lista500.corpo?.leads?.length === 0, "lead em modo 500 persistente nao e guardado");

  const limpeza = await chamar(urlModos(seg), { method: "DELETE" });
  conferir(limpeza.status === 200, "DELETE /modos limpa o modo", `status ${limpeza.status}`);
  const respostaNormal = await postarLead(seg, leadValido("(11) 90000-0010"));
  conferir(respostaNormal.status === 201, "sem modo gravado o POST volta a devolver 201", `status ${respostaNormal.status}`);

  const segAtraso = segmento("modo-atraso-persistente");
  const controleAtraso = await chamar(urlModos(segAtraso), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modo: "atraso", atraso_ms: 120 }),
  });
  conferir(controleAtraso.status === 200, "PUT /modos grava atraso configuravel", `status ${controleAtraso.status}`);

  const inicio = Date.now();
  const respostaAtraso = await postarLead(segAtraso, leadValido("(11) 90000-0011"));
  const decorrido = Date.now() - inicio;
  conferir(respostaAtraso.status === 201, "modo atraso persistente termina com 201", `status ${respostaAtraso.status}`);
  conferir(decorrido >= 100, "modo atraso persistente respeita atraso_ms", `${decorrido} ms`);
  await chamar(urlModos(segAtraso), { method: "DELETE" });

  console.log("ok - modos de teste persistem por segmento e podem ser limpos");
}

async function testeDeleteLimpa() {
  const seg = segmento("delete");
  conferir((await postarLead(seg, leadValido("(11) 90000-0012"))).status === 201, "primeiro POST do teste de DELETE devolve 201");
  conferir((await postarLead(seg, leadValido("(11) 90000-0013"))).status === 201, "segundo POST do teste de DELETE devolve 201");

  const antes = await listar(seg);
  conferir(antes.corpo?.leads?.length === 2, "os dois leads estao na lista antes do DELETE");

  const resposta = await chamar(urlLeads(seg), { method: "DELETE" });
  conferir(resposta.status === 200, "DELETE /leads devolve 200", `status ${resposta.status}`);

  const depois = await listar(seg);
  conferir(depois.corpo?.leads?.length === 0, "DELETE limpa a lista daquele segmento");
  console.log("ok - DELETE limpa a lista");
}

async function principal() {
  await testePostValido();
  await testeSemCampo();
  await testeTipoErrado();
  await testeSegmentosIsolados();
  await testeModoPorCabecalho();
  await testeModoPersistente();
  await testeDeleteLimpa();

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
