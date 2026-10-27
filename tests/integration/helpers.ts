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
// ---------------------------------------------------------------------------
// Allowlist de ambiente (SEGURANÇA-CRÍTICA)
//
// Os testes INTEGRADOS falam com uma API real. Para impedir que uma rodada
// acidentalmente aponte para PRODUÇÃO (ou qualquer host desconhecido) e
// execute operações destrutivas, só permitimos hosts explicitamente listados:
// o ambiente local e o de homologação (HML). Qualquer outro host é recusado
// ANTES de qualquer requisição.
// ---------------------------------------------------------------------------

/** Hosts onde é seguro rodar testes de contrato (match EXATO, sem subdomínios). */
const HOSTS_PERMITIDOS = ["localhost", "127.0.0.1", "gatums-gourmet-api.onrender.com"] as const;

/**
 * Função PURA (sem rede): `true` somente para os hosts da allowlist por match
 * exato. PROD (`gatumsgourmet.com.br`), hosts desconhecidos e subdomínios
 * arbitrários de um host permitido retornam `false`.
 */
export function hostPermitido(host: string): boolean {
  return (HOSTS_PERMITIDOS as readonly string[]).includes(host);
}

/**
 * Garante que a `baseUrl()` corrente aponta para um ambiente permitido
 * (local ou HML). Lança `Error` com mensagem clara caso contrário. Deve ser
 * chamada antes de qualquer requisição nos testes de contrato.
 */
export function assertAmbientePermitido(): void {
  const host = new URL(baseUrl()).hostname;
  if (!hostPermitido(host)) {
    throw new Error(
      "Testes de contrato recusados: base '" +
        baseUrl() +
        "' nao e local nem HML. PROD/desconhecido bloqueado.",
    );
  }
}

/**
 * Faz login com credenciais arbitrárias e devolve o `accessToken`. Lança se o
 * status não for 200. Variante parametrizada de `loginAdmin`.
 */
export async function loginComo(email: string, senha: string): Promise<string> {
  const resp = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (resp.status !== 200) {
    throw new Error(`loginComo falhou para '${email}': esperado 200, recebido ${resp.status}`);
  }
  const body = (await resp.json()) as { accessToken: string };
  return body.accessToken;
}

interface RolePapel {
  // GET /roles devolve `id` como number (int32) — confirmado contra a API real
  // (ex.: {"id":1,"nome":"Admin",...}) e pelo OpenAPI (roles/{id} = integer int32).
  id: number;
  nome: string;
}

let cacheClienteEGerente: { clienteToken: string; gerenteToken: string } | undefined;

/**
 * Cria (uma vez por processo) um usuário Cliente e um Gerente usando o seed
 * admin e devolve seus tokens. Memoizado em variável de módulo para reuso entre
 * testes da mesma rodada. Emails únicos por timestamp evitam colisão entre
 * execuções.
 *
 * NÃO chamar fora dos testes de contrato (requer API online + ambiente
 * permitido). Consumido pela Task 4 e pelas Fases 2-3.
 */
export async function criarClienteEGerente(): Promise<{
  clienteToken: string;
  gerenteToken: string;
}> {
  if (cacheClienteEGerente) {
    return cacheClienteEGerente;
  }

  const adminToken = await loginAdmin();
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  const rolesResp = await fetch(`${baseUrl()}/roles`, { headers: authHeaders });
  if (rolesResp.status !== 200) {
    throw new Error(`GET /roles falhou: esperado 200, recebido ${rolesResp.status}`);
  }
  const roles = (await rolesResp.json()) as RolePapel[];
  const idPorNome = (nome: string): number => {
    const papel = roles.find((r) => r.nome === nome);
    if (!papel) {
      throw new Error(`Papel '${nome}' nao encontrado em /roles`);
    }
    return papel.id;
  };

  const criarEObterToken = async (prefixo: string, roleId: number): Promise<string> => {
    const email = `teste-${prefixo}-${Date.now()}@local.test`;
    const senha = "Teste@123";
    const resp = await fetch(`${baseUrl()}/usuarios`, {
      method: "POST",
      headers: authHeaders,
      // `nome` e obrigatorio em CreateUsuarioRequest (OpenAPI) — sem ele a API retorna 400.
      body: JSON.stringify({ nome: `Teste ${prefixo}`, email, senha, telefone: null, roleIds: [roleId] }),
    });
    if (resp.status !== 200 && resp.status !== 201) {
      throw new Error(
        `POST /usuarios falhou para '${email}': esperado 200/201, recebido ${resp.status}`,
      );
    }
    return loginComo(email, senha);
  };

  const clienteToken = await criarEObterToken("cliente", idPorNome("Cliente"));
  const gerenteToken = await criarEObterToken("gerente", idPorNome("Gerente"));

  cacheClienteEGerente = { clienteToken, gerenteToken };
  return cacheClienteEGerente;
}
