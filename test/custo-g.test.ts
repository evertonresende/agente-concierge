// Custo de CPU (frente G): texto longo do catálogo ou do hóspede não pode custar tempo
// quadrático nas expressões da conferência e do saneamento.
import { describe, expect, it } from "vitest";
import { sugereNegociacao } from "../src/agente/ferramentas/handoff";
import { conferir } from "../src/agente/loop";
import { sanear } from "../src/catalogo";
import { chamar, diz, FICHAS, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

function ms(f: () => unknown): number {
  const inicio = performance.now();
  f();
  return performance.now() - inicio;
}

describe("custo de CPU (BAIXA 9)", () => {
  it("saneamento de texto enorme do catálogo corta antes de processar", () => {
    expect(ms(() => sanear({ d: " ".repeat(200_000) + "$".repeat(200_000) }))).toBeLessThan(300);
    expect((sanear({ d: "x".repeat(10_000) }) as { d: string }).d.length).toBe(300);
  });

  it("mensagem de 8.000 dígitos e resposta longa de números não travam a conferência", () => {
    expect(ms(() => sugereNegociacao("1".repeat(8_000)))).toBeLessThan(300);
    expect(ms(() => conferir("1.".repeat(4_000), new Set(), { mensagem: "1".repeat(8_000), handoff: false }))).toBeLessThan(500);
  });
});

describe("busca por comodidade com fronteira à esquerda (M22)", () => {
  it("\"gás\" não casa \"vagas\" nem \"Vegas\"; casa \"fogão a gás\"", async () => {
    const fichas = {
      ...FICHAS,
      "GRM-301": { ...FICHAS["GRM-301"], comodidades: ["2 vagas de garagem", "quadro de Las Vegas"] },
      "RIO-402": { ...FICHAS["RIO-402"], comodidades: ["fogão a gás"] },
    };
    const { turno } = conversa({ fichas });
    const r = roteiro(pedeFerramentas(chamar("buscar_por_comodidade", { termo: "gás" })), diz("ok"));
    await turno("qual tem gás?", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).dados_do_catalogo.imoveis.map((i: { id: string }) => i.id)).toEqual(["RIO-402"]);
  });
});
