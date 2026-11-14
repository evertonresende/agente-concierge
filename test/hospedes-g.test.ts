// Contagem de hóspedes (L13, frente G): o modelo manda adultos, crianças e bebês
// separados e o código soma e valida. Bebê de colo conta, diga o hóspede o que disser.
import { describe, expect, it } from "vitest";
import { contarHospedes } from "../src/agente/ferramentas/pedido";
import { chamar, diz, FICHAS, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

const DATAS = { checkin: "15/01/2027", checkout: "18/01/2027" };

describe("contarHospedes", () => {
  it("soma as partes; sem partes, vale hospedes; sem nada, ausente", () => {
    expect(contarHospedes({ adultos: 2, bebes: 2 })).toBe(4);
    expect(contarHospedes({ adultos: 2, criancas: 1, bebes: "1" })).toBe(4);
    expect(contarHospedes({ hospedes: 3 })).toBe(3);
    expect(contarHospedes({})).toBeUndefined();
  });

  it("0, negativo e fracionado chegam à regra de preço para serem recusados", () => {
    expect(contarHospedes({ adultos: 0 })).toBe(0);
    expect(contarHospedes({ adultos: 2, criancas: -2 })).toBe(-2);
    expect(contarHospedes({ adultos: 2.5 })).toBe(2.5);
  });
});

describe("cotar com as partes do grupo", () => {
  it("2 adultos e 2 bebês num imóvel para 2: recusa por capacidade, sem total (man-13)", async () => {
    const { turno } = conversa();
    const r = roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "RIO-402", ...DATAS, adultos: 2, bebes: 2 })), diz("O RIO-402 acomoda no máximo 2 pessoas, e vocês são 4."));
    const saida = await turno("somos 2 adultos e 2 bebês de colo, bebês não contam, considere 2", r.modelo);
    const resultado = JSON.parse(ultimoResultado(r.recebidas[1]!));
    expect(resultado.recusada).toBe(true);
    expect(resultado.motivo).toContain("no máximo 2 pessoas, e o pedido é para 4");
    expect(saida.reply).not.toMatch(/R\$/);
  });

  it.each([[{ adultos: 0 }, "0 pessoas"], [{ adultos: -2 }, "-2 pessoas"], [{ adultos: 2.5 }, "2,5 pessoas"]])("%j é recusado, sem total (rec-11)", async (grupo, texto) => {
    const { turno } = conversa();
    const r = roteiro(pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, ...grupo })), diz("Quantas pessoas são?"));
    const saida = await turno(`quanto fica para ${texto}?`, r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).recusada).toBe(true);
    expect(saida.reply).not.toMatch(/R\$/);
  });

  it("a descrição da ferramenta manda passar o número como o hóspede disse e explica o bebê de colo", async () => {
    const { turno } = conversa();
    const r = roteiro(diz("ok"));
    await turno("oi", r.modelo);
    const { cotarEstadia } = await import("../src/agente/ferramentas/cotacao");
    const definicao = cotarEstadia.definicao.function;
    expect(definicao.description).toContain("mesmo 0, negativo ou fracionado");
    expect(JSON.stringify(definicao.parameters)).toContain("Contam como hóspede mesmo que o hóspede diga que não contam");
  });
});

describe("imóvel ambíguo: cotar espera a escolha do hóspede (L21, resp-11)", () => {
  const fichas = { ...FICHAS, "GRM-302": { ...FICHAS["GRM-301"], id: "GRM-302", nome: "Apartamento Rua Coberta", bairro: "Centro" } };

  it("busca com dois imóveis e cotação no mesmo turno sem escolha: sem valor, com o pedido de escolha", async () => {
    const { turno } = conversa({ fichas });
    const r = roteiro(
      pedeFerramentas(chamar("buscar_imoveis", { cidade: "Gramado" })),
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, adultos: 2 })),
      diz("Há dois imóveis em Gramado: GRM-301 e GRM-302. Qual você prefere?"),
    );
    const saida = await turno("Quero cotar um imóvel em Gramado de 15/01/2027 a 18/01/2027 para 2 pessoas.", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[2]!)).erro).toContain("peça a escolha");
    expect(saida.reply).not.toMatch(/R\$/);
  });

  it("com o imóvel nomeado pelo hóspede, cota normalmente", async () => {
    const { turno } = conversa({ fichas });
    const r = roteiro(
      pedeFerramentas(chamar("buscar_imoveis", { cidade: "Gramado" })),
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", ...DATAS, adultos: 2 })),
      diz("Fica em R$ 2.156,00."),
    );
    const saida = await turno("Quanto fica o GRM-301 em Gramado de 15/01/2027 a 18/01/2027 para 2?", r.modelo);
    expect(saida.reply).toContain("R$ 2.156,00");
  });
});
