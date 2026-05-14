// Mock auth backed by localStorage. Replace with real API calls when backend is ready.
import { readStore, writeStore, uid } from "./storage";

const USERS_KEY = "gg.users";
const SESSION_KEY = "gg.session";

export type UserRole = "admin" | "cliente";

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  role: UserRole;
}

interface StoredUser extends User {
  password: string;
}

interface Session {
  token: string;
  user: User;
}

function seedIfEmpty() {
  const users = readStore<StoredUser[]>(USERS_KEY, []);
  if (users.length === 0) {
    const seeded: StoredUser[] = [
      {
        id: uid(),
        nome: "Administrador",
        email: "admin@gatums.com",
        password: "admin123",
        role: "admin",
      },
      {
        id: uid(),
        nome: "Cliente Demo",
        email: "cliente@gatums.com",
        password: "cliente123",
        role: "cliente",
      },
    ];
    writeStore(USERS_KEY, seeded);
  }
}

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((r) => setTimeout(() => r(value), ms));
}

export const authService = {
  async login(email: string, password: string): Promise<Session> {
    seedIfEmpty();
    const users = readStore<StoredUser[]>(USERS_KEY, []);
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!found) throw new Error("E-mail ou senha incorretos");
    const { password: _p, ...user } = found;
    const session: Session = { token: `mock.${found.id}.${Date.now()}`, user };
    writeStore(SESSION_KEY, session);
    return delay(session, 200);
  },

  async register(input: {
    nome: string;
    email: string;
    password: string;
    telefone?: string;
  }): Promise<Session> {
    seedIfEmpty();
    const users = readStore<StoredUser[]>(USERS_KEY, []);
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Este e-mail já está cadastrado");
    }
    const newUser: StoredUser = {
      id: uid(),
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      password: input.password,
      role: "cliente",
    };
    writeStore(USERS_KEY, [...users, newUser]);
    const { password: _p, ...user } = newUser;
    const session: Session = { token: `mock.${newUser.id}.${Date.now()}`, user };
    writeStore(SESSION_KEY, session);
    return delay(session, 200);
  },

  logout() {
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
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
