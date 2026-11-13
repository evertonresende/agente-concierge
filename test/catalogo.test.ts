import { describe, expect, it } from "vitest";
import { criarCatalogo, ErroDoCatalogo, regrasDaFicha } from "../src/catalogo";
import { BASE_CATALOGO, criarMundo, FICHAS } from "./apoio";

describe("cliente do catálogo", () => {
  it("lê cidades, busca e ficha", async () => {
    const mundo = criarMundo();
    const catalogo = criarCatalogo(BASE_CATALOGO, mundo.buscar);
    expect(await catalogo.cidades()).toContainEqual({ cidade: "Gramado", uf: "RS", imoveis: 1 });
    expect((await catalogo.buscar({ cidade: "Gramado", hospedes: 2, aceita_pet: false })).map((i) => i.id)).toEqual(["GRM-301"]);
    expect(mundo.pedidosAoCatalogo.at(-1)).toBe("/imoveis?cidade=Gramado&hospedes=2&aceita_pet=false");
    const ficha = await catalogo.ficha("grm-301");
    expect(regrasDaFicha(ficha!)).toEqual({ diariaCentavos: 59000, taxaLimpezaCentavos: 15000, minimoNoites: 2, capacidade: 4 });
  });

  it("imóvel inexistente devolve null", async () => {
    const catalogo = criarCatalogo(BASE_CATALOGO, criarMundo().buscar);
    expect(await catalogo.ficha("XXX-999")).toBeNull();
  });

  it("id fora do formato não chega à URL do catálogo", async () => {
    const mundo = criarMundo();
    const catalogo = criarCatalogo(BASE_CATALOGO, mundo.buscar);
    for (const id of ["../cidades", "GRM-301?x=1", "GRM 301/..", ""]) expect(await catalogo.ficha(id)).toBeNull();
    expect(mundo.pedidosAoCatalogo).toEqual([]);
  });

  it("ficha sem os campos de preço é recusada", async () => {
    const mundo = criarMundo({ fichas: { "GRM-301": { ...FICHAS["GRM-301"], diaria: "590" } } });
    await expect(criarCatalogo(BASE_CATALOGO, mundo.buscar).ficha("GRM-301")).rejects.toThrow(ErroDoCatalogo);
  });

  it("ficha com valor de mais de duas casas decimais é recusada", async () => {
    const mundo = criarMundo({ fichas: { "GRM-301": { ...FICHAS["GRM-301"], diaria: 590.005 } } });
    await expect(criarCatalogo(BASE_CATALOGO, mundo.buscar).ficha("GRM-301")).rejects.toThrow(ErroDoCatalogo);
  });

  it("catálogo fora do ar: uma nova tentativa, e o erro não carrega a URL", async () => {
    const mundo = criarMundo({ catalogoForaDoAr: true });
    const erro = await criarCatalogo(BASE_CATALOGO, mundo.buscar).cidades().catch((e: Error) => e);
    expect(erro).toBeInstanceOf(ErroDoCatalogo);
    expect((erro as Error).message).not.toContain("token-de-teste");
    expect(mundo.pedidosAoCatalogo).toHaveLength(2);
  });
});
