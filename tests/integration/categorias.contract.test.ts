import { afterAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de categorias contra a API local real.
// Validam o SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// Escrita opção C: cada rodada CRIA a categoria que manipula (nome único por
// timestamp) e a limpa no `afterAll`. Ordem sequencial POST→GET→list→PUT→DELETE
// com o `id` compartilhado via variável do escopo do describe.
//
// Status/shapes reais observados contra a API local (seed):
//   POST   /categorias        → 201  body {"id": <number>}
//   GET    /categorias/{id}    → 200  body {id, nome, descricao, ativo}
//   GET    /categorias?...     → 200  body paginado {itens:[...], totalRegistros, ...}
//   PUT    /categorias/{id}    → 200  body `true`
//   DELETE /categorias/{id}    → 200

// Guarda de ambiente ANTES de qualquer requisição (inclusive o probe de
// apiOnline): bloqueia PROD/hosts desconhecidos antes de tocar a rede.
assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de categorias PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de categorias", () => {
  const ts = Date.now();
  let token = "";
  let categoriaId: number | undefined;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  afterAll(async () => {
    // Best-effort: se algum passo falhou antes do DELETE, tenta remover o
    // registro criado para não deixar lixo no banco (descartável, opção C).
    if (!token || categoriaId === undefined) return;
    try {
      await fetch(`${baseUrl()}/categorias/${categoriaId}`, {
        method: "DELETE",
        headers: auth(),
      });
    } catch {
      // ignorado — limpeza best-effort
    }
  });

  it("POST /categorias com Bearer admin → 201 e corpo com id (number)", async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/categorias`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({ nome: `Teste-cat-${ts}`, descricao: null, ativo: true }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("number");
    categoriaId = body.id;
  });

  it("GET /categorias/{id} → 200 com shape {id, nome, descricao, ativo}", async () => {
    expect(categoriaId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/categorias/${categoriaId}`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(categoriaId);
    expect(typeof body.nome).toBe("string");
    expect(body.nome).toBe(`Teste-cat-${ts}`);
    // `descricao` pode ser null; só garantimos que a chave existe.
    expect(body).toHaveProperty("descricao");
    expect(typeof body.ativo).toBe("boolean");
  });

  it("GET /categorias?pagina=1&tamanho=10 → 200 paginado (itens array, totalRegistros number)", async () => {
    const resp = await fetch(`${baseUrl()}/categorias?pagina=1&tamanho=10`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
    expect(typeof body.totalRegistros).toBe("number");
  });

  it("PUT /categorias/{id} → 200/204", async () => {
    expect(categoriaId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/categorias/${categoriaId}`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({
        id: categoriaId,
        nome: `Teste-cat-upd-${ts}`,
        descricao: null,
        ativo: false,
      }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /categorias/{id} → 200/204", async () => {
    expect(categoriaId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/categorias/${categoriaId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
