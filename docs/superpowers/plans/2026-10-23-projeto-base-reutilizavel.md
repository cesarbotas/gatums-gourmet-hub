# Projeto Base Reutilizável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar, em `docs/projeto-base/`, o conjunto de documentos que descreve o esqueleto reutilizável do repo, mapeia os pontos de parametrização e fornece checklist + prompt para gerar novos sites.

**Architecture:** Entrega documental (opção B). Seis arquivos markdown em `docs/projeto-base/`, cada um com uma responsabilidade única, referenciando caminhos de arquivo do repo em vez de duplicar código. Nenhuma mudança em código de produção.

**Tech Stack:** Markdown. Nenhuma dependência nova. Projeto base alvo: TanStack Start + Vite + React 19 + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-23-projeto-base-reutilizavel-design.md`

## Global Constraints

- Todos os documentos ficam sob `docs/projeto-base/` (dentro do repo, versionados no git).
- Documentos referenciam caminhos de arquivo; não copiam trechos extensos de código, para evitar drift.
- Idioma: português (consistente com os demais docs do repo).
- Os valores de exemplo usam os dados reais atuais do Gatum's como referência preenchida.
- Nenhuma alteração em código de produção nesta entrega.

## Review Focus

- **Caminho de arquivo incorreto no inventário** — um leitor seguindo o doc não encontra o arquivo. Verificação: conferir cada caminho citado contra a árvore real do repo antes do commit.
- **Parâmetro específico esquecido (branding residual)** — ex.: nome no Pix ou prefixo `gg.` de storage não listados, gerando site novo com dado do Gatum's. Verificação: a ficha de `parametros.md` cobre todos os itens da tabela do inventário.
- **Checklist que não fecha o ciclo** — passo a passo sem o comando de validação (`npm run dev`/`build`). Verificação: o checklist termina em validação executável.
- **Prompt de geração ambíguo** — IA não sabe quais arquivos tocar. Verificação: o prompt aponta para o inventário e a ficha como fonte de verdade.
- **Nota do repo de skills perdida** — requisito do usuário de registrar a intenção futura. Verificação: seção presente em `evolucao-gerador.md`.

---

## File Structure

- `docs/projeto-base/README.md` — índice e porta de entrada.
- `docs/projeto-base/inventario-esqueleto-vs-conteudo.md` — mapa esqueleto vs conteúdo.
- `docs/projeto-base/parametros.md` — ficha de parâmetros com exemplo Gatum's.
- `docs/projeto-base/checklist-novo-site.md` — passo a passo manual.
- `docs/projeto-base/prompt-geracao.md` — prompt para IA (opção B).
- `docs/projeto-base/evolucao-gerador.md` — visão opção C + nota repo de skills.

---

### Task 1: Inventário esqueleto vs conteúdo

**Files:**
- Create: `docs/projeto-base/inventario-esqueleto-vs-conteudo.md`

**Interfaces:**
- Consumes: seção "Inventário" do spec.
- Produces: a tabela "conteúdo específico" e a lista de arquivos do esqueleto, referenciadas pelos docs de parâmetros, checklist e prompt.

- [ ] **Step 1:** Escrever o doc com duas seções: "Esqueleto reutilizável" (lista de arquivos/pastas do spec: `vite.config.ts`, `server/node-server.mjs`, `src/server.ts`, `src/start.ts`, `dev-local.mjs`, `Dockerfile`, `src/components/ui/*`, `src/lib/utils.ts`, `src/lib/api/`, `src/lib/auth-context.tsx`, `src/lib/cart-context.tsx`, estrutura de rotas) e "Conteúdo específico" (a tabela Categoria → Onde está do spec).
- [ ] **Step 2:** Conferir cada caminho de arquivo citado contra a árvore real do repo (via listagem). Corrigir divergências.
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/inventario-esqueleto-vs-conteudo.md
git commit -m "docs(projeto-base): inventario esqueleto vs conteudo"
```

---

### Task 2: Ficha de parâmetros

**Files:**
- Create: `docs/projeto-base/parametros.md`

**Interfaces:**
- Consumes: lista de parâmetros do spec; tabela do Task 1.
- Produces: a ficha preenchida (exemplo Gatum's) consumida pelo checklist e pelo prompt.

- [ ] **Step 1:** Escrever a ficha como tabela "Parâmetro | Valor (exemplo Gatum's) | Onde aplicar". Cobrir TODOS os itens: nome do projeto, nome de exibição da marca, cores (primária/accent/secundária em OKLCH), fontes, e-mail, telefone, WhatsApp, Instagram, cidade/estado, `VITE_API_BASE_URL`, `VITE_API_VERSION`, domínio do site, nome no Pix, prefixo de storage (`gg.`), imagens (`src/assets/hero-gourmet.jpg`).
- [ ] **Step 2:** Verificar que cada linha da tabela "conteúdo específico" do Task 1 tem um parâmetro correspondente aqui (nada esquecido).
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/parametros.md
git commit -m "docs(projeto-base): ficha de parametros com exemplo Gatum's"
```

---

### Task 3: Checklist para novo site

**Files:**
- Create: `docs/projeto-base/checklist-novo-site.md`

**Interfaces:**
- Consumes: Task 1 (inventário) e Task 2 (ficha).
- Produces: passo a passo manual, referenciado pelo README.

- [ ] **Step 1:** Escrever o checklist em ordem: (1) copiar/clonar o repo; (2) preencher a ficha de `parametros.md`; (3) trocar cada ponto do inventário (branding, cores em `styles.css`, contatos em `Footer.tsx`/`sobre.tsx`, meta tags, API em `.env*`, Pix em `pagamentos.ts`, prefixo de storage, imagens); (4) ajustar deploy (domínio, nomes de container/rede, workflows).
- [ ] **Step 2:** Garantir que o passo final é validação executável: `npm run dev` e `npm run build`, mais verificação visual de que nenhum branding do Gatum's restou.
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/checklist-novo-site.md
git commit -m "docs(projeto-base): checklist passo a passo para novo site"
```

---

### Task 4: Prompt de geração (opção B)

**Files:**
- Create: `docs/projeto-base/prompt-geracao.md`

**Interfaces:**
- Consumes: Task 1 (inventário) e Task 2 (ficha).
- Produces: prompt colável em IA, referenciado pelo README.

- [ ] **Step 1:** Escrever o prompt: contexto (o que é o projeto base), instrução para a IA ler o inventário e a ficha preenchida como fonte de verdade, aplicar as trocas apenas nos arquivos de "conteúdo específico" (sem tocar no esqueleto), e validar com `npm run build`. Incluir um placeholder onde o usuário cola a ficha preenchida.
- [ ] **Step 2:** Verificar que o prompt aponta explicitamente para os caminhos do inventário (sem ambiguidade sobre quais arquivos tocar).
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/prompt-geracao.md
git commit -m "docs(projeto-base): prompt de geracao assistida por IA"
```

---

### Task 5: Evolução para gerador + nota do repo de skills

**Files:**
- Create: `docs/projeto-base/evolucao-gerador.md`

**Interfaces:**
- Consumes: spec (seção "Evolução futura").
- Produces: doc de visão futura, referenciado pelo README.

- [ ] **Step 1:** Escrever duas seções: "Opção C — gerador/CLI" (como a ficha vira input de um script que aplica as trocas automaticamente; o que seria necessário) e "Futuro: repositório de skills" (registrar a intenção de extrair as skills de desenvolvimento para um repo próprio, sem implementar agora).
- [ ] **Step 2:** Confirmar que a nota do repo de skills está presente e explícita.
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/evolucao-gerador.md
git commit -m "docs(projeto-base): visao do gerador (C) e nota do repo de skills"
```

---

### Task 6: README (porta de entrada)

**Files:**
- Create: `docs/projeto-base/README.md`

**Interfaces:**
- Consumes: Tasks 1-5 (todos os docs existem e seus nomes estão fixados).
- Produces: índice navegável.

- [ ] **Step 1:** Escrever o README: o que é o projeto base, os dois caminhos de uso (manual via checklist / assistido via prompt), e um índice com links para os cinco documentos (`inventario-esqueleto-vs-conteudo.md`, `parametros.md`, `checklist-novo-site.md`, `prompt-geracao.md`, `evolucao-gerador.md`).
- [ ] **Step 2:** Verificar que todos os links apontam para arquivos que existem (Tasks 1-5 concluídas).
- [ ] **Step 3:** Commit.

```bash
git add docs/projeto-base/README.md
git commit -m "docs(projeto-base): README como porta de entrada"
```
