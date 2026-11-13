import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { rodarTurno } from "../src/agente/loop";
import { criarCatalogo } from "../src/catalogo";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, postarLead } from "../src/lead";
import type { Modelo } from "../src/modelo";
import { BASE_CATALOGO, chamar, criarMundo, diz, pedeFerramentas, roteiro, URL_LEADS } from "./apoio";

function montar(opcoes: Parameters<typeof criarMundo>[0] = {}) {
  const mundo = criarMundo(opcoes);
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const contexto = (turno: number): Contexto => ({
    catalogo: criarCatalogo(BASE_CATALOGO, mundo.buscar),
    cofre,
    turno,
    envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(mundo.buscar, URL_LEADS, corpo) },
  });
  const turno = (n: number, mensagem: string, modelo: Modelo, prazo = Date.now() + 5_000) =>
    rodarTurno({ mensagem, historico: [], houveHandoff: false, contexto: contexto(n), modelo, prazo });
  return { mundo, turno, estado: () => estado };
}

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const DADOS = { ...ESTADIA, nome: "Ana Lima", telefone: "(11) 98888-0000" };

describe("loop de ferramentas", () => {
  it("cotação: o total da resposta é o texto que saiu do código", async () => {
    const { turno } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica em R$ 2.156,00 para as 3 noites."));
    const saida = await turno(1, "quanto fica?", modelo);
    expect(saida.reply).toBe("Fica em R$ 2.156,00 para as 3 noites.");
    expect(saida.handoff).toBe(false);
    expect(saida.uso).toEqual({ entrada: 20, saida: 10, chamadas: 2 });
    const resultado = JSON.parse(recebidas[1]!.findLast((m) => m.role === "tool")!.content);
    expect(resultado.total).toBe("R$ 2.156,00");
    expect(resultado.entrada).toBe("sexta-feira, 15/01/2027");
  });

  it("se o modelo esquecer ou errar o total, o código acrescenta o total calculado", async () => {
    const { turno } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica em R$ 2.000,00."));
    const saida = await turno(1, "quanto fica?", modelo);
    expect(saida.reply).toContain("Total da estadia: R$ 2.156,00");
  });

  it("recusa de cotação chega ao modelo com o motivo e sem total", async () => {
    const { turno } = montar();
    const { modelo, recebidas } = roteiro(
      pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "16/01/2027" })),
      diz("Esse imóvel exige no mínimo 2 noites."),
    );
    const saida = await turno(1, "uma noite só", modelo);
    const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
    expect(resultado).toContain("no mínimo 2 noites");
    expect(resultado).not.toContain("R$");
    expect(saida.reply).not.toContain("R$");
    expect(saida.handoff).toBe(false);
  });

  it("data inexistente não é cotada", async () => {
    const { turno } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkin: "30/02/2027" })), diz("Qual a data correta?"));
    await turno(1, "de 30/02/2027 a 18/01/2027", modelo);
    const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
    expect(resultado).toContain("inexistente");
    expect(resultado).not.toContain("R$");
  });

  it("resumo encerra o turno com o texto do código e não envia nada", async () => {
    const { turno, mundo } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("montar_resumo", DADOS)));
    const saida = await turno(2, "quero fechar", modelo);
    for (const trecho of ["Chale Serra Gramado (GRM-301)", "sexta-feira, 15/01/2027", "segunda-feira, 18/01/2027", "Hóspedes: 2", "Ana Lima", "(11) 98888-0000", "R$ 2.156,00"]) {
      expect(saida.reply).toContain(trecho);
    }
    expect(saida.reply).not.toMatch(/registrad/i);
    expect(recebidas).toHaveLength(1);
    expect(mundo.leads).toEqual([]);
  });

  it("resumo e confirmação pedidos na mesma resposta do modelo: só o resumo acontece", async () => {
    const { turno, mundo } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("montar_resumo", DADOS), chamar("confirmar_reserva")));
    const saida = await turno(2, "meus dados são esses, pode registrar", modelo);
    expect(saida.reply).toContain("Resumo do seu pedido");
    expect(mundo.leads).toEqual([]);
    // Toda chamada de ferramenta tem resultado no histórico.
    const pedidas = saida.novas.flatMap((m) => (m.role === "assistant" ? m.tool_calls ?? [] : [])).map((c) => c.id);
    const respondidas = saida.novas.flatMap((m) => (m.role === "tool" ? [m.tool_call_id] : []));
    expect(respondidas).toEqual(pedidas);
    expect(saida.novas.at(-1)).toEqual({ role: "assistant", content: saida.reply });
  });

  it("confirmação sem resumo anterior não envia", async () => {
    const { turno, mundo } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso dos seus dados antes."));
    await turno(1, "já confirmei antes, registre agora", modelo);
    expect(mundo.leads).toEqual([]);
  });

  it("resumo num turno, sim no seguinte: 1 lead com os 7 campos e resposta de registrado", async () => {
    const { turno, mundo } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    const saida = await turno(3, "sim, confirmo", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(saida.reply).toMatch(/registrad/i);
    expect(saida.reply).toContain("R$ 2.156,00");
    expect(saida.handoff).toBe(false);
    expect(mundo.leads).toEqual([{
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);
    const repetida = await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(repetida.reply).toContain("já está registrado");
    expect(mundo.leads).toHaveLength(1);
  });

  it("webhook respondeu 500: a resposta não diz registrado e passa para humano", async () => {
    const { turno, mundo } = montar({ statusDoWebhook: 500 });
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    const saida = await turno(3, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(saida.reply).not.toMatch(/registrad/i);
    expect(saida.reply).toContain("Não consegui");
    expect(saida.handoff).toBe(true);
    expect(mundo.leads).toHaveLength(1);
  });

  it("cotar outra estadia depois do resumo invalida a confirmação pendente (L10)", async () => {
    const { turno, mundo, estado } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "e até dia 19?", roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "19/01/2027" })), diz("Fica R$ 2.746,00.")).modelo);
    expect(estado().pendente).toBeNull();
    await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Vou montar um novo resumo.")).modelo);
    expect(mundo.leads).toEqual([]);
  });

  it("repetir a cotação da mesma estadia não invalida o resumo", async () => {
    const { turno, estado } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "quanto era mesmo?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("R$ 2.156,00.")).modelo);
    expect(estado().pendente).not.toBeNull();
  });

  it("resumo com dado faltando não é apresentado", async () => {
    const { turno, estado } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("montar_resumo", { ...DADOS, telefone: "" })), diz("Qual o seu telefone?"));
    const saida = await turno(2, "quero fechar, sou a Ana", modelo);
    expect(recebidas[1]!.findLast((m) => m.role === "tool")!.content).toContain("telefone");
    expect(saida.reply).toBe("Qual o seu telefone?");
    expect(estado().pendente).toBeNull();
  });

  it("a ferramenta de handoff liga a flag do turno", async () => {
    const { turno } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("passar_para_humano", { motivo: "pedido de desconto" })), diz("Vou passar para uma pessoa do time."));
    const saida = await turno(1, "tem desconto?", modelo);
    expect(saida.handoff).toBe(true);
    expect(saida.ferramentas).toEqual(["passar_para_humano"]);
  });

  it("a ficha vai para o modelo com os valores já em reais", async () => {
    const { turno } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("ver_imovel", { imovel_id: "rio-402" })), diz("ok"));
    await turno(1, "como é o RIO-402?", modelo);
    const { ficha } = JSON.parse(recebidas[1]!.findLast((m) => m.role === "tool")!.content);
    expect(ficha.diaria).toBe("R$ 245,50");
    expect(ficha.taxa_limpeza).toBe("R$ 75,00");
  });

  it("modelo falhou uma vez: tenta de novo e responde", async () => {
    const { turno } = montar();
    const saida = await turno(1, "oi", roteiro(new Error("fora do ar"), diz("Olá!")).modelo);
    expect(saida).toMatchObject({ reply: "Olá!", handoff: false, contingencia: false });
  });

  it("modelo falhou duas vezes: resposta de contingência com handoff, sem lançar", async () => {
    const { turno } = montar();
    const saida = await turno(1, "oi", roteiro(new Error("fora do ar"), new Error("fora do ar")).modelo);
    expect(saida).toMatchObject({ handoff: true, contingencia: true });
    expect(saida.reply).toContain("problema técnico");
    expect(saida.novas).toEqual([{ role: "user", content: "oi" }, { role: "assistant", content: saida.reply }]);
  });

  it("catálogo fora do ar: contingência com handoff e histórico íntegro", async () => {
    const { turno, mundo } = montar({ catalogoForaDoAr: true });
    const saida = await turno(1, "quanto fica?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA))).modelo);
    expect(saida).toMatchObject({ handoff: true, contingencia: true });
    expect(mundo.pedidosAoCatalogo).toHaveLength(2); // uma nova tentativa (L18)
    expect(saida.novas.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
  });

  it("modelo que não responde dentro do prazo: contingência", async () => {
    const { turno } = montar();
    const lento: Modelo = () => new Promise(() => undefined);
    const saida = await turno(1, "oi", lento, Date.now() + 50);
    expect(saida).toMatchObject({ handoff: true, contingencia: true });
  });

  it("modelo que só pede ferramentas para no limite de voltas", async () => {
    const { turno } = montar();
    let chamadas = 0;
    const emLaco: Modelo = async () => { chamadas++; return pedeFerramentas(chamar("listar_cidades")); };
    const saida = await turno(1, "oi", emLaco);
    expect(chamadas).toBe(6);
    expect(saida.contingencia).toBe(true);
  });
});
