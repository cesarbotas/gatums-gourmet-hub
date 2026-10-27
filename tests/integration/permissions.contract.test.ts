import { afterAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de permissions contra a API local real.
// Validam SHAPE/STATUS (não regra de negócio). Rodam SÓ via `npm run test:integration`.
//
// Guardas: `assertAmbientePermitido()` + skip quando a API está offline.
// Escrita opção C: cada rodada CRIA a permission que manipula (codigo único por
// timestamp) e a limpa no `afterAll`. Ordem POST→GET→list→PUT→DELETE.
//
// Status/shapes reais observados contra a API local (seed):
//   POST   /permissions        → 201  body {"id": <number>}
//   GET    /permissions/{id}    → 200  body {id, codigo, descricao, recurso, acao}
//   GET    /permissions         → 200  ARRAY direto
//   PUT    /permissions/{id}    → 200/204
//   DELETE /permissions/{id}    → 200/204

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API. Testes de contrato de permissions PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de permissions", () => {
  const ts = Date.now();
  let token = "";
  let permissionId: number | undefined;
  const codigo = `teste:${ts}`;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  afterAll(async () => {
    if (!token || permissionId === undefined) return;
    try {
      await fetch(`${baseUrl()}/permissions/${permissionId}`, { method: "DELETE", headers: auth() });
    } catch {
      // ignorado — limpeza best-effort
    }
  });

  it("POST /permissions com Bearer admin → 201 e corpo com id (number)", async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/permissions`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({ codigo, descricao: null, recurso: "teste", acao: "ler" }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("number");
    permissionId = body.id;
  });

  it("GET /permissions/{id} → 200 com shape {id, codigo, descricao, recurso, acao}", async () => {
    expect(permissionId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/permissions/${permissionId}`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(permissionId);
    expect(typeof body.codigo).toBe("string");
    expect(body.codigo).toBe(codigo);
    expect(body).toHaveProperty("descricao");
    expect(typeof body.recurso).toBe("string");
    expect(typeof body.acao).toBe("string");
  });

  it("GET /permissions → 200 ARRAY direto", async () => {
    const resp = await fetch(`${baseUrl()}/permissions`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("PUT /permissions/{id} → 200/204", async () => {
    expect(permissionId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/permissions/${permissionId}`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({ id: permissionId, descricao: null, recurso: "teste", acao: "editar" }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /permissions/{id} → 200/204", async () => {
    expect(permissionId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/permissions/${permissionId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
