import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc", environment: "dev" },
      // Nenhum teste fala com a Cloudflare: o modelo é sempre um falso injetado.
      remoteBindings: false,
      miniflare: {
        bindings: {
          CATALOGO_URL: "https://catalogo.teste/catalogo/token-de-teste",
          LEADS_URL: "https://leads.teste/leads/token-de-teste",
          // Fixos aqui: um .dev.vars.dev local (usado na medição de modelos) não muda o teste.
          MODELO_RESERVA: "@cf/zai-org/glm-5.3-flash",
          AI_GATEWAY: "concierge-dev",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    // Nome de cada teste na saída: os critérios de aceite procuram por ele.
    reporters: ["verbose"],
  },
});
