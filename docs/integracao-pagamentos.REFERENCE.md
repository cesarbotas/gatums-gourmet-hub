# Referência de integração — Pagamentos Gatums Gourmet

Este documento descreve os contratos da API de pagamentos e como conectar **operadoras de cartão** e **Pix** em produção. O front-end consome os mesmos endpoints via `src/lib/api/pagamentos.ts`.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_API_BASE_URL` | Base da API (ex.: `https://api.gatums.com/v1`) |
| `VITE_PAYMENTS_MOCK` | `false` desativa mock local e usa API real |

## Endpoints REST

### `GET /pagamentos/opcoes`

Retorna métodos habilitados: `cartao_debito`, `cartao_credito`, `pix`.

### `POST /pagamentos/iniciar`

Cria intenção de pagamento vinculada ao pedido.

```json
{
  "pedidoId": "abc123",
  "metodo": "pix",
  "valor": 150.0
}
```

**Resposta 201**

```json
{
  "id": "tx_xxx",
  "pedidoId": "abc123",
  "metodo": "pix",
  "valor": 150.0,
  "status": "aguardando_pagamento",
  "operadora": "bacen_pix",
  "operadoraRef": "E123...",
  "pixCopiaCola": "00020126...",
  "pixQrCodeDataUrl": "data:image/png;base64,...",
  "pixExpiraEm": "2026-05-17T21:00:00.000Z"
}
```

### `POST /pagamentos/:transacaoId/cartao`

Processa débito ou crédito (tokenização recomendada em produção — não enviar PAN em texto claro).

```json
{
  "numero": "4111111111111111",
  "nome": "MARIA SILVA",
  "validade": "12/28",
  "cvv": "123"
}
```

**Respostas**

- `200` — `status: "aprovada"` + `cartaoUltimos4`, `cartaoBandeira`, `operadoraRef`
- `402` — `CARTAO_RECUSADO`
- `422` — validação

### `GET /pagamentos/:transacaoId/status`

Consulta status (polling Pix a cada 3–5s até `aprovada` ou `expirada`).

### `POST /pagamentos/:transacaoId/pix/confirmar`

Opcional: cliente informa que pagou; backend consulta PSP e atualiza status.

### `POST /pagamentos/:transacaoId/validar`

**Admin / servidor** — confirma na operadora antes de liberar etapa “Aprovação do pagamento” no pedido.

---

## Operadoras de cartão (referência)

| Operadora | Uso | Documentação |
|-----------|-----|----------------|
| **Stripe** | Internacional + BR | https://stripe.com/docs/payments |
| **PagSeguro / PagBank** | Débito/crédito BR | https://developer.pagbank.com.br |
| **Mercado Pago** | Checkout transparente | https://www.mercadopago.com.br/developers |
| **Cielo / Braspag** | Enterprise BR | https://developercielo.github.io |
| **Stone / Pagar.me** | Gateway BR | https://docs.pagar.me |

### Fluxo recomendado (cartão)

1. Front chama `POST /pagamentos/iniciar` → recebe `transacaoId`
2. Front obtém **token** do cartão via SDK da operadora (iframe / Elements)
3. Back envia token à operadora (`charge` / `payment_intent`)
4. Webhook da operadora atualiza `status` → `aprovada` ou `recusada`
5. Front faz polling em `GET .../status` ou recebe SSE/WebSocket
6. Ao aprovar, back avança pedido para etapa `pagamento` na timeline

### Campos a persistir

- `operadora` — slug (`stripe`, `pagseguro`, …)
- `operadoraRef` — ID da transação no PSP
- `cartaoUltimos4`, `cartaoBandeira` — apenas para exibição
- Nunca armazenar CVV ou número completo (PCI-DSS)

---

## Pix (BACEN / PSP)

| PSP | QR dinâmico | Webhook |
|-----|-------------|---------|
| **Mercado Pago** | Sim | `payment.updated` |
| **PagSeguro** | Sim | Notificações Pix |
| **Gerencianet (Efí)** | Sim | https://dev.efipay.com.br |
| **Banco inter / Itaú** | Cobrança imediata | API bancária |

### Fluxo recomendado (Pix)

1. `POST /pagamentos/iniciar` com `metodo: "pix"`
2. Back gera cobrança no PSP → retorna `pixCopiaCola` (EMV) + QR
3. Front exibe QR (`pixQrCodeDataUrl` ou gera no cliente)
4. Webhook PSP confirma pagamento → `status: "aprovada"`
5. Front polling `GET /status` até aprovação ou `pixExpiraEm`
6. Admin valida com `POST .../validar` antes de separar estoque

### BR Code

Payload deve seguir manual BACEN (EMV + CRC16). O mock usa string simplificada; em produção usar biblioteca/server do PSP.

---

## Webhooks (produção)

Registrar URLs:

```
POST https://api.gatums.com/v1/webhooks/pagamentos/stripe
POST https://api.gatums.com/v1/webhooks/pagamentos/pagseguro
POST https://api.gatums.com/v1/webhooks/pagamentos/pix
```

Corpo deve atualizar `TransacaoPagamento` e, se `aprovada`, disparar avanço automático da etapa `pagamento` do pedido.

---

## Segurança

- HTTPS obrigatório
- Autenticação JWT nas rotas de cliente e role `admin` em `/validar`
- Idempotency-Key em `iniciar` e `cartao`
- Rate limit em tentativas de cartão
- Logs sem dados sensíveis

---

## Mapeamento no app

| Arquivo | Função |
|---------|--------|
| `src/lib/api/pagamentos.ts` | Cliente HTTP + mock |
| `src/lib/api/pedidos.ts` | `pagamento` no pedido + timeline |
| `src/components/PagamentoCheckout.tsx` | UI checkout |
| `src/routes/_authenticated/pedidos.$pedidoId.pagamento.tsx` | Página de pagamento |

Para desligar o mock: `VITE_PAYMENTS_MOCK=false` e implementar os endpoints acima no backend.
