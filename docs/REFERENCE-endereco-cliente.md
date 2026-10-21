# Referência — Migração do Endereço do Cliente para Tabela Separada

> Documento de referência para a equipe backend. Descreve o estado atual
> (endereço acoplado ao cliente como campo `cidade`) e o destino desejado
> (tabela `enderecos` separada, relação 1-N com `clientes`).

## 1. Estado atual

A entidade `Cliente` na API hoje carrega apenas dados básicos:

```jsonc
// GET /api/v1/clientes/{id}
{
  "id": "uuid",
  "nome": "Maria Silva",
  "email": "maria@x.com",
  "telefone": "13991234567",
  "cidade": "Santos",
  "criadoEm": "2026-05-01T10:00:00Z"
}
```

Problemas:
- Não há CEP, logradouro, número, bairro, UF, complemento.
- Um cliente não pode ter múltiplos endereços (entrega ≠ cobrança, casa/trabalho).
- Não há endereço marcado como **principal** para entrega padrão.

## 2. Estado desejado

### 2.1 Tabela `enderecos`

```sql
CREATE TABLE enderecos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cep           VARCHAR(9)  NOT NULL,
  logradouro    VARCHAR(200) NOT NULL,
  numero        VARCHAR(20)  NOT NULL,
  complemento   VARCHAR(100),
  bairro        VARCHAR(100) NOT NULL,
  cidade        VARCHAR(100) NOT NULL,
  uf            CHAR(2)      NOT NULL,
  referencia    VARCHAR(200),
  principal     BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em     TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enderecos_cliente ON enderecos(cliente_id);
CREATE UNIQUE INDEX uq_enderecos_principal
  ON enderecos(cliente_id) WHERE principal = TRUE;
```

### 2.2 Migração dos dados existentes

```sql
INSERT INTO enderecos (cliente_id, cep, logradouro, numero, bairro, cidade, uf, principal)
SELECT
  id,
  '00000-000',           -- placeholder; cliente preenche no 1º login
  '',
  '',
  '',
  COALESCE(cidade, ''),
  'SP',
  TRUE
FROM clientes
WHERE cidade IS NOT NULL;

ALTER TABLE clientes DROP COLUMN cidade;
```

### 2.3 Novos endpoints

| Método | Rota                                         | Descrição                |
| ------ | -------------------------------------------- | ------------------------ |
| GET    | `/api/v1/clientes/{id}/enderecos`            | Lista endereços          |
| GET    | `/api/v1/clientes/{id}/enderecos/{enderecoId}` | Detalhe                |
| POST   | `/api/v1/clientes/{id}/enderecos`            | Cria novo endereço       |
| PUT    | `/api/v1/clientes/{id}/enderecos/{enderecoId}` | Atualiza               |
| DELETE | `/api/v1/clientes/{id}/enderecos/{enderecoId}` | Remove                 |

#### Payload (POST/PUT)

```jsonc
{
  "cep": "11013-001",
  "logradouro": "Av. Conselheiro Nébias",
  "numero": "100",
  "complemento": "Apto 201",
  "bairro": "Boqueirão",
  "cidade": "Santos",
  "uf": "SP",
  "referencia": "Próximo ao mercado",
  "principal": true
}
```

Regra: salvar `principal=true` deve, na mesma transação, marcar os demais
endereços do cliente como `principal=false`.

### 2.4 Impacto em `Pedido`

Adicionar `enderecoEntregaId` em `Pedido` (FK para `enderecos`), ou copiar
o snapshot do endereço dentro do pedido para histórico imutável.

## 3. Frontend — contrato já implementado

O frontend já trabalha com este contrato em `src/lib/api/enderecos.ts`:

```ts
interface Endereco {
  id?: string;
  clienteId?: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia?: string;
  principal?: boolean;
}
```

Enquanto a API não expõe os endpoints `/clientes/{id}/enderecos`, o
serviço faz **fallback automático para `localStorage`** (chave
`gg.enderecos.{clienteId}`). Assim que o backend implementar a tabela
e endpoints acima, **nenhuma mudança é necessária no frontend** — o
fallback simplesmente deixa de ser usado.

## 4. Busca por CEP

O cadastro consome `https://viacep.com.br/ws/{cep}/json/` para
auto-preencher logradouro/bairro/cidade/UF. Esta chamada acontece direto
do navegador; o backend não precisa proxy.

Caso queira centralizar (rate-limit, cache), expor:
`GET /api/v1/cep/{cep}` retornando o mesmo shape do ViaCEP.

## 5. Checklist de migração

- [ ] Criar tabela `enderecos` + índices
- [ ] Migrar dados de `clientes.cidade` para `enderecos`
- [ ] Remover coluna `clientes.cidade`
- [ ] Expor 5 endpoints CRUD acima
- [ ] Garantir unicidade de `principal=true` por cliente
- [ ] Adicionar `enderecoEntregaId` em `Pedido` (ou snapshot)
- [ ] Atualizar Swagger
- [ ] Remover fallback localStorage do frontend (opcional — funciona sem)
