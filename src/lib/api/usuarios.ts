import { apiRequest } from "./client";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  roles?: string[];
  ativo?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUsuario(raw: any): Usuario {
  return {
    id: raw.id,
    nome: raw.nome ?? "",
    email: raw.email ?? "",
    roles: Array.isArray(raw.roles) ? raw.roles : undefined,
    ativo: typeof raw.ativo === "boolean" ? raw.ativo : undefined,
  };
}

export const usuariosService = {
  async list(): Promise<Usuario[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/usuarios");
    const rawItems: unknown[] = Array.isArray(res) ? res : [];
    return rawItems.map((raw) => mapUsuario(raw));
  },

  async getById(id: string): Promise<Usuario | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/usuarios/${id}`);
      return mapUsuario(raw);
    } catch {
      return null;
    }
  },

  async create(input: {
    nome: string;
    email: string;
    senha: string;
    telefone?: string | null;
    roleIds: number[];
  }): Promise<{ id: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/usuarios", {
      method: "POST",
      json: {
        nome: input.nome,
        email: input.email,
        senha: input.senha,
        telefone: input.telefone ?? null,
        roleIds: input.roleIds,
      },
    });
    return { id: raw.id };
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/usuarios/${id}`, { method: "DELETE" });
  },

  async setRoles(id: string, roleIds: number[]): Promise<void> {
    await apiRequest(`/usuarios/${id}/roles`, {
      method: "PUT",
      json: {
        usuarioId: id,
        roleIds,
      },
    });
  },

  async setAtivo(id: string, ativo: boolean): Promise<void> {
    await apiRequest(`/usuarios/${id}/ativo`, {
      method: "PATCH",
      json: {
        usuarioId: id,
        ativo,
      },
    });
  },
};
