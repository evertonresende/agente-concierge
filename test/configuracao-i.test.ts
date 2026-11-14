import { describe, expect, it } from "vitest";
import cru from "../wrangler.jsonc?raw";

// Fixa o que o Éverton decidiu para o modelo em cada ambiente, lido do próprio
// wrangler.jsonc publicado.
type Vars = Record<string, string>;

/** Tira os comentários `//` fora de texto entre aspas e lê o JSON. */
function lerJsonc(texto: string): { env: Record<string, { vars: Vars }> } {
  const semComentario = texto.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (trecho, aspas: string | undefined) => aspas ?? "");
  return JSON.parse(semComentario);
}

const { env } = lerJsonc(cru);

describe("configuração do modelo por ambiente (wrangler.jsonc)", () => {
  it.each([
    ["dev", "concierge-dev", "ligado"],
    ["producao", "concierge-producao", "ligado"],
  ])("%s: Haiku 5.5 em nível alto, reserva GLM-5.3 Flash, gateway %s, envio de leads %s", (nome, gateway, envio) => {
    expect(env[nome]!.vars).toMatchObject({
      MODELO: "anthropic/claude-haiku-5.5",
      MODELO_ESFORCO: "high",
      MODELO_RESERVA: "@cf/zai-org/glm-5.3-flash",
      AI_GATEWAY: gateway,
      ENVIO_LEADS: envio,
    });
  });

  it.each(["dev", "producao"])("%s: URLs de pré-visualização desligadas (preview_urls: false)", (nome) => {
    expect((env[nome] as unknown as { preview_urls?: unknown }).preview_urls).toBe(false);
  });
});
