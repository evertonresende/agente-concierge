// F1 da rodada pós-entrega: a P29 recusava qualquer dígito no nome, e um nome como
// "Bia Rocha X7Q1" nunca virava resumo nem lead. Regra nova (pergunta 1, recomendação
// aceita pelo Éverton em 20/11): dígito dentro de palavra com letras passa; símbolo de
// moeda, "%", número solto e número junto de palavra de moeda continuam recusados. O nome
// é conferido no turno em que chega, pela ferramenta conferir_nome.
import { describe, expect, it } from "vitest";
import { FERRAMENTAS } from "../src/agente/ferramentas";
import { chamar, diz, pedeFerramentas, roteiro } from "./apoio";
import { conversa, ultimoResultado } from "./apoio-g";

const ESTADIA = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2 };
const TELEFONE = "(21) 97777-1234";
const conferirNome = () => FERRAMENTAS.find((f) => f.definicao.function.name === "conferir_nome");

async function cotado() {
  const c = conversa();
  await c.turno("Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2?",
    roteiro(pedeFerramentas(chamar("cotar", ESTADIA)), diz("Fica R$ 2.156,00.")).modelo);
  return c;
}

describe("F1: nome com dígito dentro de uma palavra vira resumo e lead", () => {
  it("fluxo de 3 turnos (nome num turno, telefone no seguinte, sim): o lead sai com o total do código", async () => {
    const { turno, mundo } = await cotado();
    const nome = await turno("Quero fechar. Meu nome é Bia Rocha X7Q1.", roteiro(
      pedeFerramentas(chamar("conferir_nome", { nome: "Bia Rocha X7Q1" })),
      diz("Obrigado, Bia Rocha X7Q1! Qual é o seu telefone com DDD?"),
    ).modelo);
    expect(nome.reply).toContain("Qual é o seu telefone");
    const resumo = await turno(`Telefone ${TELEFONE}.`, roteiro(
      pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome: "Bia Rocha X7Q1", telefone: TELEFONE })),
    ).modelo);
    expect(resumo.reply).toContain("Bia Rocha X7Q1");
    expect(resumo.reply).toContain("R$ 2.156,00");
    await turno("Sim, confirmo.", roteiro(pedeFerramentas(chamar("confirmar_reserva"))).modelo);
    expect(mundo.leads).toEqual([expect.objectContaining({ nome: "Bia Rocha X7Q1", valor_total: 2156, imovel_id: "GRM-301" })]);
  });

  for (const nome of ["Bia Rocha X7Q1", "Joao K4P2 Lima", "Ana Teste 2a", "Lu 3º"]) {
    it(`conferir_nome aceita ${JSON.stringify(nome)}`, async () => {
      const { turno } = await cotado();
      const r = roteiro(pedeFerramentas(chamar("conferir_nome", { nome })), diz("Anotado."));
      await turno(`Meu nome é ${nome}.`, r.modelo);
      expect(JSON.parse(ultimoResultado(r.recebidas[1]!))).toMatchObject({ nome_ok: true });
    });
  }
});

describe("F1: o nome é conferido no turno em que chega", () => {
  it("a ferramenta conferir_nome existe e o modelo é instruído a chamá-la quando recebe o nome", () => {
    const definicao = conferirNome()?.definicao.function;
    expect(definicao?.description).toMatch(/assim que o hóspede (?:disser|informar) o nome/i);
  });

  for (const nome of ["Caio Prado R$ 1,00", "Caio 1,00", "Caio Prado 500", "Caio 50%", "Caio 500reais", "Caio US$20",
    // Da revisão: valor grudado em palavra de preço, ou número de 3 dígitos ou mais.
    "Caio 1500/noite", "Caio 50desconto", "Caio 1500total", "Caio 10x500", "Caio US500", "Caio 300off"]) {
    it(`recusa ${JSON.stringify(nome)} no próprio turno, sem mexer no pedido`, async () => {
      const { turno, estado } = await cotado();
      const r = roteiro(pedeFerramentas(chamar("conferir_nome", { nome })), diz("Preciso do seu nome sem número nem valor."));
      const saida = await turno(`Meu nome é ${nome}.`, r.modelo);
      expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).erro).toContain("sem número nem valor");
      expect(saida.reply).not.toMatch(/R\$\s*1,00/);
      expect(estado().pendente).toBeNull();
    });
  }

  it("nome que o hóspede não escreveu também é recusado ali (P20)", async () => {
    const { turno } = await cotado();
    const r = roteiro(pedeFerramentas(chamar("conferir_nome", { nome: "Caio Prado Silva" })), diz("Qual é o seu nome completo?"));
    await turno("Meu nome é Caio Prado.", r.modelo);
    expect(JSON.parse(ultimoResultado(r.recebidas[1]!)).erro).toContain("\"silva\"");
  });

  it("montar_resumo segue a mesma regra: com preço no nome, nenhum resumo e nenhum lead", async () => {
    const { turno, mundo, estado } = await cotado();
    const resumo = await turno(`Sou Caio Prado R$ 1,00, telefone ${TELEFONE}.`, roteiro(
      pedeFerramentas(chamar("montar_resumo", { ...ESTADIA, nome: "Caio Prado R$ 1,00", telefone: TELEFONE })),
      diz("Preciso do seu nome sem número nem valor."),
    ).modelo);
    expect(resumo.reply).not.toMatch(/R\$\s*1,00/);
    expect(estado().pendente).toBeNull();
    await turno("Sim, pode confirmar.", roteiro(pedeFerramentas(chamar("confirmar_reserva")), diz("Não há resumo aguardando.")).modelo);
    expect(mundo.leads).toEqual([]);
  });
});
