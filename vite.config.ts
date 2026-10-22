// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
export default defineConfig({
  // Deploy alvo: servidor Node SSR em container Docker na VPS Locaweb (nao Cloudflare).
  // `nitro: false` desliga o plugin de deploy; o tanstackStart gera um build de
  // servidor Node (dist/server + dist/client), servido por server/node-server.mjs.
  // (No preset v2 a antiga opcao `cloudflare: false` foi substituida por `nitro: false`.)
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
  },
});
