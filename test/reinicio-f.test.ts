// POST perdido num reinício do Durable Object (C7 da quarta rodada do verificador): só sobra o marcador
// "enviando". Pela leitura (b) da P14, resultado incerto bloqueia a estadia: outro telefone não ganha resumo
// nem POST, e o hóspede lê "não consegui confirmar o registro", com handoff. Os dois primeiros testes são
// os do verificador, como estão.
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, postarLead } from "../src/lead";
import { criarContexto, criarMundo, URL_LEADS } from "./apoio";
import { queroFechar } from "./apoio-f";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

describe("C7 (MÉDIO, depende de reinício no meio do POST): o resultado incerto do reinício bloqueia a estadia (P14, dúvida b)", () => {
  // O Durable Object reinicia com o POST no ar: a requisição se perde e só fica o marcador "enviando", gravado antes
  // do POST. Contador e bloqueio da estadia só são gravados depois da resposta (`fechar`), então não existem.
  for (const [nome, respostas] of [["reinício no 1º POST", ["nunca"]], ["reinício no retry do 5xx", [500, "nunca"]]] as const) {
    it(`${nome}: a mesma estadia com outro telefone não ganha resumo nem POST`, async () => {
      const mundo = criarMundo();
      const posts: unknown[] = [];
      const buscar = (async (_u: string, init: RequestInit) => {
        const r = respostas[posts.length] ?? 500;
        posts.push(init.body);
        return r === "nunca" ? new Promise<Response>(() => {}) : Response.json({ erro: "x" }, { status: r });
      }) as unknown as typeof fetch;
      let estado: EstadoLead = ESTADO_INICIAL;
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      const ctx = (turno: number, mensagem: string): Contexto => ({
        ...criarContexto(mundo, cofre, turno, mensagem),
        envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(buscar, URL_LEADS, corpo, 60_000) },
      });
      await montarResumo.executar(DADOS, ctx(2, queroFechar(DADOS)));
      void confirmarReserva.executar({}, ctx(3, "sim")); // a requisição se perde no reinício
      for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 1));
      expect(Object.values(estado.envios)).toEqual(["enviando"]);
      const antes = posts.length;
      const r = await montarResumo.executar({ ...DADOS, telefone: "(11) 97777-0000" }, ctx(4, queroFechar(DADOS)));
      await confirmarReserva.executar({}, ctx(5, "sim"));
      expect(r.handoff).toBe(true);
      expect(r.respostaFinal).toMatch(/^Não consegui confirmar o registro/);
      expect(posts.length - antes).toBe(0);
    });
  }
});

describe("marcador \"enviando\" de estado antigo, sem contador nem bloqueio gravados", () => {
  it("outra reserva da mesma estadia (telefone, nome ou hóspedes diferentes) não ganha resumo nem POST; outra estadia segue", async () => {
    const mundo = criarMundo();
    let estado: EstadoLead = { ...ESTADO_INICIAL, envios: { "GRM-301|2027-01-15|2027-01-18|2|11988880000": "enviando" } };
    const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
    const ctx = (turno: number) => criarContexto(mundo, cofre, turno, queroFechar({ nome: "Ana Lima Souza" }));
    let turno = 2;
    for (const d of [{ ...DADOS, telefone: "(11) 97777-0000" }, { ...DADOS, nome: "Ana Lima Souza" }, { ...DADOS, hospedes: 3 }]) {
      const r = await montarResumo.executar(d, ctx(turno++));
      expect(r.handoff).toBe(true);
      expect(r.respostaFinal).toMatch(/^Não consegui confirmar o registro/);
      await confirmarReserva.executar({}, criarContexto(mundo, cofre, turno++, "sim"));
    }
    expect(mundo.leads).toEqual([]);
    await montarResumo.executar({ ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 }, ctx(turno++));
    expect((await confirmarReserva.executar({}, criarContexto(mundo, cofre, turno++, "sim"))).respostaFinal).toMatch(/registrado/);
    expect(mundo.leads).toHaveLength(1);
  });
});
