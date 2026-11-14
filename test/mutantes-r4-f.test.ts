// Defeitos plantados que escaparam na quarta rodada do verificador (C8): cada teste falha com o seu mutante
// (M03, M04, M05, M23, M24, M25, M26, M27 e M28).
import { describe, expect, it } from "vitest";
import type { Contexto } from "../src/agente/ferramentas";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, type CorpoDoLead, ESTADO_INICIAL, type EstadoLead, mudaDadoDoResumo, type Pendente, postarLead } from "../src/lead";
import { criarContexto, criarMundo, URL_LEADS } from "./apoio";
import { queroFechar } from "./apoio-f";

const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600, turno: 2,
};
const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const OUTRA = { ...DADOS, imovel_id: "RIO-402", checkin: "20/01/2027", checkout: "22/01/2027", hospedes: 1 };
type Passo = number | "422tel" | "tempo";

/** Webhook falso por imóvel: cada imóvel consome a sua lista de respostas (a última se repete). */
function sessao(respostas: Record<string, Passo[]>) {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const posts: CorpoDoLead[] = [];
  const buscar = (async (_u: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body)) as CorpoDoLead;
    const lista = respostas[corpo.imovel_id]!;
    const passo = lista[Math.min(posts.filter((p) => p.imovel_id === corpo.imovel_id).length, lista.length - 1)]!;
    posts.push(corpo);
    if (passo === "tempo") return new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("abortado"))));
    if (passo === "422tel") return Response.json({ erros: [{ campo: "telefone", erro: "invalido" }] }, { status: 422 });
    return Response.json({ ok: passo === 201 }, { status: passo });
  }) as unknown as typeof fetch;
  const ctx = (turno: number, mensagem: string): Contexto => ({
    ...criarContexto(mundo, cofre, turno, mensagem),
    envio: { ligado: true, destinoPermitido: true, postar: (corpo) => postarLead(buscar, URL_LEADS, corpo, 20) },
  });
  let turno = 1;
  return {
    posts: (imovel: string) => posts.filter((p) => p.imovel_id === imovel).length,
    async tentar(d: Record<string, unknown>) {
      const r = await montarResumo.executar(d, ctx(++turno, queroFechar(d)));
      const s = await confirmarReserva.executar({}, ctx(++turno, "sim"));
      return { resumo: r, sim: s };
    },
  };
}

describe("separadores ;, quebra de linha e ! entre a afirmação e a pergunta (M03, M04, M05)", () => {
  for (const m of ["vou levar minha sogra; tem estacionamento?", "levo o João\ntem wifi?", "levo o João! tem wifi?"]) {
    it(`${JSON.stringify(m)} muda o resumo`, () => expect(mudaDadoDoResumo(m, GRM301)).toBe(true));
  }
});

describe("bloqueio e contador de uma estadia sobrevivem à falha de outra (M23, M24)", () => {
  it("A bloqueada (500+500), B bloqueada (500+500): A com outro telefone continua sem resumo e sem POST", async () => {
    const s = sessao({ "GRM-301": [500], "RIO-402": [500] });
    await s.tentar(DADOS);
    await s.tentar(OUTRA);
    const r = await s.tentar({ ...DADOS, telefone: "(11) 97777-0000" });
    expect(r.resumo.handoff).toBe(true);
    expect(s.posts("GRM-301")).toBe(2);
  });

  it("A 422 no telefone, B 500 e 201, A corrigida e 500: só 2 POSTs em A, sem nova tentativa", async () => {
    const s = sessao({ "GRM-301": ["422tel", 500], "RIO-402": [500, 201] });
    await s.tentar(DADOS);
    await s.tentar(OUTRA);
    const r = await s.tentar({ ...DADOS, telefone: "(11) 97777-0000" });
    expect(r.sim.handoff).toBe(true);
    expect(s.posts("GRM-301")).toBe(2);
  });
});

describe("resultado incerto bloqueia a estadia, com o texto de incerto (M25, M26, M27, M28)", () => {
  for (const passo of ["tempo", 200] as const) {
    it(`${passo}: outro telefone e outro número de hóspedes não ganham resumo nem POST`, async () => {
      const s = sessao({ "GRM-301": [passo, 201] });
      await s.tentar(DADOS);
      for (const d of [{ ...DADOS, telefone: "(11) 97777-0000" }, { ...DADOS, hospedes: 3 }]) {
        const r = await s.tentar(d);
        expect(r.resumo.handoff).toBe(true);
        expect(r.resumo.respostaFinal).toMatch(/^Não consegui confirmar o registro/);
      }
      expect(s.posts("GRM-301")).toBe(1);
    });
  }
});

describe("resultado incerto seguido de troca de dado: a estadia segue bloqueada", () => {
  it("tempo esgotado; depois nome, telefone e hóspedes trocados juntos: sem resumo, texto de incerto, handoff, 0 POST novo", async () => {
    const s = sessao({ "GRM-301": ["tempo", 201] });
    const primeira = await s.tentar(DADOS);
    expect(primeira.sim.handoff).toBe(true);
    expect(primeira.sim.respostaFinal).toMatch(/^Não consegui confirmar o registro/);
    const r = await s.tentar({ ...DADOS, nome: "Ana Lima Souza", telefone: "(21) 96666-0000", hospedes: 3 });
    expect(r.resumo.handoff).toBe(true);
    expect(r.resumo.respostaFinal).toMatch(/^Não consegui confirmar o registro/);
    expect(s.posts("GRM-301")).toBe(1);
  });
});
