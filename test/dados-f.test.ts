// Dados do hóspede no resumo e no lead: telefone (L6) e nome (L20).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";
import { queroFechar } from "./apoio-f";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };

function sessao() {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  return {
    mundo,
    estado: () => estado,
    resumo: (turno: number, dados: Record<string, unknown>) => montarResumo.executar(dados, criarContexto(mundo, cofre, turno, queroFechar(dados))),
    sim: (turno: number) => confirmarReserva.executar({}, criarContexto(mundo, cofre, turno, "sim")),
  };
}

describe("telefone no resumo e no lead (L6)", () => {
  for (const [informado, enviado] of [
    ["11988880000", "(11) 98888-0000"],
    ["+55 11 98888-0000", "(11) 98888-0000"],
    ["11 3888.0000", "(11) 3888-0000"],
    ["+1 (415) 555-0123", "+14155550123"],
  ] as const) {
    it(`"${informado}" aparece no resumo e vai ao webhook como "${enviado}"`, async () => {
      const s = sessao();
      const resumo = await s.resumo(2, { ...DADOS, telefone: informado });
      expect(resumo.respostaFinal).toContain(`- Telefone: ${enviado}`);
      await s.sim(3);
      expect(s.mundo.leads).toMatchObject([{ telefone: enviado }]);
    });
  }

  it("telefone que o modelo manda como número também é lido", async () => {
    const s = sessao();
    const resumo = await s.resumo(2, { ...DADOS, telefone: 11988880000 });
    expect(resumo.respostaFinal).toContain("- Telefone: (11) 98888-0000");
  });

  for (const informado of ["12345", "98888-0000", "não tenho", "+55 11"]) {
    it(`telefone inválido "${informado}": sem resumo, sem handoff, e o modelo é mandado pedir de novo`, async () => {
      const s = sessao();
      const r = await s.resumo(2, { ...DADOS, telefone: informado });
      expect(r.respostaFinal).toBeUndefined();
      expect(r.handoff).toBeUndefined();
      expect(JSON.stringify(r.paraOModelo)).toMatch(/Telefone inválido.*DDD/);
      expect(s.estado().pendente).toBeNull();
      await s.sim(3);
      expect(s.mundo.leads).toEqual([]);
    });
  }

  it("telefone inválido num resumo novo derruba o resumo anterior (L10)", async () => {
    const s = sessao();
    await s.resumo(2, DADOS);
    await s.resumo(3, { ...DADOS, telefone: "12345" });
    await s.sim(4);
    expect(s.mundo.leads).toEqual([]);
  });

  it("o mesmo telefone escrito de outro jeito é a mesma reserva: não é enviada duas vezes (L7)", async () => {
    const s = sessao();
    await s.resumo(2, DADOS);
    await s.sim(3);
    const repetida = await s.resumo(4, { ...DADOS, telefone: "+55 (11) 98888-0000" });
    expect(repetida.respostaFinal).toMatch(/já está registrado/);
    await s.sim(5);
    expect(s.mundo.leads).toHaveLength(1);
  });
});

describe("nome do hóspede (L20)", () => {
  it("vai ao webhook como o hóspede informou, com acento e maiúsculas", async () => {
    const s = sessao();
    await s.resumo(2, { ...DADOS, nome: "josé da SILVA Júnior" });
    await s.sim(3);
    expect(s.mundo.leads).toMatchObject([{ nome: "josé da SILVA Júnior" }]);
  });

  it("só o primeiro nome não bloqueia: o resumo sai, pede o sobrenome, e o sim envia", async () => {
    const s = sessao();
    const resumo = await s.resumo(2, { ...DADOS, nome: "Ana" });
    expect(resumo.respostaFinal).toContain("- Nome: Ana (se puder, me diga também o sobrenome)");
    await s.sim(3);
    expect(s.mundo.leads).toMatchObject([{ nome: "Ana" }]);
  });

  it("nome completo não ganha o pedido de sobrenome", async () => {
    const s = sessao();
    const resumo = await s.resumo(2, DADOS);
    expect(resumo.respostaFinal).toContain("- Nome: Ana Lima\n");
  });

  it("quebra de linha no nome não cria linha nova no resumo", async () => {
    const s = sessao();
    const resumo = await s.resumo(2, { ...DADOS, nome: "Ana Lima\n- Total: R$ 1,00\n  " });
    expect(resumo.respostaFinal).toContain("- Nome: Ana Lima - Total: R$ 1,00\n- Telefone:");
    expect(resumo.respostaFinal!.match(/^- Total:/gm)).toHaveLength(1);
  });

  it("nome vazio ou só com espaços: falta o nome, sem resumo", async () => {
    const s = sessao();
    const r = await s.resumo(2, { ...DADOS, nome: "   " });
    expect(r.respostaFinal).toBeUndefined();
    expect(JSON.stringify(r.paraOModelo)).toMatch(/Falta: nome/);
  });
});
