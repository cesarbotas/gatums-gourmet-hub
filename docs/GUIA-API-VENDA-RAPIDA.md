# Venda presencial — endpoint necessário

O contrato atual disponibiliza carrinho, checkout e início de pagamento para clientes, não para administradores. A tela `/admin/venda-rapida` prepara a seleção e apresenta o total, mas não cria um pedido nem inicia cobrança até existir um contrato autorizado para o ponto de venda. Não usa conta fictícia, não altera perfis e não simula pagamentos.

## Proposta (não implementada na API)
`POST /api/v1/admin/vendas-presenciais`, protegido pela permissão própria de venda presencial para Admin/Gerente, com `Idempotency-Key` obrigatório.

```json
{
  "clienteNome": "Cliente balcão",
  "itens": [{ "produtoId": "uuid", "quantidade": 2 }]
}
```

Resposta 201: pedido completo, total calculado no servidor e identificação do operador/canal presencial. Nome opcional: API decide como registrar consumidor não identificado. Nunca confiar em preços ou total enviados pelo site. Validar disponibilidade e saldo em transação atômica; registrar movimentos de venda uma única vez.

Permitir início de pagamento para esse pedido pelo operador autorizado (endpoint atual ou endpoint administrativo próprio), sem conceder acesso a pedidos de outros clientes por acidente. Devolver Pix real com código/QR, vencimento e status; para cartão presencial integrar terminal/operadora, não coletar dados de cartão como substituto de maquininha.

Confirmação deve vir do provedor; não marcar pagamento como aprovado por botão local. Pagamentos pendentes devem ser retomáveis. Cancelamento/expiração precisa de política explícita para reserva/estorno de estoque. Respostas 400 para saldo insuficiente, 403 para falta de permissão e 409 para conflitos/idempotência.

## Integração seguinte
Depois de receber o contrato publicado: conectar seleção ao novo endpoint, guardar pedido retornado, iniciar pagamento usando seu total e acompanhar confirmação real. Não repetir checkout após falha na leitura do pedido. Não executar ajustes manuais de estoque como substituto de venda.