import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clientesService } from "@/lib/api/clientes";
import { API_BASE_URL } from "@/lib/api/config";
import type { Endereco } from "@/lib/api/enderecos";

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

const endereco: Endereco = {
  cep: "11000-000",
  logradouro: "Rua A",
  numero: "100",
  complemento: "ap 1",
  bairro: "Centro",
  cidade: "Santos",
  uf: "SP",
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

// --- create: toEnderecoInput (uf→estado, cep só dígitos) -------------------

describe("clientesService.create", () => {
  it("POST /clientes convertendo uf→estado e cep para só dígitos", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "c1" }));

    const result = await clientesService.create({
      nome: "João",
      email: "joao@e.com",
      telefone: "11999",
      cidade: "Santos",
      endereco,
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/clientes`);
    expect(methodOf(call)).toBe("POST");

    const body = bodyOf(call);
    expect(body.nome).toBe("João");
    expect(body.email).toBe("joao@e.com");
    expect(body.telefone).toBe("11999");
    // endereco convertido via toEnderecoInput
    expect(body.endereco.estado).toBe("SP");
    expect(body.endereco.cep).toBe("11000000");
    expect("uf" in body.endereco).toBe(false);
    expect(body.endereco.logradouro).toBe("Rua A");
    expect(body.endereco.complemento).toBe("ap 1");

    // retorno mapeado com id da API
    expect(result.id).toBe("c1");
    expect(result.endereco?.uf).toBe("SP");
  });

  it("telefone vazio vira null no body", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "c2" }));

    await clientesService.create({
      nome: "Sem Tel",
      email: "x@e.com",
      telefone: "",
      cidade: "Santos",
      endereco,
    });

    expect(bodyOf(fetchMock.mock.calls[0]).telefone).toBeNull();
  });

  it("sem endereco usa endereco default (logradouro '-', estado 'SP', cep '00000000')", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: "c3" }));

    await clientesService.create({
      nome: "Default",
      email: "d@e.com",
      telefone: "11999",
      cidade: "Campinas",
    });

    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.endereco).toEqual({
      logradouro: "-",
      numero: "-",
      complemento: null,
      bairro: "-",
      cidade: "Campinas",
      estado: "SP",
      cep: "00000000",
    });
  });
});

// --- update: PUT /clientes/{id} SEM endereco -------------------------------

describe("clientesService.update", () => {
  it("PUT /clientes/{id} com body {nome,email,telefone} e SEM endereco", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await clientesService.update("c9", {
      nome: "Editado",
      email: "ed@e.com",
      telefone: "11888",
      endereco,
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/clientes/c9`);
    expect(methodOf(call)).toBe("PUT");

    const body = bodyOf(call);
    expect(body).toEqual({ nome: "Editado", email: "ed@e.com", telefone: "11888" });
    expect("endereco" in body).toBe(false);
  });

  it("telefone vazio vira null no update", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await clientesService.update("c9", { nome: "X", email: "x@e.com", telefone: "" });

    expect(bodyOf(fetchMock.mock.calls[0]).telefone).toBeNull();
  });
});

// --- mapCliente (via list): endereco aninhado estado→uf, cidade ------------

describe("clientesService — mapeamento de cliente", () => {
  it("lê endereco aninhado (estado→uf) e cidade da raiz", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [
          {
            id: "m1",
            nome: "Maria",
            email: "m@e.com",
            telefone: "119",
            cidade: "Santos",
            endereco: {
              id: "e1",
              cep: "11000000",
              logradouro: "Rua A",
              numero: "1",
              bairro: "Centro",
              cidade: "Santos",
              estado: "RJ",
            },
          },
        ],
        totalRegistros: 1,
      }),
    );

    const result = await clientesService.list();

    const c = result.items[0];
    expect(c.cidade).toBe("Santos");
    expect(c.endereco?.uf).toBe("RJ");
    expect(c.endereco?.clienteId).toBe("m1");
  });

  it("deriva cidade do endereco quando ausente na raiz", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        itens: [
          {
            id: "m2",
            nome: "Ana",
            email: "a@e.com",
            endereco: { cidade: "Guarulhos", estado: "SP" },
          },
        ],
        totalRegistros: 1,
      }),
    );

    const result = await clientesService.list();

    expect(result.items[0].cidade).toBe("Guarulhos");
    expect(result.items[0].endereco?.uf).toBe("SP");
  });

  it("endereco null quando ausente", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { itens: [{ id: "m3", nome: "Sem End" }], totalRegistros: 1 }),
    );

    const result = await clientesService.list();

    expect(result.items[0].endereco).toBeNull();
    expect(result.items[0].cidade).toBe("");
  });
});

// --- count -----------------------------------------------------------------

describe("clientesService.count", () => {
  it("GET /clientes?pagina=1&tamanho=1 e retorna totalRegistros", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [], totalRegistros: 123 }));

    const total = await clientesService.count();

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/clientes?pagina=1&tamanho=1`);
    expect(total).toBe(123);
  });

  it("retorna 0 quando totalRegistros ausente", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { itens: [] }));

    expect(await clientesService.count()).toBe(0);
  });
});
