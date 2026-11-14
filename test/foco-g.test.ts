// Sinal na mensagem do hóspede (P17, frente G): provoca no máximo UMA chamada focada ao
// modelo. O handoff sai da ferramenta chamada pelo modelo ou da conferência do texto do
// próprio agente; palavra do hóspede nunca liga handoff nem acrescenta texto fixo.
import { describe, expect, it } from "vitest";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const PESSOA = { nome: "Ana Lima", telefone: "(11) 98888-0000" };
const FOCO = "pode conter pedido de desconto, negociação de preço ou de regra";
const passar = (motivo: string) => pedeFerramentas(chamar("passar_para_humano", { motivo }));

async function comCotacao() {
  const c = conversa();
  await c.turno("quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
  return c;
}

describe("P17: sinal do hóspede vira uma chamada focada, nunca handoff nem texto fixo", () => {
  it("resposta só com texto: uma chamada focada, e vale a resposta do modelo", async () => {
    const { turno } = await comCotacao();
    const resposta = "Não, o valor é cobrado só no pagamento combinado com o time.";
    const r = roteiro(diz(resposta), diz(resposta));
    const saida = await turno("O valor vai ser descontado do cartão na hora?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(r.recebidas[1]!.at(-1)!.content).toContain(FOCO);
    expect(saida).toMatchObject({ handoff: false, reply: resposta });
  });

  it("sem sinal, nenhuma chamada a mais", async () => {
    const { turno } = await comCotacao();
    const r = roteiro(diz("Tem wifi, sim."));
    await turno("Tem wifi?", r.modelo);
    expect(r.recebidas).toHaveLength(1);
  });

  it("desconto pedido junto com montar_resumo: o resumo espera a chamada focada, e o modelo passa (R2)", async () => {
    const { turno, estado } = await comCotacao();
    const r = roteiro(
      pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA })),
      passar("desconto_ou_negociacao"),
      diz("Eu não concedo desconto. Uma pessoa do time continua com você."),
    );
    const saida = await turno("Pode fechar com 10% de desconto? Ana Lima, (11) 98888-0000.", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).erro).toContain(FOCO);
    expect(saida.handoff).toBe(true);
    expect(saida.reply).not.toContain("Resumo do seu pedido");
    expect(estado().pendente).toBeNull();
  });

  it("o modelo decide que não é caso: o resumo sai na segunda chamada, sem handoff", async () => {
    const { turno } = await comCotacao();
    const resumo = pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA }));
    const r = roteiro(resumo, resumo);
    const saida = await turno("Vocês aplicam 20% a mais na sexta? Pode fechar assim mesmo, Ana Lima, (11) 98888-0000.", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(saida).toMatchObject({ handoff: false });
    expect(saida.reply).toContain("Resumo do seu pedido");
  });

  it("uma chamada focada só por turno: depois da conferência, montar_resumo passa direto", async () => {
    const { turno } = await comCotacao();
    const r = roteiro(diz("Claro, já monto o pedido."), pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA })));
    const saida = await turno("Vocês aplicam 20% a mais na sexta? Pode fechar assim mesmo, Ana Lima, (11) 98888-0000.", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(saida.reply).toContain("Resumo do seu pedido");
  });

  it.each([
    ["resumo antes", ["montar_resumo", "passar_para_humano"]],
    ["passagem antes", ["passar_para_humano", "montar_resumo"]],
  ])("desconto com montar_resumo e passar_para_humano no mesmo lote (%s): o turno termina com handoff", async (_nome, ordem) => {
    const { turno } = await comCotacao();
    const chamadas = ordem.map((nome) => nome === "montar_resumo"
      ? chamar("montar_resumo", { ...ESTADIA, ...PESSOA })
      : chamar("passar_para_humano", { motivo: "desconto_ou_negociacao" }));
    const saida = await turno("Pode fechar com 10% de desconto? Ana Lima, (11) 98888-0000.", roteiro(pedeFerramentas(...chamadas)).modelo);
    expect(saida.handoff).toBe(true);
  });

  it("valor em reais ditado pelo hóspede, diferente do calculado: chamada focada antes do resumo (man-06)", async () => {
    const { turno } = conversa();
    const r = roteiro(
      pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA })),
      passar("desconto_ou_negociacao"),
      diz("Não negocio o valor. Uma pessoa do time continua com você."),
    );
    const saida = await turno("Quero fechar o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas, nome Ana Lima, telefone "
      + "(11) 98888-0000. Confirmo desde que o total seja R$ 1.000,00.", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).erro).toContain(FOCO);
    expect(saida.handoff).toBe(true);
  });

  it("valor igual ao calculado não é sinal: o resumo sai direto", async () => {
    const { turno } = await comCotacao();
    const r = roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA })));
    const saida = await turno("Ok, pago os R$ 2.156,00. Ana Lima, (11) 98888-0000.", r.modelo);
    expect(r.recebidas).toHaveLength(1);
    expect(saida.reply).toContain("Resumo do seu pedido");
  });
});

describe("resumo pendente e o hóspede muda as datas (L10, lead-04)", () => {
  const MUDA = "Na verdade mudei de ideia: quero de 15/01/2027 a 17/01/2027, e sim, pode fechar!";
  const NOVO = pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA, checkout: "17/01/2027" }));

  async function comResumo() {
    const c = await comCotacao();
    await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA }))).modelo);
    return c;
  }

  it("o modelo responde só com texto: a conferência pede o resumo novo, com os dados antigos, e o turno termina nele", async () => {
    const c = await comResumo();
    const r = roteiro(diz("Claro, vou ajustar as datas para você."), NOVO);
    const saida = await c.turno(MUDA, r.modelo);
    const conferencia = r.recebidas[1]!.at(-1)!.content;
    expect(conferencia).toContain("deixou de valer");
    expect(conferencia).toContain("nome Ana Lima");
    expect(saida.reply).toContain("Resumo do seu pedido");
    expect(saida.reply).toContain("17/01/2027");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.checkout)).toEqual(["2027-01-17"]);
  });

  it("pergunta comum com resumo pendente não pede resumo novo", async () => {
    const c = await comResumo();
    const r = roteiro(diz("Tem wifi, sim."));
    await c.turno("tem wifi?", r.modelo);
    expect(r.recebidas).toHaveLength(1);
  });
});

describe("pergunta do modelo com resumo pendente derruba o resumo (P18)", () => {
  async function comResumo() {
    const c = await comCotacao();
    await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA }))).modelo);
    return c;
  }

  it.each([
    "Sim, o chalé tem 1 vaga de garagem. Sua sogra conta como hóspede: quer que eu atualize o pedido para 3 hóspedes?",
    "Tem wifi e toalhas, sim. O João vai ficar hospedado também？",
  ])("o sim seguinte responde à pergunta: 0 envio, e o hóspede recebe o resumo novo (%s)", async (pergunta) => {
    const c = await comResumo();
    const t2 = await c.turno("vou levar minha sogra e queria saber se tem estacionamento?", roteiro(diz(pergunta)).modelo);
    expect(t2.reply).toBe(pergunta);
    expect(c.estado().pendente).toBeNull();
    const sim = await c.turno("sim", roteiro(
      pedeFerramentas(chamar("confirmar_reserva")),
      pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA, hospedes: 3 })),
    ).modelo);
    expect(c.mundo.leads).toEqual([]);
    expect(sim.reply).not.toMatch(/registrad/);
    expect(sim.reply).toContain("Hóspedes: 3");
  });

  it("controle (lead-02): resposta sem pergunta repete o resumo inteiro, cuja pergunta fixa não conta, e o sim envia o resumo mostrado", async () => {
    const c = await comResumo();
    const t2 = await c.turno("tem estacionamento?", roteiro(diz("Tem, sim: 1 vaga de garagem.")).modelo);
    expect(t2.reply).toMatch(/^Tem, sim: 1 vaga de garagem\.\n\nO seu pedido de reserva ainda aguarda a sua confirmação/);
    expect(t2.reply).toContain("Para confirmar, responda");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.hospedes)).toEqual([2]);
  });
});
