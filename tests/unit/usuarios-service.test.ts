import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { usuariosService } from "@/lib/api/usuarios";
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

// --- create ----------------------------------------------------------------

describe("usuariosService.create", () => {
  it("faz POST /usuarios com roleIds como array de NUMBER e retorna {id} string", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { id: "11111111-2222-3333-4444-555555555555" }),
    );

    const result = await usuariosService.create({
      nome: "N",
      email: "e@e",
      senha: "p",
      telefone: null,
      roleIds: [1, 2],
    });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/usuarios`);
    expect(initOf(call).method).toBe("POST");

    const body = bodyOf(call) as {
      nome: string;
      email: string;
      senha: string;
      telefone: string | null;
      roleIds: number[];
    };
    expect(body).toEqual({
      nome: "N",
      email: "e@e",
      senha: "p",
      telefone: null,
      roleIds: [1, 2],
    });
    // roleIds são NUMBER, não string.
    expect(body.roleIds.every((v) => typeof v === "number")).toBe(true);

    // id retornado é string (uuid).
    expect(typeof result.id).toBe("string");
    expect(result.id).toBe("11111111-2222-3333-4444-555555555555");
  });
});

// --- setRoles --------------------------------------------------------------

describe("usuariosService.setRoles", () => {
  it("faz PUT /usuarios/uid/roles com {usuarioId:'uid',roleIds:[3]} (array de number)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await usuariosService.setRoles("uid", [3]);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/usuarios/uid/roles`);
    expect(initOf(call).method).toBe("PUT");

    const body = bodyOf(call) as { usuarioId: string; roleIds: number[] };
    expect(body).toEqual({ usuarioId: "uid", roleIds: [3] });
    expect(body.roleIds.every((v) => typeof v === "number")).toBe(true);
  });
});

// --- setAtivo --------------------------------------------------------------

describe("usuariosService.setAtivo", () => {
  it("faz PATCH /usuarios/uid/ativo com {usuarioId:'uid',ativo:false}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await usuariosService.setAtivo("uid", false);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/usuarios/uid/ativo`);
    // Ponto crítico: PATCH (não PUT).
    expect(initOf(call).method).toBe("PATCH");
    expect(bodyOf(call)).toEqual({ usuarioId: "uid", ativo: false });
  });
});

// --- list ------------------------------------------------------------------

describe("usuariosService.list", () => {
  it("mapeia Usuario (roles array de string quando presente; ativo bool)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, [
        { id: "a", nome: "A", email: "a@a", roles: ["Admin"], ativo: true },
        { id: "b", nome: "B", email: "b@b" },
      ]),
    );

    const result = await usuariosService.list();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "a",
      nome: "A",
      email: "a@a",
      roles: ["Admin"],
      ativo: true,
    });
    // Sem roles/ativo → undefined (não quebra).
    expect(result[1]).toEqual({
      id: "b",
      nome: "B",
      email: "b@b",
      roles: undefined,
      ativo: undefined,
    });
    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/usuarios`);
  });
});
