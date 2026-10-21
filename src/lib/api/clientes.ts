import { apiRequest } from "./client";
import type { PaginatedResponse } from "./config";
import type { Endereco } from "./enderecos";

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  endereco?: Endereco | null;
  criadoEm: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCliente(raw: any): Cliente {
  const end = raw.endereco ?? null;
  return {
    id: raw.id,
    nome: raw.nome ?? "",
    email: raw.email ?? "",
    telefone: raw.telefone ?? "",
    cidade: raw.cidade ?? end?.cidade ?? "",
    endereco: end
      ? {
          id: end.id,
          clienteId: end.clienteId ?? raw.id,
          cep: end.cep ?? "",
          logradouro: end.logradouro ?? "",
          numero: end.numero ?? "",
          complemento: end.complemento ?? undefined,
          bairro: end.bairro ?? "",
          cidade: end.cidade ?? "",
          uf: end.estado ?? end.uf ?? "",
        }
      : null,
    criadoEm: raw.criadoEm ?? new Date().toISOString(),
  };
}

/** Converte o Endereco do front (uf) para o contrato da API (estado, cep só dígitos). */
function toEnderecoInput(e: Endereco) {
  return {
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento ?? null,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.uf.slice(0, 2).toUpperCase(),
    cep: e.cep.replace(/\D/g, "").slice(0, 8),
  };
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
    const items: Cliente[] = (res.items ?? res).map(mapCliente);
    return { items, total: res.total ?? items.length, page: res.page ?? page, pageSize: res.pageSize ?? pageSize };
  },

  async create(
    input: Omit<Cliente, "id" | "criadoEm" | "endereco"> & { endereco?: Endereco | null },
  ): Promise<Cliente> {
    // CreateClienteRequest exige `endereco` na API
    const raw = await apiRequest<{ id: string }>("/clientes", {
      method: "POST",
      json: {
        nome: input.nome,
        email: input.email,
        telefone: input.telefone || null,
        endereco: input.endereco
          ? toEnderecoInput(input.endereco)
          : {
              logradouro: "-",
              numero: "-",
              complemento: null,
              bairro: "-",
              cidade: input.cidade || "-",
              estado: "SP",
              cep: "00000000",
            },
      },
    });
    return mapCliente({ ...input, id: raw.id, endereco: input.endereco ?? null });
  },

  async update(id: string, input: Partial<Cliente>): Promise<Cliente> {
    // UpdateClienteRequest NÃO aceita endereco — apenas dados básicos
    await apiRequest(`/clientes/${id}`, {
      method: "PUT",
      json: { nome: input.nome, email: input.email, telefone: input.telefone || null },
    });
    return mapCliente({ ...input, id });
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
