// Trava do webhook real em dev depois do catálogo próprio (rodada pós-entrega). A regra
// antiga ("real" = mesmo host do catálogo) deixava de proteger dev quando o catálogo saiu do
// host de terceiros: um LEADS_URL apontado para o webhook real passaria como "falso". Com o
// host do falso informado (secret LEADS_HOST_FALSO), só ele vale como falso.
import { describe, expect, it } from "vitest";
import { destinoDosLeads, destinoPermitido } from "../src/lead";

const CATALOGO_PROPRIO = "https://catalogo.exemplo.test/catalogo/seg";
const FALSO = "falso.exemplo.test";

describe("destino dos leads com o host do falso informado", () => {
  it("só o host do falso é falso; qualquer outro é real e fica proibido em dev", () => {
    expect(destinoDosLeads(`https://${FALSO}/leads/seg`, CATALOGO_PROPRIO, FALSO)).toBe("falso");
    const terceiro = destinoDosLeads("https://api.terceiro.test/leads/tok", CATALOGO_PROPRIO, FALSO);
    expect(terceiro).toBe("real");
    expect(destinoPermitido("dev", terceiro)).toBe(false);
    expect(destinoDosLeads("não é url", CATALOGO_PROPRIO, FALSO)).toBe("real");
  });

  it("fora de producao, sem o host do falso, todo destino é real (revisão: lado seguro)", () => {
    expect(destinoDosLeads(`https://${FALSO}/leads/seg`, CATALOGO_PROPRIO, undefined, true)).toBe("real");
    expect(destinoDosLeads(`https://${FALSO}/leads/seg`, CATALOGO_PROPRIO, "", true)).toBe("real");
    expect(destinoDosLeads(`https://${FALSO}/leads/seg`, CATALOGO_PROPRIO, FALSO, true)).toBe("falso");
  });

  it("host do falso vazio vale como ausente: regra antiga", () => {
    expect(destinoDosLeads(`https://${FALSO}/leads/seg`, CATALOGO_PROPRIO, "")).toBe("falso");
    expect(destinoDosLeads("https://api.exemplo.test/leads/tok", "https://api.exemplo.test/catalogo/tok", undefined)).toBe("real");
  });
});
