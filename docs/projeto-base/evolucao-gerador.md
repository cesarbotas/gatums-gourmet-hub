# Evolução: gerador/CLI (opção C) e nota do repo de skills

> **Visão futura — nada aqui está implementado.** Este documento registra para
> onde a entrega atual pode evoluir. A entrega atual é a **opção B** (docs +
> checklist + prompt), descrita em `docs/projeto-base/README.md` e nos demais
> documentos sob `docs/projeto-base/`. As duas seções abaixo são apenas um
> roteiro de intenção; não há código, CLI ou repositório a criar agora.

## Opção C: gerador/CLI

A opção B transforma um site novo em um trabalho **manual ou assistido por IA**:
preencher a ficha de `docs/projeto-base/parametros.md` e aplicar as trocas nos
arquivos mapeados em `docs/projeto-base/inventario-esqueleto-vs-conteudo.md`,
seguindo `docs/projeto-base/checklist-novo-site.md`.

A opção C dá o passo seguinte: **a ficha de parâmetros vira o INPUT de um
script/CLI** que aplica as trocas automaticamente, sem edição manual arquivo a
arquivo. Em vez de abrir cada arquivo e substituir valores, o fluxo seria algo
como:

```
create-site --nome "..." --cor "..." --api "..."
```

ou, de forma equivalente, lendo a ficha de um arquivo de configuração.

### O que seria necessário

- **Mecanismo de template/substituição.** Duas abordagens possíveis:
  - colocar *placeholders* nos arquivos de conteúdo específico (os listados na
    seção "Conteúdo específico do projeto" do inventário), que o gerador
    preenche; ou
  - um script que reescreve diretamente os pontos já mapeados no inventário
    (`src/components/Navigation.tsx`, `src/components/Footer.tsx`,
    `src/styles.css`, `.env*`, `src/lib/api/pagamentos.ts`, workflows, etc.),
    sem precisar alterar os arquivos para o formato de template.
- **Ficha como arquivo de config.** A ficha de `parametros.md` passaria a ter
  uma forma legível por máquina (ex.: JSON ou YAML) para servir de entrada ao
  CLI, mantendo os mesmos campos: nome do projeto, marca, cores/fontes,
  contatos, cidade/estado, API + versão, domínio, nome no Pix, prefixo de
  storage, imagens.
- **Validação automática.** Ao final, o gerador roda `npm run build` (e,
  idealmente, `npm run dev` de fumaça) para garantir que as substituições não
  quebraram o projeto — automatizando a etapa de verificação que hoje o
  checklist pede manualmente.

### Pré-requisito

A fronteira **esqueleto vs conteúdo** — documentada agora na opção B em
`docs/projeto-base/inventario-esqueleto-vs-conteudo.md` — precisa estar
**estável** antes de automatizar. Enquanto essa fronteira ainda muda, um gerador
exigiria retrabalho constante. Por isso B é pré-requisito natural de C: primeiro
mapear e estabilizar, depois automatizar.

> Reforçando: **a opção C é visão futura e NÃO está implementada agora.**

## Futuro: repositório de skills

### O que são

As *skills* de workflow de desenvolvimento usadas hoje localmente neste projeto
(por exemplo: brainstorming, writing-plans, TDD, systematic-debugging,
verification-before-completion, entre outras). Elas orientam **como** o trabalho
é conduzido, independentemente do conteúdo do site.

### A ideia futura

Extrair essas skills para um **repositório dedicado**, reutilizável entre vários
projetos — de modo que cada projeto não precise manter sua própria cópia, e
melhorias nas skills fiquem disponíveis para todos os consumidores.

### Status

Isto é **apenas um registro de intenção para o futuro**. Não há nada a fazer
agora: nenhum repositório a criar, nenhuma skill a extrair ou mover nesta
entrega.
