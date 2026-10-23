# Projeto base reutilizável

## O que é o projeto base

Este repositório (TanStack Start + Vite + React 19 + Tailwind v4) serve de **molde** para gerar novos sites de catálogo/e-commerce. A ideia é preservar o **esqueleto** — estrutura de pastas, componentes de UI, roteamento, padrões de dados e build — e trocar apenas o **conteúdo**: marca, textos, cores, contatos, integração com API e domínio. Assim cada novo site parte de uma base já testada, reduzindo o retrabalho e mantendo a consistência técnica entre projetos.

A entrega atual corresponde à **opção B**: documentação, checklist e prompt. Em vez de um gerador automatizado, esta pasta reúne os documentos que descrevem o que é reutilizável, quais parâmetros precisam ser preenchidos e como conduzir a criação de um novo site — seja de forma manual, seja assistida por IA.

## Os dois caminhos de uso

- **Manual** — siga o passo a passo em [`checklist-novo-site.md`](./checklist-novo-site.md), executando cada etapa e marcando o progresso conforme o novo site toma forma.
- **Assistido por IA** — preencha a ficha de parâmetros descrita em [`parametros.md`](./parametros.md) e use o [`prompt-geracao.md`](./prompt-geracao.md) para orientar uma IA a aplicar as trocas de conteúdo sobre o esqueleto.

## Índice de documentos

- [`inventario-esqueleto-vs-conteudo.md`](./inventario-esqueleto-vs-conteudo.md) — o que é reutilizável vs. específico de cada site.
- [`parametros.md`](./parametros.md) — a ficha de parâmetros a preencher (com exemplo Gatum's).
- [`checklist-novo-site.md`](./checklist-novo-site.md) — passo a passo manual para criar um novo site.
- [`prompt-geracao.md`](./prompt-geracao.md) — prompt pronto para gerar o site com IA.
- [`evolucao-gerador.md`](./evolucao-gerador.md) — visão futura (gerador C + repositório de skills).
