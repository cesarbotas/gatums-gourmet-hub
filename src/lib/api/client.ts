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

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    },
    body: json !== undefined ? JSON.stringify(json) : options.body,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(data.message ?? "Erro na requisição", res.status, data.code);
  }

  return data;
}
