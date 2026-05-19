import { apiRequest } from "./client";
import type { PaginatedResponse } from "./config";

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  criadoEm: string;
}

export const clientesService = {
  async list(
    params: { page?: number; pageSize?: number; search?: string } = {},
  ): Promise<PaginatedResponse<Cliente>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (params.search) qs.set("search", params.search);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>(`/clientes?${qs}`);
    const items: Cliente[] = res.items ?? res;
    return { items, total: res.total ?? items.length, page: res.page ?? page, pageSize: res.pageSize ?? pageSize };
  },

  async create(input: Omit<Cliente, "id" | "criadoEm">): Promise<Cliente> {
    return apiRequest<Cliente>("/clientes", { method: "POST", json: input });
  },

  async update(id: string, input: Partial<Cliente>): Promise<Cliente> {
    return apiRequest<Cliente>(`/clientes/${id}`, { method: "PUT", json: { id, ...input } });
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/clientes/${id}`, { method: "DELETE" });
  },

  async count(): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/clientes?page=1&pageSize=1");
    return res.total ?? 0;
  },
};
