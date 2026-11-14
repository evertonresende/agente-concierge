// Total do resumo pendente depois que a cotação sai da janela de mensagens da sessão (M-1,
// frente G): o total que o código calculou e guardou no cofre continua permitido; o nome
// do hóspede e o texto livre do modelo continuam sem liberar valor.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, pedeFerramentas, roteiro, ultimaDoHospede } from "./apoio";
import { conversa } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const PESSOA = { nome: "Ana Lima", telefone: "(11) 98888-0000" };
const COTA = "sou Ana Lima, quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?";
const TOTAL = "Tem wifi. O total do pedido é R$ 2.156,00.";

/** Modelo por regra: cota, monta o resumo, responde NÃO à pergunta fechada e o resto com TOTAL. */
const modelo: Modelo = async (mensagens: Mensagem[]) => {
  if (String(mensagens[0]?.content).includes("Responda só SIM ou NÃO")) return diz("NÃO");
  const hospede = ultimaDoHospede(mensagens);
  if (hospede === COTA) return mensagens.at(-1)!.role === "tool" ? diz("Fica R$ 2.156,00.") : pedeFerramentas(chamar("cotar", ESTADIA));
  if (hospede === "quero fechar") return pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA }));
  return diz(TOTAL);
};

describe("total do resumo pendente fora da janela (M-1)", () => {
  it("pela sessão real: depois de a cotação sair da janela de 80, o total do pedido repetido pelo modelo continua", { timeout: 60_000 }, async () => {
    const mundo = criarMundo();
    const stub = (env as unknown as Env).SESSAO.getByName("janela-g-resumo");
    await runInDurableObject(stub, (s: Sessao) => { s.dependencias = { modelo, buscar: mundo.buscar }; });
    await stub.conversar(COTA);
    await stub.conversar("quero fechar");
    // Sem a correção, o corte vinha no turno 42.
    for (let turno = 3; turno <= 50; turno++) {
      expect((await stub.conversar("tem wifi?")).reply.startsWith(TOTAL), `turno ${turno}`).toBe(true);
    }
  });

  it("pelo laço, com o histórico vazio: o total do resumo aberto vale, o nome do hóspede não", async () => {
    const c = conversa();
    await c.turno("sou Ana R$ 10,00, quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?", roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
    await c.turno("quero fechar", roteiro(pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, ...PESSOA, nome: "Ana R$ 10,00" }))).modelo);
    c.historico.splice(0); // a cotação e o resumo saíram da janela
    const certo = await c.turno("tem wifi?", roteiro(diz(TOTAL), diz("NÃO")).modelo);
    expect(certo.reply.startsWith(`${TOTAL}\n\n`)).toBe(true);
    c.historico.splice(0);
    const errado = diz("Combinado: fica R$ 10,00.");
    const nome = await c.turno("então fica R$ 10,00?", roteiro(errado, errado, diz("NÃO")).modelo);
    expect(nome.reply.split("\n\nO seu pedido de reserva ainda aguarda")[0]).not.toContain("R$ 10,00");
  });

  it("sem resumo aberto, nada novo é liberado: o texto do modelo junto da chamada segue cortado", async () => {
    const c = conversa();
    const r = roteiro(
      { ...pedeFerramentas(chamar("cotar", ESTADIA)), texto: "Vou cotar: 3 noites × R$ 500,00 = R$ 2.000,00." },
      diz("Fica R$ 2.000,00 pelas 3 noites."),
      diz("Fica R$ 2.000,00 pelas 3 noites."),
    );
    expect((await c.turno(COTA, r.modelo)).reply).not.toContain("R$ 2.000,00");
  });
});
