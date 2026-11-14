// Teto de envios por estadia (P14, decisão 2 da terceira rodada do verificador: C3 e C4). No máximo 2
// POSTs sem 201 para a mesma estadia (imóvel + entrada + saída) na sessão; a segunda falha, de qualquer
// tipo, passa para humano e bloqueia a estadia, mesmo com outro nome, telefone ou número de hóspedes.
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, type CorpoDoLead, ESTADO_INICIAL, type EstadoLead, postarLead } from "../src/lead";
import { criarContexto, criarMundo, URL_LEADS } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const OUTRA = { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 };
type Passo = number | "422tel" | "422nome";

function sessao(passos: Passo[]) {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const posts: CorpoDoLead[] = [];
  const buscar = (async (_url: string, init: RequestInit) => {
    const passo = passos[Math.min(posts.length, passos.length - 1)];
    posts.push(JSON.parse(String(init.body)) as CorpoDoLead);
    if (passo === "422tel") return Response.json({ erros: [{ campo: "telefone", erro: "invalido" }] }, { status: 422 });
    if (passo === "422nome") return Response.json({ erros: [{ campo: "nome", erro: "invalido" }] }, { status: 422 });
    return Response.json({ ok: passo === 201 }, { status: passo });
  }) as unknown as typeof fetch;
  const ctx = (turno: number, mensagem: string): Contexto => ({
    ...criarContexto(mundo, cofre, turno, mensagem),
    envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(buscar, URL_LEADS, corpo, 30) },
  });
  return {
    posts,
    resumo: (t: number, d: Record<string, unknown> = DADOS) => montarResumo.executar(d, ctx(t, "quero fechar")),
    sim: (t: number) => confirmarReserva.executar({}, ctx(t, "sim")),
  };
}
const BLOQUEIO = /^Não consegui registrar o seu pedido de reserva\. Vou passar a conversa/;

describe("teto de 2 POSTs sem 201 por estadia (P14)", () => {
  it("(a) 422 no telefone, correção, 422 de novo; voltar ao telefone original ou dar um terceiro: 0 POST novo, bloqueio com handoff", async () => {
    const s = sessao(["422tel", "422tel", 201]);
    await s.resumo(2);
    const r1 = await s.sim(3);
    expect(r1.handoff).toBeUndefined();
    expect(r1.respostaFinal).toMatch(/não aceitou o telefone/);
    await s.resumo(4, { ...DADOS, telefone: "(11) 97777-0000" });
    const r2 = await s.sim(5);
    expect(r2.handoff).toBe(true);
    expect(r2.respostaFinal).toMatch(BLOQUEIO);
    for (const telefone of ["(11) 98888-0000", "(21) 96666-0000"]) {
      const r = await s.resumo(6, { ...DADOS, telefone });
      expect(r.handoff).toBe(true);
      expect(r.respostaFinal).toMatch(BLOQUEIO);
      await s.sim(7);
    }
    expect(s.posts).toHaveLength(2);
  });

  it("(c) 422 com campo, correção, envio corrigido com 5xx: sem nova tentativa, 2 POSTs, handoff, bloqueada", async () => {
    const s = sessao(["422nome", 500, 500, 201]);
    await s.resumo(2);
    expect((await s.sim(3)).respostaFinal).toMatch(/não aceitou o nome/);
    await s.resumo(4, { ...DADOS, nome: "Ana Lima Souza" });
    const r = await s.sim(5);
    expect(s.posts).toHaveLength(2);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(BLOQUEIO);
    const depois = await s.resumo(6, { ...DADOS, nome: "Ana Lima Souza", hospedes: 3 });
    expect(depois.handoff).toBe(true);
    await s.sim(7);
    expect(s.posts).toHaveLength(2);
  });

  it("(d) 5xx com nova tentativa que recebe 422 com campo: não pede correção, 2 POSTs, handoff, bloqueada", async () => {
    const s = sessao([500, "422nome", 500, 201]);
    await s.resumo(2);
    const r = await s.sim(3);
    expect(s.posts).toHaveLength(2);
    expect(r.handoff).toBe(true);
    expect(r.respostaFinal).toMatch(BLOQUEIO);
    expect(r.respostaFinal).not.toMatch(/Pode me informar de novo/);
    expect((await s.resumo(4, { ...DADOS, nome: "Ana Lima Souza" })).handoff).toBe(true);
    await s.sim(5);
    expect(s.posts).toHaveLength(2);
  });

  it("outra estadia segue normal depois do bloqueio", async () => {
    const s = sessao([500, 500, 201]);
    await s.resumo(2);
    await s.sim(3);
    await s.resumo(4, OUTRA);
    expect((await s.sim(5)).respostaFinal).toMatch(/registrado/);
    expect(s.posts).toHaveLength(3);
  });
});
