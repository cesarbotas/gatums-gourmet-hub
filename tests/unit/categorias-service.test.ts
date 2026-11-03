import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { categoriasService } from "@/lib/api/categorias";
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

function bodyOf(call: unknown[]): any {
  const init = call[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

function methodOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit | undefined;
  return init?.method;
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

// --- list: querystring + paginação -----------------------------------------

describe("categoriasService.list", () => {
  it("monta pagina/tamanho + apenasAtivas + search e mapeia a resposta paginada", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [{ id: 1, nome: "Bebidas", descricao: "d", ativo: true }],
        totalRegistros: 1,
        paginaAtual: 1,
        tamanhoPagina: 10,
      }),
    );

    const result = await categoriasService.list({ apenasAtivas: true, search: "x" });

    const url = urlOf(fetchMock.mock.calls[0]);
    expect(url.startsWith(`${API_BASE_URL}/categorias?`)).toBe(true);
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("pagina")).toBe("1");
    expect(qs.get("tamanho")).toBe("10");
    expect(qs.get("apenasAtivas")).toBe("true");
    expect(qs.get("search")).toBe("x");

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 1, nome: "Bebidas", ativo: true });
  });

  it("envia apenasAtivas=false quando explicitamente false", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [], totalRegistros: 0 }));

    await categoriasService.list({ apenasAtivas: false });

    const qs = new URLSearchParams(urlOf(fetchMock.mock.calls[0]).split("?")[1]);
    expect(qs.get("apenasAtivas")).toBe("false");
    expect(qs.has("search")).toBe(false);
  });
});

// --- mapCategoria (via list): defaults -------------------------------------

describe("categoriasService — mapeamento de categoria", () => {
  it("aplica defaults (nome '', descricao null, ativo true) quando ausentes", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { itens: [{ id: 7 }], totalRegistros: 1 }),
    );

    const result = await categoriasService.list();

    expect(result.items[0]).toEqual({
      id: 7,
      nome: "",
      descricao: null,
      ativo: true,
    });
  });
});

// --- create: POST /categorias ----------------------------------------------

describe("categoriasService.create", () => {
  it("POST /categorias com body {nome,descricao,ativo} e retorna {id}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: 42 }));

    const result = await categoriasService.create({
      nome: "Sobremesas",
      descricao: "doces",
      ativo: true,
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/categorias`);
    expect(methodOf(call)).toBe("POST");

    const body = bodyOf(call);
    expect(body).toEqual({ nome: "Sobremesas", descricao: "doces", ativo: true });

    expect(result).toEqual({ id: 42 });
  });
});

// --- update: PUT /categorias/{id} ------------------------------------------

describe("categoriasService.update", () => {
  it("PUT /categorias/{id} com body contendo id", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await categoriasService.update(5, { nome: "Nova", descricao: null, ativo: false });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/categorias/5`);
    expect(methodOf(call)).toBe("PUT");

    const body = bodyOf(call);
    expect(body).toEqual({ id: 5, nome: "Nova", descricao: null, ativo: false });
  });
});

// --- remove: DELETE /categorias/{id} ---------------------------------------

describe("categoriasService.remove", () => {
  it("DELETE /categorias/{id}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await categoriasService.remove(9);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/categorias/9`);
    expect(methodOf(call)).toBe("DELETE");
  });
});
