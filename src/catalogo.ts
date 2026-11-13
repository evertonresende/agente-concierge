// Cliente do catálogo (contrato seção 4). Só GET. A URL base carrega o token, então
// nenhum erro daqui inclui a URL nem o texto do erro original.
import { reaisParaCentavos } from "./nucleo/dinheiro";
import type { RegrasDoImovel } from "./nucleo/preco";

export interface Cidade {
  cidade: string;
  uf: string;
  imoveis: number;
}

export interface ResumoDoImovel {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  bairro: string;
  tipo: string;
  capacidade: number;
}

/** Ficha completa. Só os campos usados em conta são tipados e validados; o resto é repassado como veio. */
export interface Ficha extends Record<string, unknown> {
  id: string;
  nome: string;
  capacidade: number;
  diaria: number;
  taxa_limpeza: number;
  minimo_noites: number;
}

export interface FiltroDeBusca {
  cidade?: string;
  busca?: string;
  hospedes?: number;
  aceita_pet?: boolean;
}

export interface Catalogo {
  cidades(): Promise<Cidade[]>;
  buscar(filtro: FiltroDeBusca): Promise<ResumoDoImovel[]>;
  /** `null` quando o imóvel não existe. */
  ficha(id: string): Promise<Ficha | null>;
}

export class ErroDoCatalogo extends Error {}

const TEMPO_POR_PEDIDO_MS = 8_000;
const TENTATIVAS = 2;
const ID_VALIDO = /^[A-Za-z0-9-]{1,32}$/;

function inteiroPositivo(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function valorEmReais(v: unknown): v is number {
  if (typeof v !== "number") return false;
  try {
    reaisParaCentavos(v);
    return true;
  } catch {
    return false;
  }
}

function validarFicha(dado: unknown): Ficha {
  const f = (dado && typeof dado === "object" ? dado : {}) as Record<string, unknown>;
  const ok = typeof f.id === "string" && typeof f.nome === "string" && inteiroPositivo(f.capacidade)
    && inteiroPositivo(f.minimo_noites) && valorEmReais(f.diaria) && valorEmReais(f.taxa_limpeza);
  if (!ok) throw new ErroDoCatalogo("o catálogo devolveu uma ficha fora do formato");
  return f as Ficha;
}

const MAX_TEXTO = 300;
const MAX_ITENS = 40;
const MAX_NIVEIS = 4;

function sanearTexto(texto: string): string {
  // O "R$" sai para que nenhum texto do catálogo se pareça com um valor escrito pelo
  // código: valor em reais só existe nos campos numéricos, formatados por nós.
  return texto.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/R\s*\$/gi, "").replace(/ {2,}/g, " ").trim().slice(0, MAX_TEXTO);
}

/**
 * Texto do catálogo é dado, nunca instrução (contrato seção 4). Tudo o que chega passa
 * por aqui antes de qualquer uso: uma linha só, tamanho limitado e sem símbolo de moeda.
 * Assim o nome de um imóvel não carrega um bloco de instruções para o modelo, para a
 * cotação nem para o resumo do pedido.
 */
export function sanear(dado: unknown, nivel = 0): unknown {
  if (typeof dado === "string") return sanearTexto(dado);
  if (dado === null || typeof dado !== "object") return dado;
  if (nivel >= MAX_NIVEIS) return null;
  if (Array.isArray(dado)) return dado.slice(0, MAX_ITENS).map((item) => sanear(item, nivel + 1));
  return Object.fromEntries(Object.entries(dado).slice(0, MAX_ITENS).map(([chave, valor]) => [sanearTexto(chave), sanear(valor, nivel + 1)]));
}

export function regrasDaFicha(ficha: Ficha): RegrasDoImovel {
  return {
    diariaCentavos: reaisParaCentavos(ficha.diaria),
    taxaLimpezaCentavos: reaisParaCentavos(ficha.taxa_limpeza),
    minimoNoites: ficha.minimo_noites,
    capacidade: ficha.capacidade,
  };
}

export function criarCatalogo(base: string | undefined, buscar: typeof fetch): Catalogo {
  /** Devolve o JSON saneado de um 200, `null` num 404, e lança nos demais casos (uma nova tentativa em falha de rede ou 5xx). */
  async function pedir(caminho: string): Promise<unknown> {
    if (!base) throw new ErroDoCatalogo("catálogo não configurado");
    for (let tentativa = 1; ; tentativa++) {
      let status = 0;
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), TEMPO_POR_PEDIDO_MS);
      try {
        const resposta = await buscar(`${base}${caminho}`, { signal: controle.signal });
        status = resposta.status;
        if (status === 200) return sanear(await resposta.json());
        await resposta.body?.cancel();
      } catch {
        status = 0;
      } finally {
        clearTimeout(relogio);
      }
      if (status === 404) return null;
      const transitorio = status === 0 || status >= 500;
      if (!transitorio || tentativa >= TENTATIVAS) throw new ErroDoCatalogo(`o catálogo não respondeu (status ${status})`);
    }
  }

  return {
    async cidades() {
      const dado = (await pedir("/cidades")) as { cidades?: unknown } | null;
      if (!Array.isArray(dado?.cidades)) throw new ErroDoCatalogo("o catálogo devolveu cidades fora do formato");
      return dado.cidades as Cidade[];
    },

    async buscar(filtro) {
      const parametros = new URLSearchParams();
      if (filtro.cidade) parametros.set("cidade", filtro.cidade);
      if (filtro.busca) parametros.set("busca", filtro.busca);
      if (filtro.hospedes !== undefined) parametros.set("hospedes", String(filtro.hospedes));
      if (filtro.aceita_pet !== undefined) parametros.set("aceita_pet", String(filtro.aceita_pet));
      const dado = (await pedir(`/imoveis?${parametros}`)) as { imoveis?: unknown } | null;
      if (!Array.isArray(dado?.imoveis)) throw new ErroDoCatalogo("o catálogo devolveu a busca fora do formato");
      return dado.imoveis as ResumoDoImovel[];
    },

    async ficha(id) {
      // O id vem do modelo: só letras, números e hífen chegam ao caminho da URL.
      const limpo = id.trim();
      if (!ID_VALIDO.test(limpo)) return null;
      const dado = await pedir(`/imoveis/${encodeURIComponent(limpo)}`);
      return dado === null ? null : validarFicha(dado);
    },
  };
}
