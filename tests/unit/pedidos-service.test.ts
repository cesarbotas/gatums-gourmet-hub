import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pedidosService } from "@/lib/api/pedidos";
import type { TransacaoPagamento } from "@/lib/api/pagamentos";
import { API_BASE_URL } from "@/lib/api/config";

// --- Helpers ---------------------------------------------------------------

/** Response fake compatível com o uso de apiRequest (`res.ok`, `res.status`,
 *  `await res.json()`). */
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** URL (1º argumento) de uma chamada registrada no mock de fetch. */
function urlOf(call: unknown[]): string {
  return String(call[0]);
}

/** Corpo JSON (body de RequestInit) de uma chamada registrada no mock. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bodyOf(call: unknown[]): any {
  const init = call[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

/** Método HTTP de uma chamada registrada no mock. */
function methodOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit | undefined;
  return init?.method;
}

/** Transação mínima para concluirPagamentoCliente (só id/status importam). */
function transacao(status: string, id = "tx1"): TransacaoPagamento {
  return { id, status } as unknown as TransacaoPagamento;
}

// --- Setup -----------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- normalizeEtapa (indireto via mapPedido/getById) -----------------------

describe("pedidosService — normalizeEtapa via mapPedido", () => {
  it('timeline "pagamentoaprovado" é normalizada para "pagamento_aprovado"', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p1",
        timeline: [{ etapa: "pagamentoaprovado", em: "2026-01-01T00:00:00Z", por: "admin" }],
      }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.timeline).toHaveLength(1);
    expect(pedido!.timeline[0].etapa).toBe("pagamento_aprovado");
  });

  it("statusAtual com timeline vazia gera 1 evento com a etapa atual", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { id: "p1", statusAtual: "criado", timeline: [] }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.timeline).toHaveLength(1);
    expect(pedido!.timeline[0].etapa).toBe("criado");
    expect(pedido!.timeline[0].por).toBe("cliente");
  });

  it("statusAtual divergente do último evento anexa um evento extra com a etapa atual", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p1",
        statusAtual: "aprovado",
        timeline: [{ etapa: "criado", em: "2026-01-01T00:00:00Z", por: "cliente" }],
      }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.timeline).toHaveLength(2);
    expect(pedido!.timeline[0].etapa).toBe("criado");
    expect(pedido!.timeline[1].etapa).toBe("aprovado");
    expect(pedido!.timeline[1].por).toBe("admin");
  });

  it("não anexa evento extra quando statusAtual coincide com o último evento", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p1",
        statusAtual: "criado",
        timeline: [{ etapa: "criado", em: "2026-01-01T00:00:00Z", por: "cliente" }],
      }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.timeline).toHaveLength(1);
    expect(pedido!.timeline[0].etapa).toBe("criado");
  });

  it("etapa desconhecida cai no fallback 'criado'", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p1",
        timeline: [{ etapa: "qualquer_coisa_invalida", em: "2026-01-01T00:00:00Z", por: "admin" }],
      }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.timeline[0].etapa).toBe("criado");
  });
});

// --- listAll / listByUser --------------------------------------------------

describe("pedidosService.listAll / listByUser", () => {
  it("listAll faz GET /pedidos?pagina=1&tamanho=100 e mapeia res.itens", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [
          { id: "a", total: 10, timeline: [] },
          { id: "b", total: 20, timeline: [] },
        ],
      }),
    );

    const pedidos = await pedidosService.listAll();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/pedidos?pagina=1&tamanho=100`);
    expect(pedidos).toHaveLength(2);
    expect(pedidos.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("listByUser também faz GET /pedidos?pagina=1&tamanho=100 e mapeia res.itens", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [{ id: "z", timeline: [] }] }));

    const pedidos = await pedidosService.listByUser("u1");

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/pedidos?pagina=1&tamanho=100`);
    expect(pedidos[0].id).toBe("z");
  });
});

// --- getById ---------------------------------------------------------------

describe("pedidosService.getById", () => {
  it("GET /pedidos/{id} e mapeia o pedido", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { id: "p7", total: 99, timeline: [] }),
    );

    const pedido = await pedidosService.getById("p7");

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/pedidos/p7`);
    expect(pedido!.id).toBe("p7");
    expect(pedido!.total).toBe(99);
  });

  it("retorna null quando a requisição falha (404)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(404, { message: "não encontrado" }));

    const pedido = await pedidosService.getById("naoexiste");

    expect(pedido).toBeNull();
  });
});

// --- mapPedido: defaults ---------------------------------------------------

describe("pedidosService — mapPedido defaults", () => {
  it("userId de clienteId, clienteNome de cliente.nome, itens [], total 0", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p1",
        clienteId: "cli9",
        cliente: { nome: "Fulano" },
        statusAtual: "criado",
        timeline: [],
      }),
    );

    const pedido = await pedidosService.getById("p1");

    expect(pedido!.userId).toBe("cli9");
    expect(pedido!.clienteNome).toBe("Fulano");
    expect(pedido!.itens).toEqual([]);
    expect(pedido!.total).toBe(0);
    expect(typeof pedido!.data).toBe("string");
  });

  it("userId direto tem precedência sobre clienteId; clienteNome direto sobre cliente.nome", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: "p2",
        userId: "u1",
        clienteId: "cli9",
        clienteNome: "Direto",
        cliente: { nome: "Fallback" },
        timeline: [],
        statusAtual: "criado",
      }),
    );

    const pedido = await pedidosService.getById("p2");

    expect(pedido!.userId).toBe("u1");
    expect(pedido!.clienteNome).toBe("Direto");
  });
});

// --- concluirPagamentoCliente ----------------------------------------------

describe("pedidosService.concluirPagamentoCliente", () => {
  it("lança quando transacao.status !== 'aprovada' (sem fetch)", () => {
    expect(() =>
      pedidosService.concluirPagamentoCliente("p1", transacao("recusada")),
    ).toThrow(/não foi aprovado/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("status 'aprovada' faz POST /pedidos/{id}/pagamento/concluir {transacaoId} e mapeia", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { id: "p1", total: 50, timeline: [] }),
    );

    const pedido = await pedidosService.concluirPagamentoCliente("p1", transacao("aprovada", "tx9"));

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/pedidos/p1/pagamento/concluir`);
    expect(methodOf(call)).toBe("POST");
    expect(bodyOf(call)).toEqual({ transacaoId: "tx9" });
    expect(pedido.id).toBe("p1");
    expect(pedido.total).toBe(50);
  });
});

// --- avancar: caso mínimo (getById null) -----------------------------------

describe("pedidosService.avancar", () => {
  it("lança 'Pedido não encontrado' quando getById retorna null", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(404, { message: "não encontrado" }));

    await expect(pedidosService.avancar("p1", "admin")).rejects.toThrow(/não encontrado/);
  });
});
