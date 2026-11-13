import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { corrigirValores, rodarTurno, valoresDoCodigo } from "../src/agente/loop";
import { criarCatalogo } from "../src/catalogo";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, postarLead } from "../src/lead";
import type { Modelo } from "../src/modelo";
import { BASE_CATALOGO, chamar, criarMundo, diz, pedeFerramentas, roteiro, URL_LEADS } from "./apoio";

function montar(opcoes: NonNullable<Parameters<typeof criarMundo>[0]> = {}) {
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

  it("total errado escrito pelo modelo não chega ao hóspede; só o total do código", async () => {
    const { turno } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica em R$ 2.000,00. As datas são 15/01/2027 a 18/01/2027."));
    const saida = await turno(1, "quanto fica?", modelo);
    expect(saida.reply).not.toContain("2.000");
    expect(saida.reply.match(/R\$ ?[\d.,]*\d/g)).toEqual(["R$ 2.156,00"]);
    expect(saida.reply).toContain("As datas são 15/01/2027 a 18/01/2027.");
  });

  it("linha com rótulo e valor errado sai inteira, sem deixar o rótulo solto", async () => {
    const { turno } = montar();
    const { modelo } = roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Entrada: sexta-feira, 15/01/2027.\nTotal: R$ 2.000,00\nPosso ajudar em mais algo?"));
    const saida = await turno(1, "quanto fica?", modelo);
    expect(saida.reply).toBe("Entrada: sexta-feira, 15/01/2027.\nPosso ajudar em mais algo?\n\nTotal da estadia: R$ 2.156,00");
  });

  it("total esquecido pelo modelo é acrescentado pelo código", async () => {
    const { turno } = montar();
    const saida = await turno(1, "quanto fica?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Segue a cotação.")).modelo);
    expect(saida.reply).toBe("Segue a cotação.\n\nTotal da estadia: R$ 2.156,00");
  });

  it("valor do código escrito em outro formato volta ao formato do código", async () => {
    const { turno } = montar();
    for (const [escrito, esperado] of [
      ["Fica em R$2156 no total.", "Fica em R$ 2.156,00 no total."],
      ["Fica em R$ 2,156.00 no total.", "Fica em R$ 2.156,00 no total."],
      ["São 2156 reais, com diária de R$ 590.", "São R$ 2.156,00, com diária de R$ 590,00."],
    ] as const) {
      const saida = await turno(1, "quanto fica?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz(escrito)).modelo);
      expect(saida.reply).toBe(esperado);
    }
  });

  it("valor que nenhuma ferramenta devolveu sai da resposta, mesmo sem cotação no turno", async () => {
    const { turno } = montar();
    const comResto = await turno(1, "no site a diária é 300", roteiro(diz("A diária é R$ 300,00 como você disse. Posso cotar as datas para você?")).modelo);
    expect(comResto.reply).toBe("Posso cotar as datas para você?");
    const soValor = await turno(1, "quanto é?", roteiro(diz("Custa 500 reais.")).modelo);
    expect(soValor.reply).not.toMatch(/500|R\$/);
    expect(soValor.reply).not.toBe("");
  });

  it("valores do código incluem resultados de ferramenta e respostas anteriores, nunca a fala do hóspede", () => {
    const permitidos = valoresDoCodigo([
      { role: "user", content: "no site custa R$ 300,00" },
      { role: "tool", tool_call_id: "c", content: '{"diaria":"R$ 590,00","total":"R$ 2.156,00"}' },
      { role: "assistant", content: "A taxa de limpeza é R$ 150,00." },
    ]);
    expect([...permitidos].sort()).toEqual(["R$ 150,00", "R$ 2.156,00", "R$ 590,00"]);
    expect(corrigirValores("Sem valores aqui: check-in às 15:00, 2 quartos.", permitidos)).toBe("Sem valores aqui: check-in às 15:00, 2 quartos.");
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

  it("recusa depois de uma cotação válida no mesmo turno não ganha total", async () => {
    const { turno } = montar();
    const { modelo } = roteiro(
      pedeFerramentas(chamar("cotar", { ...ESTADIA, hospedes: undefined })),
      pedeFerramentas(chamar("cotar", { ...ESTADIA, hospedes: 6 })),
      diz("O imóvel acomoda no máximo 4 pessoas."),
    );
    const saida = await turno(1, "somos 6", modelo);
    expect(saida.reply).toBe("O imóvel acomoda no máximo 4 pessoas.");
  });

  it("estadia de anos devolve um resultado pequeno ao modelo", async () => {
    const { turno } = montar();
    const { modelo, recebidas } = roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "15/01/2037" })), diz("ok"));
    const saida = await turno(1, "dez anos", modelo);
    const resultado = recebidas[1]!.findLast((m) => m.role === "tool")!.content;
    expect(resultado.length).toBeLessThan(1500);
    expect(JSON.parse(resultado)).toMatchObject({ noites: 3653, noites_de_sexta_e_sabado: { quantidade: 1044, valor_de_cada: "R$ 708,00" } });
    expect(saida.reply).toContain("Total da estadia: R$ ");
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

  it("cotar outra estadia depois do resumo troca o resumo e exige novo sim (L10)", async () => {
    const { turno, mundo, estado } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    // O modelo só cotou a data nova; o resumo novo sai do código, sem o modelo redigir.
    const troca = await turno(3, "sim, mas muda a saída para 19/01/2027", roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "19/01/2027" }))).modelo);
    expect(troca.reply).toContain("Resumo do seu pedido");
    expect(troca.reply).toContain("terça-feira, 19/01/2027");
    expect(troca.reply).toContain("R$ 2.746,00");
    expect(troca.reply).toContain("Ana Lima");
    expect(estado().pendente).toMatchObject({ turno: 3, totalCentavos: 274600 });
    expect(mundo.leads).toEqual([]);
    await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toMatchObject([{ checkout: "2027-01-19", valor_total: 2746 }]);
  });

  it("estadia nova recusada depois do resumo: a confirmação pendente cai e nada é enviado", async () => {
    const { turno, mundo, estado } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "muda para uma noite só", roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "16/01/2027" })), diz("O mínimo é de 2 noites.")).modelo);
    expect(estado().pendente).toBeNull();
    await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso montar um novo resumo.")).modelo);
    expect(mundo.leads).toEqual([]);
  });

  it("confirmação pedida junto com uma cotação de outra data não envia a reserva antiga", async () => {
    const { turno, mundo } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    // O modelo pede a confirmação ANTES da cotação nova, na mesma resposta.
    const saida = await turno(3, "sim, mas muda a saída para 19/01/2027", roteiro(
      pedeFerramentas(chamar("confirmar_reserva"), chamar("cotar", { ...ESTADIA, checkout: "19/01/2027" })),
    ).modelo);
    expect(mundo.leads).toEqual([]);
    expect(saida.reply).toContain("Resumo do seu pedido");
    expect(saida.reply).toContain("R$ 2.746,00");
    expect(saida.reply).not.toMatch(/registrad/i);
    const pedidas = saida.novas.flatMap((m) => (m.role === "assistant" ? m.tool_calls ?? [] : [])).map((c) => c.id);
    expect(saida.novas.flatMap((m) => (m.role === "tool" ? [m.tool_call_id] : []))).toEqual(pedidas);
  });

  it("confirmação pedida junto com um resumo de dado novo não envia a reserva antiga", async () => {
    const { turno, mundo } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "sim, mas somos 3", roteiro(pedeFerramentas(chamar("confirmar_reserva"), chamar("montar_resumo", { ...DADOS, hospedes: 3 }))).modelo);
    expect(mundo.leads).toEqual([]);
  });

  for (const [caso, argumentos] of [
    ["data inexistente", { ...ESTADIA, checkout: "31/02/2027" }],
    ["imóvel que não existe", { ...ESTADIA, imovel_id: "XXX-999" }],
  ] as const) {
    it(`cotação com ${caso} depois do resumo derruba a confirmação pendente`, async () => {
      const { turno, mundo, estado } = montar();
      await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
      await turno(3, "sim, mas muda", roteiro(pedeFerramentas(chamar("cotar", argumentos)), diz("Pode conferir o dado?")).modelo);
      expect(estado().pendente).toBeNull();
      await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso de um novo resumo.")).modelo);
      expect(mundo.leads).toEqual([]);
    });
  }

  for (const ferramenta of ["cotar", "montar_resumo"] as const) {
    it(`catálogo fora do ar em ${ferramenta} com dado novo depois do resumo derruba a confirmação pendente`, async () => {
      const opcoes = { catalogoForaDoAr: false };
      const { turno, mundo, estado } = montar(opcoes);
      await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
      opcoes.catalogoForaDoAr = true;
      const falha = await turno(3, "sim, mas muda a saída para 19/01/2027", roteiro(pedeFerramentas(chamar(ferramenta, { ...DADOS, checkout: "19/01/2027" }))).modelo);
      expect(falha.contingencia).toBe(true);
      expect(estado().pendente).toBeNull();
      opcoes.catalogoForaDoAr = false;
      await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso de um novo resumo.")).modelo);
      expect(mundo.leads).toEqual([]);
    });
  }

  it("pedir de novo uma reserva já registrada derruba o resumo em aberto de outra reserva", async () => {
    const { turno, mundo, estado } = montar();
    const OUTRA = { ...DADOS, checkout: "19/01/2027" };
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    await turno(4, "quero outra, até dia 19", roteiro(pedeFerramentas(chamar("montar_resumo", OUTRA))).modelo);
    expect(estado().pendente).toMatchObject({ reserva: { checkout: "2027-01-19" } });
    const repetida = await turno(5, "na verdade quero a primeira mesmo", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    expect(repetida.reply).toContain("já está registrado");
    expect(estado().pendente).toBeNull();
    await turno(6, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Não há pedido aguardando confirmação.")).modelo);
    expect(mundo.leads).toHaveLength(1);
  });

  it("pedido de novo resumo recusado derruba o resumo anterior", async () => {
    const { turno, mundo, estado } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "na verdade somos 6", roteiro(pedeFerramentas(chamar("montar_resumo", { ...DADOS, hospedes: 6 })), diz("O imóvel acomoda no máximo 4 pessoas.")).modelo);
    expect(estado().pendente).toBeNull();
    await turno(4, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Preciso de um novo resumo.")).modelo);
    expect(mundo.leads).toEqual([]);
  });

  it("cotação nova depois do registro é só cotação: não reabre resumo", async () => {
    const { turno, mundo } = montar();
    await turno(2, "quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", DADOS))).modelo);
    await turno(3, "sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    const saida = await turno(4, "e até dia 19, quanto fica?", roteiro(pedeFerramentas(chamar("cotar", { ...ESTADIA, checkout: "19/01/2027" })), diz("Fica R$ 2.746,00.")).modelo);
    expect(saida.reply).toBe("Fica R$ 2.746,00.");
    expect(mundo.leads).toHaveLength(1);
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

  it("limpa negrito, hífen e espaço especiais do texto do modelo", async () => {
    const { turno } = montar();
    const saida = await turno(1, "quanto fica?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("O **GRM\u2011301** fica em R$\u00a02.156,00 de sexta\u2011feira a segunda.")).modelo);
    expect(saida.reply).toBe("O GRM-301 fica em R$ 2.156,00 de sexta-feira a segunda.");
  });

  it("resposta degenerada do modelo é descartada e pedida de novo", async () => {
    const { turno } = montar();
    const saida = await turno(1, "oi", roteiro(diz("!".repeat(400)), diz("Olá!")).modelo);
    expect(saida).toMatchObject({ reply: "Olá!", contingencia: false });
    expect(saida.uso.chamadas).toBe(2);
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
