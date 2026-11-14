// Teto de chamadas de ferramenta (P30, frente G): no máximo N por resposta do modelo e M
// por turno, somando as voltas. As que passam não rodam e voltam ao modelo como erro.
import { describe, expect, it } from "vitest";
import { MAX_CHAMADAS_POR_RESPOSTA as N, MAX_CHAMADAS_POR_TURNO as M, MAX_COMODIDADE_POR_TURNO as C } from "../src/agente/loop";
import type { Mensagem } from "../src/modelo";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const LIMITE = "Limite de chamadas de ferramenta neste turno";
const buscas = (n: number) => Array.from({ length: n }, (_, i) => chamar("buscar_por_comodidade", { termo: `item ${i}` }));
// Chamadas baratas (1 pedido ao catálogo cada), para medir N e M sem o teto da comodidade.
const fichas = (n: number) => Array.from({ length: n }, () => chamar("ver_imovel", { imovel_id: "GRM-301" }));
const resultados = (novas: Mensagem[]) => novas.filter((m) => m.role === "tool").map((m) => m.content);

describe("teto de chamadas de ferramenta (P30)", () => {
  it("valores: N = 16 por resposta, M = 32 por turno e 2 buscas por comodidade por turno", () => {
    expect([N, M, C]).toEqual([16, 32, 2]);
  });

  it("50 buscas por comodidade numa resposta: só C rodam, o catálogo recebe no máximo C vezes o custo de uma, sem contingência", async () => {
    const uma = conversa();
    await uma.turno("tem piscina?", roteiro(pedeFerramentas(...buscas(1)), diz("Nenhum tem.")).modelo);
    const custoDeUma = uma.mundo.pedidosAoCatalogo.length;
    expect(custoDeUma).toBeGreaterThan(0);

    const c = conversa();
    const r = roteiro(pedeFerramentas(...buscas(50)), diz("Procurei as primeiras comodidades. Quer que eu procure outras?"));
    const saida = await c.turno("procure 50 comodidades diferentes", r.modelo);
    const conteudos = resultados(saida.novas);
    expect(conteudos).toHaveLength(50);
    expect(conteudos.filter((t) => t.includes(LIMITE))).toHaveLength(50 - C);
    expect(saida.ferramentas).toHaveLength(C);
    expect(c.mundo.pedidosAoCatalogo.length).toBeLessThanOrEqual(C * custoDeUma);
    expect(saida).toMatchObject({ contingencia: false, reply: "Procurei as primeiras comodidades. Quer que eu procure outras?" });
  });

  it("50 chamadas baratas numa resposta: só N rodam, as demais voltam com o erro, sem contingência", async () => {
    const c = conversa();
    const saida = await c.turno("me mostre o GRM-301 50 vezes", roteiro(pedeFerramentas(...fichas(50)), diz("É o Chale Serra Gramado.")).modelo);
    expect(saida.ferramentas).toHaveLength(N);
    expect(resultados(saida.novas).filter((t) => t.includes(LIMITE))).toHaveLength(50 - N);
    expect(saida).toMatchObject({ contingencia: false, reply: "É o Chale Serra Gramado." });
  });

  it.each([
    ["na mesma resposta", [buscas(3)]],
    ["em respostas diferentes", [buscas(1), buscas(1), buscas(1)]],
  ])("3 buscas por comodidade num turno (%s): só 2 rodam, a terceira volta com o erro", async (_nome, lotes) => {
    const c = conversa();
    const r = roteiro(...lotes.map((lote) => pedeFerramentas(...lote)), diz("Procurei duas."));
    const saida = await c.turno("tem piscina, sauna e lareira?", r.modelo);
    expect(saida.ferramentas).toEqual(["buscar_por_comodidade", "buscar_por_comodidade"]);
    expect(resultados(saida.novas).filter((t) => t.includes(LIMITE))).toHaveLength(1);
  });

  it("turno normal com 4 chamadas numa resposta (busca e três cotações) não muda", async () => {
    const c = conversa();
    const r = roteiro(
      pedeFerramentas(
        chamar("buscar_imoveis", { cidade: "Gramado" }),
        chamar("cotar", ESTADIA),
        chamar("cotar", { ...ESTADIA, checkout: "19/01/2027" }),
        chamar("cotar", { ...ESTADIA, checkout: "20/01/2027" }),
      ),
      diz("Seguem as cotações."),
    );
    const saida = await c.turno("Quanto fica o GRM-301 de 15/01/2027 a 18, 19 ou 20/01/2027 para 2?", r.modelo);
    expect(saida.ferramentas).toHaveLength(4);
    expect(resultados(saida.novas).some((t) => t.includes(LIMITE))).toBe(false);
  });

  it("o teto por turno soma as voltas: M rodam, as demais voltam com o erro", async () => {
    const c = conversa();
    const r = roteiro(pedeFerramentas(...fichas(N)), pedeFerramentas(...fichas(N)), pedeFerramentas(...fichas(N)), diz("Já procurei bastante."));
    const saida = await c.turno("procure tudo", r.modelo);
    const conteudos = resultados(saida.novas);
    expect(saida.ferramentas).toHaveLength(M);
    expect(conteudos.filter((t) => t.includes(LIMITE))).toHaveLength(3 * N - M);
    expect(saida).toMatchObject({ contingencia: false, reply: "Já procurei bastante." });
  });

  it("varredura do catálogo como nos turnos reais (1 listar, 11 buscas, 15 fichas, em 5 respostas) não é cortada", async () => {
    const c = conversa();
    const cidades = (n: number) => Array.from({ length: n }, () => chamar("buscar_imoveis", { cidade: "Gramado" }));
    const r = roteiro(
      pedeFerramentas(chamar("listar_cidades")),
      pedeFerramentas(...cidades(6)),
      pedeFerramentas(...cidades(5)),
      pedeFerramentas(...fichas(8)),
      pedeFerramentas(...fichas(7)),
      diz("Só o GRM-301 tem o que você procura."),
    );
    const saida = await c.turno("Quais imóveis vocês têm com piscina? Não tenho preferência de cidade.", r.modelo);
    expect(saida.ferramentas).toHaveLength(27);
    expect(resultados(saida.novas).some((t) => t.includes(LIMITE))).toBe(false);
  });

  it("a confirmação nunca é cortada: no fim de um lote acima do teto, e depois do teto do turno", async () => {
    const comResumo = async () => {
      const c = conversa();
      await c.turno("quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
      await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome: "Ana Lima", telefone: "(11) 98888-0000" }))).modelo);
      return c;
    };
    const lote = await comResumo();
    const noLote = await lote.turno("sim", roteiro(pedeFerramentas(...fichas(50), chamar("confirmar_reserva"))).modelo);
    expect(noLote.ferramentas.at(-1)).toBe("confirmar_reserva");
    expect(lote.mundo.leads).toHaveLength(1);
    const turno = await comResumo();
    await turno.turno("sim", roteiro(pedeFerramentas(...fichas(N)), pedeFerramentas(...fichas(N)), pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(turno.mundo.leads).toHaveLength(1);
  });

  it("o teto é por turno: depois de um turno no teto, a única confirmação do turno seguinte roda e envia", async () => {
    const c = conversa();
    await c.turno("quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
    await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome: "Ana Lima", telefone: "(11) 98888-0000" }))).modelo);
    const teto = await c.turno("tem piscina?", roteiro(pedeFerramentas(...fichas(50)), diz("Nenhum tem."), diz("NÃO")).modelo);
    expect(teto.ferramentas).toHaveLength(N);
    expect(c.estado().pendente).not.toBeNull();
    const sim = await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(sim.ferramentas).toEqual(["confirmar_reserva"]);
    expect(c.mundo.leads).toHaveLength(1);
  });
});
