import type { Ficha } from "../../catalogo";
import { formatarReais, reaisParaCentavos } from "../../nucleo/dinheiro";
import { definir, numero, texto } from "./tipos";

/** Ficha para o modelo, com os valores já em texto de reais: ele nunca formata dinheiro. */
export function fichaParaOModelo(ficha: Ficha) {
  return {
    ...ficha,
    diaria: formatarReais(reaisParaCentavos(ficha.diaria)),
    taxa_limpeza: formatarReais(reaisParaCentavos(ficha.taxa_limpeza)),
  };
}

export const listarCidades = definir(
  "listar_cidades",
  "Lista as cidades que têm imóveis no catálogo, com a quantidade de imóveis em cada uma.",
  {},
  [],
  async (_argumentos, { catalogo }) => ({ paraOModelo: { cidades: await catalogo.cidades() } }),
);

export const buscarImoveis = definir(
  "buscar_imoveis",
  "Busca imóveis no catálogo. Informe `cidade` (nome inteiro da cidade) ou `busca` (texto procurado em id, nome, "
    + "bairro, tipo e cidade). A busca NÃO olha descrição nem comodidades: para saber de piscina, lareira, wifi etc., "
    + "liste os imóveis e leia a ficha de cada um com ver_imovel. O resultado não traz preço nem regras.",
  {
    cidade: { type: "string", description: "Nome inteiro da cidade, ex.: Gramado" },
    busca: { type: "string", description: "Texto livre: id, nome, bairro, tipo ou cidade" },
    hospedes: { type: "integer", description: "Capacidade mínima" },
    aceita_pet: { type: "boolean", description: "true para só os que aceitam pet" },
  },
  [],
  async (argumentos, { catalogo }) => {
    const cidade = texto(argumentos, "cidade");
    const busca = texto(argumentos, "busca");
    if (!cidade && !busca) {
      return { paraOModelo: { erro: "Informe cidade ou busca. Para ver as cidades disponíveis, use listar_cidades." } };
    }
    const hospedes = numero(argumentos, "hospedes");
    const pet = argumentos.aceita_pet;
    const imoveis = await catalogo.buscar({
      cidade,
      busca,
      hospedes: hospedes !== undefined && Number.isInteger(hospedes) && hospedes > 0 ? hospedes : undefined,
      aceita_pet: typeof pet === "boolean" ? pet : undefined,
    });
    return { paraOModelo: { total: imoveis.length, imoveis } };
  },
);

export const verImovel = definir(
  "ver_imovel",
  "Lê a ficha completa de um imóvel pelo id: quartos, capacidade, diária, taxa de limpeza, mínimo de noites, "
    + "horários, comodidades, regras (pet, fumo, festas) e descrição. Campo ausente ou nulo = o catálogo não informa.",
  { imovel_id: { type: "string", description: "Id do imóvel, ex.: GRM-301" } },
  ["imovel_id"],
  async (argumentos, { catalogo }) => {
    const id = texto(argumentos, "imovel_id");
    const ficha = id ? await catalogo.ficha(id) : null;
    if (!ficha) return { paraOModelo: { erro: "Imóvel não encontrado no catálogo. Não invente dados sobre ele." } };
    return { paraOModelo: { ficha: fichaParaOModelo(ficha) } };
  },
);
