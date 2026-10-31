import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authService } from "@/lib/api/auth";
import { apiRequest, ApiError } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";

// --- Helpers ---------------------------------------------------------------

/** Monta uma Response fake compatível com o uso de apiRequest/doRefresh
 *  (`res.ok`, `res.status`, `await res.json()`). */
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Extrai a URL (1º argumento) de uma chamada registrada no mock de fetch. */
function urlOf(call: unknown[]): string {
  return String(call[0]);
}

function countCalls(mock: ReturnType<typeof vi.fn>, matcher: (url: string) => boolean): number {
  return mock.mock.calls.filter((c) => matcher(urlOf(c))).length;
}

const REFRESH_URL = `${API_BASE_URL}/auth/refresh`;

/** Sessão pré-gravada em localStorage (formato gg.session). */
function seedSession(partial?: {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}) {
  const session = {
    accessToken: partial?.accessToken ?? "old-access",
    refreshToken: partial?.refreshToken ?? "valid-refresh",
    user: partial?.user ?? { id: "1", nome: "X", email: "e@e", roles: ["Cliente"] },
  };
  window.localStorage.setItem("gg.session", JSON.stringify(session));
  return session;
}

// --- Setup -----------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // 401 terminal chama window.location.assign("/login"); happy-dom pode
  // avisar/lançar em navegação — stub seguro (setup de teste, não produção).
  vi.spyOn(window.location, "assign").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- Caso 1: login grava sessão -------------------------------------------

describe("authService.login", () => {
  it("grava gg.session com accessToken, refreshToken e user.roles", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        accessToken: "a",
        refreshToken: "r",
        expiresIn: 900,
        user: { id: "1", nome: "X", email: "e@e", roles: ["Admin"] },
      }),
    );

    await authService.login("e@e", "pw");

    const stored = JSON.parse(window.localStorage.getItem("gg.session")!);
    expect(stored.accessToken).toBe("a");
    expect(stored.refreshToken).toBe("r");
    expect(stored.user.roles).toEqual(["Admin"]);
  });
});

// --- Caso 2: refresh no 401 ------------------------------------------------

describe("apiRequest — refresh transparente no 401", () => {
  it("no 401 chama /auth/refresh uma vez e refaz a requisição original", async () => {
    seedSession({ accessToken: "old-access", refreshToken: "valid-refresh" });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === REFRESH_URL) {
        return fakeResponse(200, { accessToken: "new-access", refreshToken: "new-refresh" });
      }
      if (url === `${API_BASE_URL}/algo`) {
        // 1ª chamada → 401; após o refresh, a 2ª → 200.
        const prior = countCalls(fetchMock, (u) => u === `${API_BASE_URL}/algo`);
        // prior inclui a chamada atual (já registrada em mock.calls).
        return prior <= 1 ? fakeResponse(401, {}) : fakeResponse(200, { ok: true });
      }
      return fakeResponse(500, {});
    });

    const result = await apiRequest<{ ok: boolean }>("/algo");

    expect(result).toEqual({ ok: true });
    expect(countCalls(fetchMock, (u) => u === REFRESH_URL)).toBe(1);
    expect(countCalls(fetchMock, (u) => u === `${API_BASE_URL}/algo`)).toBe(2);
  });
});

// --- Caso 3: single-flight -------------------------------------------------

describe("apiRequest — single-flight do refresh", () => {
  it("dois 401 concorrentes disparam UM único /auth/refresh", async () => {
    seedSession({ accessToken: "old-access", refreshToken: "valid-refresh" });

    // Controla a resolução do refresh para garantir que ambos os 401 cheguem
    // ao `refreshing ??=` antes de o refresh resolver.
    let releaseRefresh: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    const first = new Set<string>(); // paths que já receberam o primeiro 401

    fetchMock.mockImplementation(async (url: string) => {
      if (url === REFRESH_URL) {
        await refreshGate;
        return fakeResponse(200, { accessToken: "new-access", refreshToken: "new-refresh" });
      }
      if (url === `${API_BASE_URL}/a` || url === `${API_BASE_URL}/b`) {
        if (!first.has(url)) {
          first.add(url);
          return fakeResponse(401, {});
        }
        return fakeResponse(200, { url });
      }
      return fakeResponse(500, {});
    });

    const p = Promise.all([apiRequest("/a"), apiRequest("/b")]);

    // Deixa os dois 401 serem processados e ambos atingirem `refreshing ??=`
    // antes de liberar o refresh.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    releaseRefresh!();

    await p;

    expect(countCalls(fetchMock, (u) => u === REFRESH_URL)).toBe(1);
    // Ambas as requisições tomaram 401 e foram refeitas após o refresh.
    expect(countCalls(fetchMock, (u) => u === `${API_BASE_URL}/a`)).toBe(2);
    expect(countCalls(fetchMock, (u) => u === `${API_BASE_URL}/b`)).toBe(2);
  });
});

// --- Caso 4: anti-loop no login -------------------------------------------

describe("apiRequest — anti-loop em /auth/login", () => {
  it("401 em /auth/login NÃO dispara /auth/refresh e lança ApiError", async () => {
    // Mesmo com sessão presente, /auth/login não é elegível a refresh.
    seedSession({ refreshToken: "valid-refresh" });

    fetchMock.mockResolvedValue(fakeResponse(401, { message: "credenciais inválidas" }));

    await expect(
      apiRequest("/auth/login", { method: "POST", json: { email: "e@e", senha: "pw" } }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(countCalls(fetchMock, (u) => u === REFRESH_URL)).toBe(0);
  });
});

// --- Caso 5: isAdmin -------------------------------------------------------

describe("authService.isAdmin", () => {
  it("true para roles Gerente", () => {
    seedSession({ user: { id: "1", nome: "X", email: "e@e", roles: ["Gerente"] } });
    expect(authService.isAdmin()).toBe(true);
  });

  it("false para roles Cliente", () => {
    seedSession({ user: { id: "1", nome: "X", email: "e@e", roles: ["Cliente"] } });
    expect(authService.isAdmin()).toBe(false);
  });

  it("false (sem lançar) quando user não tem roles", () => {
    seedSession({ user: { id: "1", nome: "X", email: "e@e" } });
    expect(() => authService.isAdmin()).not.toThrow();
    expect(authService.isAdmin()).toBe(false);
  });
});
