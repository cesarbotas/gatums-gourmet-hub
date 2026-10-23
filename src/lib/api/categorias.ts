import { apiRequest } from "./client";
import { appendPageParams, mapPaginated, type PaginatedResponse } from "./config";

export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategoria(raw: any): Categoria {
  return {
    id: raw.id,
    nome: raw.nome ?? "",
    descricao: raw.descricao ?? null,
    ativo: raw.ativo ?? true,
  };
}

export const categoriasService = {
  async list(
    params: {
      page?: number;
      pageSize?: number;
      apenasAtivas?: boolean;
      search?: string;
    } = {},
  ): Promise<PaginatedResponse<Categoria>> {
    const qs = new URLSearchParams();
    const { page, pageSize } = appendPageParams(qs, params);
    if (typeof params.apenasAtivas === "boolean")
      qs.set("apenasAtivas", String(params.apenasAtivas));
    if (params.search) qs.set("search", params.search);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>(`/categorias?${qs}`);
    return mapPaginated(res, (raw) => mapCategoria(raw), { page, pageSize });
  },

  async getById(id: number): Promise<Categoria | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/categorias/${id}`);
      return mapCategoria(raw);
    } catch {
      return null;
    }
  },

  async create(input: {
    nome: string;
    descricao?: string | null;
    ativo?: boolean;
  }): Promise<{ id: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/categorias", {
      method: "POST",
      json: {
        nome: input.nome,
        descricao: input.descricao,
        ativo: input.ativo,
      },
    });
    return { id: raw.id };
  },

  async update(
    id: number,
    input: { nome: string; descricao?: string | null; ativo: boolean },
  ): Promise<void> {
    await apiRequest(`/categorias/${id}`, {
      method: "PUT",
      json: {
        id,
        nome: input.nome,
        descricao: input.descricao,
        ativo: input.ativo,
      },
    });
  },

  async remove(id: number): Promise<void> {
    await apiRequest(`/categorias/${id}`, { method: "DELETE" });
  },
};
