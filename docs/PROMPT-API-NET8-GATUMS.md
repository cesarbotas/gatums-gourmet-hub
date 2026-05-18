# Prompt de referência — API Gatums Gourmet (.NET 8 + Clean Architecture)

Use este documento como **prompt completo** para gerar a API backend do projeto **gatums-gourmet-hub** (site React/TanStack). O front consome `VITE_API_BASE_URL` (padrão `/api/v1`) e está documentado em `src/lib/api/*` e `docs/integracao-pagamentos.REFERENCE.md`.

---

## Prompt (copiar e colar)

```
Você é um arquiteto de software especialista em .NET e Clean Architecture.

Crie a API backend do e-commerce **Gatums Gourmet**, espelhando TODOS os fluxos do front-end existente (catálogo, carrinho, pedidos com timeline, pagamentos Pix/cartão, admin).

# Stack obrigatória

- .NET 8
- ASP.NET Core Web API
- Clean Architecture (sem MediatR — handlers explícitos por Use Case)
- Entity Framework Core 8 + **PostgreSQL** (Npgsql)
- XUnit + Moq + FluentAssertions
- FluentValidation
- Swagger/OpenAPI
- Docker Compose (PostgreSQL + API) para testes locais
- JWT Bearer para autenticação (roles: admin, cliente)

# Estrutura da solução

GatumsGourmet.sln

- src/
  - GatumsGourmet.Api
  - GatumsGourmet.Application
  - GatumsGourmet.Domain
  - GatumsGourmet.Infrastructure

- tests/
  - GatumsGourmet.UnitTests

- docker/
  - docker-compose.yml
  - Dockerfile

# Regras da Clean Architecture

## Domain

Apenas regras de negócio. Sem dependências externas.

Entidades e enums (mapear do front):

- **Usuario**: Id, Nome, Email, Telefone?, SenhaHash, Role (admin | cliente), CriadoEm
- **Produto**: Id, Nome, Descricao, Categoria, Preco, FotoUrl, Disponivel, Tipo (simples | combo), CriadoEm
- **ProdutoComboItem**: Id, ComboProdutoId, ProdutoId, Quantidade
- **Cliente** (CRM admin): Id, Nome, Email, Telefone, Cidade, CriadoEm
- **CarrinhoItem**: Id, UsuarioId, ProdutoId, Quantidade (+ snapshot Nome, Preco, FotoUrl)
- **Pedido**: Id, UsuarioId, ClienteNome, Total, Data, StatusAtual (PedidoEtapa)
- **PedidoItem**: Id, PedidoId, ProdutoId, Nome, Preco, FotoUrl, Quantidade
- **PedidoTimelineEvento**: Id, PedidoId, Etapa, Em, Por (cliente | admin), Observacao?, EntregaTipo? (transporte | retirada)
- **PedidoPagamento**: PedidoId, TransacaoId, Resumo, AprovadoEm
- **TransacaoPagamento**: Id, PedidoId, Metodo (cartao_debito | cartao_credito | pix), Valor, Status, Operadora, OperadoraRef?, PixCopiaCola?, PixExpiraEm?, CartaoUltimos4?, CartaoBandeira?, MensagemErro?, CriadoEm, AtualizadoEm
- **Venda** (linha analítica): Id, PedidoId?, ProdutoId, ProdutoNome, Quantidade, Total, Data

Enums Domain:
- UserRole, TipoProduto, PedidoEtapa, PedidoActor, EntregaTipo, MetodoPagamento, StatusTransacao

Interfaces de domínio (exemplos):
- IPedidoWorkflowService (validar transição de etapa)
- IClock, IPasswordHasher

Exceptions: DomainException, NotFoundException, BusinessRuleException

---

## Application

Organizar por **Use Case** — uma pasta por caso de uso.

NÃO utilizar MediatR.
Cada endpoint chama **um** Handler via interface injetada.

Estrutura por feature:

Application/UseCases/{Feature}/{Action}/
  - {Action}Request.cs      (record)
  - {Action}Response.cs     (record)
  - {Action}Validator.cs    (FluentValidation)
  - I{Action}Handler.cs
  - {Action}Handler.cs

Retorno: `Result<T>` (Success, Error, ValidationErrors, Data).

### Mapeamento obrigatório: Front → Use Cases → Endpoints

Base path da API: `/api/v1`

#### Auth (`src/lib/api/auth.ts`)
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| POST | /auth/login | Login | anon |
| POST | /auth/register | RegisterUser | anon |
| GET | /auth/me | GetCurrentUser | autenticado |
| POST | /auth/logout | Logout | autenticado |

#### Produtos (`src/lib/api/produtos.ts`) — catálogo público + admin
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| GET | /produtos | ListProdutos (page, pageSize, search, categoria, tipo, disponivel) | anon |
| GET | /produtos/{id} | GetProdutoById | anon |
| POST | /produtos | CreateProduto | admin |
| PUT | /produtos/{id} | UpdateProduto | admin |
| DELETE | /produtos/{id} | DeleteProduto | admin |
| GET | /produtos/categorias | ListCategorias | anon |

Regras: combo exige `itens[]` com produtoId + quantidade; produto simples não tem itens.

#### Clientes admin (`src/lib/api/clientes.ts`)
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| GET | /clientes | ListClientes (paginado, search) | admin |
| POST | /clientes | CreateCliente | admin |
| PUT | /clientes/{id} | UpdateCliente | admin |
| DELETE | /clientes/{id} | DeleteCliente | admin |

#### Carrinho (`src/lib/api/carrinho.ts`)
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| GET | /carrinho | GetCarrinho | cliente |
| POST | /carrinho/itens | AddCarrinhoItem (produtoId, quantidade) | cliente |
| PATCH | /carrinho/itens/{produtoId} | UpdateCarrinhoItemQuantidade | cliente |
| DELETE | /carrinho/itens/{produtoId} | RemoveCarrinhoItem | cliente |
| DELETE | /carrinho | ClearCarrinho | cliente |

#### Pedidos (`src/lib/api/pedidos.ts` + `pedido-flow.ts`)
Timeline (ordem): criado → aprovado → pagamento → pagamento_aprovado → envio_pendente → entregue → finalizado

| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| POST | /pedidos/checkout | CheckoutPedido (carrinho → pedido etapa criado + itens venda) | cliente |
| GET | /pedidos | ListPedidos (admin: todos; cliente: só seus) | autenticado |
| GET | /pedidos/{id} | GetPedidoById | dono ou admin |
| POST | /pedidos/{id}/etapas/avancar | AvancarPedidoEtapa (observacao?, entregaTipo?) | admin ou cliente conforme etapa |
| POST | /pedidos/{id}/pagamento/concluir | ConcluirPagamentoPedido (transacaoId aprovada) | cliente |

Regras de workflow (Domain/Application):
- **criado**: automático no checkout
- **aprovado**: só admin, quando atual = criado
- **pagamento**: só cliente após pagamento aprovado na API de pagamentos
- **pagamento_aprovado**: só admin; antes validar transação via `ValidarPagamentoParaAprovacao`
- **envio_pendente**, **entregue** (exige entregaTipo), **finalizado**: só admin

#### Pagamentos (`src/lib/api/pagamentos.ts` + docs/integracao-pagamentos.REFERENCE.md)
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| GET | /pagamentos/opcoes | ListOpcoesPagamento | cliente |
| POST | /pagamentos/iniciar | IniciarPagamento (pedidoId, metodo, valor) | cliente |
| POST | /pagamentos/{transacaoId}/cartao | ProcessarPagamentoCartao (numero, nome, validade, cvv) | cliente |
| GET | /pagamentos/{transacaoId}/status | ConsultarStatusPagamento | cliente |
| POST | /pagamentos/{transacaoId}/pix/confirmar | ConfirmarPagamentoPix | cliente |
| POST | /pagamentos/{transacaoId}/validar | ValidarPagamentoParaAprovacao | admin |

Integração PSP (Infrastructure): interfaces `IPaymentGateway` (cartão) e `IPixProvider` (QR/copia-cola/webhook). Mock em Development.

**Produção**: tokenizar cartão no front/PSP; API recebe token, não PAN completo.

#### Relatórios (`src/lib/api/vendas.ts`)
| Método | Rota | Use Case | Role |
|--------|------|----------|------|
| GET | /relatorios/vendas/resumo | GetVendasResumo (30 dias: faturamento, pedidos, ticket, topProdutos, serieDiaria) | admin |

---

## Infrastructure

- EF Core + **PostgreSQL** (connection string `Host=localhost;Port=5432;Database=gatums;Username=gatums;Password=gatums_dev`)
- `GatumsDbContext` + `IEntityTypeConfiguration<>` por entidade
- Repositories concretos (ex.: IProdutoRepository / ProdutoRepository)
- Migrations iniciais com seed: admin@gatums.com, produtos demo
- `IPasswordHasher` (BCrypt ou ASP.NET Identity PasswordHasher)
- `IJwtTokenGenerator`
- `IPaymentGateway`, `IPixProvider` (implementações Mock + stubs Stripe/PagSeguro documentados)
- Armazenar QR Pix como texto EMV; API pode retornar `pixQrCodeBase64` gerado no handler ou no provider

NÃO usar SQL Server — apenas PostgreSQL.

---

## Api

- Minimal APIs agrupadas por feature em `Endpoints/`
- Cada arquivo = 1 endpoint = 1 Handler
- `Program.cs` mínimo: apenas `WebApplication.CreateBuilder` + chamadas `AddApplication()`, `AddInfrastructure()`, `MapEndpoints()`, `Run()`
- Configuração em extension methods:
  - `DependencyInjection/ApplicationServiceCollectionExtensions.cs` → AddApplication()
  - `DependencyInjection/InfrastructureServiceCollectionExtensions.cs` → AddInfrastructure(configuration)
  - `DependencyInjection/EndpointRouteBuilderExtensions.cs` → MapGatumsEndpoints()
- Middleware global de exceções → ProblemDetails (RFC 7807)
- Swagger com JWT (Authorize button)
- CORS para front Vite (`http://localhost:5173`)
- Policies: `AdminOnly`, `ClienteOnly`

Exemplo endpoint:

```csharp
public static class LoginEndpoint
{
    public static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/login", HandleAsync)
            .WithName("Login")
            .Produces<LoginResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem();
    }

    private static async Task<IResult> HandleAsync(
        LoginRequest request,
        ILoginHandler handler,
        CancellationToken cancellationToken)
    {
        var result = await handler.Handle(request, cancellationToken);
        return result.ToHttpResult(); // extension: Result → TypedResults
    }
}
```

---

## Result Pattern

```csharp
public sealed class Result<T>
{
    public bool Success { get; }
    public T? Data { get; }
    public string? Error { get; }
    public IReadOnlyDictionary<string, string[]>? ValidationErrors { get; }
    // factory methods: Ok, Fail, ValidationFail
}
```

---

## Handlers (padrão obrigatório)

```csharp
public interface ILoginHandler
{
    Task<Result<LoginResponse>> Handle(LoginRequest request, CancellationToken cancellationToken);
}

public sealed class LoginHandler : ILoginHandler
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenGenerator _jwt;

    public LoginHandler(IUserRepository users, IPasswordHasher hasher, IJwtTokenGenerator jwt)
    {
        _users = users;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<Result<LoginResponse>> Handle(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        // validação já feita pelo FluentValidation no endpoint filter ou manualmente
    }
}
```

---

## Testes unitários (GatumsGourmet.UnitTests)

- XUnit + Moq + FluentAssertions
- Testar: Handlers, Validators, PedidoWorkflowService
- Mockar repositories e gateways de pagamento
- Sem banco real (InMemory só se necessário para query complexa)

Exemplo: `CheckoutPedidoHandlerTests`, `AvancarPedidoEtapaHandlerTests`, `ProcessarPagamentoCartaoHandlerTests`

---

## Entity Framework

- DbContext com DbSets para todas entidades
- Configurations separadas (Fluent API)
- `AsNoTracking()` em queries de leitura
- `CancellationToken` em todos métodos async de repository/handler
- Índices: Usuario.Email (unique), Pedido.UsuarioId, TransacaoPagamento.PedidoId

---

## Docker (obrigatório para dev local)

Gerar `docker/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gatums
      POSTGRES_PASSWORD: gatums_dev
      POSTGRES_DB: gatums
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gatums"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Port=5432;Database=gatums;Username=gatums;Password=gatums_dev
      Jwt__Secret: dev-secret-min-32-chars-for-hs256!!
      Jwt__Issuer: GatumsGourmet
      Jwt__Audience: GatumsGourmet.Web
    ports:
      - "5080:8080"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

README com:
```bash
docker compose -f docker/docker-compose.yml up -d
dotnet ef database update --project src/GatumsGourmet.Infrastructure --startup-project src/GatumsGourmet.Api
# Swagger: http://localhost:5080/swagger
```

---

## Boas práticas (obrigatórias)

- async/await + CancellationToken em toda cadeia
- Program.cs enxuto; lógica em extensions
- SOLID, sem Service Locator
- **NÃO** MediatR
- **NÃO** AutoMapper (mapear manualmente)
- records para Request/Response
- Paginação: `page`, `pageSize`, `total` em listagens
- ILogger em handlers críticos (pagamento, checkout)
- Validação FluentValidation por Request
- DTOs de API = records em Application (não expor Entities)
- Idempotência em `POST /pagamentos/iniciar` (header Idempotency-Key)
- Não logar dados de cartão/CVV

---

## Contratos JSON (alinhar com front)

PaginatedResponse:
```json
{ "items": [], "total": 0, "page": 1, "pageSize": 10 }
```

LoginResponse:
```json
{ "token": "jwt...", "user": { "id": "", "nome": "", "email": "", "role": "cliente" } }
```

Pedido (resumo):
```json
{
  "id": "",
  "userId": "",
  "clienteNome": "",
  "itens": [{ "produtoId": "", "nome": "", "preco": 0, "foto": "", "quantidade": 1 }],
  "total": 0,
  "data": "ISO",
  "timeline": [{ "etapa": "criado", "em": "ISO", "por": "cliente", "observacao": null, "entregaTipo": null }],
  "pagamento": { "transacaoId": "", "resumo": "", "aprovadoEm": "ISO" }
}
```

TransacaoPagamento: campos conforme `src/lib/api/pagamentos.ts` (incluir pixQrCodeDataUrl opcional).

---

## Ordem de implementação sugerida

1. Domain + Result + exceptions
2. Infrastructure (DbContext, migrations, repositories, JWT)
3. Auth Use Cases + endpoints
4. Produtos + Clientes
5. Carrinho + Checkout + Pedidos workflow
6. Pagamentos (mock gateway) + concluir pagamento
7. Relatórios vendas
8. UnitTests por handler crítico
9. Docker Compose + README

---

## Objetivo final

API REST completa para o site Gatums Gourmet: escalável, desacoplada, testável, **um Use Case por endpoint**, PostgreSQL via Docker, sem MediatR, pronta para substituir o mock localStorage do front (`VITE_PAYMENTS_MOCK=false`, `VITE_API_BASE_URL=http://localhost:5080/api/v1`).
```

---

## Como usar

1. Copie o bloco entre \`\`\` do prompt acima.
2. Cole em um agente de IA ou use como spec para implementação manual.
3. Mantenha este repositório aberto: o front em `src/lib/api/` é a fonte da verdade dos contratos.
4. Pagamentos em produção: complemente com `docs/integracao-pagamentos.REFERENCE.md`.

## Variáveis do front após API pronta

```env
VITE_API_BASE_URL=http://localhost:5080/api/v1
VITE_PAYMENTS_MOCK=false
```
