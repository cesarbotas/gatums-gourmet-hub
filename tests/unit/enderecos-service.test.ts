import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { consultarCep, enderecosService, type Endereco } from "@/lib/api/enderecos";
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

function methodOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit | undefined;
  return init?.method;
}

function bodyOf(call: unknown[]): any {
  const init = call[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

const endereco: Endereco = {
  cep: "11000-000",
  logradouro: "Rua A",
  numero: "100",
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

// --- consultarCep: validação, erro e mapeamento ----------------------------

describe("consultarCep", () => {
  it("CEP com != 8 dígitos lança 'CEP inválido' (sem fetch)", async () => {
    await expect(consultarCep("123")).rejects.toThrow("CEP inválido");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta { erro: true } lança 'CEP não encontrado'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { erro: true }));

    await expect(consultarCep("00000000")).rejects.toThrow("CEP não encontrado");
  });

  it("resposta !ok lança 'Não foi possível consultar o CEP'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(500, {}));

    await expect(consultarCep("11000000")).rejects.toThrow(
      "Não foi possível consultar o CEP",
    );
  });

  it("resposta ok mapeia localidade→cidade, uf, logradouro etc.", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        cep: "11000-000",
        logradouro: "Praça da Sé",
        complemento: "lado ímpar",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      }),
    );

    const result = await consultarCep("11.000-000");

    // só os 8 dígitos vão para a URL do viacep
    expect(urlOf(fetchMock.mock.calls[0])).toBe("https://viacep.com.br/ws/11000000/json/");
    expect(result).toEqual({
      cep: "11000-000",
      logradouro: "Praça da Sé",
      complemento: "lado ímpar",
      bairro: "Sé",
      cidade: "São Paulo",
      uf: "SP",
    });
  });
});

// --- listByCliente: caminho API --------------------------------------------

describe("enderecosService.listByCliente", () => {
  it("GET /clientes/{id}/enderecos com sucesso retorna a lista (sem fallback)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [endereco]));

    const result = await enderecosService.listByCliente("c1");

    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/clientes/c1/enderecos`);
    expect(result).toEqual([endereco]);
  });
});

// --- save: POST (sem id) / PUT (com id) ------------------------------------

describe("enderecosService.save", () => {
  it("sem id → POST /clientes/{id}/enderecos", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { ...endereco, id: "novo" }));

    const result = await enderecosService.save("c1", endereco);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/clientes/c1/enderecos`);
    expect(methodOf(call)).toBe("POST");
    expect(bodyOf(call).logradouro).toBe("Rua A");
    expect(result.id).toBe("novo");
  });

  it("com id → PUT /clientes/{id}/enderecos/{enderecoId}", async () => {
    const comId: Endereco = { ...endereco, id: "e9" };
    fetchMock.mockResolvedValueOnce(fakeResponse(200, comId));

    await enderecosService.save("c1", comId);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/clientes/c1/enderecos/e9`);
    expect(methodOf(call)).toBe("PUT");
  });
});

// --- remove: DELETE --------------------------------------------------------

describe("enderecosService.remove", () => {
  it("DELETE /clientes/{id}/enderecos/{enderecoId}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await enderecosService.remove("c1", "e9");

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/clientes/c1/enderecos/e9`);
    expect(methodOf(call)).toBe("DELETE");
  });
});

// --- getPrincipal: principal:true → primeiro → null ------------------------

describe("enderecosService.getPrincipal", () => {
  it("retorna o endereço com principal:true", async () => {
    const a: Endereco = { ...endereco, id: "a", principal: false };
    const b: Endereco = { ...endereco, id: "b", principal: true };
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [a, b]));

    const result = await enderecosService.getPrincipal("c1");

    expect(result?.id).toBe("b");
  });

  it("sem principal retorna o primeiro da lista", async () => {
    const a: Endereco = { ...endereco, id: "a" };
    const b: Endereco = { ...endereco, id: "b" };
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [a, b]));

    const result = await enderecosService.getPrincipal("c1");

    expect(result?.id).toBe("a");
  });

  it("lista vazia retorna null", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, []));

    const result = await enderecosService.getPrincipal("c1");

    expect(result).toBeNull();
  });
});

// --- fallback localStorage quando o fetch REJEITA --------------------------

describe("enderecosService.save — fallback localStorage", () => {
  it("fetch rejeita → persiste local e devolve endereço com id gerado", async () => {
    // apiRequest usa fetch; rejeição força o catch do service.
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const result = await enderecosService.save("c1", endereco);

    expect(result.id).toBeTruthy();
    expect(result.clienteId).toBe("c1");

    const raw = window.localStorage.getItem("gg.enderecos.c1");
    expect(raw).toBeTruthy();
    const list = JSON.parse(raw!) as Endereco[];
    expect(list).toHaveLength(1);
    expect(list[0].logradouro).toBe("Rua A");
  });
});
