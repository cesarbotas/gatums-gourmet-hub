# Ficha de parâmetros — projeto base reutilizável

Esta ficha lista os **parâmetros que mudam a cada novo site** derivado do
projeto base (TanStack Start + Vite + React 19 + Tailwind v4). Para cada
parâmetro há o **valor de exemplo real do Gatum's** (estado atual do repo) e
**onde aplicá-lo** ao clonar o esqueleto.

Complementa o inventário em
[`inventario-esqueleto-vs-conteudo.md`](./inventario-esqueleto-vs-conteudo.md):
cada linha de "conteúdo específico" daquele doc tem um parâmetro correspondente
aqui. Os valores referenciam caminhos de arquivo; não reproduzem trechos
extensos de código, para evitar drift com o código real.

## Parâmetros

| Parâmetro | Valor (exemplo Gatum's) | Onde aplicar |
|---|---|---|
| 1. Nome do projeto (package) | `tanstack_start_ts` | `package.json` (campo `name`); nomes de imagem/container/rede Docker em `docker-compose.production.yml` (`gatums-site`, `gatums-site-net`) |
| 2. Nome de exibição da marca | `Gatums Gourmet` | `src/components/Navigation.tsx`, `src/components/Footer.tsx`, meta tags (`src/routes/__root.tsx` e `head()` de cada rota, ex. `src/routes/sobre.tsx`) |
| 3. Cor primária (OKLCH) | framboesa `oklch(0.55 0.19 10)` | `src/styles.css` (`--primary`; variante escura em `.dark`) |
| 4. Cor accent (OKLCH) | caramelo `oklch(0.72 0.15 65)` | `src/styles.css` (`--accent`; alias `--copper`) |
| 5. Cor secundária (OKLCH) | rosa-nude `oklch(0.93 0.035 15)` | `src/styles.css` (`--secondary`; alias `--sand`) |
| 6. Fontes | Playfair Display (display) + Inter (sans) | `src/styles.css` (`--font-display`, `--font-sans`) |
| 7. E-mail | `gatumsgourmet@gmail.com` | `src/routes/sobre.tsx` (`EMAIL`), `src/components/Footer.tsx` |
| 8. Telefone | `(13) 9 9134-1233` | `src/routes/sobre.tsx` (`PHONE_DISPLAY`), `src/components/Footer.tsx` |
| 9. WhatsApp (formato internacional) | `5513991341233` | `src/routes/sobre.tsx` (`WHATSAPP_NUMBER`) |
| 10. Instagram | `gatumsgourmet` | `src/routes/sobre.tsx` (`INSTAGRAM`) |
| 11. Cidade/Estado | Santos, SP | `src/routes/sobre.tsx`, `src/components/Footer.tsx` |
| 12. `VITE_API_BASE_URL` | raiz da API, ex. `https://gatumsgourmet.com.br` | `.env*` (`.env`, `.env.example`, `.env.development`, `.env.homologacao`, `.env.production`), `Dockerfile` (`ARG VITE_API_BASE_URL`), `.github/workflows/*` |
| 13. `VITE_API_VERSION` | `v1` | `.env*`, `.github/workflows/*` |
| 14. Domínio do site | `app.gatumsgourmet.com.br` | `deploy/nginx-host-site.conf` (`server_name`), `.github/workflows/*` (host, path, projeto Vercel) |
| 15. Nome no Pix / cidade | `GATUMS GOURMET` / `SAO PAULO` | `src/lib/api/pagamentos.ts` (`5913GATUMS GOURMET`, `6009SAO PAULO`) |
| 16. Prefixo de storage | `gg.` (ex. `gg.session`) | `src/lib/api/client.ts` (`localStorage` `gg.session`) e services que leem/escrevem storage |
| 17. Imagens (hero) | `src/assets/hero-gourmet.jpg` | `src/assets/`; referência via import em `src/routes/index.tsx` (`import heroImage from "@/assets/hero-gourmet.jpg"`) |

## Observações

- **`VITE_API_BASE_URL` no Dockerfile**: o `ARG` default do `Dockerfile` traz a
  URL já com a versão anexada (`https://gatumsgourmet.com.br/api/v1`), enquanto
  os `.env*` guardam apenas a raiz (`https://gatumsgourmet.com.br`) e combinam
  com `VITE_API_VERSION` em runtime/build. Ao parametrizar, ajuste os dois
  pontos de forma coerente (ver `src/lib/api/config.ts`).
- **Meta tags**: além do título/descrição por rota, há metadados globais em
  `src/routes/__root.tsx`; troque a marca em ambos.
- **Aliases de cor**: `--copper` e `--sand` em `src/styles.css` são apelidos de
  accent/secondary; mantenha-os sincronizados se renomear a paleta.

## Cobertura do inventário

Checagem de que cada linha de "conteúdo específico" do inventário tem parâmetro
correspondente nesta ficha:

| Linha do inventário | Parâmetros desta ficha |
|---|---|
| Branding/textos | 1, 2, 17 |
| Cores/fontes | 3, 4, 5, 6 |
| Contatos/redes | 7, 8, 9, 10, 11 |
| API/ambiente | 12, 13 |
| Domínio/deploy | 1 (container/rede), 14 |
| Dados embutidos no código | 15 (Pix), 16 (prefixo storage) |
| Assets | 17 |
