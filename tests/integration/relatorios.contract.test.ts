import { describe, it, expect, beforeAll } from "vitest";
import { apiOnline, assertAmbientePermitido, baseUrl, loginAdmin } from "./helpers";

// Testes INTEGRADOS de contrato do endpoint de relatórios contra a API local
// real. Validam o SHAPE da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts):
//  - `assertAmbientePermitido()` recusa PROD/hosts desconhecidos ANTES de
//    qualquer requisição (allowlist local + HML).
//  - `apiOnline()` → se a API estiver fora do ar, PULAMOS (skip) com mensagem
//    clara em vez de falhar por erro de conexão.
//
// Shape real observado de GET /relatorios/vendas/resumo (API local, seed):
//   {
//     faturamento: number,       // ex.: 18120.00
//     totalPedidos: number,      // ex.: 302
//     ticketMedio: number,       // ex.: 60.00
//     topProdutos: Array<{ produtoId: string; nome: string; quantidade: number; total: number }>,
//     serieDiaria: Array<{ data: string; faturamento: number; pedidos: number }>
//   }

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de relatórios PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: endpoints de relatórios", () => {
  beforeAll(() => {
    // Falha rápida e clara se a base não for local/HML (bloqueia PROD).
    assertAmbientePermitido();
  });

  it("GET /relatorios/vendas/resumo com Bearer admin → 200 com objeto de resumo", async () => {
    const token = await loginAdmin();
    const resp = await fetch(`${baseUrl()}/relatorios/vendas/resumo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    // Corpo é um objeto não-nulo.
    expect(body).not.toBeNull();
    expect(typeof body).toBe("object");

    // Campos reais observados (documentados para os consumidores das Fases 2-3).
    expect(typeof body.faturamento).toBe("number");
    expect(typeof body.totalPedidos).toBe("number");
    expect(typeof body.ticketMedio).toBe("number");
    expect(Array.isArray(body.topProdutos)).toBe(true);
    expect(Array.isArray(body.serieDiaria)).toBe(true);
  });

  it("GET /relatorios/vendas/resumo SEM Authorization → 401", async () => {
    const resp = await fetch(`${baseUrl()}/relatorios/vendas/resumo`);
    expect(resp.status).toBe(401);
  });
});
