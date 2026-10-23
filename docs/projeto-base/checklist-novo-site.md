# Checklist: criar um site novo a partir do projeto base

Passo a passo **em ordem** para derivar um site novo do projeto base
(TanStack Start + Vite + React 19 + Tailwind v4), a partir do estado atual do
repositório `gatums-gourmet-hub`.

Use este checklist junto da ficha de parâmetros
[`parametros.md`](./parametros.md) (valores de exemplo reais do Gatum's e onde
aplicar cada um) e do inventário
[`inventario-esqueleto-vs-conteudo.md`](./inventario-esqueleto-vs-conteudo.md)
(o que é esqueleto reutilizável vs. conteúdo específico). Este documento aponta
caminhos de arquivo; os valores concretos ficam na ficha de parâmetros.

> Convenção: marque cada item (`- [x]`) à medida que concluir. Os números entre
> parênteses (ex. "param. 2") remetem às linhas da ficha
> [`parametros.md`](./parametros.md).

## 1. Copiar/clonar o repositório base

- [ ] Clonar ou copiar o repositório base para o novo diretório do projeto.
- [ ] Remover o histórico de git antigo, se aplicável, e inicializar um novo
      repositório (`git init`) apontando para o remoto do novo site.
- [ ] Instalar dependências: `npm install`.
- [ ] Confirmar que o projeto sobe sem alterações antes de customizar:
      `npm run dev`.

## 2. Preencher a ficha de parâmetros

- [ ] Abrir [`parametros.md`](./parametros.md) e preencher a coluna de valores
      com os dados do **novo negócio** (nome da marca, cores, contatos, domínio,
      API, Pix, prefixo de storage, imagens).
- [ ] Usar essa ficha preenchida como fonte única de verdade durante as trocas
      do passo 3.

## 3. Trocar cada ponto do inventário

Agrupado por categoria, conforme o inventário. Em cada item, substitua o valor
do Gatum's pelo valor do novo negócio (registrado na ficha de parâmetros).

### 3.1. Branding/textos (param. 1, 2, 17)

- [ ] `package.json` — campo `name` (atual: `tanstack_start_ts`).
- [ ] `src/components/Navigation.tsx` — nome/identidade da marca.
- [ ] `src/components/Footer.tsx` — nome da marca e textos de rodapé.
- [ ] `src/routes/sobre.tsx` — textos institucionais.
- [ ] `src/routes/index.tsx` — hero, pilares e stats da home.
- [ ] Meta tags globais em `src/routes/__root.tsx` (título/descrição/marca).
- [ ] Meta tags por rota: `head()` de cada rota (ex. `src/routes/sobre.tsx`).

### 3.2. Cores/fontes (param. 3, 4, 5, 6)

- [ ] `src/styles.css` — tokens de cor OKLCH em `:root` **e** na variante
      `.dark`:
  - [ ] `--primary` (Gatum's: framboesa).
  - [ ] `--accent` (Gatum's: caramelo) — manter o alias `--copper` sincronizado.
  - [ ] `--secondary` (Gatum's: rosa-nude) — manter o alias `--sand`
        sincronizado.
- [ ] `src/styles.css` — fontes `--font-display` e `--font-sans`
      (Gatum's: Playfair Display + Inter).

### 3.3. Contatos/redes (param. 7, 8, 9, 10, 11)

- [ ] `src/routes/sobre.tsx`:
  - [ ] `EMAIL`.
  - [ ] `PHONE_DISPLAY`.
  - [ ] `WHATSAPP_NUMBER` (formato internacional, ex. `5513991341233`).
  - [ ] `INSTAGRAM`.
  - [ ] Cidade/estado.
- [ ] `src/components/Footer.tsx` — e-mail, telefone e cidade/estado.

### 3.4. API/ambiente (param. 12, 13)

- [ ] `.env*` — ajustar em **todos** os arquivos: `.env`, `.env.example`,
      `.env.development`, `.env.homologacao`, `.env.production`:
  - [ ] `VITE_API_BASE_URL` = **raiz** da API, **sem** a versão
        (ex. `https://gatumsgourmet.com.br`).
  - [ ] `VITE_API_VERSION` (ex. `v1`).
- [ ] `Dockerfile` — `ARG VITE_API_BASE_URL`. **Atenção à divergência** (ver
      nota abaixo): o default do `Dockerfile` traz a URL **com a versão
      anexada** (`.../api/v1`).

> **Nota importante — divergência do `VITE_API_BASE_URL`** (herdada da ficha de
> parâmetros): a env `VITE_API_BASE_URL` diverge entre as fontes. Os `.env*`
> guardam a **raiz** sem versão (ex. `https://gatumsgourmet.com.br`) e combinam
> com `VITE_API_VERSION`; já o `ARG` default do `Dockerfile` traz a URL **com a
> versão anexada** (`https://gatumsgourmet.com.br/api/v1`). Ajuste os **dois
> pontos de forma coerente** para o novo domínio, confirmando o comportamento em
> `src/lib/api/config.ts`.

### 3.5. Pix (param. 15)

- [ ] `src/lib/api/pagamentos.ts` — nome/cidade embutidos no payload Pix:
      `5913GATUMS GOURMET` (nome) e `6009SAO PAULO` (cidade). Trocar pelos dados
      do novo recebedor, mantendo o formato dos campos.

### 3.6. Prefixo de storage (param. 16)

- [ ] `src/lib/api/client.ts` — prefixo `gg.` (ex. `gg.session`).
- [ ] Demais services que leem/escrevem storage — alinhar o mesmo prefixo novo.

### 3.7. Imagens (param. 17)

- [ ] Substituir o asset `src/assets/hero-gourmet.jpg` pela imagem do novo site.
- [ ] Ajustar o import em `src/routes/index.tsx`
      (`import heroImage from "@/assets/hero-gourmet.jpg"`) caso o nome do
      arquivo mude.

## 4. Ajustar deploy (param. 1, 14)

- [ ] `deploy/nginx-host-site.conf` — `server_name` com o domínio do novo site.
- [ ] `docker-compose.production.yml` — nomes de container/rede (atuais:
      `gatums-site`, `gatums-site-net`).
- [ ] `.github/workflows/*` — host, path e projeto Vercel, além de
      `VITE_API_BASE_URL`/`VITE_API_VERSION` usados nos workflows
      (`deploy.yml`, `deploy-homologacao.yml`).

## 5. Validar (passo final, executável)

- [ ] `npm run dev` — subir localmente e conferir visualmente branding, cores,
      fontes, contatos e imagens do novo site.
- [ ] `npm run build` — garantir que o projeto **compila** sem erros.
- [ ] **Verificação de branding residual**: buscar textualmente no repositório
      por resíduos do Gatum's e confirmar que não sobrou nenhum. Termos a
      procurar (case-insensitive): `gatum`, `Gatums`, `GATUMS GOURMET`,
      `gatumsgourmet`, `gg.`, `SAO PAULO` (Pix), `app.gatumsgourmet.com.br`,
      `gatums-site`, `hero-gourmet`.
  - Exemplo (PowerShell):
    `Select-String -Path (Get-ChildItem -Recurse -File -Exclude node_modules) -Pattern 'gatum|gg\.' -SimpleMatch:$false`
  - Exemplo (ripgrep): `rg -i "gatum|gatums|gg\.|hero-gourmet" --glob '!node_modules'`
  - [ ] Nenhuma ocorrência inesperada remanescente (ou todas justificadas).
