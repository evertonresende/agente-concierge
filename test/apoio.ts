// Falsos usados pelos testes: catálogo, webhook de leads e modelo roteirizado.
import type { ChamadaDeFerramenta, Mensagem, Modelo, RespostaDoModelo } from "../src/modelo";

export const BASE_CATALOGO = "https://catalogo.teste/catalogo/token-de-teste";
export const URL_LEADS = "https://leads.teste/leads/token-de-teste";

export const FICHAS: Record<string, Record<string, unknown>> = {
  "GRM-301": {
    id: "GRM-301", nome: "Chale Serra Gramado", cidade: "Gramado", uf: "RS", bairro: "Planalto", tipo: "chale",
    quartos: 2, banheiros: 1, capacidade: 4, diaria: 590.0, taxa_limpeza: 150.0, minimo_noites: 2,
    checkin_hora: "15:00", checkout_hora: "12:00", distancia_praia_m: null,
    comodidades: ["wifi", "lareira", "hidromassagem", "1 vaga de garagem", "aquecedor"],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
    descricao: "Chale com lareira e hidromassagem, a 2 km do centro.",
  },
  "RIO-402": {
    id: "RIO-402", nome: "Studio Copacabana", cidade: "Rio de Janeiro", uf: "RJ", bairro: "Copacabana", tipo: "studio",
    quartos: 0, banheiros: 1, capacidade: 2, diaria: 245.5, taxa_limpeza: 75.0, minimo_noites: 1,
    checkin_hora: "14:00", checkout_hora: "11:00", distancia_praia_m: 300,
    comodidades: ["wifi", "ar-condicionado"],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
    descricao: "Studio a 300 m da praia.",
  },
};

function json(dado: unknown, status = 200): Response {
  return Response.json(dado, { status });
}

export interface Mundo {
  buscar: typeof fetch;
  /** Corpos recebidos pelo webhook falso, na ordem. */
  leads: Record<string, unknown>[];
  /** Caminhos pedidos ao catálogo, na ordem. */
  pedidosAoCatalogo: string[];
}

/** Catálogo fiel ao formato do contrato (seção 4) e webhook que responde `statusDoWebhook`. */
export function criarMundo(opcoes: { statusDoWebhook?: number; fichas?: typeof FICHAS; catalogoForaDoAr?: boolean; atrasoDoCatalogoMs?: number } = {}): Mundo {
  const fichas = opcoes.fichas ?? FICHAS;
  const leads: Record<string, unknown>[] = [];
  const pedidosAoCatalogo: string[] = [];
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada));
    if (String(entrada).startsWith(URL_LEADS)) {
      if (init?.method !== "POST") return json({ leads });
      leads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return json({ ok: true }, opcoes.statusDoWebhook ?? 201);
    }
    if (!String(entrada).startsWith(BASE_CATALOGO)) throw new Error("os testes não falam com a rede");
    const caminho = url.pathname.slice(new URL(BASE_CATALOGO).pathname.length);
    pedidosAoCatalogo.push(caminho + url.search);
    if (opcoes.atrasoDoCatalogoMs) await new Promise((r) => setTimeout(r, opcoes.atrasoDoCatalogoMs));
    if (opcoes.catalogoForaDoAr) return json({ erro: "fora do ar" }, 503);
    const lista = Object.values(fichas);
    if (caminho === "/cidades") {
      const cidades = [...new Set(lista.map((f) => f.cidade))].map((cidade) => ({
        cidade, uf: lista.find((f) => f.cidade === cidade)!.uf, imoveis: lista.filter((f) => f.cidade === cidade).length,
      }));
      return json({ cidades });
    }
    if (caminho === "/imoveis") {
      const cidade = url.searchParams.get("cidade")?.toLowerCase();
      const busca = url.searchParams.get("busca")?.toLowerCase();
      if (!cidade && !busca) return json({ erro: "informe cidade= ou busca=", dica: "..." }, 400);
      const imoveis = lista
        .filter((f) => (!cidade || String(f.cidade).toLowerCase() === cidade)
          && (!busca || [f.id, f.nome, f.bairro, f.tipo, f.cidade].some((c) => String(c).toLowerCase().includes(busca))))
        .map(({ id, nome, cidade: c, uf, bairro, tipo, capacidade }) => ({ id, nome, cidade: c, uf, bairro, tipo, capacidade }));
      return json({ imoveis, total: imoveis.length });
    }
    const ficha = fichas[caminho.replace("/imoveis/", "").toUpperCase()];
    return ficha && caminho.startsWith("/imoveis/") ? json(ficha) : json({ erro: "imovel nao encontrado" }, 404);
  }) as typeof fetch;
  return { buscar, leads, pedidosAoCatalogo };
}

const USO = { entrada: 10, saida: 5 };
let contador = 0;

export function chamar(nome: string, argumentos: Record<string, unknown> = {}): ChamadaDeFerramenta {
  return { id: `c${++contador}`, type: "function", function: { name: nome, arguments: JSON.stringify(argumentos) } };
}

export function pedeFerramentas(...chamadas: ChamadaDeFerramenta[]): RespostaDoModelo {
  return { texto: "", chamadas, uso: USO };
}

export function diz(texto: string): RespostaDoModelo {
  return { texto, chamadas: [], uso: USO };
}

export interface ModeloRoteirizado {
  modelo: Modelo;
  /** Mensagens que o modelo recebeu a cada chamada. */
  recebidas: Mensagem[][];
}

/** Modelo falso que devolve as respostas do roteiro, uma por chamada. Roteiro esgotado = erro. */
export function roteiro(...respostas: (RespostaDoModelo | Error)[]): ModeloRoteirizado {
  const fila = [...respostas];
  const recebidas: Mensagem[][] = [];
  return {
    recebidas,
    modelo: async (mensagens) => {
      recebidas.push(mensagens);
      const proxima = fila.shift();
      if (!proxima) throw new Error("roteiro do modelo falso esgotado");
      if (proxima instanceof Error) throw proxima;
      return proxima;
    },
  };
}

/** Última mensagem do hóspede vista pelo modelo numa chamada. */
export function ultimaDoHospede(mensagens: Mensagem[]): string {
  return mensagens.findLast((m) => m.role === "user")?.content ?? "";
}
