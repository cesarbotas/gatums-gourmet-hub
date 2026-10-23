// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Interruptor de alvo de deploy. Mantem UMA base de codigo com saidas diferentes
// por ambiente, sem duplicar config:
//
//   DEPLOY_TARGET ausente | "vps"  -> PRODUCAO: servidor Node SSR em container
//     Docker na VPS Locaweb. nitro:false faz o tanstackStart gerar dist/server
//     (handler fetch) + dist/client, servidos por server/node-server.mjs.
//
//   DEPLOY_TARGET="vercel-spa"     -> HOMOLOGACAO (atual): SPA estatico na Vercel.
//     Sem servidor (nitro:false) + SPA mode do TanStack Start. A Vercel serve
//     os estaticos com fallback para o shell (vercel.json).
//
//   DEPLOY_TARGET="vercel-ssr"     -> FLEXIBILIDADE FUTURA: SSR serverless na
//     Vercel via nitro preset "vercel". Troca-se so a env no workflow; nada
//     de producao muda. (Pronto para ativar quando/se necessario.)
//
// Producao (vps) e o default e permanece inalterada.
const DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? "vps";

function configForTarget() {
  switch (DEPLOY_TARGET) {
    case "vercel-spa":
      return {
        // Sem servidor: build so-cliente.
        nitro: false as const,
        tanstackStart: {
          // SPA mode: pre-renderiza um shell e hidrata no cliente.
          spa: { enabled: true },
          server: { entry: "server" },
        },
      };
    case "vercel-ssr":
      return {
        // SSR serverless na Vercel (preset nitro oficial).
        nitro: { preset: "vercel" },
        tanstackStart: {
          server: { entry: "server" },
        },
      };
    case "vps":
    default:
      return {
        // nitro:false -> build de servidor Node (dist/server + dist/client).
        nitro: false as const,
        tanstackStart: {
          server: { entry: "server" },
        },
      };
  }
}

export default defineConfig(configForTarget());
