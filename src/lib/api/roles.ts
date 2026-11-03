import { apiRequest } from "./client";

export interface Role {
  id: number;
  nome: string;
  descricao: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRole(raw: any): Role {
  return {
    id: raw.id,
    nome: raw.nome ?? "",
    descricao: raw.descricao ?? null,
  };
}

export const rolesService = {
  async list(): Promise<Role[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/roles");
    const rawItems: unknown[] = Array.isArray(res) ? res : [];
    return rawItems.map((raw) => mapRole(raw));
  },

  async getById(id: number): Promise<Role | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/roles/${id}`);
      return mapRole(raw);
    } catch {
      return null;
    }
  },

  async create(input: {
    nome: string;
    descricao?: string | null;
  }): Promise<{ id: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/roles", {
      method: "POST",
      json: {
        nome: input.nome,
        descricao: input.descricao ?? null,
      },
    });
    return { id: raw.id };
  },

  async update(
    id: number,
    input: { nome: string; descricao?: string | null },
  ): Promise<void> {
    await apiRequest(`/roles/${id}`, {
      method: "PUT",
      json: {
        id,
        nome: input.nome,
        descricao: input.descricao ?? null,
      },
    });
  },

  async remove(id: number): Promise<void> {
    await apiRequest(`/roles/${id}`, { method: "DELETE" });
  },

  async setPermissions(id: number, permissionIds: number[]): Promise<void> {
    await apiRequest(`/roles/${id}/permissions`, {
      method: "PUT",
      json: {
        roleId: id,
        permissionIds,
      },
    });
  },
};
