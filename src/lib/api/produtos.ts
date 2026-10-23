import { apiRequest } from "./client";
import { appendPageParams, mapPaginated, type PaginatedResponse } from "./config";

export type TipoProduto = "simples" | "combo";

export interface ItemCombo {
  produtoId: string;
  quantidade: number;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  categoriaId: number;
  categoriaNome: string;
  preco: number;
  foto: string;
  disponivel: boolean;
  tipo: TipoProduto;
  itens?: ItemCombo[];
  criadoEm: string;
}

// API uses integer enums: TipoProduto 0=simples, 1=combo
function toTipo(v: number | string): TipoProduto {
  if (v === 1 || v === "combo") return "combo";
  return "simples";
}

function fromTipo(t: TipoProduto): number {
  return t === "combo" ? 1 : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduto(raw: any): Produto {
  return {
    id: raw.id,
    nome: raw.nome ?? "",
    descricao: raw.descricao ?? "",
    categoriaId: raw.categoriaId ?? 0,
    categoriaNome: raw.categoriaNome ?? "",
    preco: raw.preco ?? 0,
    foto: raw.fotoUrl ?? raw.foto ?? "",
    disponivel: raw.disponivel ?? true,
    tipo: toTipo(raw.tipo),
    itens: raw.itens,
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
  };
}

export const produtosService = {
  async list(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      categoriaId?: number;
      tipo?: TipoProduto | "todos";
      disponivel?: boolean;
    } = {},
  ): Promise<PaginatedResponse<Produto>> {
    const qs = new URLSearchParams();
    const { page, pageSize } = appendPageParams(qs, params);
    if (params.search) qs.set("search", params.search);
    if (typeof params.categoriaId === "number") qs.set("categoriaId", String(params.categoriaId));
    // Query params aceitam o nome do enum (case-insensitive), ex.: ?tipo=simples
    if (params.tipo && params.tipo !== "todos") qs.set("tipo", params.tipo);
    if (typeof params.disponivel === "boolean") qs.set("disponivel", String(params.disponivel));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>(`/produtos?${qs}`);
    return mapPaginated(res, (raw) => mapProduto(raw), { page, pageSize });
  },

  async getById(id: string): Promise<Produto | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await apiRequest<any>(`/produtos/${id}`);
      return mapProduto(raw);
    } catch {
      return null;
    }
  },

  async create(input: Omit<Produto, "id" | "criadoEm">): Promise<Produto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>("/produtos", {
      method: "POST",
      json: {
        nome: input.nome,
        descricao: input.descricao,
        categoriaId: input.categoriaId,
        preco: input.preco,
        fotoUrl: input.foto,
        disponivel: input.disponivel,
        tipo: fromTipo(input.tipo),
        itens: input.itens,
      },
    });
    return mapProduto(raw);
  },

  async update(id: string, input: Partial<Produto>): Promise<Produto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/produtos/${id}`, {
      method: "PUT",
      json: {
        id,
        nome: input.nome,
        descricao: input.descricao,
        categoriaId: input.categoriaId,
        preco: input.preco,
        fotoUrl: input.foto,
        disponivel: input.disponivel,
      },
    });
    return mapProduto(raw);
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/produtos/${id}`, { method: "DELETE" });
  },
};
