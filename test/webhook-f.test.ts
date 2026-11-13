// Falhas do webhook vistas pelo hóspede (contrato L11, CA-11, CA-17, CA-19). O webhook
// daqui responde como o falso de `falso/` em cada modo: 500, 422 com
// `{ erros: [{ campo, erro }] }` e atraso (a resposta não chega antes do tempo).
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { chaveDaReserva, type Cofre, type CorpoDoLead, ESTADO_INICIAL, type EstadoLead, postarLead } from "../src/lead";
import { criarContexto, criarMundo, URL_LEADS } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
type Modo = "ok" | "500" | "422" | "atraso";

/** Sessão com um webhook que segue a lista de modos, um por POST (o último vale para os seguintes). */
function sessao(modos: Modo[], envio: Partial<Contexto["envio"]> = {}) {
  const mundo = criarMundo();
  const recebidos: CorpoDoLead[] = [];
  const guardados: CorpoDoLead[] = [];
  const buscar = (async (_url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body)) as CorpoDoLead;
    const modo = modos[Math.min(recebidos.length, modos.length - 1)];
    recebidos.push(corpo);
    if (modo === "500") return Response.json({ erro: "falha simulada" }, { status: 500 });
    if (modo === "422") return Response.json({ erros: [{ campo: "telefone", erro: "invalido" }] }, { status: 422 });
    guardados.push(corpo);
    if (modo === "atraso") {
      // O falso guarda o lead e só depois espera: quem desiste não sabe se entrou.
      return new Promise<Response>((_, rejeitar) => init.signal!.addEventListener("abort", () => rejeitar(new Error("abortado"))));
    }
    return Response.json({ ok: true }, { status: 201 });
  }) as unknown as typeof fetch;

  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const contexto = (turno: number, mensagem: string): Contexto => ({
    ...criarContexto(mundo, cofre, turno, mensagem),
    envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(buscar, URL_LEADS, corpo, 40), ...envio },
  });
  return {
    recebidos,
    guardados,
    estado: () => estado,
    resumo: (turno: number, dados: Record<string, unknown> = DADOS) => montarResumo.executar(dados, contexto(turno, "quero fechar")),
    sim: (turno: number) => confirmarReserva.executar({}, contexto(turno, "Sim, confirmo.")),
  };
}

describe("falhas do webhook na conversa", () => {
  it("201: registrado, sem handoff", async () => {
    const s = sessao(["ok"]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(r.handoff).toBeUndefined();
    expect(s.guardados).toHaveLength(1);
  });

  it("500 persistente: uma nova tentativa, não diz registrado, handoff true", async () => {
    const s = sessao(["500"]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(s.recebidos).toHaveLength(2);
    expect(s.guardados).toEqual([]);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(/Não consegui registrar/);
    expect(r.respostaFinal).not.toMatch(/foi registrado|já está registrado/);
  });

  it("500 e depois sucesso: registrado na nova tentativa, 1 lead guardado", async () => {
    const s = sessao(["500", "ok"]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(r.handoff).toBeUndefined();
    expect(s.recebidos).toHaveLength(2);
    expect(s.guardados).toHaveLength(1);
  });

  it("depois de um 500 persistente a reserva não fica bloqueada: novo resumo e novo sim enviam", async () => {
    const s = sessao(["500", "500", "ok"]);
    await s.resumo(2);
    await s.sim(3);
    const resumo = await s.resumo(4);
    expect(resumo.respostaFinal).toContain("R$ 2.156,00");
    const r = await s.sim(5);
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(s.guardados).toHaveLength(1);
  });

  it("422 que aponta o telefone: pede a correção sem handoff; o resumo corrigido é enviado", async () => {
    const s = sessao(["422", "ok"]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(s.recebidos).toHaveLength(1);
    expect(r.handoff).toBeUndefined();
    expect(r.respostaFinal).toMatch(/Não consegui registrar/);
    expect(r.respostaFinal).toMatch(/telefone/);
    expect(r.respostaFinal).not.toMatch(/foi registrado/);
    // Sem novo resumo, outro sim não envia nada.
    await s.sim(4);
    expect(s.recebidos).toHaveLength(1);
    await s.resumo(5, { ...DADOS, telefone: "(11) 97777-0000" });
    const ok = await s.sim(6);
    expect(ok.respostaFinal).toMatch(/registrado/);
    expect(s.guardados).toMatchObject([{ telefone: "(11) 97777-0000" }]);
  });

  it("segundo 422 na sessão, mesmo com o dado corrigido: não pede correção de novo, handoff true", async () => {
    const s = sessao(["422"]);
    await s.resumo(2);
    expect((await s.sim(3)).handoff).toBeUndefined();
    await s.resumo(4, { ...DADOS, telefone: "(11) 97777-0000" });
    const r = await s.sim(5);
    expect(s.recebidos).toHaveLength(2);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(/Não consegui registrar/);
    expect(r.respostaFinal).not.toMatch(/Pode me informar de novo/);
    // O mesmo dado recusado de novo também passa para humano.
    await s.resumo(6);
    expect((await s.sim(7)).handoff).toBe(true);
    expect(s.guardados).toEqual([]);
  });

  it("422 da mesma reserva duas vezes: a segunda passa para humano e a reserva não é enviada de novo (A3)", async () => {
    const s = sessao(["422"]);
    await s.resumo(2);
    expect((await s.sim(3)).handoff).toBeUndefined();
    // O hóspede não corrige nada e o resumo é refeito com os mesmos dados.
    await s.resumo(4);
    const segunda = await s.sim(5);
    expect(segunda.handoff).toBe(true);
    expect(segunda.respostaFinal).toMatch(/Não consegui registrar/);
    expect(s.recebidos).toHaveLength(2);
    // Terceira rodada: nem resumo nem POST.
    const resumo = await s.resumo(6);
    expect(resumo.handoff).toBe(true);
    expect(resumo.respostaFinal).toMatch(/Não consegui registrar/);
    await s.sim(7);
    expect(s.recebidos).toHaveLength(2);
    expect(s.guardados).toEqual([]);
  });

  it("atraso (resposta não chega): sem nova tentativa, não diz registrado, handoff true, e a reserva não é reenviada (CA-19)", async () => {
    const s = sessao(["atraso", "ok"]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(s.recebidos).toHaveLength(1);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(/Não consegui confirmar o registro/);
    expect(r.respostaFinal).not.toMatch(/foi registrado|já está registrado/);
    expect(s.estado().envios[chaveDaReserva(s.estado().pendente!.reserva)]).toBe("incerto");
    // Outro sim e um novo resumo da mesma reserva: nenhum POST a mais, e de novo handoff.
    expect((await s.sim(4)).handoff).toBe(true);
    const resumo = await s.resumo(5);
    expect(resumo.handoff).toBe(true);
    expect(resumo.respostaFinal).toMatch(/Não consegui confirmar o registro/);
    await s.sim(6);
    expect(s.recebidos).toHaveLength(1);
  });

  it("resultado incerto de uma reserva não impede outra reserva na mesma sessão", async () => {
    const s = sessao(["atraso", "ok"]);
    await s.resumo(2);
    await s.sim(3);
    await s.resumo(4, { ...DADOS, checkout: "17/01/2027" });
    const r = await s.sim(5);
    expect(r.respostaFinal).toMatch(/registrado/);
    expect(s.recebidos).toHaveLength(2);
  });

  it("envio desligado: nenhum POST, não diz registrado, handoff true (CA-17)", async () => {
    const s = sessao(["ok"], { ligado: false });
    await s.resumo(2);
    const r = await s.sim(3);
    expect(s.recebidos).toEqual([]);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(/Não consegui registrar/);
    expect(r.respostaFinal).not.toMatch(/foi registrado/);
  });
});
