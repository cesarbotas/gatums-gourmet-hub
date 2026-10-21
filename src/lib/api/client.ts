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
    const session = JSON.parse(raw) as { token?: string };
    return session.token ?? null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>),
    },
    body: json !== undefined ? JSON.stringify(json) : options.body,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    code?: string;
    // ProblemDetails (RFC 7807/9807) retornado pela API em erros
    title?: string;
    detail?: string;
  };

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // Sessão expirada (JWT 8h) — limpa e manda para o login
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
