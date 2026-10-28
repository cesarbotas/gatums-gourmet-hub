import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config padrão dos testes unitários.
// O alias `@/` (tsconfig paths `@/* -> ./src/*`) é resolvido de duas formas
// complementares: o plugin vite-tsconfig-paths e um `resolve.alias` explícito.
// O alias explícito garante a resolução a partir de `tests/**`, já que o
// `include` do tsconfig cobre apenas `src/**` e o plugin limita o escopo a ele.
// Inclui apenas `tests/unit/**` e exclui explicitamente `tests/integration/**`
// (os testes de integração rodam sob demanda com `npm run test:integration`).
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    // Testes de componente (React Testing Library + user-event + render completo)
    // podem passar dos 5s default sob paralelismo quando a suíte cresce — ex.:
    // login-form.test.tsx ficava intermitentemente lento. 15s dá folga sem
    // afrouxar nenhuma asserção (só o orçamento de tempo).
    testTimeout: 15000,
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "tests/integration/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.idea/**",
      "**/.git/**",
      "**/.cache/**",
    ],
  },
});
