import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de produtos contra a API local real.
// Validam o SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// Dependência: um produto exige uma categoria. No `beforeAll` criamos uma
// categoria descartável e guardamos o `categoriaId`; no `afterAll` removemos
// produto (se sobrou) e categoria, nessa ordem — a API recusa DELETE de
// categoria com produto vinculado.
//
// Escrita opção C: a rodada CRIA o produto que manipula (nome único por
// timestamp). Ordem sequencial POST→GET→list→PUT→DELETE.
//
// Shapes de body conforme `src/lib/api/produtos.ts`: POST/PUT usam `fotoUrl` e
// `tipo` inteiro (0=simples, 1=combo). O GET devolve `fotoUrl`.
//
// Status/shapes reais observados contra a API local (seed):
//   POST   /produtos        → 201  body {"id": "<uuid>"}
//   GET    /produtos/{id}    → 200  body {id:uuid, nome, categoriaId, preco, fotoUrl, disponivel, tipo}
//   GET    /produtos?...     → 200  body paginado {itens:[...], totalRegistros, ...}
//   PUT    /produtos/{id}    → 200/204
//   DELETE /produtos/{id}    → 200/204

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de produtos PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de produtos", () => {
  const ts = Date.now();
  let token = "";
  let categoriaId: number | undefined;
  let produtoId: string | undefined;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/categorias`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({ nome: `Teste-cat-prod-${ts}`, descricao: null, ativo: true }),
    });
    if (resp.status !== 200 && resp.status !== 201) {
      throw new Error(
        `beforeAll: POST /categorias falhou: esperado 200/201, recebido ${resp.status}`,
      );
    }
    const body = await resp.json();
    categoriaId = body.id;
  });

  afterAll(async () => {
    if (!token) return;
    // Remover produto ANTES da categoria (FK). Best-effort — ignora erros.
    if (produtoId !== undefined) {
      try {
        await fetch(`${baseUrl()}/produtos/${produtoId}`, { method: "DELETE", headers: auth() });
      } catch {
        // ignorado
      }
    }
    if (categoriaId !== undefined) {
      try {
        await fetch(`${baseUrl()}/categorias/${categoriaId}`, {
          method: "DELETE",
          headers: auth(),
        });
      } catch {
        // ignorado
      }
    }
  });

  it("POST /produtos com Bearer admin → 201 e corpo com id (uuid)", async () => {
    expect(categoriaId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/produtos`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({
        nome: `Teste-prod-${ts}`,
        descricao: "d",
        categoriaId,
        preco: 10.5,
        fotoUrl: "http://x/f.jpg",
        disponivel: true,
        tipo: 0,
        itens: null,
      }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("string");
    // uuid: só garantimos string não-vazia (shape), não o formato exato.
    expect(body.id.length).toBeGreaterThan(0);
    produtoId = body.id;
  });

  it("GET /produtos/{id} → 200 com shape (id, nome, categoriaId, preco, fotoUrl, disponivel, tipo)", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/produtos/${produtoId}`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(produtoId);
    expect(typeof body.nome).toBe("string");
    expect(typeof body.categoriaId).toBe("number");
    expect(typeof body.preco).toBe("number");
    // Foto: o service mapeia `fotoUrl ?? foto`; aceitamos qualquer uma presente.
    expect("fotoUrl" in body || "foto" in body).toBe(true);
    expect(typeof body.disponivel).toBe("boolean");
    expect(body).toHaveProperty("tipo");
  });

  it("GET /produtos?pagina=1&tamanho=10 → 200 paginado (itens array, totalRegistros number)", async () => {
    const resp = await fetch(`${baseUrl()}/produtos?pagina=1&tamanho=10`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
    expect(typeof body.totalRegistros).toBe("number");
  });

  it("PUT /produtos/{id} → 200/204", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/produtos/${produtoId}`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({
        id: produtoId,
        nome: `Teste-prod-upd-${ts}`,
        descricao: "d2",
        categoriaId,
        preco: 12,
        fotoUrl: "http://x/f2.jpg",
        disponivel: false,
      }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /produtos/{id} → 200/204", async () => {
    expect(produtoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/produtos/${produtoId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
    // Produto removido: evita DELETE duplicado no afterAll.
    produtoId = undefined;
  });
});
