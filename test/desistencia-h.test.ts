// Worker que desiste de um pedido que ainda espera na fila do objeto (frente H, B2 da terceira
// rodada do verificador): o hóspede recebeu a contingência, então o turno não pode rodar depois
// e gravar um resumo que ele não viu. O pedido desistido sai da fila como prazo esgotado.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Mensagem, Modelo } from "../src/modelo";
import type { RespostaDoChat, Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, pedeFerramentas } from "./apoio";

const ambiente = env as unknown as Env;
let proxima = 0;
const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DADOS = {
  imovel_id: "GRM-301",
  checkin: "15/01/2027",
  checkout: "18/01/2027",
  hospedes: 2,
  nome: "Ana Lima",
  telefone: "(11) 98888-0000",
};
const OUTROS = { ...DADOS, checkin: "22/01/2027", checkout: "25/01/2027", hospedes: 3 };
/** Turno lento em curso: pergunta pura, que não muda dado do resumo (L10) nem o derruba. */
const LENTA = "qual o horário do check-in?";

function modelo(vistas: string[]): Modelo {
  return async (mensagens: Mensagem[]) => {
    const ultima = mensagens[mensagens.length - 1]!;
    if (ultima.role === "tool") return diz("Certo.");
    // Pergunta fechada do rearme (G, P18): a mensagem não muda o pedido, o resumo visto fica.
    if (mensagens[0]?.role === "system" && mensagens[0].content.includes("aguarda a confirmação do hóspede")) return diz("NÃO");
    vistas.push(ultima.content);
    await pausa(ultima.content === LENTA ? 250 : 40);
    if (ultima.content === "quero fechar, sou Ana Lima") return pedeFerramentas(chamar("montar_resumo", DADOS));
    if (ultima.content === "quero outras datas") return pedeFerramentas(chamar("montar_resumo", OUTROS));
    if (ultima.content === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
    // Sem "?" na resposta, para a pergunta do agente não derrubar o resumo (P18).
    return diz("O check-in é às 15:00.");
  };
}

async function abrir(vistas: string[]) {
  const id = `desistencia-h-${++proxima}`;
  const mundo = criarMundo();
  const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo: modelo(vistas), buscar: mundo.buscar };
  });
  return { id, mundo };
}

function postChat(sessionId: string, message: string, variaveis: Env = ambiente): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), variaveis);
}

/**
 * A 1ª tentativa do Worker entrega o pedido ao objeto e perde a volta; a 2ª não chega. O
 * Worker devolve a contingência e avisa o objeto, como em produção.
 */
function entregaPerdida(esperaMs: number): Env {
  let tentativa = 0;
  return {
    ...ambiente,
    SESSAO: {
      ...ambiente.SESSAO,
      getByName(nome: string) {
        const real = ambiente.SESSAO.getByName(nome);
        return {
          async conversar(...args: [string, number?, string?, number?]): Promise<RespostaDoChat> {
            if (++tentativa === 1) {
              real.conversar(...args).catch(() => {});
              await pausa(esperaMs);
              throw new Error("conexão perdida");
            }
            throw new Error("conexão perdida de novo");
          },
          registrarContingenciaNoWorker: (idPedido?: string) => real.registrarContingenciaNoWorker(idPedido),
        };
      },
    } as unknown as Env["SESSAO"],
  };
}

describe("Worker desiste de pedido na fila do objeto (frente H, B2)", () => {
  it("B2: 'quero fechar' abandonado enquanto espera na fila → o turno não roda, nenhum resumo fica gravado e o 'sim' seguinte não envia", async () => {
    const vistas: string[] = [];
    const s = await abrir(vistas);
    const lento = postChat(s.id, LENTA);
    await pausa(20);

    const r = await (await postChat(s.id, "quero fechar, sou Ana Lima", entregaPerdida(5))).json<{ handoff: boolean }>();
    expect(r.handoff).toBe(true);
    await lento;
    await pausa(200);

    await postChat(s.id, "sim");
    expect(vistas).not.toContain("quero fechar, sou Ana Lima");
    expect(s.mundo.leads).toEqual([]);
  });

  it("B2b: resumo visto em aberto e 'quero outras datas' abandonado na fila → o resumo visto continua; 'sim' reapresenta e o 'sim' seguinte envia as datas vistas", async () => {
    const vistas: string[] = [];
    const s = await abrir(vistas);
    await postChat(s.id, "quero fechar, sou Ana Lima");
    const lento = postChat(s.id, LENTA);
    await pausa(20);

    const r = await (await postChat(s.id, "quero outras datas", entregaPerdida(5))).json<{ handoff: boolean }>();
    expect(r.handoff).toBe(true);
    await lento;
    await pausa(200);

    const primeiro = await (await postChat(s.id, "sim")).json<{ reply: string }>();
    expect(primeiro.reply).toContain("Ainda não enviei este pedido");
    expect(primeiro.reply).toContain("15/01/2027");
    expect(s.mundo.leads).toEqual([]);

    await postChat(s.id, "sim");
    expect(vistas).not.toContain("quero outras datas");
    expect(s.mundo.leads).toMatchObject([{ checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2 }]);
  });

  it("B2-controle: abandono com o turno já em curso (sem fila) continua sem enviar", async () => {
    const vistas: string[] = [];
    const s = await abrir(vistas);
    const r = await (await postChat(s.id, "quero fechar, sou Ana Lima", entregaPerdida(10))).json<{ handoff: boolean }>();
    expect(r.handoff).toBe(true);
    await pausa(150);
    await postChat(s.id, "sim");
    expect(s.mundo.leads).toEqual([]);
  });
});
