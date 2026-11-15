# Controle de estoque — validação

## API publicada
Consultas realizadas em 11/11/2026 em `https://gatumsgourmet.com.br/api/v1`, com login de administrador e sem gravações:
- Login: 200.
- Listar produtos: 200, mas sem os campos `estoque` e `estoqueMinimo`.
- `GET /estoque/baixo`: 404.
- `GET /produtos/{id}/estoque`: 404 para um produto existente.
- `GET /produtos/{id}/estoque/movimentos`: 404 para o mesmo produto.

O changelog de 08/11 documenta esses endpoints, mas essa versão ainda não foi constatada no servidor. A coleção Postman disponível não contém as rotas de estoque; formato de ajuste validado apenas pelo changelog (tipo inteiro 0/1/2, quantidade e observação). Gravações de estoque reais não foram executadas.

## Tela
A opção Estoque permite buscar produtos, filtrar saldo zero/baixo/normal, consultar saldo e histórico e registrar entrada/saída/ajuste. Dados não informados pela API aparecem como desconhecidos, nunca como estoque zerado. Consultas falhas bloqueiam ajustes e mostram o erro.

## Disponibilidade
Saldo explicitamente informado como zero torna o produto indisponível na interface, inclusive catálogo, e bloqueia sua inclusão. Criação com estoque inicial zero e edição com saldo zero enviam `disponivel: false`. Não há atualização automática em consultas de leitura.

**Regra necessária na API:** atualizar `Disponivel=false` na mesma transação que zerar o estoque (checkout ou ajuste). O site não consegue garantir essa regra para vendas feitas em outros dispositivos, e não deve salvar produtos em segundo plano ao consultar. Reposição não deve reativar um produto desativado manualmente sem decisão explícita.

## Pedidos
Alerta usa o saldo atual do produto (saldo ≤ mínimo), não desconta novamente quantidades do pedido: o checkout já gera o movimento de venda. Sem saldo na API, os alertas ficam pendentes e isso aparece na tela.

## Pendências
Publicar a versão/migration de estoque, confirmar contrato e testar PUT com dados próprios de homologação. Permissões continuam sob autoridade da API: leitura `produtos:ler`, ajustes `estoque:gerenciar` (Admin/Gerente). Variáveis de development preservadas.