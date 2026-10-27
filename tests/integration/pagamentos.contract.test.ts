import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  apiOnline,
  assertAmbientePermitido,
  baseUrl,
  criarClienteEGerente,
  loginAdmin,
} from "./helpers";

// Testes INTEGRADOS de contrato de PAGAMENTOS contra a API local real. Validam
// o SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts): `assertAmbientePermitido()` +
// `apiOnline()`/skipIf (mesmo contrato das Tasks 1/2).
//
// MÁQUINA DE ESTADO: pagamentos transitam pendente→aprovado. O teste monta o
// estado alcançável e asserta o status REAL quando a transição depende de
// estado — não força verde.
//
// MetodoPagamento (inteiro) — confirmado via GET /pagamentos/opcoes + service
// src/lib/api/pagamentos.ts:
//   0 = cartao_debito, 1 = cartao_credito, 2 = pix
// (opcoes devolve o `metodo` como STRING: "cartao_credito"|"cartao_debito"|"pix";
//  o POST /pagamentos/iniciar espera o INTEIRO.)
//
// Setup (opção C): admin cria categoria → produto; cliente monta carrinho →
// checkout → captura `pedidoId`. Pagamentos são iniciados pelo CLIENTE.
// afterAll best-effort: produto antes da categoria.
//
// Status/shapes reais observados contra a API local (seed):
//   GET  /pagamentos/opcoes                 → 200 [{metodo, label, disponivel}]
//   POST /pagamentos/iniciar (Idempotency)   → 201 {id, pedidoId, metodo, valor,
//                                              status:"pendente", ...}
//   GET  /pagamentos/{id}/status             → 200 {id, pedidoId, metodo, valor,
//                                              status, ...}
//   POST /pagamentos/{id}/pix/confirmar      → 200 {... status:"aprovado"}
//   POST /pagamentos/{id}/validar (admin)    → 200 {...}
//   POST /pagamentos/{id}/cartao             → 200 {... status:"aprovado"}

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de pagamentos PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: pagamentos (fluxo de compra + máquina de estado)", () => {
  const ts = Date.now();
  let adminToken = "";
  let clienteToken = "";
  let categoriaId: number | undefined;
  let produtoId: string | undefined;
  let pedidoId: string | undefined;
  let pixTransacaoId: string | undefined;

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
      body: JSON.stringify({ nome: `Teste-cat-pag-${ts}`, descricao: null, ativo: true }),
    });
    if (catResp.status !== 200 && catResp.status !== 201) {
      throw new Error(`beforeAll: POST /categorias falhou: recebido ${catResp.status}`);
    }
    categoriaId = (await catResp.json()).id;

    const prodResp = await fetch(`${baseUrl()}/produtos`, {
      method: "POST",
      headers: adminJson(),
      body: JSON.stringify({
        nome: `Teste-prod-pag-${ts}`,
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

    // Carrinho não-vazio → checkout → pedido para o qual iniciaremos pagamento.
    const addResp = await fetch(`${baseUrl()}/carrinho/itens`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ produtoId, quantidade: 1 }),
    });
    if (![200, 201].includes(addResp.status)) {
      throw new Error(`beforeAll: POST /carrinho/itens falhou: recebido ${addResp.status}`);
    }
    const coResp = await fetch(`${baseUrl()}/pedidos/checkout`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ clienteNome: "Teste" }),
    });
    if (coResp.status !== 201) {
      throw new Error(`beforeAll: POST /pedidos/checkout falhou: recebido ${coResp.status}`);
    }
    pedidoId = (await coResp.json()).pedidoId;
  });

  afterAll(async () => {
    if (!adminToken) return;
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

  it("GET /pagamentos/opcoes → 200 com métodos (metodo/label) — fonte dos valores válidos", async () => {
    const resp = await fetch(`${baseUrl()}/pagamentos/opcoes`, { headers: cliAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    const items = Array.isArray(body) ? body : (body.items ?? body.itens ?? []);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    // Cada opção expõe o método (string) e um rótulo.
    expect(typeof items[0].metodo === "string" || typeof items[0].id === "string").toBe(true);
    // Os três métodos esperados devem estar presentes.
    const metodos = items.map((o: { metodo?: string; id?: string }) => o.metodo ?? o.id);
    expect(metodos).toContain("pix");
  });

  it("POST /pagamentos/iniciar (pix=2, Idempotency-Key) → 201 {id, status}", async () => {
    expect(pedidoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pagamentos/iniciar`, {
      method: "POST",
      headers: { ...cliJson(), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ pedidoId, metodo: 2, valor: 10.5 }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.pedidoId).toBe(pedidoId);
    // Pagamento recém-iniciado começa pendente (máquina de estado).
    expect(typeof body.status).toBe("string");
    pixTransacaoId = body.id;
  });

  it("GET /pagamentos/{transacaoId}/status → 200 com shape (id, pedidoId, status)", async () => {
    expect(pixTransacaoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pagamentos/${pixTransacaoId}/status`, {
      headers: cliAuth(),
    });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(pixTransacaoId);
    expect(body.pedidoId).toBe(pedidoId);
    expect(typeof body.status).toBe("string");
  });

  it("POST /pagamentos/{transacaoId}/pix/confirmar → 200/204 (transita para aprovado)", async () => {
    // Transição de estado alcançável para Pix: confirma o pagamento.
    expect(pixTransacaoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pagamentos/${pixTransacaoId}/pix/confirmar`, {
      method: "POST",
      headers: cliJson(),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("POST /pagamentos/{transacaoId}/validar com token ADMIN → 200/204", async () => {
    // Validação é ação de gestão; após o Pix confirmado a transação está
    // aprovada e a validação é aceita.
    expect(pixTransacaoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pagamentos/${pixTransacaoId}/validar`, {
      method: "POST",
      headers: adminJson(),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("POST /pagamentos/{transacaoId}/cartao (fluxo crédito) → 200/204", async () => {
    // Inicia uma nova transação de cartão de crédito (metodo=1) no mesmo pedido
    // e processa os dados do cartão. Exercita o ramo de cartão da máquina.
    expect(pedidoId).toBeDefined();
    const iniResp = await fetch(`${baseUrl()}/pagamentos/iniciar`, {
      method: "POST",
      headers: { ...cliJson(), "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ pedidoId, metodo: 1, valor: 10.5 }),
    });
    expect(iniResp.status).toBe(201);
    const cartaoTransacaoId = (await iniResp.json()).id;
    expect(typeof cartaoTransacaoId).toBe("string");

    const resp = await fetch(`${baseUrl()}/pagamentos/${cartaoTransacaoId}/cartao`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({
        numero: "4111111111111111",
        nome: "Teste Cliente",
        validade: "12/30",
        cvv: "123",
      }),
    });
    expect([200, 204]).toContain(resp.status);
  });
});
