import { apiRequest } from "./client";

export interface Venda {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  total: number;
  data: string;
}

export const vendasService = {
  async list(): Promise<Venda[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/relatorios/vendas/resumo");
    return res.vendas ?? res.items ?? [];
  },

  async resumo() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiRequest<any>("/relatorios/vendas/resumo");
  },
};
