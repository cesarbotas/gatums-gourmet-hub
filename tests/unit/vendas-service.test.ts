import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { vendasService, type Venda } from "@/lib/api/vendas";
import { API_BASE_URL } from "@/lib/api/config";

// --- Helpers ---------------------------------------------------------------

function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

const venda: Venda = {
  id: "v1",
  produtoId: "p1",
  produtoNome: "Bolo",
  quantidade: 2,
  total: 50,
  data: "2026-01-01",
};

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

// --- list(): os 3 ramos do ?? ----------------------------------------------

describe("vendasService.list", () => {
  it("resposta { vendas: [...] } → retorna vendas", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { vendas: [venda] }));

    const result = await vendasService.list();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/relatorios/vendas/resumo`);
    expect(result).toEqual([venda]);
  });

  it("resposta { items: [...] } (sem vendas) → retorna items", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { items: [venda] }));

    const result = await vendasService.list();

    expect(result).toEqual([venda]);
  });

  it("resposta {} (sem vendas nem items) → retorna []", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    const result = await vendasService.list();

    expect(result).toEqual([]);
  });
});

// --- resumo(): objeto cru --------------------------------------------------

describe("vendasService.resumo", () => {
  it("GET /relatorios/vendas/resumo retorna o objeto cru", async () => {
    const cru = { totalVendas: 10, faturamento: 1234.5, vendas: [venda] };
    fetchMock.mockResolvedValueOnce(fakeResponse(200, cru));

    const result = await vendasService.resumo();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/relatorios/vendas/resumo`);
    expect(result).toEqual(cru);
  });
});
