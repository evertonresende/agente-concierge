// Segunda reserva e repetição na mesma sessão (L7); mudança depois do resumo e último
// resumo mostrado (L10).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

function sessao() {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  return {
    mundo,
    resumo: (turno: number, dados: Record<string, unknown> = DADOS) => montarResumo.executar(dados, criarContexto(mundo, cofre, turno, "quero fechar")),
    sim: (turno: number, mensagem = "sim") => confirmarReserva.executar({}, criarContexto(mundo, cofre, turno, mensagem)),
  };
}

describe("segunda reserva e repetição (L7)", () => {
  it("hesitação na segunda reserva não diz que nada foi enviado: a primeira já foi", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3, "Sim, confirmo.");
    await s.resumo(4, { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 });
    const r = await s.sim(5, "acho que sim");
    expect(r.respostaFinal).toMatch(/^Ainda não enviei este pedido\./);
    expect(r.respostaFinal).not.toMatch(/nada|nenhum/);
    expect(s.mundo.leads).toHaveLength(1);
  });

  it("outra reserva na mesma sessão: novo resumo, nova confirmação, 2 leads", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3, "Sim, confirmo.");
    const segunda = await s.resumo(4, { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 });
    expect(segunda.respostaFinal).toContain("Studio Copacabana (RIO-402)");
    expect(s.mundo.leads).toHaveLength(1);
    const r = await s.sim(5, "Sim, confirmo.");
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(s.mundo.leads).toMatchObject([
      { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2 },
      { imovel_id: "RIO-402", checkin: "2027-01-20", checkout: "2027-01-22", hospedes: 1 },
    ]);
  });

  it("mesmo imóvel e telefone com outras datas é outra reserva", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3);
    await s.resumo(4, { ...DADOS, checkin: "22/01/2027", checkout: "25/01/2027" });
    await s.sim(5);
    expect(s.mundo.leads).toHaveLength(2);
  });

  it("sim repetido logo depois do registro: diz que já está registrado e não envia de novo, quantas vezes for", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3, "Sim, confirmo.");
    for (const turno of [4, 5, 6]) {
      const r = await s.sim(turno, "Sim, confirmo de novo!");
      expect(r.respostaFinal).toMatch(/já está registrado/);
      expect(r.respostaFinal).toMatch(/Não enviei de novo/);
      expect(r.handoff).toBeUndefined();
    }
    expect(s.mundo.leads).toHaveLength(1);
  });

  it("pedir de novo o resumo da reserva já registrada: já registrado, sem novo resumo nem novo lead", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3);
    const r = await s.resumo(4);
    expect(r.respostaFinal).toMatch(/já está registrado/);
    expect(r.respostaFinal).not.toContain("Resumo do seu pedido");
    await s.sim(5);
    expect(s.mundo.leads).toHaveLength(1);
  });

  it("mudar só o nome não faz da reserva registrada uma nova", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3);
    expect((await s.resumo(4, { ...DADOS, nome: "Ana Maria Lima" })).respostaFinal).toMatch(/já está registrado/);
    await s.sim(5);
    expect(s.mundo.leads).toHaveLength(1);
  });

  it("sim depois de outra conversa, com o último resumo já registrado: nada é enviado e o modelo decide com a instrução", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.sim(3);
    // Turno 4: o hóspede cotou outra estadia, sem resumo. O sim do turno 5 pode ser para ela.
    const r = await s.sim(5, "Sim, confirmo.");
    expect(r.respostaFinal).toBeUndefined();
    expect(JSON.stringify(r.paraOModelo)).toMatch(/nada foi enviado agora.*montar_resumo/);
    expect(s.mundo.leads).toHaveLength(1);
  });
});

describe("mudança depois do resumo (L10)", () => {
  it("vale o último resumo mostrado: o sim envia os dados novos, com o total novo", async () => {
    const s = sessao();
    await s.resumo(2);
    const novo = await s.resumo(3, { ...DADOS, checkout: "17/01/2027", hospedes: 3 });
    expect(novo.respostaFinal).toContain("R$ 1.566,00");
    await s.sim(4);
    expect(s.mundo.leads).toEqual([{
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-17", hospedes: 3, valor_total: 1566,
    }]);
  });

  it("o sim ao resumo antigo não vale para o novo no mesmo turno", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.resumo(3, { ...DADOS, checkout: "17/01/2027" });
    await s.sim(3);
    expect(s.mundo.leads).toEqual([]);
  });

  it("mudança só de nome ou só de telefone também troca o resumo", async () => {
    const s = sessao();
    await s.resumo(2);
    await s.resumo(3, { ...DADOS, nome: "Ana Maria Lima", telefone: "(21) 97777-0000" });
    await s.sim(4);
    expect(s.mundo.leads).toMatchObject([{ nome: "Ana Maria Lima", telefone: "(21) 97777-0000" }]);
  });

  it("resumo novo que não sai (estadia recusada) derruba o anterior", async () => {
    const s = sessao();
    await s.resumo(2);
    const recusado = await s.resumo(3, { ...DADOS, hospedes: 9 });
    expect(recusado.recusa).toBe(true);
    await s.sim(4);
    expect(s.mundo.leads).toEqual([]);
  });
});
