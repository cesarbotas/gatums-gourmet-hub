import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rolesService } from "@/lib/api/roles";
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

describe("rolesService.list", () => {
  it("mapeia o array de Role (descricao default null quando ausente)", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, [
        { id: 1, nome: "Admin", descricao: null },
        { id: 2, nome: "Cliente" },
      ]),
    );

    const result = await rolesService.list();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, nome: "Admin", descricao: null });
    expect(result[1]).toEqual({ id: 2, nome: "Cliente", descricao: null });
    expect(urlOf(fetchMock.mock.calls[0])).toBe(`${API_BASE_URL}/roles`);
  });
});

// --- create ----------------------------------------------------------------

describe("rolesService.create", () => {
  it("faz POST /roles com body {nome,descricao} e retorna {id}", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: 10 }));

    const result = await rolesService.create({ nome: "X", descricao: "d" });

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/roles`);
    expect(initOf(call).method).toBe("POST");
    expect(bodyOf(call)).toEqual({ nome: "X", descricao: "d" });
    expect(result).toEqual({ id: 10 });
  });
});

// --- setPermissions --------------------------------------------------------

describe("rolesService.setPermissions", () => {
  it("faz PUT /roles/5/permissions com {roleId:5,permissionIds:[1,2,3]} (array de number)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await rolesService.setPermissions(5, [1, 2, 3]);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/roles/5/permissions`);
    expect(initOf(call).method).toBe("PUT");

    const body = bodyOf(call) as { roleId: number; permissionIds: number[] };
    expect(body).toEqual({ roleId: 5, permissionIds: [1, 2, 3] });
    // permissionIds são NUMBER, não string.
    expect(body.permissionIds.every((v) => typeof v === "number")).toBe(true);
  });
});

// --- remove ----------------------------------------------------------------

describe("rolesService.remove", () => {
  it("faz DELETE /roles/7", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));

    await rolesService.remove(7);

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toBe(`${API_BASE_URL}/roles/7`);
    expect(initOf(call).method).toBe("DELETE");
  });
});
