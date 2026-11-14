// Teto de chamadas de ferramenta (P30, frente G): no máximo N por resposta do modelo e M
// por turno, somando as voltas. As que passam não rodam e voltam ao modelo como erro.
import { describe, expect, it } from "vitest";
import { MAX_CHAMADAS_POR_RESPOSTA as N, MAX_CHAMADAS_POR_TURNO as M } from "../src/agente/loop";
import type { Mensagem } from "../src/modelo";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const LIMITE = "Limite de chamadas de ferramenta neste turno";
const buscas = (n: number) => Array.from({ length: n }, (_, i) => chamar("buscar_por_comodidade", { termo: `item ${i}` }));
const resultados = (novas: Mensagem[]) => novas.filter((m) => m.role === "tool").map((m) => m.content);

describe("teto de chamadas de ferramenta (P30)", () => {
  it("valores: N = 16 por resposta e M = 32 por turno (a varredura real do catálogo faz 27 num turno)", () => {
    expect([N, M]).toEqual([16, 32]);
  });

  it("50 buscas numa resposta: só N rodam, o catálogo recebe no máximo N vezes o custo de uma, e a resposta sai sem contingência", async () => {
    const uma = conversa();
    await uma.turno("tem piscina?", roteiro(pedeFerramentas(...buscas(1)), diz("Nenhum tem.")).modelo);
    const custoDeUma = uma.mundo.pedidosAoCatalogo.length;
    expect(custoDeUma).toBeGreaterThan(0);

    const c = conversa();
    const r = roteiro(pedeFerramentas(...buscas(50)), diz("Procurei as primeiras comodidades. Quer que eu procure outras?"));
    const saida = await c.turno("procure 50 comodidades diferentes", r.modelo);
    const conteudos = resultados(saida.novas);
    expect(conteudos).toHaveLength(50);
    expect(conteudos.filter((t) => t.includes(LIMITE))).toHaveLength(50 - N);
    expect(saida.ferramentas).toHaveLength(N);
    expect(c.mundo.pedidosAoCatalogo.length).toBeLessThanOrEqual(N * custoDeUma);
    expect(saida).toMatchObject({ contingencia: false, reply: "Procurei as primeiras comodidades. Quer que eu procure outras?" });
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
    const r = roteiro(pedeFerramentas(...buscas(N)), pedeFerramentas(...buscas(N)), pedeFerramentas(...buscas(N)), diz("Já procurei bastante."));
    const saida = await c.turno("procure tudo", r.modelo);
    const conteudos = resultados(saida.novas);
    expect(saida.ferramentas).toHaveLength(M);
    expect(conteudos.filter((t) => t.includes(LIMITE))).toHaveLength(3 * N - M);
    expect(saida).toMatchObject({ contingencia: false, reply: "Já procurei bastante." });
  });

  it("varredura do catálogo como nos turnos reais (1 listar, 11 buscas, 15 fichas) não é cortada", async () => {
    const c = conversa();
    const r = roteiro(
      pedeFerramentas(chamar("listar_cidades"), ...Array.from({ length: 11 }, () => chamar("buscar_imoveis", { cidade: "Gramado" }))),
      pedeFerramentas(...Array.from({ length: 15 }, () => chamar("ver_imovel", { imovel_id: "GRM-301" }))),
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
    const noLote = await lote.turno("sim", roteiro(pedeFerramentas(...buscas(50), chamar("confirmar_reserva"))).modelo);
    expect(noLote.ferramentas.at(-1)).toBe("confirmar_reserva");
    expect(lote.mundo.leads).toHaveLength(1);
    const turno = await comResumo();
    await turno.turno("sim", roteiro(pedeFerramentas(...buscas(N)), pedeFerramentas(...buscas(N)), pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(turno.mundo.leads).toHaveLength(1);
  });

  it("o teto é por turno: depois de um turno no teto, a única confirmação do turno seguinte roda e envia", async () => {
    const c = conversa();
    await c.turno("quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
    await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome: "Ana Lima", telefone: "(11) 98888-0000" }))).modelo);
    const teto = await c.turno("tem piscina?", roteiro(pedeFerramentas(...buscas(50)), diz("Nenhum tem."), diz("NÃO")).modelo);
    expect(teto.ferramentas).toHaveLength(N);
    expect(c.estado().pendente).not.toBeNull();
    const sim = await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(sim.ferramentas).toEqual(["confirmar_reserva"]);
    expect(c.mundo.leads).toHaveLength(1);
  });
});
