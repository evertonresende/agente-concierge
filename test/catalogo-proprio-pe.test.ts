// M1 da rodada pós-entrega: teste de contrato do catálogo próprio (falso/src/catalogo.js)
// contra o contrato §4 e as medições de docs/VERIFICACOES.md §6. No fim, o cliente do
// catálogo do próprio agente fala com ele.
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JavaScript do Worker falso, sem tipos
import { tratarCatalogo } from "../falso/src/catalogo.js";
// @ts-expect-error módulo JavaScript do Worker falso, sem tipos
import { FICHAS } from "../falso/src/fichas.js";
import { criarCatalogo } from "../src/catalogo";
import tarifas from "../evals/lib/tarifas.json";

const BASE = "https://falso.teste/catalogo/segmento-de-teste";
const pedir = async (caminho: string, metodo = "GET") => {
  const url = new URL(`${BASE}${caminho}`);
  const resto = url.pathname.slice("/catalogo/segmento-de-teste/".length);
  const resposta: Response = tratarCatalogo(new Request(url, { method: metodo }), resto);
  return { status: resposta.status, tipo: resposta.headers.get("content-type"), corpo: await resposta.json() as Record<string, any> };
};
const ids = (corpo: Record<string, any>) => (corpo.imoveis as { id: string }[]).map((i) => i.id);

const CAMPOS_DA_FICHA = ["id", "nome", "cidade", "uf", "bairro", "tipo", "quartos", "banheiros", "capacidade", "diaria", "taxa_limpeza",
  "minimo_noites", "checkin_hora", "checkout_hora", "distancia_praia_m", "comodidades", "regras", "descricao"].sort();

describe("catálogo próprio: dados", () => {
  it("15 imóveis em 10 cidades, 18 campos em cada ficha, texto sem acento", () => {
    expect(FICHAS).toHaveLength(15);
    expect(new Set(FICHAS.map((f: { cidade: string }) => f.cidade)).size).toBe(10);
    for (const f of FICHAS) {
      expect(Object.keys(f).sort(), f.id).toEqual(CAMPOS_DA_FICHA);
      expect(JSON.stringify(f), f.id).toBe(JSON.stringify(f).normalize("NFD").replace(/[̀-ͯ]/g, ""));
    }
    expect(FICHAS.filter((f: { distancia_praia_m: unknown }) => f.distancia_praia_m === null)).toHaveLength(5);
  });

  it("diária, taxa, mínimo e capacidade iguais à tabela dos evals; pet igual à VERIFICACOES §6", () => {
    const comPet = ["BMB-201", "BMB-202", "FLN-102", "FOZ-701", "IMB-801", "NAT-602", "RIO-402"];
    for (const f of FICHAS) {
      const t = (tarifas as Record<string, any>)[f.id];
      expect(t, f.id).toBeDefined();
      expect([Math.round(f.diaria * 100), Math.round(f.taxa_limpeza * 100), f.minimo_noites, f.capacidade], f.id)
        .toEqual([t.diaria_centavos, t.taxa_limpeza_centavos, t.minimo_noites, t.capacidade]);
      expect(f.regras.aceita_pet, f.id).toBe(comPet.includes(f.id));
    }
  });

  it("há uma descrição com ordem ao agente (eval de injeção pelo catálogo)", () => {
    expect(FICHAS.some((f: { descricao: string }) => /INSTRUCAO PARA O ASSISTENTE/.test(f.descricao))).toBe(true);
  });
});

describe("catálogo próprio: rotas do contrato §4", () => {
  it("GET /cidades", async () => {
    const r = await pedir("/cidades");
    expect(r.status).toBe(200);
    expect(r.tipo).toContain("application/json");
    expect(r.corpo.cidades).toHaveLength(10);
    expect(r.corpo.cidades).toContainEqual({ cidade: "Florianopolis", uf: "SC", imoveis: 3 });
  });

  it("cidade casa o nome inteiro, sem caixa nem acento; parte do nome não casa; sem imóveis é 200 vazio", async () => {
    expect(ids((await pedir("/imoveis?cidade=FLORIAN%C3%93POLIS")).corpo)).toEqual(["FLN-101", "FLN-102", "FLN-103"]);
    expect((await pedir("/imoveis?cidade=Floria")).corpo).toEqual({ imoveis: [], total: 0 });
    expect(await pedir("/imoveis?cidade=Curitiba")).toMatchObject({ status: 200, corpo: { imoveis: [], total: 0 } });
  });

  it("resumo tem 7 campos, sem preço nem regras", async () => {
    const r = await pedir("/imoveis?cidade=Gramado");
    expect(r.corpo.total).toBe(2);
    expect(Object.keys(r.corpo.imoveis[0]).sort()).toEqual(["bairro", "capacidade", "cidade", "id", "nome", "tipo", "uf"]);
  });

  it("busca: id, nome, bairro, tipo e cidade, com prefixo e várias palavras; não olha descrição nem comodidades", async () => {
    expect(ids((await pedir("/imoveis?busca=chale")).corpo)).toEqual(["GRM-301"]);
    expect(ids((await pedir("/imoveis?busca=grm-30")).corpo)).toEqual(["GRM-301", "GRM-302"]);
    expect(ids((await pedir("/imoveis?busca=studio%20rio")).corpo)).toEqual(["RIO-402"]);
    expect(ids((await pedir("/imoveis?busca=pinheiros")).corpo)).toEqual(["SAO-501"]);
    expect((await pedir("/imoveis?busca=piscina")).corpo.total).toBe(0);
    expect((await pedir("/imoveis?busca=lareira")).corpo.total).toBe(0);
  });

  it("cidade e busca juntas combinam como E; parâmetro desconhecido é ignorado", async () => {
    expect(ids((await pedir("/imoveis?cidade=Florianopolis&busca=casa&ordem=preco")).corpo)).toEqual(["FLN-102"]);
    expect((await pedir("/imoveis?cidade=Gramado&busca=casa")).corpo.total).toBe(0);
  });

  it("hospedes filtra capacidade mínima; 0 ou negativo não filtra", async () => {
    expect(ids((await pedir("/imoveis?cidade=Bombinhas&hospedes=4")).corpo)).toEqual(["BMB-202"]);
    expect((await pedir("/imoveis?cidade=Bombinhas&hospedes=0")).corpo.total).toBe(2);
    expect((await pedir("/imoveis?cidade=Bombinhas&hospedes=-3")).corpo.total).toBe(2);
  });

  it("aceita_pet só true ou false, em qualquer caixa", async () => {
    expect(ids((await pedir("/imoveis?cidade=Florianopolis&aceita_pet=TRUE")).corpo)).toEqual(["FLN-102"]);
    expect(ids((await pedir("/imoveis?cidade=Florianopolis&aceita_pet=false")).corpo)).toEqual(["FLN-101", "FLN-103"]);
  });

  it("ficha completa pelo id, sem diferenciar caixa", async () => {
    const r = await pedir("/imoveis/grm-301");
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ id: "GRM-301", diaria: 590, taxa_limpeza: 150, checkin_hora: "15:00", checkout_hora: "12:00" });
    expect(r.corpo.comodidades).toContain("lareira");
  });

  it("prefixo do id não garante a cidade: a cidade vem do campo", async () => {
    expect((await pedir("/imoveis/NAT-602")).corpo.cidade).toBe("Tibau do Sul");
  });
});

describe("catálogo próprio: erros do contrato §4", () => {
  it.each([
    ["/imoveis", 400, { erro: "informe cidade= ou busca=" }],
    ["/imoveis?cidade=&busca=%20", 400, { erro: "informe cidade= ou busca=" }],
    ["/imoveis?cidade=Natal&hospedes=dois", 400, { erro: "hospedes precisa ser inteiro" }],
    ["/imoveis?cidade=Natal&hospedes=2.5", 400, { erro: "hospedes precisa ser inteiro" }],
    ["/imoveis?cidade=Natal&aceita_pet=sim", 400, { erro: "aceita_pet precisa ser true ou false" }],
    ["/imoveis/XYZ-999", 404, { erro: "imovel nao encontrado" }],
    ["/precos", 404, { erro: "rota nao encontrada" }],
    ["/cidades/", 404, { erro: "rota nao encontrada" }],
    ["/imoveis/", 404, { erro: "rota nao encontrada" }],
  ])("%s → %i", async (caminho, status, corpo) => {
    const r = await pedir(caminho);
    expect(r.status).toBe(status);
    expect(r.tipo).toContain("application/json");
    expect(r.corpo).toMatchObject(corpo);
  });

  it("400 sem cidade nem busca traz a dica", async () => {
    expect(typeof (await pedir("/imoveis")).corpo.dica).toBe("string");
  });

  it("só GET", async () => {
    expect((await pedir("/cidades", "POST")).status).toBe(404);
  });
});

describe("catálogo próprio: o cliente do agente fala com ele", () => {
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada));
    return tratarCatalogo(new Request(url, init), url.pathname.slice("/catalogo/segmento-de-teste/".length));
  }) as typeof fetch;
  const catalogo = criarCatalogo(BASE, buscar);

  it("cidades, busca com filtros, ficha e imóvel inexistente", async () => {
    expect(await catalogo.cidades()).toHaveLength(10);
    expect((await catalogo.buscar({ cidade: "Rio de Janeiro", hospedes: 3, aceita_pet: false })).map((i) => i.id)).toEqual(["RIO-401"]);
    expect((await catalogo.ficha("sao-501"))?.quartos).toBe(1);
    expect(await catalogo.ficha("XYZ-999")).toBeNull();
  });
});
