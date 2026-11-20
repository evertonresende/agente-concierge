// Catálogo próprio (M1 da rodada pós-entrega): as rotas do contrato §4, com as mesmas
// formas de resposta, os mesmos erros e as mesmas regras de busca medidas no catálogo
// original (docs/VERIFICACOES.md §6). Só GET. Base: /catalogo/<segmento>; qualquer
// segmento serve o mesmo catálogo, e o segmento faz o papel do token na URL.
import { FICHAS } from "./fichas.js";

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const ROTA_NAO_ENCONTRADA = () => json({ erro: "rota nao encontrada" }, 404);

/** Sem acento e em minúsculas: "Florianópolis" e "FLORIANOPOLIS" casam. */
const normalizar = (texto) => String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const palavras = (texto) => normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

const resumo = ({ id, nome, cidade, uf, bairro, tipo, capacidade }) => ({ id, nome, cidade, uf, bairro, tipo, capacidade });

function cidades() {
  const contagem = new Map();
  for (const f of FICHAS) {
    const atual = contagem.get(f.cidade) ?? { cidade: f.cidade, uf: f.uf, imoveis: 0 };
    contagem.set(f.cidade, { ...atual, imoveis: atual.imoveis + 1 });
  }
  return json({ cidades: [...contagem.values()].sort((a, b) => a.cidade.localeCompare(b.cidade)) });
}

/**
 * Busca: cada palavra da busca é prefixo de alguma palavra de id, nome, bairro, tipo ou
 * cidade. Não olha descrição nem comodidades, como o original.
 */
function casaBusca(ficha, busca) {
  const alvo = palavras(`${ficha.id} ${ficha.id.replace("-", "")} ${ficha.nome} ${ficha.bairro} ${ficha.tipo} ${ficha.cidade}`);
  return palavras(busca).every((p) => alvo.some((a) => a.startsWith(p)));
}

function imoveis(parametros) {
  const cidade = (parametros.get("cidade") ?? "").trim();
  const busca = (parametros.get("busca") ?? "").trim();
  if (!cidade && !busca) {
    return json({ erro: "informe cidade= ou busca=", dica: "exemplos: /imoveis?cidade=Gramado ou /imoveis?busca=chale" }, 400);
  }
  const hospedesCru = parametros.get("hospedes");
  let hospedes = 0;
  if (hospedesCru !== null) {
    if (!/^-?\d+$/.test(hospedesCru.trim())) return json({ erro: "hospedes precisa ser inteiro" }, 400);
    hospedes = Number(hospedesCru);
  }
  const petCru = parametros.get("aceita_pet");
  let pet = null;
  if (petCru !== null) {
    const valor = petCru.trim().toLowerCase();
    if (valor !== "true" && valor !== "false") return json({ erro: "aceita_pet precisa ser true ou false" }, 400);
    pet = valor === "true";
  }
  const achados = FICHAS
    .filter((f) => !cidade || normalizar(f.cidade) === normalizar(cidade))
    .filter((f) => !busca || casaBusca(f, busca))
    .filter((f) => hospedes <= 0 || f.capacidade >= hospedes)
    .filter((f) => pet === null || f.regras.aceita_pet === pet)
    .map(resumo);
  return json({ imoveis: achados, total: achados.length });
}

function ficha(idCru) {
  let id;
  try {
    id = decodeURIComponent(idCru).toUpperCase();
  } catch {
    return json({ erro: "imovel nao encontrado" }, 404);
  }
  const achada = FICHAS.find((f) => f.id === id);
  return achada ? json(achada) : json({ erro: "imovel nao encontrado" }, 404);
}

/** `resto`: o caminho depois de /catalogo/<segmento>, sem a barra inicial. */
export function tratarCatalogo(request, resto) {
  if (request.method !== "GET") return ROTA_NAO_ENCONTRADA();
  const url = new URL(request.url);
  if (resto === "cidades") return cidades();
  if (resto === "imoveis") return imoveis(url.searchParams);
  const partes = resto.split("/");
  if (partes.length === 2 && partes[0] === "imoveis" && partes[1] !== "") return ficha(partes[1]);
  // Barra final ("/cidades/") e qualquer outra rota: 404, como o original.
  return ROTA_NAO_ENCONTRADA();
}
