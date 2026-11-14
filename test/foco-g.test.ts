// Sinal na mensagem do hóspede (P17, frente G): provoca no máximo UMA chamada focada ao
// modelo. O handoff sai da ferramenta chamada pelo modelo ou da conferência do texto do
// próprio agente; palavra do hóspede nunca liga handoff nem acrescenta texto fixo.
import { describe, expect, it } from "vitest";
import type { DefinicaoDeFerramenta, Mensagem, Modelo } from "../src/modelo";
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
    const r = roteiro(diz("Tem wifi, sim."), diz("NÃO"));
    await c.turno("tem wifi?", r.modelo);
    // Só a pergunta fechada do rearme (item 10), nenhuma conferência.
    expect(r.recebidas).toHaveLength(2);
    expect(r.recebidas[1]![0]!.content).toContain("Responda só SIM ou NÃO");
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

  it("hóspede que hesitou (lead-05): a pergunta do agente não derruba o resumo, o pedido se repete e o sim envia", async () => {
    const c = await comResumo();
    const r2 = roteiro(diz("Os dados do resumo estão corretos?"));
    const t2 = await c.turno("Acho que sim, talvez pode ser.", r2.modelo);
    expect(r2.recebidas).toHaveLength(1); // sem a pergunta fechada do rearme (item 10, critério d)
    expect(t2.reply).toMatch(/^Os dados do resumo estão corretos\?\n\nO seu pedido de reserva ainda aguarda a sua confirmação/);
    expect(c.estado().pendente).not.toBeNull();
    await c.turno("Sim, confirmo definitivamente.", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.hospedes)).toEqual([2]);
  });

  it("outra leitura da mensagem (pergunta do hóspede) com pergunta do agente: o resumo cai", async () => {
    const c = await comResumo();
    await c.turno("tem wifi?", roteiro(diz("Tem wifi, sim. Quer saber mais alguma coisa?")).modelo);
    expect(c.estado().pendente).toBeNull();
  });

  it("controle (lead-02): resposta sem pergunta repete o resumo inteiro, cuja pergunta fixa não conta, e o sim envia o resumo mostrado", async () => {
    const c = await comResumo();
    const t2 = await c.turno("tem estacionamento?", roteiro(diz("Tem, sim: 1 vaga de garagem."), diz("NÃO")).modelo);
    expect(t2.reply).toMatch(/^Tem, sim: 1 vaga de garagem\.\n\nO seu pedido de reserva ainda aguarda a sua confirmação/);
    expect(t2.reply).toContain("Para confirmar, responda");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.hospedes)).toEqual([2]);
  });
});

describe("rearme passa pela pergunta fechada ao modelo (item 10, complemento da P18)", () => {
  const AFIRMA = "Sua sogra conta como hóspede. Se quiser, eu atualizo o resumo com 3 hóspedes antes de você confirmar.";

  async function comResumo() {
    const c = await comCotacao();
    await c.turno("quero fechar, Ana Lima, (11) 98888-0000", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA }))).modelo);
    return c;
  }

  /** Modelo falso que também guarda as ferramentas oferecidas em cada chamada. */
  function comFerramentas(base: ReturnType<typeof roteiro>) {
    const ferramentas: DefinicaoDeFerramenta[][] = [];
    const modelo: Modelo = (mensagens: Mensagem[], definicoes: DefinicaoDeFerramenta[]) => {
      ferramentas.push(definicoes);
      return base.modelo(mensagens, definicoes);
    };
    return { modelo, ferramentas };
  }

  it("(a) e (e): NÃO mantém o resumo, o rearme vem inteiro, a pergunta vai sem ferramentas e sem a conversa, e o sim envia 1", async () => {
    const c = await comResumo();
    const r = roteiro(diz("Tem, sim: 1 vaga de garagem."), diz("NÃO"), diz("NÃO"));
    const f = comFerramentas(r);
    const t2 = await c.turno("tem estacionamento?", f.modelo);
    expect(r.recebidas).toHaveLength(2);
    const [sistema, pergunta] = r.recebidas[1]!;
    expect(sistema!.content).toContain("Responda só SIM ou NÃO");
    expect(pergunta!.content).toContain('"""tem estacionamento?"""');
    expect(pergunta!.content).toContain("2 hóspede(s); nome Ana Lima; telefone (11) 98888-0000");
    expect(r.recebidas[1]).toHaveLength(2);
    expect(f.ferramentas[1]).toEqual([]);
    expect(t2.reply).toContain("O seu pedido de reserva ainda aguarda a sua confirmação");
    await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.hospedes)).toEqual([2]);
  });

  it("(b) SIM: sem rearme, e o sim seguinte com confirmar_reserva não envia nada", async () => {
    const c = await comResumo();
    const r = roteiro(diz(AFIRMA), diz("SIM"));
    const t2 = await c.turno("vou levar minha sogra tem estacionamento?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(r.recebidas[1]![0]!.content).toContain("Responda só SIM ou NÃO");
    expect(t2.reply).toBe(AFIRMA);
    expect(c.estado().pendente).toBeNull();
    const sim = await c.turno("sim", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Quantas pessoas vão ao todo?")).modelo);
    expect(c.mundo.leads).toEqual([]);
    expect(sim.reply).not.toMatch(/registrad/);
  });

  it.each([
    ["resposta inesperada", diz("NÃO, mas a sogra muda o número")],
    ["texto solto", diz("Talvez.")],
    ["vazio", diz("")],
    ["erro do modelo", new Error("fora do ar")],
  ])("(c) %s: igual ao SIM, sem rearme e sem envio", async (_nome, resposta) => {
    const c = await comResumo();
    // Mensagem sem dado mudado que a F leia: o caminho é o da pergunta fechada (chamada 2).
    const r = roteiro(diz("There is 1 parking spot."), resposta);
    const t2 = await c.turno("Is there parking?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(r.recebidas[1]![0]!.content).toContain("Responda só SIM ou NÃO");
    expect(t2.reply).toBe("There is 1 parking spot.");
    expect(c.estado().pendente).toBeNull();
    await c.turno("yes", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("How many guests in total?")).modelo);
    expect(c.mundo.leads).toEqual([]);
  });

  it("dado que a F lê como mudado (\"bring my mom\"): sem pergunta fechada, a conferência pede o resumo novo, e o sim envia o grupo novo", async () => {
    const c = await comResumo();
    const r = roteiro(diz("There is 1 parking spot."), pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA, hospedes: 3 })));
    await c.turno("I'll bring my mom, is there parking?", r.modelo);
    expect(r.recebidas.some((m) => m[0]!.content.includes("Responda só SIM ou NÃO"))).toBe(false);
    expect(r.recebidas[1]!.at(-1)!.content).toContain("deixou de valer");
    expect(c.estado().pendente?.reserva.hospedes).toBe(3);
    await c.turno("yes", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(c.mundo.leads.map((l) => l.hospedes)).toEqual([3]);
  });

  it("dado que a F lê como mudado, e o modelo só reescreve o texto: o resumo cai e o sim não envia nada", async () => {
    const c = await comResumo();
    const r = roteiro(diz("There is 1 parking spot."), diz("There is 1 parking spot, and your mom counts as a guest."));
    const t2 = await c.turno("I'll bring my mom, is there parking?", r.modelo);
    expect(t2.reply).toBe("There is 1 parking spot, and your mom counts as a guest.");
    expect(c.estado().pendente).toBeNull();
    await c.turno("yes", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("How many guests in total?")).modelo);
    expect(c.mundo.leads).toEqual([]);
  });

  it("(c) \"NÃO\" junto com chamada de ferramenta na pergunta fechada: o resumo cai e o sim seguinte não envia (P07)", async () => {
    const c = await comResumo();
    const r = roteiro(diz("There is 1 parking spot."), { ...pedeFerramentas(chamar("confirmar_reserva")), texto: "NÃO" });
    const t2 = await c.turno("Is there parking?", r.modelo);
    expect(r.recebidas).toHaveLength(2);
    expect(r.recebidas[1]![0]!.content).toContain("Responda só SIM ou NÃO");
    expect(t2.reply).toBe("There is 1 parking spot.");
    expect(c.estado().pendente).toBeNull();
    await c.turno("yes", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("How many guests in total?")).modelo);
    expect(c.mundo.leads).toEqual([]);
  });

  it("(e) com conferência e correção no turno, a pergunta fechada sai uma vez só", async () => {
    const c = await comResumo();
    const errado = diz("Tem wifi. Pronto, seu pedido foi registrado!");
    const r = roteiro(errado, errado, diz("NÃO"), diz("NÃO"));
    await c.turno("tem wifi?", r.modelo);
    expect(r.recebidas).toHaveLength(3);
    expect(r.recebidas.filter((m) => m[0]!.content.includes("Responda só SIM ou NÃO"))).toHaveLength(1);
  });
});
