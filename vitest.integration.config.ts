import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config dos testes INTEGRADOS de contrato (rodam contra a API local real).
// Rodam SÓ via `npm run test:integration` — nunca no `npm test` padrão, cujo
// `include` cobre apenas `tests/unit/**` e exclui `tests/integration/**`.
//
// CARRY da Task 1: o alias `@/` (tsconfig paths `@/* -> ./src/*`) exige um
// `resolve.alias` explícito ALÉM do plugin `vite-tsconfig-paths`, porque o
// `include` do tsconfig cobre apenas `src/**` e o plugin limita o escopo a ele.
// Sem o alias explícito a resolução a partir de `tests/**` falha.
//
// Ambiente `node` (sem DOM): estes testes só fazem fetch HTTP contra a API.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.{test,spec}.ts"],
    testTimeout: 8000,
  },
});
