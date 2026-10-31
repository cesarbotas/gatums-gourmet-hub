import { apiRequest } from "./client";

export interface Permission {
  id: number;
  codigo: string;
  descricao: string | null;
  recurso: string;
  acao: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPermission(raw: any): Permission {
  return {
    id: raw.id,
    codigo: raw.codigo ?? "",
    descricao: raw.descricao ?? null,
    recurso: raw.recurso ?? "",
    acao: raw.acao ?? "",
  };
}

export const permissionsService = {
  async list(): Promise<Permission[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/permissions");
    const rawItems: unknown[] = Array.isArray(res) ? res : [];
    return rawItems.map((raw) => mapPermission(raw));
  },

  async getById(id: number): Promise<Permission | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/permissions/${id}`);
      return mapPermission(raw);
    } catch {
      return null;
    }
  },

  async create(input: {
    codigo: string;
    descricao?: string | null;
    recurso: string;
    acao: string;
  }): Promise<{ id: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/permissions", {
      method: "POST",
      json: {
        codigo: input.codigo,
        descricao: input.descricao ?? null,
        recurso: input.recurso,
        acao: input.acao,
      },
    });
    return { id: raw.id };
  },

  async update(
    id: number,
    input: { descricao?: string | null; recurso: string; acao: string },
  ): Promise<void> {
    await apiRequest(`/permissions/${id}`, {
      method: "PUT",
      json: {
        id,
        descricao: input.descricao ?? null,
        recurso: input.recurso,
        acao: input.acao,
      },
    });
  },

  async remove(id: number): Promise<void> {
    await apiRequest(`/permissions/${id}`, { method: "DELETE" });
  },
};
