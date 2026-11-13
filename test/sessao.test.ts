import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, type Mundo, pedeFerramentas, roteiro, ultimaDoHospede } from "./apoio";

const namespace = (env as unknown as Env).SESSAO;
let proxima = 0;

/** Sessão nova com modelo e rede falsos. */
async function abrir(modelo: Modelo, mundo: Mundo = criarMundo()) {
  const stub = namespace.getByName(`teste-${++proxima}`);
  await runInDurableObject(stub, (sessao: Sessao) => { sessao.dependencias = { modelo, buscar: mundo.buscar }; });
  return { stub, mundo };
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

describe("sessão", () => {
  it("uma mensagem por vez", async () => {
    const entradas: string[] = [];
    const vistoPelaSegunda: Mensagem[] = [];
    let liberar!: () => void;
    const portao = new Promise<void>((r) => { liberar = r; });
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      entradas.push(ultima);
      if (ultima === "primeira") await portao;
      else vistoPelaSegunda.push(...mensagens);
      return diz(`resposta para ${ultima}`);
    };
    const { stub } = await abrir(modelo);

    const primeira = stub.conversar("primeira");
    const segunda = stub.conversar("segunda");
    while (entradas.length === 0) await pausa(5);
    await pausa(100);
    // Enquanto a primeira está presa no modelo, a segunda não chega nele.
    expect(entradas).toEqual(["primeira"]);

    liberar();
    const respostas = await Promise.all([primeira, segunda]);
    expect(entradas).toEqual(["primeira", "segunda"]);
    expect(respostas.map((r) => r.reply)).toEqual(["resposta para primeira", "resposta para segunda"]);
    // A segunda rodou vendo a primeira já concluída, com a resposta dela no histórico.
    expect(vistoPelaSegunda.filter((m) => m.role !== "system")).toEqual([
      { role: "user", content: "primeira" },
      { role: "assistant", content: "resposta para primeira" },
      { role: "user", content: "segunda" },
    ]);
  });

  it("lembra o que foi dito na mesma sessão e não vê nada de outra", async () => {
    const a = roteiro(diz("Olá, Ana."), diz("Você se chama Ana."));
    const b = roteiro(diz("Não sei o seu nome."));
    const sessaoA = await abrir(a.modelo);
    const sessaoB = await abrir(b.modelo);
    await sessaoA.stub.conversar("meu nome é Ana");
    await sessaoB.stub.conversar("como eu me chamo?");
    await sessaoA.stub.conversar("como eu me chamo?");
    expect(a.recebidas[1]!.map((m) => m.content)).toContain("meu nome é Ana");
    expect(JSON.stringify(b.recebidas[0])).not.toContain("Ana");
  });

  it("conversa do Marco 1: total, resumo, lead depois do sim e handoff no desconto", async () => {
    const { modelo, recebidas } = roteiro(
      pedeFerramentas(chamar("cotar", { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 })),
      diz("O total fica em R$ 2.156,00."),
      pedeFerramentas(chamar("montar_resumo", DADOS)),
      pedeFerramentas(chamar("confirmar_reserva")),
      pedeFerramentas(chamar("passar_para_humano", { motivo: "desconto" })),
      diz("Não consigo dar desconto; vou passar para uma pessoa do time."),
      diz("O check-in é às 15:00."),
    );
    const { stub, mundo } = await abrir(modelo);

    const cotacao = await stub.conversar("Quero o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas.");
    expect(cotacao).toMatchObject({ reply: "O total fica em R$ 2.156,00.", handoff: false });

    const resumo = await stub.conversar("Quero fechar. Sou Ana Lima, telefone (11) 98888-0000.");
    expect(resumo.reply).toContain("R$ 2.156,00");
    expect(resumo.reply).toContain("15/01/2027");
    expect(resumo.reply).toContain("18/01/2027");
    expect(resumo.reply).not.toMatch(/registrad/i);
    expect(mundo.leads).toEqual([]);

    const confirmacao = await stub.conversar("Sim, confirmo.");
    expect(confirmacao.reply).toMatch(/registrad/i);
    expect(confirmacao.handoff).toBe(false);
    expect(mundo.leads).toEqual([{
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);

    // Antes do sim o modelo é avisado do resumo em aberto; depois do registro, não mais.
    expect(recebidas[3]![0]!.content).toContain("aguardando o sim");
    const desconto = await stub.conversar("Consegue um desconto?");
    expect(desconto.handoff).toBe(true);
    expect(recebidas[4]![0]!.content).not.toContain("aguardando o sim");
    expect(recebidas[4]![0]!.content).toContain("Pedidos já registrados nesta conversa: 1");
    // A flag vale só para a resposta em que o agente decide passar (L3).
    expect((await stub.conversar("Qual o horário de check-in?")).handoff).toBe(false);
    expect(mundo.leads).toHaveLength(1);
  });

  it("dois sins ao mesmo tempo geram exatamente 1 lead", async () => {
    const modelo: Modelo = async (mensagens) =>
      ultimaDoHospede(mensagens) === "sim" ? pedeFerramentas(chamar("confirmar_reserva")) : pedeFerramentas(chamar("montar_resumo", DADOS));
    const { stub, mundo } = await abrir(modelo);
    await stub.conversar("quero fechar");
    const respostas = await Promise.all([stub.conversar("sim"), stub.conversar("sim")]);
    expect(mundo.leads).toHaveLength(1);
    expect(respostas[0].reply).toMatch(/foi registrado/);
    expect(respostas[1].reply).toMatch(/já está registrado/);
  });

  it("ferramenta abandonada pelo prazo não grava resumo depois que o turno acabou", async () => {
    const modelo: Modelo = async (mensagens) => {
      const ultima = ultimaDoHospede(mensagens);
      if (mensagens.at(-1)!.role === "tool") return diz("Preciso montar o resumo primeiro.");
      return ultima === "sim" ? pedeFerramentas(chamar("confirmar_reserva")) : pedeFerramentas(chamar("montar_resumo", DADOS));
    };
    const vistas: Mensagem[][] = [];
    const espiao: Modelo = (mensagens, ferramentas) => { vistas.push(mensagens); return modelo(mensagens, ferramentas); };
    const { stub, mundo } = await abrir(espiao, criarMundo({ atrasoDoCatalogoMs: 400 }));

    // Pedido que chegou há 44,8 s: sobram 200 ms, menos que a resposta do catálogo.
    const cortada = await stub.conversar("quero fechar", Date.now() - 44_800);
    expect(cortada.handoff).toBe(true);
    expect(cortada.reply).toContain("problema técnico");
    await pausa(700); // a leitura da ficha termina depois da resposta

    await stub.conversar("sim");
    expect(vistas.at(-2)![0]!.content).toContain("Nenhum resumo aguardando confirmação");
    expect(mundo.leads).toEqual([]);
  });

  it("falha do modelo vira resposta de contingência e não trava a mensagem seguinte", async () => {
    const { modelo } = roteiro(new Error("fora do ar"), new Error("fora do ar"), diz("Olá!"));
    const { stub } = await abrir(modelo);
    expect(await stub.conversar("oi")).toMatchObject({ handoff: true });
    expect(await stub.conversar("oi de novo")).toMatchObject({ reply: "Olá!", handoff: false });
  });
});
