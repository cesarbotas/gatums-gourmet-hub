import { apiRequest } from "./client";
import { writeStore, readStore } from "./storage";

const SESSION_KEY = "gg.session";

export type UserRole = "admin" | "cliente";

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  role: UserRole;
}

interface Session {
  token: string;
  user: User;
}

interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(email: string, password: string): Promise<Session> {
    const res = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      json: { email, senha: password },
    });
    const session: Session = { token: res.token, user: res.user };
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
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    }
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
    return authService.getSession()?.user.role === "admin";
  },

  getAuthHeaders(): Record<string, string> {
    const s = authService.getSession();
    return s ? { Authorization: `Bearer ${s.token}` } : {};
  },
};
