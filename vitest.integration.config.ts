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
    // Execução SERIAL entre arquivos. Os testes de contrato batem numa única
    // API local e cada arquivo faz `loginAdmin()` (hash de senha / bcrypt) +
    // probe `apiOnline()` no topo. Com paralelismo de arquivos (default do
    // Vitest), 8 arquivos disparam login/probe ao mesmo tempo e saturam a API,
    // estourando o timeout de 8s (login) e o probe de 3s (vira skip). Rodar os
    // arquivos em série mantém a suíte determinística e verde.
    fileParallelism: false,
  },
});
