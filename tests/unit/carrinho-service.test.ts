import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cartService, type CartItem } from "@/lib/api/carrinho";
import type { Produto } from "@/lib/api/produtos";
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

const produtoFake: Produto = {
  id: "p1",
  nome: "Pizza",
  descricao: "",
  categoriaId: 1,
  categoriaNome: "",
  preco: 50,
  foto: "",
  disponivel: true,
  tipo: "simples",
  criadoEm: new Date().toISOString(),
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

// --- getRemote: mapItem ----------------------------------------------------

describe("cartService.getRemote", () => {
  it("GET /carrinho e mapeia itens via mapItem (produtoId direto + campos diretos)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [{ produtoId: "p1", nome: "Pizza", preco: 50, foto: "http://img/p1.png", quantidade: 2 }],
      }),
    );

    const itens = await cartService.getRemote();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/carrinho`);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toEqual({
      produtoId: "p1",
      nome: "Pizza",
      preco: 50,
      foto: "http://img/p1.png",
      quantidade: 2,
    });
  });

  it("mapItem usa raw.produto como fallback (produtoId de produto.id, foto de fotoUrl, quantidade default 1)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [
          {
            produto: { id: "p9", nome: "Burger", preco: 30, fotoUrl: "http://img/p9.png" },
          },
        ],
      }),
    );

    const itens = await cartService.getRemote();

    expect(itens[0]).toEqual({
      produtoId: "p9",
      nome: "Burger",
      preco: 30,
      foto: "http://img/p9.png",
      quantidade: 1,
    });
  });

  it("retorna [] quando a resposta não traz itens nem items", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));
    expect(await cartService.getRemote()).toEqual([]);
  });
});

// --- add: POST + rebusca ---------------------------------------------------

describe("cartService.add", () => {
  it("POST /carrinho/itens {produtoId, quantidade} e depois rebusca via getRemote", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(200, {})) // POST
      .mockResolvedValueOnce(
        fakeResponse(200, { itens: [{ produtoId: "p1", nome: "Pizza", preco: 50, quantidade: 3 }] }),
      ); // GET rebusca

    const itens = await cartService.add("u1", produtoFake, 3);

    const post = fetchMock.mock.calls[0];
    expect(urlOf(post)).toBe(`${API_BASE_URL}/carrinho/itens`);
    expect(methodOf(post)).toBe("POST");
    expect(bodyOf(post)).toEqual({ produtoId: "p1", quantidade: 3 });

    const get = fetchMock.mock.calls[1];
    expect(urlOf(get)).toBe(`${API_BASE_URL}/carrinho`);
    expect(itens).toHaveLength(1);
    expect(itens[0].quantidade).toBe(3);
  });
});

// --- setQtyRemote: DELETE para 0, PATCH para >0 ----------------------------

describe("cartService.setQtyRemote", () => {
  it("qtd <= 0 faz DELETE /carrinho/itens/{produtoId} e rebusca", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(200, {})) // DELETE
      .mockResolvedValueOnce(fakeResponse(200, { itens: [] })); // GET rebusca

    const itens = await cartService.setQtyRemote("p1", 0);

    const del = fetchMock.mock.calls[0];
    expect(urlOf(del)).toBe(`${API_BASE_URL}/carrinho/itens/p1`);
    expect(methodOf(del)).toBe("DELETE");
    expect(urlOf(fetchMock.mock.calls[1])).toBe(`${API_BASE_URL}/carrinho`);
    expect(itens).toEqual([]);
  });

  it("qtd > 0 faz PATCH /carrinho/itens/{produtoId} {quantidade} e rebusca", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(200, {})) // PATCH
      .mockResolvedValueOnce(
        fakeResponse(200, { itens: [{ produtoId: "p1", nome: "Pizza", preco: 50, quantidade: 3 }] }),
      ); // GET rebusca

    const itens = await cartService.setQtyRemote("p1", 3);

    const patch = fetchMock.mock.calls[0];
    expect(urlOf(patch)).toBe(`${API_BASE_URL}/carrinho/itens/p1`);
    expect(methodOf(patch)).toBe("PATCH");
    expect(bodyOf(patch)).toEqual({ quantidade: 3 });
    expect(itens[0].quantidade).toBe(3);
  });
});

// --- removeRemote: DELETE + rebusca ----------------------------------------

describe("cartService.removeRemote", () => {
  it("DELETE /carrinho/itens/{produtoId} e rebusca via getRemote", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(200, {})) // DELETE
      .mockResolvedValueOnce(fakeResponse(200, { itens: [] })); // GET rebusca

    const itens = await cartService.removeRemote("p1");

    const del = fetchMock.mock.calls[0];
    expect(urlOf(del)).toBe(`${API_BASE_URL}/carrinho/itens/p1`);
    expect(methodOf(del)).toBe("DELETE");
    expect(urlOf(fetchMock.mock.calls[1])).toBe(`${API_BASE_URL}/carrinho`);
    expect(itens).toEqual([]);
  });
});

// --- clearRemote: DELETE ---------------------------------------------------

describe("cartService.clearRemote", () => {
  it("DELETE /carrinho (sem rebusca)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await cartService.clearRemote();

    expect(fetchMock.mock.calls).toHaveLength(1);
    const del = fetchMock.mock.calls[0];
    expect(urlOf(del)).toBe(`${API_BASE_URL}/carrinho`);
    expect(methodOf(del)).toBe("DELETE");
  });
});

// --- checkout: POST checkout + getById -------------------------------------

describe("cartService.checkout", () => {
  it("POST /pedidos/checkout {clienteNome} e depois getById(pedidoId)", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(201, { pedidoId: "ped1" })) // POST checkout
      .mockResolvedValueOnce(
        fakeResponse(200, { id: "ped1", clienteNome: "Nome", total: 100, timeline: [] }),
      ); // GET /pedidos/ped1

    const pedido = await cartService.checkout("u1", "Nome");

    const post = fetchMock.mock.calls[0];
    expect(urlOf(post)).toBe(`${API_BASE_URL}/pedidos/checkout`);
    expect(methodOf(post)).toBe("POST");
    expect(bodyOf(post)).toEqual({ clienteNome: "Nome" });

    const get = fetchMock.mock.calls[1];
    expect(urlOf(get)).toBe(`${API_BASE_URL}/pedidos/ped1`);

    expect(pedido.id).toBe("ped1");
    expect(pedido.clienteNome).toBe("Nome");
    expect(pedido.total).toBe(100);
  });

  it("lança quando getById não encontra o pedido criado", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(201, { pedidoId: "ped1" })) // POST checkout
      .mockResolvedValueOnce(fakeResponse(404, { message: "não encontrado" })); // getById -> null

    await expect(cartService.checkout("u1", "Nome")).rejects.toThrow(
      /não foi possível carregá-lo/,
    );
  });
});

// --- total: puro, sem fetch ------------------------------------------------

describe("cartService.total", () => {
  it("soma preco * quantidade de todos os itens", () => {
    const itens: CartItem[] = [
      { produtoId: "a", nome: "A", preco: 10, foto: "", quantidade: 2 },
      { produtoId: "b", nome: "B", preco: 5.5, foto: "", quantidade: 4 },
    ];
    expect(cartService.total(itens)).toBe(42);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna 0 para carrinho vazio", () => {
    expect(cartService.total([])).toBe(0);
  });
});
