import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiOnline,
  assertAmbientePermitido,
  baseUrl,
  criarClienteEGerente,
  loginAdmin,
} from "./helpers";

// Testes INTEGRADOS de contrato do CARRINHO contra a API local real. Validam o
// SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// Dependência: o carrinho opera sobre um produto disponível. No `beforeAll`
// (token admin) criamos categoria → produto descartáveis e guardamos os ids;
// no `afterAll` removemos produto antes da categoria (FK).
//
// TOKEN do carrinho (descoberto ao rodar): o carrinho é por usuário e funciona
// tanto com o token admin quanto com o token Cliente. Usamos o `clienteToken`
// de `criarClienteEGerente()` porque é o papel real que usa o carrinho no fluxo
// de compra (e o mesmo token alimenta o checkout nos testes de pedidos).
//
// Status/shapes reais observados contra a API local (seed):
//   GET    /carrinho              → 200  body {itens:[...], total:<number>}
//   POST   /carrinho/itens        → 200  body `true`
//   PATCH  /carrinho/itens/{id}   → 200  body `true`
//   DELETE /carrinho/itens/{id}   → 200  body `true`
//   DELETE /carrinho              → 200  body `true`

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de carrinho PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: carrinho (fluxo de compra)", () => {
  const ts = Date.now();
  let adminToken = "";
  let clienteToken = "";
  let categoriaId: number | undefined;
  let produtoId: string | undefined;

  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
  const adminJson = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  });
  const cliAuth = () => ({ Authorization: `Bearer ${clienteToken}` });
  const cliJson = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${clienteToken}`,
  });

  beforeAll(async () => {
    adminToken = await loginAdmin();
    ({ clienteToken } = await criarClienteEGerente());

    const catResp = await fetch(`${baseUrl()}/categorias`, {
      method: "POST",
      headers: adminJson(),
      body: JSON.stringify({ nome: `Teste-cat-carr-${ts}`, descricao: null, ativo: true }),
    });
    if (catResp.status !== 200 && catResp.status !== 201) {
      throw new Error(`beforeAll: POST /categorias falhou: recebido ${catResp.status}`);
    }
    categoriaId = (await catResp.json()).id;

    const prodResp = await fetch(`${baseUrl()}/produtos`, {
      method: "POST",
      headers: adminJson(),
      body: JSON.stringify({
        nome: `Teste-prod-carr-${ts}`,
        descricao: "d",
        categoriaId,
        preco: 10.5,
        fotoUrl: "http://x/f.jpg",
        disponivel: true,
        tipo: 0,
        itens: null,
      }),
    });
    if (prodResp.status !== 200 && prodResp.status !== 201) {
      throw new Error(`beforeAll: POST /produtos falhou: recebido ${prodResp.status}`);
    }
    produtoId = (await prodResp.json()).id;
  });

  afterAll(async () => {
    if (!adminToken) return;
    // Esvazia o carrinho do cliente para não deixar item órfão (best-effort).
    if (clienteToken) {
      try {
        await fetch(`${baseUrl()}/carrinho`, { method: "DELETE", headers: cliAuth() });
      } catch {
        // ignorado
      }
    }
    // Remover produto ANTES da categoria (FK). Best-effort.
    if (produtoId !== undefined) {
      try {
        await fetch(`${baseUrl()}/produtos/${produtoId}`, {
          method: "DELETE",
          headers: adminAuth(),
        });
      } catch {
        // ignorado
      }
    }
    if (categoriaId !== undefined) {
      try {
        await fetch(`${baseUrl()}/categorias/${categoriaId}`, {
          method: "DELETE",
          headers: adminAuth(),
        });
      } catch {
        // ignorado
      }
    }
  });

  it("GET /carrinho → 200 com shape {itens: array, total: number}", async () => {
    const resp = await fetch(`${baseUrl()}/carrinho`, { headers: cliAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("POST /carrinho/itens {produtoId, quantidade:1} → 200/201", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/carrinho/itens`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ produtoId, quantidade: 1 }),
    });
    // Observado: a API responde 200 (não 201) para adicionar item ao carrinho.
    expect([200, 201]).toContain(resp.status);
  });

  it("GET /carrinho após POST → 200 e o item aparece em itens", async () => {
    const resp = await fetch(`${baseUrl()}/carrinho`, { headers: cliAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
    const encontrado = body.itens.some(
      (i: { produtoId?: string; produto?: { id?: string } }) =>
        i.produtoId === produtoId || i.produto?.id === produtoId,
    );
    expect(encontrado).toBe(true);
  });

  it("PATCH /carrinho/itens/{produtoId} {quantidade:2} → 200/204", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/carrinho/itens/${produtoId}`, {
      method: "PATCH",
      headers: cliJson(),
      body: JSON.stringify({ quantidade: 2 }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /carrinho/itens/{produtoId} → 200/204", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/carrinho/itens/${produtoId}`, {
      method: "DELETE",
      headers: cliAuth(),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /carrinho (esvaziar) → 200/204", async () => {
    // Garante ao menos um item para exercer o esvaziamento.
    await fetch(`${baseUrl()}/carrinho/itens`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ produtoId, quantidade: 1 }),
    });
    const resp = await fetch(`${baseUrl()}/carrinho`, { method: "DELETE", headers: cliAuth() });
    expect([200, 204]).toContain(resp.status);
  });
});
