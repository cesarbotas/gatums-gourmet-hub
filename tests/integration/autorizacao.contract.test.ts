import { beforeAll, describe, expect, it } from "vitest";
import {
  apiOnline,
  assertAmbientePermitido,
  baseUrl,
  criarClienteEGerente,
  loginAdmin,
} from "./helpers";

// Testes INTEGRADOS de contrato: MATRIZ DE NEGAÇÃO por papel (401/403) contra a
// API local real. Documentam quem recebe 200/401/403 em endpoints de
// gestão/admin representativos. Rodam SÓ via `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// MÉTODO: o OpenAPI NÃO diz qual papel cada endpoint exige. Descobrimos o
// comportamento REAL rodando contra a API local e asseramos o status observado.
// Nenhuma asserção força 403 "no desejo" — todas refletem o que a API retorna.
//
// MATRIZ REAL observada (API local, seed) — endpoint × papel × status:
//   GET  /usuarios                 sem-token=401  cliente=403  gerente=403  admin=200
//   GET  /roles                    sem-token=401  cliente=403  gerente=403  admin=200
//   GET  /permissions              sem-token=401  cliente=403  gerente=403  admin=200
//   GET  /relatorios/vendas/resumo sem-token=401  (admin=200, ver relatorios.contract)
//   POST /permissions              cliente=403    gerente=403  (admin=201, ver permissions.contract)
//
// CONCLUSÃO: os endpoints de gestão (usuarios/roles/permissions) são
// Admin-only. NEM o Cliente NEM o Gerente têm acesso — ambos recebem 403.
// Só o seed Admin (200/201) passa, conforme confirmado nos contratos de
// usuarios/roles/permissions/relatorios das Tasks anteriores.

// Guarda de ambiente ANTES de qualquer requisição (inclusive o probe de
// apiOnline): bloqueia PROD/hosts desconhecidos antes de tocar a rede.
assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de autorização PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: matriz de negação por papel (401/403)", () => {
  let clienteToken = "";
  let gerenteToken = "";

  beforeAll(async () => {
    // loginAdmin apenas valida que o seed admin está disponível (pré-condição
    // da suíte); os tokens de Cliente/Gerente é que exercem a negação.
    await loginAdmin();
    const tokens = await criarClienteEGerente();
    clienteToken = tokens.clienteToken;
    gerenteToken = tokens.gerenteToken;
  });

  // Helper: faz um GET e devolve o status real.
  const statusGet = async (path: string, token?: string): Promise<number> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const resp = await fetch(`${baseUrl()}${path}`, { headers });
    return resp.status;
  };

  // ---------------------------------------------------------------------------
  // Bloco 1 — SEM Authorization → 401 (não autenticado)
  // ---------------------------------------------------------------------------
  describe("sem token → 401 (não autenticado)", () => {
    it("GET /usuarios → 401", async () => {
      expect(await statusGet("/usuarios")).toBe(401);
    });

    it("GET /roles → 401", async () => {
      expect(await statusGet("/roles")).toBe(401);
    });

    it("GET /permissions → 401", async () => {
      expect(await statusGet("/permissions")).toBe(401);
    });

    it("GET /relatorios/vendas/resumo → 401", async () => {
      expect(await statusGet("/relatorios/vendas/resumo")).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Bloco 2 — Cliente em endpoints de gestão/admin → 403 (autenticado, sem
  // permissão). Status REAL observado; não forçado.
  // ---------------------------------------------------------------------------
  describe("cliente → 403 (autenticado, sem permissão de gestão)", () => {
    it("GET /usuarios com cliente → 403", async () => {
      expect(await statusGet("/usuarios", clienteToken)).toBe(403);
    });

    it("GET /roles com cliente → 403", async () => {
      expect(await statusGet("/roles", clienteToken)).toBe(403);
    });

    it("GET /permissions com cliente → 403", async () => {
      expect(await statusGet("/permissions", clienteToken)).toBe(403);
    });

    it("POST /permissions com cliente → 403", async () => {
      const resp = await fetch(`${baseUrl()}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clienteToken}`,
        },
        body: JSON.stringify({
          codigo: `x:${Date.now()}`,
          descricao: null,
          recurso: "x",
          acao: "ler",
        }),
      });
      expect(resp.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Bloco 3 — Gerente em endpoints de gestão/admin.
  // DESCOBERTA: o Gerente TAMBÉM recebe 403 nesses endpoints — eles são
  // Admin-only. Asseramos o 403 real observado.
  // ---------------------------------------------------------------------------
  describe("gerente → 403 (endpoints de gestão são Admin-only)", () => {
    it("GET /usuarios com gerente → 403", async () => {
      expect(await statusGet("/usuarios", gerenteToken)).toBe(403);
    });

    it("GET /permissions com gerente → 403", async () => {
      expect(await statusGet("/permissions", gerenteToken)).toBe(403);
    });
  });
});
