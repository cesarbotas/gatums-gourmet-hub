// Helpers compartilhados pelos testes INTEGRADOS de contrato.
//
// Estes testes falam com a API local real (default http://localhost:5166).
// No ambiente `node` do Vitest o `import.meta.env` do Vite pode não estar
// populado, então compomos a base a partir de `process.env` com os mesmos
// defaults da app — mais robusto aqui do que importar de `@/lib/api/config`.

const DEFAULT_ROOT = "http://localhost:5166";
const DEFAULT_VERSION = "v1";

/** Base efetiva da API: `${raiz}/api/${versão}`. */
export function baseUrl(): string {
  const root = process.env.VITE_API_BASE_URL ?? DEFAULT_ROOT;
  const version = process.env.VITE_API_VERSION ?? DEFAULT_VERSION;
  return `${root.replace(/\/+$/, "")}/api/${version}`;
}

/**
 * Verifica se a API está respondendo. Retorna `true` para QUALQUER resposta
 * HTTP (inclusive 404 — significa "servidor no ar") e `false` em erro de
 * conexão ou timeout. Usado para PULAR (skip) os testes quando a API está fora,
 * em vez de falhar com erro de conexão.
 */
export async function apiOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(baseUrl(), { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz login com o seed admin e devolve o `accessToken`. Lança se o status não
 * for 200 (não deve ser chamado quando a API está offline — proteja com skip).
 */
export async function loginAdmin(): Promise<string> {
  const resp = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@gatums.com", senha: "Admin@123" }),
  });
  if (resp.status !== 200) {
    throw new Error(`loginAdmin falhou: esperado 200, recebido ${resp.status}`);
  }
  const body = (await resp.json()) as { accessToken: string };
  return body.accessToken;
}
