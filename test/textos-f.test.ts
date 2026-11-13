// Idioma dos textos fixos (L15): resumo, pedido de confirmação, resultado da confirmação
// e aviso de falha saem do código em português ou em inglês, pelo idioma do hóspede.
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, LeadRecusado } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "+14155550123" };
// Palavras em português que um texto em inglês não pode trazer.
const PORTUGUES = /\b(h[oó]spedes|di[aá]ria|estadia|resumo|pedido|registrad[oa]|encaminhad[oa]|confirmad[oa]|im[oó]vel|entrada|sa[ií]da|noites?|telefone|sim)\b/i;

function sessao(envio: Partial<Contexto["envio"]> = {}, statusDoWebhook = 201) {
  const mundo = criarMundo({ statusDoWebhook });
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const contexto = (turno: number, mensagem: string, historico?: { role: string; content: string }[]): Contexto => {
    const base = criarContexto(mundo, cofre, turno, mensagem);
    return { ...base, envio: { ...base.envio, ...envio }, ...(historico ? { historico } : {}) };
  };
  return {
    mundo,
    resumo: (turno: number, mensagem: string, dados: Record<string, unknown> = DADOS, historico?: { role: string; content: string }[]) =>
      montarResumo.executar(dados, contexto(turno, mensagem, historico)),
    confirma: (turno: number, mensagem: string, historico?: { role: string; content: string }[]) =>
      confirmarReserva.executar({}, contexto(turno, mensagem, historico)),
  };
}

const QUER_FECHAR = "Great, I want to book it. My name is Ana Lima and my phone is +14155550123.";

describe("textos fixos em inglês (L15)", () => {
  it("resumo em inglês: datas por extenso com dia da semana, total no formato do código, nada em português", async () => {
    const s = sessao();
    const r = await s.resumo(2, QUER_FECHAR);
    expect(r.respostaFinal).toBe([
      "Summary of your booking request:",
      "- Property: Chale Serra Gramado (GRM-301)",
      "- Check-in: Friday, January 15, 2027",
      "- Check-out: Monday, January 18, 2027 (3 nights)",
      "- Guests: 2",
      "- Name: Ana Lima",
      "- Phone: +14155550123",
      "- Total: R$ 2.156,00",
      "",
      "Is everything correct? To confirm, reply \"yes\" and I will send your request to our sales team.",
    ].join("\n"));
    expect(r.respostaFinal).not.toMatch(PORTUGUES);
  });

  it("confirmação em inglês: registra 1 lead e responde em inglês", async () => {
    const s = sessao();
    await s.resumo(2, QUER_FECHAR);
    const r = await s.confirma(3, "Yes, I confirm.");
    expect(s.mundo.leads).toHaveLength(1);
    expect(r.respostaFinal).toMatch(/has been registered and sent to our sales team, for a total of R\$ 2\.156,00/);
    expect(r.respostaFinal).toMatch(/does not guarantee the booking/);
    expect(r.respostaFinal).not.toMatch(PORTUGUES);
    const repetido = await s.confirma(4, "Yes, I confirm.");
    expect(repetido.respostaFinal).toMatch(/GRM-301, Friday, January 15, 2027 to Monday, January 18, 2027\) is already registered/);
    expect(repetido.respostaFinal).not.toMatch(PORTUGUES);
    expect(s.mundo.leads).toHaveLength(1);
  });

  it("hesitação, condição de preço e sim fora de hora em inglês", async () => {
    const s = sessao();
    await s.resumo(2, QUER_FECHAR);
    const hesitou = await s.confirma(3, "I think so, maybe");
    expect(hesitou.respostaFinal).toBe("I have not sent anything yet. Is everything correct? To confirm, reply \"yes\" and I will send your request to our sales team.");
    const preco = await s.confirma(4, "Yes, if you give me a discount");
    expect(preco.handoff).toBe(true);
    expect(preco.respostaFinal).toMatch(/I cannot change prices or negotiate/);
    const foraDeHora = await s.confirma(6, "Yes, I confirm.");
    expect(foraDeHora.respostaFinal).toMatch(/^I have not sent anything yet\. To avoid any mistake, please check the request once more\.\n\nSummary of your booking request:/);
    expect(s.mundo.leads).toEqual([]);
    for (const r of [hesitou, preco, foraDeHora]) expect(r.respostaFinal).not.toMatch(PORTUGUES);
  });

  it("avisos de falha em inglês: não registrado, incerto e dado recusado", async () => {
    const falhou = sessao({}, 500);
    await falhou.resumo(2, QUER_FECHAR);
    const r500 = await falhou.confirma(3, "Yes, I confirm.");
    expect(r500).toMatchObject({ handoff: true, respostaFinal: expect.stringMatching(/^I could not register your booking request\./) });

    const incerto = sessao({ postar: async () => { throw new Error("tempo esgotado"); } });
    await incerto.resumo(2, QUER_FECHAR);
    const rIncerto = await incerto.confirma(3, "Yes, I confirm.");
    expect(rIncerto).toMatchObject({ handoff: true, respostaFinal: expect.stringMatching(/^I could not confirm whether your booking request was registered\./) });

    const recusado = sessao({ postar: async () => { throw new LeadRecusado(["telefone", "checkin"]); } });
    await recusado.resumo(2, QUER_FECHAR);
    const r422 = await recusado.confirma(3, "Yes, I confirm.");
    expect(r422.handoff).toBeUndefined();
    expect(r422.respostaFinal).toMatch(/did not accept the phone number, the check-in date\. Could you send it again\?/);
    for (const r of [r500, rIncerto, r422]) expect(r.respostaFinal).not.toMatch(PORTUGUES);
  });

  it("só o primeiro nome, em inglês", async () => {
    const s = sessao();
    const r = await s.resumo(2, QUER_FECHAR, { ...DADOS, nome: "Ana" });
    expect(r.respostaFinal).toContain("- Name: Ana (if you can, please tell me your last name too)");
  });

  it("uma noite só: singular nos dois idiomas", async () => {
    const dados = { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "21/01/2027", hospedes: 1 };
    expect((await sessao().resumo(2, QUER_FECHAR, dados)).respostaFinal).toContain("(1 night)");
    expect((await sessao().resumo(2, "quero fechar", dados)).respostaFinal).toContain("(1 noite)");
  });
});

describe("escolha do idioma", () => {
  it("português continua português", async () => {
    const s = sessao();
    const r = await s.resumo(2, "Quero fechar. Sou Ana Lima, telefone +14155550123.");
    expect(r.respostaFinal).toMatch(/^Resumo do seu pedido de reserva:\n- Imóvel: Chale Serra Gramado \(GRM-301\)\n- Entrada: sexta-feira, 15\/01\/2027\n/);
    expect((await s.confirma(3, "Sim, confirmo.")).respostaFinal).toMatch(/^Pronto! Seu pedido de reserva foi registrado/);
  });

  it("outro idioma recebe o texto em português", async () => {
    const s = sessao();
    const r = await s.resumo(2, "Quiero reservar. Me llamo Ana Lima, mi teléfono es +14155550123.");
    expect(r.respostaFinal).toMatch(/^Resumo do seu pedido de reserva:/);
  });

  it("mensagem do turno sem idioma claro: vale o que o hóspede escreveu antes, quando o contexto traz o histórico", async () => {
    const historico = [
      { role: "user", content: "Hi! How much is GRM-301 from January 15, 2027 to January 18, 2027 for 2 guests?" },
      { role: "assistant", content: "Quanto custa? Para quantas pessoas?" },
    ];
    const s = sessao();
    expect((await s.resumo(2, "Ana Lima, +14155550123", DADOS, historico)).respostaFinal).toMatch(/^Summary of your booking request:/);
    expect((await s.confirma(3, "ok", historico)).respostaFinal).toMatch(/^All set!/);
    // Sem histórico no contexto, a mesma mensagem cai no português.
    expect((await sessao().resumo(2, "Ana Lima, +14155550123")).respostaFinal).toMatch(/^Resumo do seu pedido de reserva:/);
  });

  it("o texto do modelo no histórico não decide o idioma: só as mensagens do hóspede", async () => {
    const historico = [{ role: "assistant", content: "Hello! How can I help you with your booking today? What are the dates of your stay?" }];
    const r = await sessao().resumo(2, "Ana Lima, +14155550123", DADOS, historico);
    expect(r.respostaFinal).toMatch(/^Resumo do seu pedido de reserva:/);
  });
});
