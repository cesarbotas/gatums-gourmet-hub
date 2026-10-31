import { afterAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de roles contra a API local real.
// Validam SHAPE/STATUS (não regra de negócio). Rodam SÓ via `npm run test:integration`.
//
// Guardas: `assertAmbientePermitido()` + skip quando a API está offline.
// Escrita opção C: cada rodada CRIA a role que manipula (nome único por
// timestamp) e a limpa no `afterAll`. Ordem POST→GET→list→PUT→PUT perms→DELETE.
//
// Status/shapes reais observados contra a API local (seed):
//   POST   /roles              → 201  body {"id": <number>}
//   GET    /roles/{id}          → 200  body {id:number, nome, descricao}
//   GET    /roles               → 200  ARRAY direto
//   PUT    /roles/{id}          → 200/204
//   PUT    /roles/{id}/permissions → 200/204
//   DELETE /roles/{id}          → 200/204

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API. Testes de contrato de roles PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de roles", () => {
  const ts = Date.now();
  let token = "";
  let roleId: number | undefined;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  afterAll(async () => {
    if (!token || roleId === undefined) return;
    try {
      await fetch(`${baseUrl()}/roles/${roleId}`, { method: "DELETE", headers: auth() });
    } catch {
      // ignorado — limpeza best-effort
    }
  });

  it("POST /roles com Bearer admin → 201 e corpo com id (number)", async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/roles`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({ nome: `Teste-role-${ts}`, descricao: null }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("number");
    roleId = body.id;
  });

  it("GET /roles/{id} → 200 com shape {id, nome, descricao}", async () => {
    expect(roleId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/roles/${roleId}`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(roleId);
    expect(typeof body.nome).toBe("string");
    expect(body.nome).toBe(`Teste-role-${ts}`);
    expect(body).toHaveProperty("descricao");
  });

  it("GET /roles → 200 ARRAY direto", async () => {
    const resp = await fetch(`${baseUrl()}/roles`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("PUT /roles/{id} → 200/204", async () => {
    expect(roleId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/roles/${roleId}`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({ id: roleId, nome: `Teste-role-upd-${ts}`, descricao: null }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("PUT /roles/{id}/permissions → 200/204", async () => {
    expect(roleId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/roles/${roleId}/permissions`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({ roleId, permissionIds: [] }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /roles/{id} → 200/204", async () => {
    expect(roleId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/roles/${roleId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
