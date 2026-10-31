import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { permissionsService } from "@/lib/api/permissions";
import { API_BASE_URL } from "@/lib/api/config";

// --- Helpers ---------------------------------------------------------------

/** Response fake compatível com apiRequest (`res.ok`, `res.status`, `res.json()`). */
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** URL (1º arg) da chamada registrada no mock de fetch. */
function urlOf(call: unknown[]): string {
  return String(call[0]);
}

/** RequestInit (2º arg) da chamada registrada no mock de fetch. */
function initOf(call: unknown[]): RequestInit {
  return (call[1] ?? {}) as RequestInit;
}

/** Body parseado da chamada registrada. */
function bodyOf(call: unknown[]): unknown {
  const body = initOf(call).body;
  return typeof body === "string" ? JSON.parse(body) : body;
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

// --- list ------------------------------------------------------------------

describe("permissionsService.list", () => {
  it("mapeia Permission (codigo/recurso/acao default '' quando ausente)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, [
        { id: 1, codigo: "c1", descricao: "d1", recurso: "r1", acao: "a1" },
        { id: 2 },
      ]),
    );

    const result = await permissionsService.list();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      codigo: "c1",
      descricao: "d1",
      recurso: "r1",
      acao: "a1",
    });
    // Campos ausentes recebem default: codigo/recurso/acao = "", descricao = null.
    expect(result[1]).toEqual({
      id: 2,
      codigo: "",
      descricao: null,
      recurso: "",
      acao: "",
    });
    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/permissions`);
  });
});

// --- create ----------------------------------------------------------------

describe("permissionsService.create", () => {
  it("faz POST /permissions com body completo e retorna {id}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: 42 }));

    const result = await permissionsService.create({
      codigo: "c",
      descricao: null,
      recurso: "r",
      acao: "a",
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/permissions`);
    expect(initOf(call).method).toBe("POST");
    expect(bodyOf(call)).toEqual({
      codigo: "c",
      descricao: null,
      recurso: "r",
      acao: "a",
    });
    expect(result).toEqual({ id: 42 });
  });
});

// --- update ----------------------------------------------------------------

describe("permissionsService.update", () => {
  it("faz PUT /permissions/3 com body {id:3,descricao,recurso,acao}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await permissionsService.update(3, { descricao: "d", recurso: "r", acao: "a" });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/permissions/3`);
    expect(initOf(call).method).toBe("PUT");
    expect(bodyOf(call)).toEqual({ id: 3, descricao: "d", recurso: "r", acao: "a" });
  });
});
