// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  // Deploy alvo: servidor Node SSR em container Docker na VPS Locaweb (não Cloudflare).
  // Desligar o plugin Cloudflare faz o tanstackStart gerar um build de servidor Node
  // (nitro) em .output/, servível por `node .output/server/index.mjs`.
  // Para voltar ao alvo Cloudflare, remova a linha `cloudflare: false`.
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
});
