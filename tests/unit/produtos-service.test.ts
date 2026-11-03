import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { produtosService } from "@/lib/api/produtos";
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
function bodyOf(call: unknown[]): any {
  const init = call[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

/** Método HTTP de uma chamada registrada no mock. */
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

// --- list: querystring + mapeamento paginado -------------------------------

describe("produtosService.list", () => {
  it("monta a querystring pagina/tamanho + filtros e mapeia a resposta paginada", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [
          {
            id: "p1",
            nome: "Pizza",
            descricao: "Grande",
            categoriaId: 3,
            categoriaNome: "Pizzas",
            preco: 50,
            fotoUrl: "http://img/p1.png",
            disponivel: true,
            tipo: 0,
          },
        ],
        totalRegistros: 1,
        paginaAtual: 1,
        tamanhoPagina: 10,
      }),
    );

    const result = await produtosService.list({
      page: 1,
      pageSize: 10,
      search: "x",
      categoriaId: 3,
      tipo: "simples",
      disponivel: true,
    });

    const url = urlOf(fetchMock.mock.calls[0]);
    expect(url.startsWith(`${API_BASE_URL}/produtos?`)).toBe(true);
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("pagina")).toBe("1");
    expect(qs.get("tamanho")).toBe("10");
    expect(qs.get("search")).toBe("x");
    expect(qs.get("categoriaId")).toBe("3");
    expect(qs.get("tipo")).toBe("simples");
    expect(qs.get("disponivel")).toBe("true");

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "p1",
      nome: "Pizza",
      foto: "http://img/p1.png",
      tipo: "simples",
    });
  });

  it("omite filtros ausentes mantendo apenas pagina/tamanho", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [], totalRegistros: 0 }));

    await produtosService.list();

    const qs = new URLSearchParams(urlOf(fetchMock.mock.calls[0]).split("?")[1]);
    expect(qs.get("pagina")).toBe("1");
    expect(qs.get("tamanho")).toBe("10");
    expect(qs.has("search")).toBe(false);
    expect(qs.has("categoriaId")).toBe(false);
    expect(qs.has("tipo")).toBe(false);
    expect(qs.has("disponivel")).toBe(false);
  });

  it("não envia tipo quando o filtro é 'todos'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [], totalRegistros: 0 }));

    await produtosService.list({ tipo: "todos" });

    const qs = new URLSearchParams(urlOf(fetchMock.mock.calls[0]).split("?")[1]);
    expect(qs.has("tipo")).toBe(false);
  });
});

// --- mapProduto (via list): fotoUrl→foto, tipo inteiro→string, defaults ----

describe("produtosService — mapeamento de produto", () => {
  it("tipo:1 vira 'combo'", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { itens: [{ id: "c1", tipo: 1, fotoUrl: "u" }], totalRegistros: 1 }),
    );

    const result = await produtosService.list();

    expect(result.items[0].tipo).toBe("combo");
    expect(result.items[0].foto).toBe("u");
  });

  it("aplica defaults quando campos estão ausentes (nome/descricao '', disponivel true, tipo simples)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { itens: [{ id: "x" }], totalRegistros: 1 }),
    );

    const result = await produtosService.list();

    expect(result.items[0]).toMatchObject({
      id: "x",
      nome: "",
      descricao: "",
      categoriaId: 0,
      categoriaNome: "",
      preco: 0,
      foto: "",
      disponivel: true,
      tipo: "simples",
    });
    expect(typeof result.items[0].criadoEm).toBe("string");
  });
});

// --- create: POST com tipo INTEIRO e fotoUrl -------------------------------

describe("produtosService.create", () => {
  it("POST /produtos com fotoUrl (não 'foto') e tipo inteiro (combo→1)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "novo", tipo: 1, fotoUrl: "u" }));

    await produtosService.create({
      nome: "Combo X",
      descricao: "desc",
      categoriaId: 2,
      categoriaNome: "Combos",
      preco: 99,
      foto: "http://img/combo.png",
      disponivel: true,
      tipo: "combo",
      itens: [{ produtoId: "a", quantidade: 2 }],
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/produtos`);
    expect(methodOf(call)).toBe("POST");

    const body = bodyOf(call);
    expect(body.fotoUrl).toBe("http://img/combo.png");
    expect("foto" in body).toBe(false);
    expect(body.tipo).toBe(1);
    expect(typeof body.tipo).toBe("number");
    expect(body.itens).toEqual([{ produtoId: "a", quantidade: 2 }]);
    expect(body.nome).toBe("Combo X");
    expect(body.categoriaId).toBe(2);
    expect(body.preco).toBe(99);
  });

  it("tipo 'simples' vira 0 no body", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "n", tipo: 0 }));

    await produtosService.create({
      nome: "Simples",
      descricao: "",
      categoriaId: 1,
      categoriaNome: "",
      preco: 10,
      foto: "",
      disponivel: true,
      tipo: "simples",
    });

    expect(bodyOf(fetchMock.mock.calls[0]).tipo).toBe(0);
  });
});

// --- update: PUT /produtos/{id} com {id,...} e fotoUrl ---------------------

describe("produtosService.update", () => {
  it("PUT /produtos/{id} com body contendo id e fotoUrl", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "p9", fotoUrl: "nova" }));

    await produtosService.update("p9", {
      nome: "Editado",
      descricao: "d",
      categoriaId: 5,
      preco: 30,
      foto: "http://img/nova.png",
      disponivel: false,
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/produtos/p9`);
    expect(methodOf(call)).toBe("PUT");

    const body = bodyOf(call);
    expect(body.id).toBe("p9");
    expect(body.fotoUrl).toBe("http://img/nova.png");
    expect("foto" in body).toBe(false);
    expect(body.disponivel).toBe(false);
  });
});

// --- getById ---------------------------------------------------------------

describe("produtosService.getById", () => {
  it("mapeia o produto retornado", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { id: "g1", nome: "G", tipo: 1, fotoUrl: "f" }),
    );

    const produto = await produtosService.getById("g1");

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/produtos/g1`);
    expect(produto).toMatchObject({ id: "g1", nome: "G", tipo: "combo", foto: "f" });
  });

  it("retorna null quando a requisição falha", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(404, { message: "não encontrado" }));

    const produto = await produtosService.getById("naoexiste");

    expect(produto).toBeNull();
  });
});
