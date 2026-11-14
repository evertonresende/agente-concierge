// Resposta do Worker fora do turno com resumo pendente (frente H, P24): mensagem vazia ou acima
// de 8.000 caracteres recebe a pergunta do Worker sem passar pelo modelo, e o "sim" seguinte pode
// estar respondendo a ela. Com resumo em aberto, essa confirmação só reapresenta o resumo.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Mensagem, Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, pedeFerramentas } from "./apoio";

const ambiente = env as unknown as Env;
let proxima = 0;
const DADOS = {
  imovel_id: "GRM-301",
  checkin: "15/01/2027",
  checkout: "18/01/2027",
  hospedes: 2,
  nome: "Ana Lima",
  telefone: "(11) 98888-0000",
};

async function abrir(vistas: string[]) {
  const id = `fora-do-turno-h-${++proxima}`;
  const mundo = criarMundo();
  const modelo: Modelo = async (mensagens: Mensagem[]) => {
    const ultima = mensagens[mensagens.length - 1]!;
    if (ultima.role === "tool") return diz("Certo.");
    vistas.push(ultima.content);
    if (ultima.content === "quero fechar") return pedeFerramentas(chamar("montar_resumo", DADOS));
    if (ultima.content === "sim") return pedeFerramentas(chamar("confirmar_reserva"));
    return diz(`resposta a ${ultima.content}`);
  };
  const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
  await runInDurableObject(stub, (sessao: Sessao) => {
    sessao.dependencias = { modelo, buscar: mundo.buscar };
  });
  const marca = () => runInDurableObject(stub, (_s, state) =>
    state.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = 'reapresentar'").toArray()[0]?.valor ?? null);
  return { id, mundo, marca };
}

async function postChat(sessionId: string, message: string) {
  const resposta = await worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), ambiente);
  expect(resposta.status).toBe(200);
  return resposta.json<{ reply: string; handoff: boolean }>();
}

describe("resposta do Worker fora do turno com resumo pendente (frente H, P24)", () => {
  const casos = [
    { nome: "mensagem vazia", mensagem: "   ", resposta: /Pode escrever a sua mensagem\?/ },
    { nome: "mensagem acima de 8.000 caracteres", mensagem: "x".repeat(8_001), resposta: /Pode resumir/ },
  ];

  for (const caso of casos) {
    it(`P24: resumo, ${caso.nome} e 'sim' → o 'sim' reapresenta (0 POSTs, sem modelo); o 'sim' seguinte envia o resumo`, async () => {
      const vistas: string[] = [];
      const s = await abrir(vistas);
      await postChat(s.id, "quero fechar");

      const doWorker = await postChat(s.id, caso.mensagem);
      expect(doWorker).toEqual({ reply: expect.stringMatching(caso.resposta), handoff: false });

      const primeiro = await postChat(s.id, "sim");
      expect(primeiro.handoff).toBe(false);
      expect(primeiro.reply).toContain("Ainda não enviei este pedido");
      expect(vistas).toEqual(["quero fechar"]);
      expect(s.mundo.leads).toEqual([]);

      await postChat(s.id, "sim");
      expect(s.mundo.leads).toMatchObject([{ checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2 }]);
    });

    it(`P24: sem resumo pendente, ${caso.nome} não liga a marca e não muda o turno seguinte`, async () => {
      const vistas: string[] = [];
      const s = await abrir(vistas);
      await postChat(s.id, "oi");
      await postChat(s.id, caso.mensagem);
      expect(await s.marca()).toBeNull();
      expect(await postChat(s.id, "tudo bem?")).toEqual({ reply: "resposta a tudo bem?", handoff: false });
    });
  }
});
