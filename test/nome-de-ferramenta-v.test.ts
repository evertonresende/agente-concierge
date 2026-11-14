import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import { lerRespostaAnthropic, type Mensagem, type Modelo, normalizarResposta } from "../src/modelo";
import type { Sessao } from "../src/sessao";
import { chamar, criarMundo, diz, pedeFerramentas } from "./apoio";

const ambiente = env as unknown as Env;
const LONGO = "abc1234567".repeat(500); // 5.000 caracteres, com dígitos
let proxima = 0;

async function abrir(modelo: Modelo) {
  const stub = ambiente.SESSAO.getByName(`nome-de-ferramenta-v-${++proxima}`);
  await runInDurableObject(stub, (s: Sessao) => { s.dependencias = { modelo, buscar: criarMundo().buscar }; });
  return stub;
}

/** Roda um turno com uma ferramenta pedida e devolve as linhas de log e o que o modelo viu depois dela. */
async function turnoCom(nome: string) {
  const vistas: Mensagem[][] = [];
  const modelo: Modelo = async (mensagens) => {
    vistas.push(mensagens);
    return mensagens.at(-1)!.role === "tool" ? diz("Posso ajudar com outra coisa?") : pedeFerramentas(chamar(nome));
  };
  const stub = await abrir(modelo);
  const logs: string[] = [];
  const espiado = vi.spyOn(console, "log").mockImplementation((texto) => { logs.push(String(texto)); });
  try {
    const resposta = await stub.conversar("oi");
    return { resposta, logs, vistas };
  } finally {
    espiado.mockRestore();
  }
}

const eventoTurno = (logs: string[]) =>
  logs.filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Record<string, unknown>).find((o) => o.evento === "turno");

describe("nome de ferramenta vindo do modelo (frente V)", () => {
  it("chat completions: nome desconhecido de 5.000 caracteres sai cortado em 64; nome válido não muda", () => {
    const ler = (nome: string) => normalizarResposta({
      choices: [{ message: { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: nome, arguments: "{}" } }] } }],
    }).chamadas[0]!.function.name;
    expect(ler(LONGO)).toBe(LONGO.slice(0, 64));
    expect(ler("buscar_imoveis")).toBe("buscar_imoveis");
  });

  it("API Messages: nome desconhecido de 5.000 caracteres sai cortado em 64; nome válido não muda", () => {
    const ler = (nome: string) => lerRespostaAnthropic({
      type: "message",
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "toolu_1", name: nome, input: {} }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }).chamadas[0]!.function.name;
    expect(ler(LONGO)).toBe(LONGO.slice(0, 64));
    expect(ler("buscar_imoveis")).toBe("buscar_imoveis");
  });

  it("no log do turno o nome desconhecido vira 'desconhecida', e a conversa segue com 'Ferramenta inexistente.'", async () => {
    const { resposta, logs, vistas } = await turnoCom(LONGO);
    expect(resposta.reply).toBe("Posso ajudar com outra coisa?");
    const resultado = vistas.at(-1)!.at(-1)!;
    expect(resultado.role).toBe("tool");
    expect(resultado.content).toContain("Ferramenta inexistente.");
    expect(eventoTurno(logs)?.ferramentas).toEqual(["desconhecida"]);
    expect(logs.join("\n")).not.toContain("abc123");
  });

  it("ferramenta da lista fechada aparece no log com o nome dela", async () => {
    const { logs } = await turnoCom("listar_cidades");
    expect(eventoTurno(logs)?.ferramentas).toEqual(["listar_cidades"]);
  });
});

describe("corte do nome de ferramenta sem meio caractere no fim (frente V)", () => {
  const EMOJI = "\u{1F600}"; // dois substitutos em UTF-16
  const lerChat = (nome: string) => normalizarResposta({
    choices: [{ message: { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: nome, arguments: "{}" } }] } }],
  }).chamadas[0]!.function.name;
  const lerMessages = (nome: string) => lerRespostaAnthropic({
    type: "message",
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "toolu_1", name: nome, input: {} }],
    usage: { input_tokens: 1, output_tokens: 1 },
  }).chamadas[0]!.function.name;
  const bemFormado = (texto: string) => !/\p{Cs}/u.test(texto); // nenhum substituto solto

  for (const [adaptador, ler] of [["chat completions", lerChat], ["API Messages", lerMessages]] as const) {
    it(`${adaptador}: 63 letras + emoji + texto sai com até 64 unidades e bem formado`, () => {
      const nome = ler("a".repeat(63) + EMOJI + "mais texto");
      expect(nome.length).toBeLessThanOrEqual(64);
      expect(bemFormado(nome)).toBe(true);
      expect(Array.from(nome).join("")).toBe(nome);
      expect(nome).toBe("a".repeat(63));
    });

    it(`${adaptador}: 64 letras + emoji sai com as 64 letras`, () => {
      expect(ler("a".repeat(64) + EMOJI)).toBe("a".repeat(64));
    });

    it(`${adaptador}: 62 letras + emoji cabe inteiro em 64 unidades`, () => {
      expect(ler("a".repeat(62) + EMOJI + "x")).toBe("a".repeat(62) + EMOJI);
    });
  }
});
