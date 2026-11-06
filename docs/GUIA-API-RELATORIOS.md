# Guia — Relatórios na API Gatums Gourmet

Base: `/api/v1`, JWT Bearer, perfil **admin** em todos os endpoints. Valores monetários em `decimal` (R$), datas ISO-8601 (`yyyy-MM-dd`). Seguir o padrão do projeto: Minimal API, 1 endpoint = 1 Handler, PostgreSQL.

## Já existe

### GET /relatorios/vendas/resumo
Últimos 30 dias.
```json
{
  "totalFaturamento": 1234.50,
  "totalPedidos": 42,
  "ticket": 29.39,
  "topProdutos": [{ "nome": "X-Burger", "quantidade": 18, "total": 540.00 }],
  "serieDiaria": [{ "dia": "2026-10-08", "total": 120.00 }]
}
```
Considerar apenas pedidos com pagamento aprovado.

## Propostos (ordem sugerida de prioridade)

### 1. GET /relatorios/vendas?dataInicio=&dataFim=&agrupamento=Dia|Semana|Mes
Mesmo formato do resumo, com período livre. Validar `dataFim >= dataInicio` e limite de 366 dias. `serieDiaria` vira `serie: [{ periodo, total, pedidos }]`.

### 2. GET /relatorios/pagamentos/metodos?dataInicio=&dataFim=
```json
[{ "metodo": "Pix", "quantidade": 20, "total": 600.00, "aprovados": 19, "recusados": 1, "expirados": 0 }]
```
`metodo` como nome do enum MetodoPagamento (query/resposta usam nome, igual ao padrão atual).

### 3. GET /relatorios/vendas/categorias?dataInicio=&dataFim=
```json
[{ "categoria": "Hambúrgueres", "quantidade": 50, "total": 1500.00, "percentual": 62.5 }]
```

### 4. GET /relatorios/clientes/top?dataInicio=&dataFim=&limite=10
```json
[{ "clienteId": "uuid", "nome": "Maria", "pedidos": 8, "total": 320.00, "ultimoPedido": "2026-11-01" }]
```

### 5. GET /relatorios/pedidos/etapas
Contagem atual por PedidoEtapa:
```json
[{ "etapa": "EmPreparo", "quantidade": 3 }]
```

### 6. GET /relatorios/pedidos/horarios?dataInicio=&dataFim=
```json
{ "porHora": [{ "hora": 19, "pedidos": 12 }], "porDiaSemana": [{ "dia": "Sexta", "pedidos": 30 }] }
```
Converter para fuso `America/Sao_Paulo` antes de agrupar.

### 7. GET /relatorios/produtos/sem-venda?dias=30
```json
[{ "produtoId": "uuid", "nome": "Suco de Uva", "categoria": "Bebidas", "ultimaVenda": null }]
```

### 8. GET /relatorios/pedidos/cancelados?dataInicio=&dataFim= (paginado)
Aceita `Paginacao.NumeroPagina` e `Paginacao.QuantidadeRegistros`.
```json
{ "items": [{ "pedidoId": "uuid", "data": "...", "cliente": "...", "total": 45.0, "motivo": "PagamentoExpirado" }], "totalRegistros": 5 }
```

### Extra: exportação
`GET /relatorios/{nome}/export?formato=csv` reutilizando os mesmos handlers, retornando `text/csv`.

## Integração no front
- Serviço: `src/lib/api/vendas.ts` (adicionar um método por endpoint).
- Tela: `src/routes/_authenticated/admin/relatorios.tsx` — ao implementar, trocar o status do card de "Proposto" para "Disponível" e renderizar o resultado.
- Erros 401/403 já tratados por `apiRequest`.
