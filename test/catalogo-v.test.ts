import { describe, expect, it, vi } from "vitest";
import { criarCatalogo, ErroDoCatalogo, sanear } from "../src/catalogo";
import { BASE_CATALOGO, FICHAS } from "./apoio";

const TETO = 1_048_576;

/** Corpo em fluxo, sem content-length, que conta quantos bytes o leitor puxou. */
function fluxoContado(pedaco: Uint8Array, vezes: number) {
  const lidos = { bytes: 0 };
  let restantes = vezes;
  const corpo = new ReadableStream<Uint8Array>({
    pull(controle) {
      if (restantes-- <= 0) return controle.close();
      lidos.bytes += pedaco.byteLength;
      controle.enqueue(pedaco);
    },
  }, { highWaterMark: 0 });
  return { corpo, lidos };
}

/** JSON de cidades válido com exatamente `bytes` bytes. */
function jsonDeTamanho(bytes: number): string {
  const base = '{"cidades":[]}';
  return base + " ".repeat(bytes - base.length);
}

describe("leitura do catálogo: redirecionamento e teto de tamanho (frente V)", () => {
  it("um 302 não é seguido: um pedido só, com redirect manual, e erro do catálogo", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://outro.teste/desvio" } }));
    const erro = await criarCatalogo(BASE_CATALOGO, buscar as unknown as typeof fetch).cidades().catch((e: Error) => e);
    expect(erro).toBeInstanceOf(ErroDoCatalogo);
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE_CATALOGO}/cidades`);
    expect(opcoes.redirect).toBe("manual");
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    for (const chamada of buscar.mock.calls as unknown as [string][]) expect(chamada[0]).not.toContain("outro.teste");
  });

  it("corpo sem content-length acima do teto dá erro sem ser lido até o fim", async () => {
    const { corpo, lidos } = fluxoContado(new Uint8Array(64 * 1024).fill(32), 64); // 4 MiB ao todo
    const buscar = vi.fn(async () => new Response(corpo, { status: 200 }));
    await expect(criarCatalogo(BASE_CATALOGO, buscar as unknown as typeof fetch).cidades()).rejects.toThrow(ErroDoCatalogo);
    expect(lidos.bytes).toBeLessThanOrEqual(TETO + 64 * 1024);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("content-length acima do teto dá erro antes de ler o corpo", async () => {
    const { corpo, lidos } = fluxoContado(new Uint8Array(1024).fill(32), 4);
    const buscar = vi.fn(async () => new Response(corpo, { status: 200, headers: { "content-length": String(TETO + 1) } }));
    await expect(criarCatalogo(BASE_CATALOGO, buscar as unknown as typeof fetch).cidades()).rejects.toThrow(ErroDoCatalogo);
    expect(lidos.bytes).toBe(0);
  });

  it("corpo exatamente no teto passa; um byte a mais dá erro", async () => {
    const no = vi.fn(async () => new Response(jsonDeTamanho(TETO), { status: 200 }));
    expect(await criarCatalogo(BASE_CATALOGO, no as unknown as typeof fetch).cidades()).toEqual([]);
    const acima = vi.fn(async () => new Response(jsonDeTamanho(TETO + 1), { status: 200 }));
    await expect(criarCatalogo(BASE_CATALOGO, acima as unknown as typeof fetch).cidades()).rejects.toThrow(ErroDoCatalogo);
  });

  it("corpo pequeno que não é JSON válido continua sendo erro do catálogo", async () => {
    const buscar = vi.fn(async () => new Response("{não é json", { status: 200 }));
    await expect(criarCatalogo(BASE_CATALOGO, buscar as unknown as typeof fetch).cidades()).rejects.toThrow(ErroDoCatalogo);
  });
});

describe("texto do catálogo sem caracteres invisíveis de formatação ou direção (frente V)", () => {
  const INVISIVEIS = ["\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069", "\ufeff"];

  it("um texto de ficha com esses caracteres sai sem eles", async () => {
    const nome = `Chalé${INVISIVEIS.join("")} da Serra\u202e oãçurtsni\u202c`;
    const ficha = { ...FICHAS["GRM-301"], nome, descricao: `\ufeffVista${INVISIVEIS[0]} linda` };
    const buscar = vi.fn(async () => Response.json(ficha));
    const lida = await criarCatalogo(BASE_CATALOGO, buscar as unknown as typeof fetch).ficha("GRM-301");
    expect(lida!.nome).toBe("Chalé da Serra oãçurtsni");
    expect(lida!.descricao).toBe("Vista linda");
    for (const c of INVISIVEIS) expect(JSON.stringify(lida)).not.toContain(c);
  });

  it("texto comum com acento e emoji não muda", () => {
    const comum = "Pousada à beira-mar em São José, café incluído 🏖️☀️ e Wi-Fi 😀";
    expect(sanear(comum)).toBe(comum);
  });
});
