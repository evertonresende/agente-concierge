// Marca de reapresentação da sessão (frente H) contra as regras finais de confirmação da F
// (P11, P13, P15): um resumo em aberto depois de um turno que falhou não é confirmado pela
// próxima confirmação, que só o reapresenta; o "sim" seguinte envia exatamente o mostrado.
import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { Modelo } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, pedeFerramentas, ultimaDoHospede } from "./apoio";

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

function postChat(sessionId: string, message: string): Promise<Response> {
  return worker.fetch(new Request("https://agente.teste/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  }), ambiente);
}

/** Lê do texto mostrado ao hóspede os dados que o lead precisa ter (resumo em pt ou en). */
function dadosDoResumoMostrado(texto: string) {
  const campo = (rotulos: string) => texto.match(new RegExp(`^- (?:${rotulos}): (.+)$`, "m"))?.[1];
  const data = (valor: string | undefined) => {
    const pt = valor?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
    const en = new Date(`${valor?.split(" (")[0]} UTC`);
    return en.toISOString().slice(0, 10);
  };
  const total = campo("Total")!.replace(/[^\d,]/g, "").replace(",", ".");
  return {
    imovel_id: campo("Imóvel|Property")!.match(/\(([^)]+)\)/)![1],
    checkin: data(campo("Entrada|Check-in")),
    checkout: data(campo("Saída|Check-out")),
    hospedes: Number(campo("Hóspedes|Guests")),
    nome: campo("Nome|Name"),
    telefone: campo("Telefone|Phone"),
    valor_total: Number(total),
  };
}

describe("reapresentação depois de turno que falhou, com as regras finais da F (frente H)", () => {
  const casos = [
    { confirmacao: "confirma", sim: "sim", aviso: "Ainda não enviei este pedido", idioma: "pt" },
    { confirmacao: "perfeito, confirma", sim: "sim", aviso: "Ainda não enviei este pedido", idioma: "pt" },
    { confirmacao: "Sim! 😊", sim: "sim", aviso: "Ainda não enviei este pedido", idioma: "pt" },
    { confirmacao: "bora", sim: "sim", aviso: "Ainda não enviei este pedido", idioma: "pt" },
    { confirmacao: "please confirm", sim: "yes", aviso: "I have not sent this request yet", idioma: "en" },
  ] as const;

  for (const caso of casos) {
    it(`P15: '${caso.confirmacao}' depois de contingência reapresenta o último resumo (sem modelo, 0 POSTs); '${caso.sim}' envia exatamente o mostrado`, async () => {
      const id = `reapresentacao-h-${++proxima}`;
      const mundo = criarMundo();
      let chamadasModelo = 0;
      const ingles = caso.idioma === "en";
      const modelo: Modelo = async (mensagens) => {
        chamadasModelo++;
        const ultima = ultimaDoHospede(mensagens);
        if (ultima === caso.sim || ultima === caso.confirmacao) return pedeFerramentas(chamar("confirmar_reserva"));
        // O segundo resumo (saída um dia antes) é o último que o hóspede viu: é ele que vale (L10, P13).
        if (ultima.startsWith(ingles ? "change" : "muda")) return pedeFerramentas(chamar("montar_resumo", { ...DADOS, checkout: "17/01/2027" }));
        if (ultima.startsWith(ingles ? "I want" : "quero")) return pedeFerramentas(chamar("montar_resumo", DADOS));
        throw new Error("modelo indisponível");
      };
      const stub = ambiente.SESSAO.getByName(`sessao:${id}`);
      await runInDurableObject(stub, (sessao: Sessao) => {
        sessao.dependencias = { modelo, buscar: mundo.buscar };
      });

      await postChat(id, ingles ? "I want to book this place, I am Ana Lima" : "quero fechar, sou Ana Lima");
      const segundo = await (await postChat(id, ingles ? "change the check-out to one day earlier" : "muda a saída para um dia antes")).json<{ reply: string }>();
      const falha = await (await postChat(id, ingles ? "what time is check-in?" : "qual o horário do check-in?")).json<{ handoff: boolean }>();
      expect(falha.handoff).toBe(true);

      const antes = chamadasModelo;
      const reapresentado = await (await postChat(id, caso.confirmacao)).json<{ reply: string; handoff: boolean }>();
      expect(chamadasModelo).toBe(antes);
      expect(mundo.leads).toEqual([]);
      expect(reapresentado.handoff).toBe(false);
      expect(reapresentado.reply).toContain(caso.aviso);
      expect(reapresentado.reply.match(ingles ? /Summary of your booking request:/g : /Resumo do seu pedido de reserva:/g)).toHaveLength(1);
      const mostrado = dadosDoResumoMostrado(reapresentado.reply);
      expect(mostrado).toEqual(dadosDoResumoMostrado(segundo.reply));
      expect(mostrado.checkout).toBe("2027-01-17");

      const enviado = await (await postChat(id, caso.sim)).json<{ reply: string; handoff: boolean }>();
      expect(enviado.handoff).toBe(false);
      expect(mundo.leads).toEqual([mostrado]);
    });
  }
});
