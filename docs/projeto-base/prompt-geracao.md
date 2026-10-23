# Prompt de geração assistida por IA (opção B)

Este documento traz o **prompt** que você cola em um agente de IA com acesso ao
repositório para adaptar o projeto base (TanStack Start + Vite + React 19 +
Tailwind v4) a um novo negócio de forma automática. Uso: preencha a ficha de
parâmetros (ver [`parametros.md`](./parametros.md)) com os valores do novo site,
cole o bloco de prompt abaixo **seguido da sua ficha preenchida** na seção
`### Ficha preenchida`, e envie tudo a um agente de IA que enxergue este repo. O
agente usará o inventário e a ficha como fonte de verdade sobre o que trocar e o
que preservar.

## O prompt

```text
Você vai adaptar um projeto base reutilizável a um novo negócio.

CONTEXTO
- Este repositório é um projeto base reutilizável: TanStack Start + Vite +
  React 19 + Tailwind v4. O objetivo é clonar o esqueleto e trocar apenas o
  conteúdo específico, produzindo um novo site a partir dos dados que eu
  forneço na "Ficha preenchida" ao final deste prompt.

FONTE DE VERDADE (leia ANTES de qualquer alteração)
- docs/projeto-base/inventario-esqueleto-vs-conteudo.md
    → mapeia o esqueleto reutilizável (NÃO tocar) vs o conteúdo específico
      (trocar). É a lista autoritativa de quais arquivos podem ser alterados.
- docs/projeto-base/parametros.md
    → ficha de parâmetros: cada parâmetro, o valor de exemplo atual (Gatum's)
      e onde aplicá-lo. Use-a para mapear cada valor da minha ficha ao arquivo
      e símbolo corretos.

REGRA DE OURO
- Aplique as trocas APENAS nos arquivos listados como "conteúdo específico do
  projeto" no inventário. NÃO toque em nenhum arquivo do "esqueleto
  reutilizável" (vite.config.ts, server/node-server.mjs, src/server.ts,
  src/start.ts, dev-local.mjs, src/components/ui/*, src/lib/utils.ts,
  src/lib/api/client.ts/config.ts/paginação, src/lib/auth-context.tsx,
  src/lib/cart-context.tsx, estrutura de rotas). Exceção: pontos de
  "conteúdo embutido em código" explicitamente citados na ficha (ex.: Pix em
  src/lib/api/pagamentos.ts, prefixo de storage em src/lib/api/client.ts).

O QUE TROCAR (guiado pela ficha; caminhos exatos vêm de parametros.md)
1. Branding e textos: nome de exibição da marca e cópias em
   src/components/Navigation.tsx, src/components/Footer.tsx,
   src/routes/sobre.tsx e src/routes/index.tsx (hero/pilares/stats).
2. Cores e fontes: tokens OKLCH e --font-* em src/styles.css (inclua a variante
   .dark e mantenha os aliases --copper/--sand sincronizados com accent/secondary).
3. Contatos e redes: e-mail, telefone, WhatsApp, Instagram, cidade/estado em
   src/routes/sobre.tsx (EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER, INSTAGRAM) e
   src/components/Footer.tsx.
4. Meta tags: marca e descrição em src/routes/__root.tsx (metadados globais) e
   no head() de cada rota (ex.: src/routes/sobre.tsx).
5. API/ambiente: VITE_API_BASE_URL e VITE_API_VERSION nos arquivos .env*
   (.env, .env.example, .env.development, .env.homologacao, .env.production),
   no Dockerfile (ARG VITE_API_BASE_URL) e em .github/workflows/*.
   ATENÇÃO à divergência documentada: o ARG do Dockerfile traz a URL JÁ com a
   versão anexada (ex.: https://dominio/api/v1), enquanto os .env* guardam só a
   raiz (ex.: https://dominio) e combinam com VITE_API_VERSION. Ajuste os dois
   pontos de forma coerente (ver src/lib/api/config.ts).
6. Pix: nome e cidade em src/lib/api/pagamentos.ts (campos 5913... e 6009...).
7. Prefixo de storage: ex. "gg." em src/lib/api/client.ts e nos services que
   leem/escrevem storage.
8. Imagens: substitua os assets em src/assets/ (ex.: hero) e mantenha os
   imports que os referenciam (ex.: src/routes/index.tsx).

DEPLOY
- Domínio: server_name em deploy/nginx-host-site.conf.
- Nomes de container/rede: docker-compose.production.yml (ex.: gatums-site,
  gatums-site-net) e o name de package.json.
- Workflows: .github/workflows/* (host, path, projeto Vercel, variáveis de API).

VALIDAÇÃO FINAL (obrigatória)
- Rode `npm run build` e garanta que o build passa.
- Busque branding residual no código e reporte qualquer ocorrência remanescente:
  procure por termos como "gatum", "gg." (prefixo de storage), "GATUMS GOURMET",
  "gatumsgourmet" e o domínio antigo. Liste o que encontrou e onde.
- Entregue um resumo das alterações por categoria e dos arquivos do esqueleto
  que você deliberadamente NÃO tocou.
```

### Ficha preenchida

Cole aqui a ficha de [`parametros.md`](./parametros.md) com os valores do **novo
site** (substitua os exemplos do Gatum's pelos seus). O agente lerá esta tabela
como os valores-alvo das trocas.

```text
| Parâmetro | Valor (novo site) | Onde aplicar |
|---|---|---|
| 1. Nome do projeto (package) | <preencher> | package.json (name); container/rede em docker-compose.production.yml |
| 2. Nome de exibição da marca | <preencher> | Navigation.tsx, Footer.tsx, meta tags (__root.tsx e head() de cada rota) |
| 3. Cor primária (OKLCH) | <preencher> | src/styles.css (--primary; variante .dark) |
| 4. Cor accent (OKLCH) | <preencher> | src/styles.css (--accent; alias --copper) |
| 5. Cor secundária (OKLCH) | <preencher> | src/styles.css (--secondary; alias --sand) |
| 6. Fontes | <preencher> | src/styles.css (--font-display, --font-sans) |
| 7. E-mail | <preencher> | sobre.tsx (EMAIL), Footer.tsx |
| 8. Telefone | <preencher> | sobre.tsx (PHONE_DISPLAY), Footer.tsx |
| 9. WhatsApp (formato internacional) | <preencher> | sobre.tsx (WHATSAPP_NUMBER) |
| 10. Instagram | <preencher> | sobre.tsx (INSTAGRAM) |
| 11. Cidade/Estado | <preencher> | sobre.tsx, Footer.tsx |
| 12. VITE_API_BASE_URL | <preencher> | .env*, Dockerfile (ARG), .github/workflows/* |
| 13. VITE_API_VERSION | <preencher> | .env*, .github/workflows/* |
| 14. Domínio do site | <preencher> | deploy/nginx-host-site.conf (server_name), .github/workflows/* |
| 15. Nome no Pix / cidade | <preencher> | src/lib/api/pagamentos.ts (5913..., 6009...) |
| 16. Prefixo de storage | <preencher> | src/lib/api/client.ts e services de storage |
| 17. Imagens (hero) | <preencher> | src/assets/; import em src/routes/index.tsx |
```

> Dica: mantenha a coluna "Onde aplicar" como está — ela já aponta os caminhos
> exatos derivados de [`parametros.md`](./parametros.md). Preencha apenas a
> coluna de valores do novo site.
