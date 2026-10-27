import { afterAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de clientes contra a API local real.
// Validam o SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`. Espelha o padrão de `categorias.contract.test.ts`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip).
//
// Escrita opção C: cada rodada CRIA o cliente que manipula (nome/email único
// por timestamp) e o limpa no `afterAll`. Ordem POST→list→PUT→DELETE.
//
// Status/shapes reais observados contra a API local (seed):
//   POST   /clientes        → 201  body {"id": <uuid>}
//   GET    /clientes?...     → 200  body paginado {itens:[...], totalRegistros, ...}
//   PUT    /clientes/{id}    → 200/204
//   DELETE /clientes/{id}    → 200/204
//   (não há GET /clientes/{id} no OpenAPI — só list)

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de clientes PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de clientes", () => {
  const ts = Date.now();
  let token = "";
  let clienteId: string | undefined;
  const email = `cli-${ts}@local.test`;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  afterAll(async () => {
    if (!token || clienteId === undefined) return;
    try {
      await fetch(`${baseUrl()}/clientes/${clienteId}`, { method: "DELETE", headers: auth() });
    } catch {
      // ignorado — limpeza best-effort
    }
  });

  it("POST /clientes com Bearer admin → 201 e corpo com id (uuid)", async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/clientes`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({
        nome: `Teste-cli-${ts}`,
        email,
        telefone: null,
        endereco: {
          logradouro: "R",
          numero: "1",
          complemento: null,
          bairro: "B",
          cidade: "Santos",
          estado: "SP",
          cep: "11000000",
        },
      }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("string");
    clienteId = body.id;
  });

  it("GET /clientes?pagina=1&tamanho=10 → 200 paginado (itens array, totalRegistros number)", async () => {
    const resp = await fetch(`${baseUrl()}/clientes?pagina=1&tamanho=10`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
    expect(typeof body.totalRegistros).toBe("number");
  });

  it("PUT /clientes/{id} (sem endereco) → 200/204", async () => {
    expect(clienteId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/clientes/${clienteId}`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({
        id: clienteId,
        nome: `Teste-cli-upd-${ts}`,
        email,
        telefone: null,
      }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /clientes/{id} → 200/204", async () => {
    expect(clienteId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/clientes/${clienteId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
