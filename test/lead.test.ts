import { describe, expect, it } from "vitest";
import {
  apresentarResumo, chaveDaReserva, confirmar, corpoDoLead, destinoDosLeads, destinoPermitido, ESTADO_INICIAL,
  invalidarPendente, postarLead, type Cofre, type CorpoDoLead, type DependenciasDoEnvio, type EstadoLead, type Reserva,
} from "../src/lead";
import { cotar, type Cotacao } from "../src/nucleo/preco";

const RESERVA: Reserva = {
  imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2,
  nome: "Ana Lima", telefone: "(11) 98888-0000",
};
const GRM301 = { diariaCentavos: 59000, taxaLimpezaCentavos: 15000, minimoNoites: 2, capacidade: 4 };
const TOTAL = 215600;

function cofreEmMemoria(inicial: EstadoLead = ESTADO_INICIAL) {
  let estado = inicial;
  const gravacoes: EstadoLead[] = [];
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; gravacoes.push(e); } };
  return { cofre, gravacoes, estado: () => estado };
}

/** Webhook e catálogo falsos, com a ordem dos acontecimentos registrada. */
function ambiente(opcoes: Partial<DependenciasDoEnvio> & { status?: number; regras?: typeof GRM301 } = {}) {
  const posts: CorpoDoLead[] = [];
  const deps: DependenciasDoEnvio = {
    envioLigado: true,
    destinoPermitido: true,
    recotar: async (r): Promise<Cotacao> => cotar(opcoes.regras ?? GRM301, r.checkin, r.checkout, r.hospedes),
    postar: async (corpo) => { posts.push(corpo); return opcoes.status ?? 201; },
    ...opcoes,
  };
  return { deps, posts };
}

describe("trava de confirmação", () => {
  it("sem resumo apresentado, a confirmação não envia nada", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    expect(await confirmar(cofre, 5, deps)).toEqual({ tipo: "sem_resumo" });
    expect(posts).toEqual([]);
  });

  it("resumo e confirmação no mesmo turno não enviam nada", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 2, deps)).toEqual({ tipo: "mesmo_turno" });
    expect(posts).toEqual([]);
  });

  it("resumo num turno e confirmação em outro enviam 1 lead com os 7 campos", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toMatchObject({ tipo: "registrado" });
    expect(posts).toEqual([{
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    }]);
    expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("registrado");
  });

  it("a confirmação é consumida uma vez: o segundo sim não reenvia", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, deps);
    expect(await confirmar(cofre, 4, deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("o mesmo resumo apresentado de novo depois do registro não gera segundo lead", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, deps);
    apresentarResumo(cofre, { ...RESERVA, telefone: "11 98888 0000" }, TOTAL, 4);
    expect(await confirmar(cofre, 5, deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("duas confirmações ao mesmo tempo enviam exatamente 1 lead", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    const resultados = await Promise.all([confirmar(cofre, 3, deps), confirmar(cofre, 3, deps)]);
    expect(posts).toHaveLength(1);
    expect(resultados.map((r) => r.tipo).sort()).toEqual(["nao_registrado", "registrado"]);
  });

  it("o marcador da reserva é gravado antes do POST", async () => {
    const { cofre, estado } = cofreEmMemoria();
    let marcadorNaHoraDoPost: string | undefined;
    const { deps } = ambiente({
      postar: async () => { marcadorNaHoraDoPost = estado().envios[chaveDaReserva(RESERVA)]; return 201; },
    });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, deps);
    expect(marcadorNaHoraDoPost).toBe("enviando");
  });

  it("reinício no meio do envio: o marcador 'enviando' impede um segundo POST", async () => {
    const { cofre } = cofreEmMemoria({
      pendente: { reserva: RESERVA, totalCentavos: TOTAL, turno: 2 },
      envios: { [chaveDaReserva(RESERVA)]: "enviando" },
    });
    const { deps, posts } = ambiente();
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
    expect(posts).toEqual([]);
  });

  it("mudança de dado depois do resumo invalida a confirmação pendente", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    invalidarPendente(cofre);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "sem_resumo" });
    expect(posts).toEqual([]);
  });

  it("invalidar não apaga o resumo de uma reserva já registrada", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, deps);
    invalidarPendente(cofre);
    expect(estado().pendente).not.toBeNull();
    expect(await confirmar(cofre, 4, deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("novo resumo substitui o anterior e exige confirmação em turno posterior a ele", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    apresentarResumo(cofre, { ...RESERVA, checkout: "2027-01-17" }, 156600, 3);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "mesmo_turno" });
    expect(await confirmar(cofre, 4, deps)).toMatchObject({ tipo: "registrado" });
    expect(posts).toMatchObject([{ checkout: "2027-01-17", valor_total: 1566 }]);
  });

  it("total diferente na releitura da ficha: não envia e pede nova confirmação", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ regras: { ...GRM301, diariaCentavos: 60000 } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    const r = await confirmar(cofre, 3, deps);
    expect(r).toMatchObject({ tipo: "total_mudou", pendente: { totalCentavos: 219000, turno: 3 } });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
    // O novo resumo foi mostrado no turno 3: só um turno seguinte confirma, com o total novo.
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "mesmo_turno" });
    expect(await confirmar(cofre, 4, deps)).toMatchObject({ tipo: "registrado" });
    expect(posts).toMatchObject([{ valor_total: 2190 }]);
  });

  it("reserva que deixou de caber na regra do imóvel não é enviada", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ regras: { ...GRM301, capacidade: 1 } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toMatchObject({ tipo: "recusada" });
    expect(posts).toEqual([]);
    expect(estado().pendente).toBeNull();
  });

  it("catálogo fora do ar na confirmação: nada é enviado nem marcado", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ recotar: async () => { throw new Error("catálogo fora"); } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "catalogo" });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
  });
});

describe("resposta do webhook", () => {
  for (const status of [200, 202, 400, 422, 500, 503]) {
    it(`status ${status} não vira registrado`, async () => {
      const { cofre, estado } = cofreEmMemoria();
      const { deps, posts } = ambiente({ status });
      apresentarResumo(cofre, RESERVA, TOTAL, 2);
      expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "resposta" });
      expect(posts).toHaveLength(1);
      expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("falhou");
    });
  }

  it("tempo esgotado é resultado incerto: não registrado e sem nova tentativa", async () => {
    const { cofre } = cofreEmMemoria();
    let tentativas = 0;
    const { deps } = ambiente({ postar: async () => { tentativas++; throw new Error("tempo esgotado"); } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "incerto" });
    expect(await confirmar(cofre, 4, deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
    expect(tentativas).toBe(1);
  });
});

describe("envio desligado e destino", () => {
  it("com o envio desligado, a confirmação não gera POST nem registro (CA-17)", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ envioLigado: false });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "envio_desligado" });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
  });

  it("destino proibido não recebe POST", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente({ destinoPermitido: false });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, deps)).toEqual({ tipo: "nao_registrado", motivo: "destino_proibido" });
    expect(posts).toEqual([]);
  });

  it("o destino é real quando o webhook mora no host do catálogo", () => {
    expect(destinoDosLeads("https://api.exemplo.test/leads/tok", "https://api.exemplo.test/catalogo/tok")).toBe("real");
    expect(destinoDosLeads("https://falso.exemplo.test/leads/x", "https://api.exemplo.test/catalogo/tok")).toBe("falso");
    expect(destinoDosLeads(undefined, "https://api.exemplo.test/catalogo/tok")).toBe("real");
    expect(destinoDosLeads("não é url", "https://api.exemplo.test/catalogo/tok")).toBe("real");
  });

  it("fora de producao só o webhook falso é permitido", () => {
    expect(destinoPermitido("dev", "falso")).toBe(true);
    expect(destinoPermitido("dev", "real")).toBe(false);
    expect(destinoPermitido(undefined, "real")).toBe(false);
    expect(destinoPermitido("producao", "real")).toBe(true);
  });
});

describe("POST do lead", () => {
  it("manda os 7 campos em JSON e devolve o status", async () => {
    const pedidos: { url: string; init: RequestInit }[] = [];
    const buscar = (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return new Response('{"ok":true}', { status: 201 });
    }) as unknown as typeof fetch;
    const status = await postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL));
    expect(status).toBe(201);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.init.method).toBe("POST");
    expect(JSON.parse(pedidos[0]!.init.body as string)).toEqual({
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    });
  });

  it("o erro de rede não carrega a URL do webhook", async () => {
    const buscar = (async () => { throw new Error("falha em https://falso.exemplo.test/leads/segredo"); }) as unknown as typeof fetch;
    await expect(postarLead(buscar, "https://falso.exemplo.test/leads/segredo", corpoDoLead(RESERVA, TOTAL)))
      .rejects.toThrow(/^webhook de leads sem resposta$/);
  });
});
