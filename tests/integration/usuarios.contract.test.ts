import { afterAll, describe, expect, it } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do CRUD de usuarios contra a API local real.
// Validam SHAPE/STATUS (não regra de negócio). Rodam SÓ via `npm run test:integration`.
//
// Guardas: `assertAmbientePermitido()` + skip quando a API está offline.
// Escrita opção C: cada rodada CRIA o usuário que manipula (email único por
// timestamp) e o limpa no `afterAll`. Ordem GET roles→POST→GET→list→PUT roles→
// PATCH ativo→DELETE.
//
// Status/shapes reais observados contra a API local (seed):
//   GET    /roles              → 200  ARRAY direto (achamos roleId)
//   POST   /usuarios           → 201  body {"id": <uuid>}
//   GET    /usuarios/{id}       → 200  body {id, nome, email, roles?}
//   GET    /usuarios            → 200  ARRAY direto
//   PUT    /usuarios/{id}/roles → 200/204
//   PATCH  /usuarios/{id}/ativo → 200/204
//   DELETE /usuarios/{id}       → 200/204

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API. Testes de contrato de usuarios PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: CRUD de usuarios", () => {
  const ts = Date.now();
  let token = "";
  let usuarioId: string | undefined;
  let roleId: number | undefined;
  const email = `usr-${ts}@local.test`;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const jsonAuth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

  afterAll(async () => {
    if (!token || usuarioId === undefined) return;
    try {
      await fetch(`${baseUrl()}/usuarios/${usuarioId}`, { method: "DELETE", headers: auth() });
    } catch {
      // ignorado — limpeza best-effort
    }
  });

  it("GET /roles → 200 array; achar um roleId válido", async () => {
    token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/roles`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as Array<{ id: number; nome: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const cliente = body.find((r) => r.nome === "Cliente");
    roleId = cliente ? cliente.id : body[0].id;
    expect(typeof roleId).toBe("number");
  });

  it("POST /usuarios com Bearer admin → 201 e corpo com id (uuid)", async () => {
    expect(roleId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/usuarios`, {
      method: "POST",
      headers: jsonAuth(),
      body: JSON.stringify({
        nome: `Teste-usr-${ts}`,
        email,
        senha: "Teste@123",
        telefone: null,
        roleIds: [roleId],
      }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("string");
    usuarioId = body.id;
  });

  it("GET /usuarios/{id} → 200 com shape {id, nome, email, roles?}", async () => {
    expect(usuarioId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/usuarios/${usuarioId}`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(usuarioId);
    expect(typeof body.nome).toBe("string");
    expect(body.nome).toBe(`Teste-usr-${ts}`);
    expect(typeof body.email).toBe("string");
    expect(body.email).toBe(email);
  });

  it("GET /usuarios → 200 ARRAY direto", async () => {
    const resp = await fetch(`${baseUrl()}/usuarios`, { headers: auth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("PUT /usuarios/{id}/roles → 200/204", async () => {
    expect(usuarioId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/usuarios/${usuarioId}/roles`, {
      method: "PUT",
      headers: jsonAuth(),
      body: JSON.stringify({ usuarioId, roleIds: [roleId] }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("PATCH /usuarios/{id}/ativo → 200/204", async () => {
    expect(usuarioId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/usuarios/${usuarioId}/ativo`, {
      method: "PATCH",
      headers: jsonAuth(),
      body: JSON.stringify({ usuarioId, ativo: false }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("DELETE /usuarios/{id} → 200/204", async () => {
    expect(usuarioId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/usuarios/${usuarioId}`, {
      method: "DELETE",
      headers: auth(),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
