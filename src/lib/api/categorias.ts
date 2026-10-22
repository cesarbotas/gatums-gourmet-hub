import { apiRequest } from "./client";
import type { PaginatedResponse } from "./config";

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
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const qs = new URLSearchParams();
    if (typeof params.apenasAtivas === "boolean") qs.set("apenasAtivas", String(params.apenasAtivas));

    const query = qs.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any[]>(`/categorias${query ? `?${query}` : ""}`);
    let items = (res ?? []).map(mapCategoria);

    if (params.search) {
      const term = params.search.toLowerCase();
      items = items.filter((c) => c.nome.toLowerCase().includes(term));
    }

    const total = items.length;
    // TODO[API-pagination]: quando /categorias aceitar page/pageSize, trocar o fatiamento local por query server-side e repassar o PaginatedResponse da API.
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return {
      items: paged,
      total,
      page,
      pageSize,
    };
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

  async create(input: { nome: string; descricao?: string | null; ativo?: boolean }): Promise<{ id: number }> {
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
