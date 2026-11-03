import { describe, it, expect } from "vitest";
import { apiOnline, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato dos endpoints de auth contra a API local real.
// Validam o SHAPE das respostas (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Se a API estiver fora do ar, PULAM (skip) com mensagem clara — nunca falham
// por erro de conexão. Top-level await é suportado em ESM; checamos uma vez.

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de auth PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: endpoints de auth", () => {
  it("POST /auth/login (seed admin) → 200 com shape de sessão", async () => {
    const resp = await fetch(`${baseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gatums.com", senha: "Admin@123" }),
    });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
    expect(typeof body.expiresIn).toBe("number");
    expect(Array.isArray(body.user?.roles)).toBe(true);
  });

  it("POST /auth/login com senha errada → status >= 400", async () => {
    const resp = await fetch(`${baseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gatums.com", senha: "senha-errada" }),
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).not.toBe(200);
  });

  it("GET /auth/me com Bearer válido → 200 com shape de usuário", async () => {
    const token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("nome");
    expect(body).toHaveProperty("email");
    expect(Array.isArray(body.roles)).toBe(true);
  });

  it("GET /auth/me SEM Authorization → 401", async () => {
    const resp = await fetch(`${baseUrl()}/auth/me`);
    expect(resp.status).toBe(401);
  });
});

// --- PADRÃO para replicar em outros recursos -------------------------------
// Para cobrir o contrato de endpoints protegidos (ex.: /categorias, /produtos):
//
//   const token = await loginAdmin();
//   const resp = await fetch(`${baseUrl()}/categorias`, {
//     headers: { Authorization: `Bearer ${token}` },
//   });
//   expect(resp.status).toBe(200);
//   const body = await resp.json();
//   // validar o SHAPE (ex.: paginado): itens/totalRegistros/paginaAtual/...
//   expect(Array.isArray(body.itens)).toBe(true);
//
// Sempre: login → GET com Bearer → validar shape (não a regra de negócio).
