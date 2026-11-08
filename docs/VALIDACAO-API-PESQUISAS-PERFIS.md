# Validação da coleção Gatums Gourmet

Referência: `GatumsGourmet.postman_collection.json` enviada nesta solicitação. A coleção descreve .NET 10, RBAC, accessToken/refreshToken e `user.roles[]`. As variáveis de development foram preservadas.

## Pesquisas
- Produtos: o front envia `search`, `categoriaId`, `tipo`, `disponivel`, `pagina`, `tamanho`.
- Clientes: o front envia `search`, `pagina`, `tamanho`.
- Categorias: o front envia `search`, `apenasAtivas`, `pagina`, `tamanho`.
- Catálogo e pedidos: carregam todas as páginas antes de pesquisar/paginar localmente, sem o limite fixo anterior de 100/500 itens. Nos pedidos, os filtros são cliente/código, etapa e data.
- Tamanhos disponíveis: 10, 25, 50 e 100. Alterar um filtro retorna à primeira página.

**Limite da validação documental:** os GETs da coleção não têm parâmetros de pesquisa/paginação nem respostas salvas. Os parâmetros acima seguem os serviços e testes existentes do projeto, não uma comprovação adicional na coleção. Recomenda-se documentar no OpenAPI e adicionar casos Postman com filtros e uma segunda página. Resposta esperada pelo front: `{ itens, totalRegistros, paginaAtual, tamanhoPagina }`.

## Perfil de acesso no cadastro de clientes
1. Carregar `GET /roles` e `GET /usuarios` com o token administrativo.
2. Encontrar a conta pelo e-mail, ignorando maiúsculas/minúsculas e espaços nas pontas.
3. Se existe: `PUT /usuarios/{id}/roles` com `{ "roleIds": [idDoPerfil] }`.
4. Se não existe: exigir senha inicial e chamar `POST /usuarios` com `{ nome, email, senha, telefone, roleIds: [idDoPerfil] }`.
5. Os dados básicos do CRM usam `POST /clientes` ou `PUT /clientes/{id}`. Perfil e senha não são enviados para esses endpoints.

O seletor atribui um perfil; salvar substitui a lista de roles por esse perfil. O usuário deve entrar novamente para receber claims atualizadas. As permissões reais permanecem validadas na API. Falha ao carregar usuários não é interpretada como usuário inexistente.

O front mantém o ID do cliente após criação para que repetir um salvamento parcialmente concluído não crie outro cliente. Não há transação entre os endpoints de cliente e usuário: uma falha parcial é exibida explicitamente. A senha não é persistida pelo front.

### Melhorias sugeridas para a API (não confirmadas na coleção)
- Retornar `usuarioId` e perfis junto ao cliente ou oferecer uma consulta por e-mail para evitar carregar todos os usuários.
- Oferecer uma operação administrativa transacional que salve o CRM, crie/vincule a conta e atribua o perfil sem duplicar clientes.
- Documentar se `POST /usuarios` também cria CRM automaticamente e fornecer vínculo explícito entre ambos; a coleção não permite confirmar esse comportamento.
- Oferecer convite/redefinição de senha para dispensar senha inicial definida pelo administrador.
- Documentar a sincronização de e-mail/nome entre CRM e conta; não há endpoint de atualização desses campos de usuário na coleção.

## Relatório
O único endpoint confirmado na coleção é `GET /relatorios/vendas/resumo`, sem filtros de data documentados. O componente mostra faturamento, quantidade de pedidos, ticket médio, série diária e ranking. Consulte `GUIA-API-RELATORIOS.md` para o formato e as propostas de expansão.

## Verificações realizadas
- 62 testes unitários passaram, incluindo pesquisa/página, alteração de perfil e criação de conta ausente.
- Login HTTPS da API hospedada retornou 200; clientes, produtos e resumo foram lidos na interface com dados reais. As chamadas foram direcionadas para HTTPS somente no navegador de teste, sem mudar variáveis de development, pois a API local não estava acessível neste ambiente.
- Alteração de perfil e criação de usuário foram exercitadas com respostas simuladas e leitura posterior do resultado na tela, sem modificar dados de produção.
- Relatório verificado em computador e celular, sem erros de execução e sem transbordamento horizontal no celular.
- A comunicação direta com a API local e gravações reais permanecem não verificadas.