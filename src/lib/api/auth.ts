import { apiRequest } from "./client";
import { writeStore, readStore } from "./storage";
import { API_BASE_URL } from "./config";

const SESSION_KEY = "gg.session";

export type UserRole = "Admin" | "Cliente" | "Gerente";

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  roles: UserRole[];
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

const ADMIN_ROLES = ["admin", "administrador", "gerente"];

function rolesFromToken(token?: string): string[] {
  if (!token) return [];
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    const out: string[] = [];
    for (const [k, v] of Object.entries(json)) {
      if (/role|perfil/i.test(k)) out.push(...(Array.isArray(v) ? v : [v]).map(String));
    }
    return out;
  } catch {
    return [];
  }
}

/** Detecta perfil admin aceitando roles[]/role/perfil (qualquer caixa) e claims do JWT. */
export function userIsAdmin(user: User | null, token?: string): boolean {
  if (!user && !token) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (user ?? {}) as any;
  const list: string[] = [
    ...(Array.isArray(u.roles) ? u.roles : []),
    ...(u.role ? [u.role] : []),
    ...(u.perfil ? [u.perfil] : []),
    ...rolesFromToken(token),
  ].map((r) => String(r).toLowerCase());
  return list.some((r) => ADMIN_ROLES.includes(r));
}

export const authService = {
  async login(email: string, password: string): Promise<Session> {
    const res = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      json: { email, senha: password },
    });
    const session: Session = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
    };
    writeStore(SESSION_KEY, session);
    return session;
  },

  async register(input: {
    nome: string;
    email: string;
    password: string;
    telefone?: string;
  }): Promise<Session> {
    // A API retorna 201 com o usuário criado, SEM token — é preciso logar em seguida.
    await apiRequest("/auth/register", {
      method: "POST",
      json: { nome: input.nome, email: input.email, senha: input.password, telefone: input.telefone },
    });
    return authService.login(input.email, input.password);
  },

  async logout(): Promise<void> {
    const session = authService.getSession();
    try {
      if (session?.refreshToken) {
        await apiRequest("/auth/logout", {
          method: "POST",
          json: { refreshToken: session.refreshToken },
        });
      }
    } finally {
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    }
  },

  async refresh(): Promise<string | null> {
    const session = authService.getSession();
    const refreshToken = session?.refreshToken;
    if (!refreshToken) return null;

    const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) {
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const data = (await resp.json()) as LoginResponse;
    const next: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: session.user,
    };
    writeStore(SESSION_KEY, next);
    return next.accessToken;
  },

  async me(): Promise<User | null> {
    try {
      return await apiRequest<User>("/auth/me");
    } catch {
      return null;
    }
  },

  getSession(): Session | null {
    return readStore<Session | null>(SESSION_KEY, null);
  },

  isAuthenticated(): boolean {
    return !!authService.getSession();
  },

  isAdmin(): boolean {
    const s = authService.getSession();
    return userIsAdmin(s?.user ?? null, s?.accessToken);
  },

  getAuthHeaders(): Record<string, string> {
    const s = authService.getSession();
    return s ? { Authorization: `Bearer ${s.accessToken}` } : {};
  },
};
