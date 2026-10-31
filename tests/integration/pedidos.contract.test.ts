import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiOnline,
  assertAmbientePermitido,
  baseUrl,
  criarClienteEGerente,
  loginAdmin,
} from "./helpers";

// Testes INTEGRADOS de contrato de PEDIDOS contra a API local real. Validam o
// SHAPE/STATUS da resposta (não a regra de negócio). Rodam SÓ via
// `npm run test:integration`.
//
// Guardas de segurança (ver helpers.ts): `assertAmbientePermitido()` +
// `apiOnline()`/skipIf (mesmo contrato das Tasks 1/2).
//
// MÁQUINA DE ESTADO: pedidos têm etapas (criado→aprovado→…). O teste monta o
// estado alcançável e DOCUMENTA/asserta o status REAL quando uma transição
// depende de estado/permissão — não força verde.
//
// Enums inteiros (confirmados via src/lib/api/pedidos.ts e exercidos ao rodar):
//   PedidoEtapa: criado=0, aprovado=1, pagamento=2, pagamento_aprovado=3,
//                envio_pendente=4, entregue=5, finalizado=6
//   EntregaTipo: transporte=0, retirada=1
//
// RBAC descoberto ao rodar:
//   POST /pedidos/{id}/etapas/avancar → 200 com token ADMIN, 403 com token
//   CLIENTE (avançar etapa é ação de gestão). O checkout e o
//   pagamento/concluir são feitos pelo CLIENTE.
//
// Setup (opção C): token admin cria categoria → produto; token cliente monta
// carrinho (POST /carrinho/itens) → checkout. afterAll best-effort: produto
// antes da categoria.
//
// Status/shapes reais observados contra a API local (seed):
//   GET  /pedidos?pagina&tamanho            → 200 paginado {itens:[...], ...}
//   POST /pedidos/checkout {clienteNome}     → 201 {pedidoId:"<uuid>"}
//   GET  /pedidos/{id}                       → 200 {id, userId, clienteNome,
//                                              itens[], total, statusAtual,
//                                              timeline[], pagamento}
//   POST /pedidos/{id}/etapas/avancar        → 200 (admin) / 403 (cliente)
//   POST /pedidos/{id}/pagamento/concluir    → 200 (cliente) body `true`

assertAmbientePermitido();

const online = await apiOnline();
if (!online) {
  console.warn(
    `API local fora do ar em ${baseUrl()} — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de pedidos PULADOS.`,
  );
}

describe.skipIf(!online)("contrato: pedidos (fluxo de compra + máquina de estado)", () => {
  const ts = Date.now();
  let adminToken = "";
  let clienteToken = "";
  let categoriaId: number | undefined;
  let produtoId: string | undefined;
  let pedidoId: string | undefined;

  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
  const adminJson = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  });
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
      body: JSON.stringify({ nome: `Teste-cat-ped-${ts}`, descricao: null, ativo: true }),
    });
    if (catResp.status !== 200 && catResp.status !== 201) {
      throw new Error(`beforeAll: POST /categorias falhou: recebido ${catResp.status}`);
    }
    categoriaId = (await catResp.json()).id;

    const prodResp = await fetch(`${baseUrl()}/produtos`, {
      method: "POST",
      headers: adminJson(),
      body: JSON.stringify({
        nome: `Teste-prod-ped-${ts}`,
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

    // Carrinho não-vazio (cliente) para permitir o checkout.
    const addResp = await fetch(`${baseUrl()}/carrinho/itens`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ produtoId, quantidade: 1 }),
    });
    if (![200, 201].includes(addResp.status)) {
      throw new Error(`beforeAll: POST /carrinho/itens falhou: recebido ${addResp.status}`);
    }
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

  it("GET /pedidos?pagina=1&tamanho=10 → 200 paginado (itens array)", async () => {
    const resp = await fetch(`${baseUrl()}/pedidos?pagina=1&tamanho=10`, { headers: adminAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(Array.isArray(body.itens)).toBe(true);
  });

  it("POST /pedidos/checkout {clienteNome} com carrinho não-vazio → 201 {pedidoId}", async () => {
    const resp = await fetch(`${baseUrl()}/pedidos/checkout`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ clienteNome: "Teste" }),
    });
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(typeof body.pedidoId).toBe("string");
    expect(body.pedidoId.length).toBeGreaterThan(0);
    pedidoId = body.pedidoId;
  });

  it("GET /pedidos/{id} → 200 com shape (id, clienteNome, itens, total, statusAtual, timeline)", async () => {
    expect(pedidoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pedidos/${pedidoId}`, { headers: adminAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.id).toBe(pedidoId);
    expect(typeof body.clienteNome).toBe("string");
    expect(Array.isArray(body.itens)).toBe(true);
    expect(typeof body.total).toBe("number");
    // Estado inicial do pedido recém-criado.
    expect(body.statusAtual).toBe("criado");
    expect(Array.isArray(body.timeline)).toBe(true);
  });

  it("POST /pedidos/{id}/etapas/avancar com token CLIENTE → 403 (ação é de gestão)", async () => {
    // MÁQUINA DE ESTADO / RBAC: avançar etapa exige papel de gestão. Com o
    // token do cliente a API nega (403). Asserimos o status REAL observado.
    expect(pedidoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pedidos/${pedidoId}/etapas/avancar`, {
      method: "POST",
      headers: cliJson(),
      body: JSON.stringify({ proximaEtapa: 1, observacao: null, entregaTipo: 0 }),
    });
    expect(resp.status).toBe(403);
  });

  it("POST /pedidos/{id}/etapas/avancar criado→aprovado com token ADMIN → 200/204", async () => {
    // Transição alcançável: de `criado` (0) para `aprovado` (1) com permissão
    // de gestão. Entra na máquina de estado com proximaEtapa=1, entregaTipo=0.
    expect(pedidoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pedidos/${pedidoId}/etapas/avancar`, {
      method: "POST",
      headers: adminJson(),
      body: JSON.stringify({ proximaEtapa: 1, observacao: null, entregaTipo: 0 }),
    });
    expect([200, 204]).toContain(resp.status);
  });

  it("GET /pedidos/{id} após avançar → 200 e statusAtual = aprovado", async () => {
    expect(pedidoId).toBeDefined();
    const resp = await fetch(`${baseUrl()}/pedidos/${pedidoId}`, { headers: adminAuth() });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    // Confirma que a transição de estado tomou efeito.
    expect(body.statusAtual).toBe("aprovado");
  });
});
