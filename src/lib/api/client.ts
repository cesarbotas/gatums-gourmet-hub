import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("gg.session") : null;
    if (!raw) return null;
    const session = JSON.parse(raw) as { accessToken?: string };
    return session.accessToken ?? null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("gg.session") : null;
    if (!raw) return null;
    const session = JSON.parse(raw) as { refreshToken?: string };
    return session.refreshToken ?? null;
  } catch {
    return null;
  }
}

// Único refresh em voo compartilhado entre chamadas concorrentes que recebem 401.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    // fetch direto (NÃO usa apiRequest) para evitar recursão de refresh.
    const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) {
      window.localStorage.removeItem("gg.session");
      return false;
    }

    const body = (await resp.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (!body.accessToken) {
      window.localStorage.removeItem("gg.session");
      return false;
    }

    const raw = window.localStorage.getItem("gg.session");
    const current = raw ? (JSON.parse(raw) as { user?: unknown }) : {};

    window.localStorage.setItem(
      "gg.session",
      JSON.stringify({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? refreshToken,
        user: current.user,
      }),
    );

    return true;
  } catch {
    window.localStorage.removeItem("gg.session");
    return false;
  }
}

function buildHeaders(
  headers: RequestInit["headers"],
  token: string | null,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const body = json !== undefined ? JSON.stringify(json) : options.body;

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(headers, getToken()),
    body,
  });

  // 401 + refresh transparente (uma vez, compartilhado), exceto nos paths de auth terminais.
  const refreshEligible =
    res.status === 401 &&
    typeof window !== "undefined" &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/login") &&
    getRefreshToken() !== null;

  if (refreshEligible) {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    const ok = await refreshing;

    if (ok) {
      // Refaz a requisição UMA vez com o novo access token.
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: buildHeaders(headers, getToken()),
        body,
      });
    }
  }

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    code?: string;
    // ProblemDetails (RFC 7807/9807) retornado pela API em erros
    title?: string;
    detail?: string;
  };

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // 401 terminal (refresh falhou ou inelegível) — limpa e manda para o login.
      window.localStorage.removeItem("gg.session");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    throw new ApiError(
      data.detail ?? data.message ?? data.title ?? "Erro na requisição",
      res.status,
      data.code,
    );
  }

  return data;
}
