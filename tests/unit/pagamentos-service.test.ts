import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizeMetodo,
  normalizeStatus,
  pagamentosService,
  OPCOES_PAGAMENTO,
} from "@/lib/api/pagamentos";
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

// --- normalizeMetodo: inteiros + strings + fallback ------------------------

describe("normalizeMetodo", () => {
  it("inteiro 0 → cartao_debito", () => {
    expect(normalizeMetodo(0)).toBe("cartao_debito");
  });

  it("inteiro 1 → cartao_credito", () => {
    expect(normalizeMetodo(1)).toBe("cartao_credito");
  });

  it("inteiro 2 → pix", () => {
    expect(normalizeMetodo(2)).toBe("pix");
  });

  it("inteiro desconhecido → pix (fallback)", () => {
    expect(normalizeMetodo(99)).toBe("pix");
  });

  it('string "cartaocredito" (sem separador) → cartao_credito', () => {
    expect(normalizeMetodo("cartaocredito")).toBe("cartao_credito");
  });

  it('string "cartao_credito" (com underscore) → cartao_credito', () => {
    expect(normalizeMetodo("cartao_credito")).toBe("cartao_credito");
  });

  it('string "cartao_debito" (com underscore) → cartao_debito', () => {
    expect(normalizeMetodo("cartao_debito")).toBe("cartao_debito");
  });

  it('string "cartaodebito" (sem separador) → cartao_debito', () => {
    expect(normalizeMetodo("cartaodebito")).toBe("cartao_debito");
  });

  it("string desconhecida → pix (fallback)", () => {
    expect(normalizeMetodo("boleto")).toBe("pix");
  });

  it("null/undefined → pix (fallback)", () => {
    expect(normalizeMetodo(null)).toBe("pix");
    expect(normalizeMetodo(undefined)).toBe("pix");
  });

  it('string "pix" explícita → pix', () => {
    // "pix" não bate débito/crédito → cai no fallback que também é pix
    expect(normalizeMetodo("pix")).toBe("pix");
  });
});

// --- normalizeStatus: inteiros 0..6 + strings + fallback -------------------

describe("normalizeStatus", () => {
  it("inteiros 0..6 mapeiam para criada..cancelada", () => {
    expect(normalizeStatus(0)).toBe("criada");
    expect(normalizeStatus(1)).toBe("aguardando_pagamento");
    expect(normalizeStatus(2)).toBe("processando");
    expect(normalizeStatus(3)).toBe("aprovada");
    expect(normalizeStatus(4)).toBe("recusada");
    expect(normalizeStatus(5)).toBe("expirada");
    expect(normalizeStatus(6)).toBe("cancelada");
  });

  it("inteiro desconhecido → criada (fallback)", () => {
    expect(normalizeStatus(99)).toBe("criada");
  });

  it('string "aguardandopagamento" → aguardando_pagamento', () => {
    expect(normalizeStatus("aguardandopagamento")).toBe("aguardando_pagamento");
  });

  it('string "pendente" → aguardando_pagamento', () => {
    expect(normalizeStatus("pendente")).toBe("aguardando_pagamento");
  });

  it('string "aprovado" (sem sufixo "a") → aprovada', () => {
    expect(normalizeStatus("aprovado")).toBe("aprovada");
  });

  it('string "aprovada" → aprovada', () => {
    expect(normalizeStatus("aprovada")).toBe("aprovada");
  });

  it('string "recusado" → recusada', () => {
    expect(normalizeStatus("recusado")).toBe("recusada");
  });

  it('string "expirado" → expirada', () => {
    expect(normalizeStatus("expirado")).toBe("expirada");
  });

  it("string desconhecida → criada (fallback)", () => {
    expect(normalizeStatus("rascunho")).toBe("criada");
  });

  it("null/undefined → criada (fallback)", () => {
    expect(normalizeStatus(null)).toBe("criada");
    expect(normalizeStatus(undefined)).toBe("criada");
  });
});

// --- listarOpcoesRemoto: método REST sem tocar no mock interno -------------

describe("pagamentosService.listarOpcoesRemoto", () => {
  it("GET /pagamentos/opcoes e normaliza id via normalizeMetodo", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        items: [
          { id: 1, label: "Crédito", descricao: "parcela" },
          { metodo: "cartaodebito", nome: "Débito" },
        ],
      }),
    );

    const result = await pagamentosService.listarOpcoesRemoto();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/pagamentos/opcoes`);
    expect(result).toEqual([
      { id: "cartao_credito", label: "Crédito", descricao: "parcela" },
      { id: "cartao_debito", label: "Débito", descricao: "" },
    ]);
  });

  it("lista remota vazia → devolve OPCOES_PAGAMENTO default", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { items: [] }));

    const result = await pagamentosService.listarOpcoesRemoto();

    expect(result).toEqual(OPCOES_PAGAMENTO);
  });

  it("erro na requisição → cai no catch e devolve OPCOES_PAGAMENTO", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(500, {}));

    const result = await pagamentosService.listarOpcoesRemoto();

    expect(result).toEqual(OPCOES_PAGAMENTO);
  });
});
