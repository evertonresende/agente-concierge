// Bloqueio da estadia lido dos marcadores ("enviando", "incerto"): casos FELIZ e ANTIGO da sonda do C7 da
// quinta rodada do verificador, com as mesmas conferências e sem as linhas de registro da sonda. O fluxo feliz
// não pode ganhar bloqueio (defeito plantado X06: marcador "registrado" bloqueando a estadia), e o estado
// antigo com "incerto" tem de bloquear (X03: marcador sem "incerto").
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, type CorpoDoLead, ESTADO_INICIAL, type EstadoLead, postarLead, type SituacaoEnvio } from "../src/lead";
import { criarContexto, criarMundo, URL_LEADS } from "./apoio";
import { queroFechar } from "./apoio-f";

const A = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const B = { imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const A_OUTRAS_DATAS = { ...A, checkin: "20/01/2027", checkout: "23/01/2027" };
const TROCAS: [string, Record<string, unknown>][] = [
  ["telefone", { ...A, telefone: "(11) 97777-0000" }],
  ["nome", { ...A, nome: "Ana Lima Souza" }],
  ["hospedes", { ...A, hospedes: 3 }],
  ["tudo", { ...A, nome: "Bia Reis", telefone: "(21) 96666-0000", hospedes: 1 }],
  ["original", A],
];
type Passo = number | "422tel" | "tempo";

function sessao(roteiro: Passo[], json = false) {
  const mundo = criarMundo();
  let guardado: EstadoLead | string = json ? JSON.stringify(ESTADO_INICIAL) : ESTADO_INICIAL;
  const ler = (): EstadoLead => (typeof guardado === "string" ? JSON.parse(guardado) as EstadoLead : guardado);
  const posts: CorpoDoLead[] = [];
  const buscar = (async (_u: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body)) as CorpoDoLead;
    const passo = roteiro[Math.min(posts.length, roteiro.length - 1)]!;
    posts.push(corpo);
    if (passo === "tempo") return new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("abortado"))));
    if (passo === "422tel") return Response.json({ erros: [{ campo: "telefone", erro: "invalido" }] }, { status: 422 });
    return Response.json({ ok: passo === 201 }, { status: passo });
  }) as unknown as typeof fetch;
  // Um cofre por turno, como em src/sessao.ts: depois do turno encerrado, gravar lança.
  const cofreDoTurno = (): [Cofre, { aberto: boolean }] => {
    const flag = { aberto: true };
    return [{
      ler,
      salvar: (e) => {
        if (!flag.aberto) throw new Error("turno encerrado");
        guardado = json ? JSON.stringify(e) : e;
      },
    }, flag];
  };
  const ctx = (cofre: Cofre, turno: number, mensagem: string): Contexto => ({
    ...criarContexto(mundo, cofre, turno, mensagem),
    envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(buscar, URL_LEADS, corpo, 30) },
  });
  let turno = 1;
  const s = {
    posts,
    async resumo(d: Record<string, unknown>) {
      const [c, f] = cofreDoTurno();
      const r = await montarResumo.executar(d, ctx(c, ++turno, queroFechar(d)));
      f.aberto = false;
      return r;
    },
    async sim(mensagem = "sim") {
      const [c, f] = cofreDoTurno();
      const r = await confirmarReserva.executar({}, ctx(c, ++turno, mensagem));
      f.aberto = false;
      return r;
    },
    async tentar(d: Record<string, unknown>) {
      const resumo = await s.resumo(d);
      const sim = await s.sim();
      return { resumo, sim };
    },
  };
  return s;
}

describe("C7, bloqueio a mais: o fluxo feliz não muda", () => {
  for (const json of [false, true]) {
    const cofre = json ? "json" : "memoria";
    it(`${cofre}: 201, segundo sim sem POST, a mesma estadia com outro telefone registra`, async () => {
      const s = sessao([201], json);
      const r = await s.tentar(A);
      expect.soft(r.sim.respostaFinal).toMatch(/registrado/);
      const segundo = await s.sim();
      expect.soft(s.posts.length).toBe(1);
      expect.soft(segundo.respostaFinal ?? "").toMatch(/já está registrado/);
      const deNovo = await s.resumo(A);
      expect.soft(deNovo.respostaFinal ?? "").toMatch(/já está registrado/);
      const outro = await s.tentar({ ...A, telefone: "(11) 97777-0000" });
      expect.soft(outro.resumo.respostaFinal ?? "").toMatch(/^Resumo do seu pedido/);
      expect.soft(outro.sim.respostaFinal ?? "").toMatch(/registrado/);
      expect.soft(s.posts.length).toBe(2);
    });
    it(`${cofre}: 500 e depois 201 registra; outra reserva da estadia ainda tem resumo`, async () => {
      const s = sessao([500, 201], json);
      const r = await s.tentar(A);
      expect.soft(r.sim.respostaFinal).toMatch(/registrado/);
      expect.soft(s.posts.length).toBe(2);
      const outro = await s.resumo({ ...A, hospedes: 3 });
      expect.soft(outro.respostaFinal ?? "").toMatch(/^Resumo do seu pedido/);
    });
    it(`${cofre}: 422 no telefone, correção e 201 registra`, async () => {
      const s = sessao(["422tel", 201], json);
      const r = await s.tentar(A);
      expect.soft(r.sim.handoff ?? false).toBe(false);
      const c = await s.tentar({ ...A, telefone: "(11) 97777-0000" });
      expect.soft(c.resumo.respostaFinal ?? "").toMatch(/^Resumo do seu pedido/);
      expect.soft(c.sim.respostaFinal ?? "").toMatch(/registrado/);
      expect.soft(s.posts.length).toBe(2);
    });
    it(`${cofre}: outra estadia antes, depois de um bloqueio por recusa e depois de um incerto`, async () => {
      const s = sessao([201, 500, 500, 201, "tempo", 201], json);
      const b = await s.tentar(B); // 201
      const a = await s.tentar(A); // 500 + 500: bloqueia A
      const a2 = await s.tentar(A_OUTRAS_DATAS); // 201: outras datas, mesmo imóvel
      const c = await s.tentar({ ...B, checkin: "01/02/2027", checkout: "03/02/2027" }); // tempo: incerto
      const d = await s.tentar({ ...B, checkin: "10/02/2027", checkout: "12/02/2027" }); // 201
      const aBloq = await s.tentar({ ...A, telefone: "(11) 97777-0000" });
      expect.soft(b.sim.respostaFinal).toMatch(/registrado/);
      expect.soft(a.sim.handoff).toBe(true);
      expect.soft(a2.sim.respostaFinal).toMatch(/registrado/);
      expect.soft(c.sim.respostaFinal).toMatch(/^Não consegui confirmar/);
      expect.soft(d.sim.respostaFinal).toMatch(/registrado/);
      expect.soft(aBloq.resumo.handoff).toBe(true);
      expect.soft(s.posts.length).toBe(6);
    });
  }
  it("estado com marcadores antigos já resolvidos (registrado, nao_registrado) não bloqueia a estadia", async () => {
    const antigos: Record<string, SituacaoEnvio>[] = [
      { "GRM-301|2027-01-15|2027-01-18|2|11988880000": "registrado" },
      { "GRM-301|2027-01-15|2027-01-18|2|11988880000": "nao_registrado" },
      { "GRM-301|2027-01-15|2027-01-18|2|11988880000": "registrado", "GRM-301|2027-01-15|2027-01-18|3|11988880000": "nao_registrado" },
    ];
    for (const envios of antigos) {
      const mundo = criarMundo();
      let estado: EstadoLead = { ...ESTADO_INICIAL, envios: { ...envios } };
      const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
      const r = await montarResumo.executar({ ...A, telefone: "(11) 97777-0000" }, criarContexto(mundo, cofre, 2, queroFechar(A)));
      const sim = await confirmarReserva.executar({}, criarContexto(mundo, cofre, 3, "sim"));
      expect.soft(r.respostaFinal ?? "").toMatch(/^Resumo do seu pedido/);
      expect.soft(sim.respostaFinal ?? "").toMatch(/registrado/);
    }
  });
});

describe("C7, estado antigo sem os campos novos", () => {
  it("estado antigo sem os campos novos: enviando, incerto, recusado", async () => {
    // "recusado" e "nao_registrado" de estado antigo passam pelo mesmo roteiro, sem conferência: o C7 só
    // prometeu "enviando" e "incerto" (sessões de dev abertas antes do teto por estadia).
    for (const situacao of ["enviando", "incerto", "recusado", "nao_registrado"] as const) {
      const bloqueia = situacao === "enviando" || situacao === "incerto";
      const mundo = criarMundo();
      let guardado = JSON.stringify({ pendente: null, envios: { "GRM-301|2027-01-15|2027-01-18|2|11988880000": situacao } });
      const cofre: Cofre = { ler: () => JSON.parse(guardado) as EstadoLead, salvar: (e) => { guardado = JSON.stringify(e); } };
      let turno = 2;
      for (const [troca, d] of TROCAS) {
        const r = await montarResumo.executar(d, criarContexto(mundo, cofre, turno++, queroFechar(d)));
        await confirmarReserva.executar({}, criarContexto(mundo, cofre, turno++, "sim"));
        if (bloqueia) {
          expect.soft(r.handoff, `${situacao} ${troca}`).toBe(true);
          expect.soft(r.respostaFinal ?? "", `${situacao} ${troca}`).toMatch(/^Não consegui confirmar o registro/);
        }
      }
      if (bloqueia) expect.soft(mundo.leads.length).toBe(0);
    }
  });
});
