import { describe, expect, it } from "vitest";
import {
  apresentarResumo, camposApontados, chaveDaReserva, confirmar, corpoDoLead, destinoDosLeads, destinoPermitido, ESTADO_INICIAL,
  invalidarPendente, LeadRecusado, postarLead, type Cofre, type CorpoDoLead, type DependenciasDoEnvio, type EstadoLead,
  type Reserva, type SituacaoEnvio,
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
    expect(await confirmar(cofre, 5, "sim", deps)).toEqual({ tipo: "sem_resumo" });
    expect(posts).toEqual([]);
  });

  it("resumo e confirmação no mesmo turno não enviam nada", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 2, "sim", deps)).toEqual({ tipo: "mesmo_turno" });
    expect(posts).toEqual([]);
  });

  it("resumo num turno e confirmação em outro enviam 1 lead com os 7 campos", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toMatchObject({ tipo: "registrado" });
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
    await confirmar(cofre, 3, "sim", deps);
    expect(await confirmar(cofre, 4, "sim", deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("o mesmo resumo apresentado de novo depois do registro não gera segundo lead", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, "sim", deps);
    apresentarResumo(cofre, { ...RESERVA, telefone: "11 98888 0000" }, TOTAL, 4);
    expect(await confirmar(cofre, 5, "sim", deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("duas confirmações ao mesmo tempo enviam exatamente 1 lead", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    const resultados = await Promise.all([confirmar(cofre, 3, "sim", deps), confirmar(cofre, 3, "sim", deps)]);
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
    await confirmar(cofre, 3, "sim", deps);
    expect(marcadorNaHoraDoPost).toBe("enviando");
  });

  it("reinício no meio do envio: o marcador 'enviando' impede um segundo POST", async () => {
    const { cofre } = cofreEmMemoria({
      pendente: { reserva: RESERVA, totalCentavos: TOTAL, turno: 2 },
      envios: { [chaveDaReserva(RESERVA)]: "enviando" },
    });
    const { deps, posts } = ambiente();
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
    expect(posts).toEqual([]);
  });

  it("mudança de dado depois do resumo invalida a confirmação pendente", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    invalidarPendente(cofre);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "sem_resumo" });
    expect(posts).toEqual([]);
  });

  it("invalidar não apaga o resumo de uma reserva já registrada", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    await confirmar(cofre, 3, "sim", deps);
    invalidarPendente(cofre);
    expect(estado().pendente).not.toBeNull();
    expect(await confirmar(cofre, 4, "sim", deps)).toMatchObject({ tipo: "ja_registrado" });
    expect(posts).toHaveLength(1);
  });

  it("novo resumo substitui o anterior e exige confirmação em turno posterior a ele", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente();
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    apresentarResumo(cofre, { ...RESERVA, checkout: "2027-01-17" }, 156600, 3);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "mesmo_turno" });
    expect(await confirmar(cofre, 4, "sim", deps)).toMatchObject({ tipo: "registrado" });
    expect(posts).toMatchObject([{ checkout: "2027-01-17", valor_total: 1566 }]);
  });

  it("total diferente na releitura da ficha: não envia e pede nova confirmação", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ regras: { ...GRM301, diariaCentavos: 60000 } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    const r = await confirmar(cofre, 3, "sim", deps);
    expect(r).toMatchObject({ tipo: "total_mudou", pendente: { totalCentavos: 219000, turno: 3 } });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
    // O novo resumo foi mostrado no turno 3: só um turno seguinte confirma, com o total novo.
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "mesmo_turno" });
    expect(await confirmar(cofre, 4, "sim", deps)).toMatchObject({ tipo: "registrado" });
    expect(posts).toMatchObject([{ valor_total: 2190 }]);
  });

  it("reserva que deixou de caber na regra do imóvel não é enviada", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ regras: { ...GRM301, capacidade: 1 } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toMatchObject({ tipo: "recusada" });
    expect(posts).toEqual([]);
    expect(estado().pendente).toBeNull();
  });

  it("catálogo fora do ar na confirmação: nada é enviado nem marcado", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ recotar: async () => { throw new Error("catálogo fora"); } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "catalogo" });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
  });
});

describe("resposta do webhook (L11)", () => {
  /** Webhook que devolve os status da lista, um por POST; `Error` na lista é resposta que não chegou. */
  function webhook(...respostas: (number | Error)[]) {
    const fila = [...respostas];
    let posts = 0;
    const postar = async () => {
      posts++;
      const r = fila.shift();
      if (r === undefined) throw new Error("POST a mais do que o teste previa");
      if (r instanceof Error) throw r;
      return r;
    };
    return { postar, posts: () => posts };
  }

  for (const status of [200, 202, 204]) {
    it(`status ${status}: 2xx diferente de 201 é incerto, 1 POST, e a reserva não é enviada de novo (P14)`, async () => {
      const { cofre, estado } = cofreEmMemoria();
      const w = webhook(status);
      const { deps } = ambiente({ postar: w.postar });
      apresentarResumo(cofre, RESERVA, TOTAL, 2);
      expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "incerto" });
      expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("incerto");
      apresentarResumo(cofre, RESERVA, TOTAL, 4);
      expect(await confirmar(cofre, 5, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
      expect(w.posts()).toBe(1);
    });
  }

  for (const status of [301, 400, 401, 403, 404, 422]) {
    it(`status ${status}: não registrado, 1 POST, e a reserva fica bloqueada na sessão (P14)`, async () => {
      const { cofre, estado } = cofreEmMemoria();
      const w = webhook(status);
      const { deps } = ambiente({ postar: w.postar });
      apresentarResumo(cofre, RESERVA, TOTAL, 2);
      expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "resposta" });
      expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("recusado");
      // A confirmação foi gasta: outro sim, sem novo resumo, não envia.
      expect(estado().pendente).toBeNull();
      expect(await confirmar(cofre, 4, "sim", deps)).toEqual({ tipo: "sem_resumo" });
      // Novo resumo da mesma reserva também não envia.
      apresentarResumo(cofre, RESERVA, TOTAL, 5);
      expect(await confirmar(cofre, 6, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_recusado" });
      expect(w.posts()).toBe(1);
    });
  }

  for (const status of [500, 502, 503]) {
    it(`status ${status} persistente: exatamente uma nova tentativa, depois não registrado e reserva bloqueada (P14)`, async () => {
      const { cofre, estado } = cofreEmMemoria();
      const w = webhook(status, status);
      const { deps } = ambiente({ postar: w.postar });
      apresentarResumo(cofre, RESERVA, TOTAL, 2);
      expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "resposta" });
      expect(w.posts()).toBe(2);
      expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("recusado");
      apresentarResumo(cofre, RESERVA, TOTAL, 4);
      expect(await confirmar(cofre, 5, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_recusado" });
      expect(w.posts()).toBe(2);
    });
  }

  it("500 e depois 201 na nova tentativa: registrado, com o mesmo corpo nos dois POSTs", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const corpos: CorpoDoLead[] = [];
    const { deps } = ambiente({ postar: async (corpo) => { corpos.push(corpo); return corpos.length === 1 ? 500 : 201; } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toMatchObject({ tipo: "registrado" });
    expect(corpos).toHaveLength(2);
    expect(corpos[1]).toEqual(corpos[0]);
    expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("registrado");
  });

  it("500 e depois 422 na nova tentativa: não registrado, sem terceira tentativa", async () => {
    const { cofre } = cofreEmMemoria();
    const w = webhook(500, 422);
    const { deps } = ambiente({ postar: w.postar });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "resposta" });
    expect(w.posts()).toBe(2);
  });

  it("tempo esgotado é resultado incerto: sem nova tentativa, e a reserva não é reenviada na sessão (CA-19)", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const w = webhook(new Error("tempo esgotado"));
    const { deps } = ambiente({ postar: w.postar });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "incerto" });
    expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("incerto");
    expect(await confirmar(cofre, 4, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
    // Nem com um resumo novo da mesma reserva.
    apresentarResumo(cofre, RESERVA, TOTAL, 5);
    expect(await confirmar(cofre, 6, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
    expect(w.posts()).toBe(1);
  });

  it("500 e depois tempo esgotado na nova tentativa: incerto, e não 'não registrado'", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const w = webhook(500, new Error("tempo esgotado"));
    const { deps } = ambiente({ postar: w.postar });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "incerto" });
    expect(w.posts()).toBe(2);
    expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("incerto");
  });

  it("422 que aponta um dado do hóspede: pede a correção, e o resumo corrigido é enviado", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const corpos: CorpoDoLead[] = [];
    const { deps } = ambiente({
      postar: async (corpo) => {
        corpos.push(corpo);
        if (corpo.nome === "A") throw new LeadRecusado(["nome"]);
        return 201;
      },
    });
    apresentarResumo(cofre, { ...RESERVA, nome: "A" }, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "campo_recusado", campos: ["nome"] });
    expect(estado().pendente).toBeNull();
    // O nome não entra na chave da reserva: a correção dele cai na mesma chave e precisa poder ser enviada.
    apresentarResumo(cofre, RESERVA, TOTAL, 4);
    expect(await confirmar(cofre, 5, "sim", deps)).toMatchObject({ tipo: "registrado" });
    expect(corpos.map((c) => c.nome)).toEqual(["A", "Ana Lima"]);
    expect(estado().envios[chaveDaReserva(RESERVA)]).toBe("registrado");
  });

  it("422 que não aponta dado do hóspede: não registrado, sem pedido de correção", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps } = ambiente({ postar: async () => { throw new LeadRecusado([]); } });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "resposta" });
  });

  for (const marcador of ["falhou", "enviando", "incerto"]) {
    it(`marcador "${marcador}" já gravado bloqueia a reserva como resultado incerto`, async () => {
      const { cofre } = cofreEmMemoria({
        pendente: { reserva: RESERVA, totalCentavos: TOTAL, turno: 2 },
        // "falhou" é de estado gravado antes da separação dos marcadores.
        envios: { [chaveDaReserva(RESERVA)]: marcador as SituacaoEnvio },
      });
      const { deps, posts } = ambiente();
      expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "ja_tentado" });
      expect(posts).toEqual([]);
    });
  }
});

describe("leitura do corpo do 422", () => {
  const casos: [string, string, string[]][] = [
    ["formato do webhook falso", '{"erros":[{"campo":"telefone","erro":"obrigatorio"}]}', ["telefone"]],
    ["dois campos", '{"erros":[{"campo":"checkin","erro":"data invalida"},{"campo":"checkout","erro":"data invalida"}]}', ["checkin", "checkout"]],
    ["lista de textos", '{"errors":["hospedes must be an integer"]}', ["hospedes"]],
    ["caminho do campo em lista", '{"detail":[{"loc":["body","nome"],"msg":"field required"}]}', ["nome"]],
    ["campo como chave", '{"imovel_id":["nao encontrado"]}', ["imovel_id"]],
    ["texto solto com acento", "Telefone inválido; número de hóspedes inválido", ["telefone", "hospedes"]],
    ["imóvel em prosa", "imóvel não encontrado", ["imovel_id"]],
    ["valor_total não é dado do hóspede", '{"erros":[{"campo":"valor_total","erro":"invalido"}]}', []],
    ["valor_total junto com outro campo", '{"erros":[{"campo":"valor_total"},{"campo":"nome"}]}', []],
    ["eco do lead inteiro não aponta nada", '{"erro":"invalido","recebido":{"nome":"A","telefone":"1","imovel_id":"X","checkin":"a","checkout":"b","hospedes":1}}', []],
    ["sem campo", '{"erro":"corpo invalido"}', []],
    ["campo que não é do lead", '{"erros":[{"campo":"corpo","erro":"json invalido"}]}', []],
    ["vazio", "", []],
    ["não é JSON", "<html>Unprocessable Entity</html>", []],
    ["nome de campo dentro de outra palavra", "sobrenome ausente", []],
  ];
  for (const [nome, corpo, esperado] of casos) {
    it(nome, () => expect(camposApontados(corpo)).toEqual(esperado));
  }
});

describe("envio desligado e destino", () => {
  it("com o envio desligado, a confirmação não gera POST nem registro (CA-17)", async () => {
    const { cofre, estado } = cofreEmMemoria();
    const { deps, posts } = ambiente({ envioLigado: false });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "envio_desligado" });
    expect(posts).toEqual([]);
    expect(estado().envios).toEqual({});
  });

  it("destino proibido não recebe POST", async () => {
    const { cofre } = cofreEmMemoria();
    const { deps, posts } = ambiente({ destinoPermitido: false });
    apresentarResumo(cofre, RESERVA, TOTAL, 2);
    expect(await confirmar(cofre, 3, "sim", deps)).toEqual({ tipo: "nao_registrado", motivo: "destino_proibido" });
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
    // Sem seguir redirecionamento: um 307 não leva o corpo a outro host.
    expect(pedidos[0]!.init.redirect).toBe("manual");
    expect(JSON.parse(pedidos[0]!.init.body as string)).toEqual({
      nome: "Ana Lima", telefone: "(11) 98888-0000", imovel_id: "GRM-301",
      checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, valor_total: 2156,
    });
  });

  it("tempo esgotado: exatamente 1 fetch, sem nova tentativa", async () => {
    let fetches = 0;
    // Webhook que nunca responde: só termina quando o sinal de tempo esgotado aborta.
    const buscar = ((_url: string, init: RequestInit) => {
      fetches++;
      return new Promise<Response>((_, rejeitar) => init.signal!.addEventListener("abort", () => rejeitar(new Error("abortado"))));
    }) as unknown as typeof fetch;
    await expect(postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL), 30)).rejects.toThrow("sem resposta");
    expect(fetches).toBe(1);
  });

  it("422: lança LeadRecusado com os dados que o corpo aponta, em 1 fetch", async () => {
    let fetches = 0;
    const buscar = (async () => {
      fetches++;
      return Response.json({ erros: [{ campo: "telefone", erro: "obrigatorio" }] }, { status: 422 });
    }) as unknown as typeof fetch;
    const erro = await postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(LeadRecusado);
    expect((erro as LeadRecusado).campos).toEqual(["telefone"]);
    expect(fetches).toBe(1);
  });

  it("422 com corpo que não dá para ler continua sendo 422, não resultado incerto", async () => {
    const corpo = new ReadableStream({ start: (c) => c.error(new Error("conexão caiu")) });
    const buscar = (async () => new Response(corpo, { status: 422 })) as unknown as typeof fetch;
    const erro = await postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(LeadRecusado);
    expect((erro as LeadRecusado).campos).toEqual([]);
  });

  it("201 com corpo que não dá para descartar continua sendo 201", async () => {
    const corpo = new ReadableStream({ start: (c) => c.error(new Error("conexão caiu")) });
    const buscar = (async () => new Response(corpo, { status: 201 })) as unknown as typeof fetch;
    expect(await postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL))).toBe(201);
  });

  it("redirecionamento não vira registrado", async () => {
    const buscar = (async () => new Response(null, { status: 307, headers: { location: "https://outro.exemplo.test/" } })) as unknown as typeof fetch;
    expect(await postarLead(buscar, "https://falso.exemplo.test/leads/x", corpoDoLead(RESERVA, TOTAL))).toBe(307);
  });

  it("o erro de rede não carrega a URL do webhook", async () => {
    const buscar = (async () => { throw new Error("falha em https://falso.exemplo.test/leads/segredo"); }) as unknown as typeof fetch;
    await expect(postarLead(buscar, "https://falso.exemplo.test/leads/segredo", corpoDoLead(RESERVA, TOTAL)))
      .rejects.toThrow(/^webhook de leads sem resposta$/);
  });
});
