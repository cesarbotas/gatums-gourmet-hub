import { apiRequest } from "./client";

/**
 * Endereço do cliente.
 *
 * NOTA: hoje a API mantém apenas `cidade` no recurso `/clientes`.
 * Este módulo modela o endereço completo no frontend e prevê uma
 * futura tabela `enderecos` separada (1-N com cliente). Veja
 * `docs/REFERENCE-endereco-cliente.md` para o plano de migração
 * backend.
 *
 * Enquanto a API não expõe os endpoints `/clientes/{id}/enderecos`,
 * o serviço persiste o endereço localmente (localStorage) por
 * cliente, espelhando o contrato esperado.
 */
export interface Endereco {
  id?: string;
  clienteId?: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia?: string;
  principal?: boolean;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/** Consulta ViaCEP e devolve um endereço parcial pronto para mesclar no form. */
export async function consultarCep(cepRaw: string): Promise<Partial<Endereco>> {
  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP inválido");
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP");
  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) throw new Error("CEP não encontrado");
  return {
    cep: data.cep,
    logradouro: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    uf: data.uf,
  };
}

const LS_KEY = (clienteId: string) => `gg.enderecos.${clienteId}`;

function readLocal(clienteId: string): Endereco[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY(clienteId));
    return raw ? (JSON.parse(raw) as Endereco[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(clienteId: string, list: Endereco[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY(clienteId), JSON.stringify(list));
}

export const enderecosService = {
  async listByCliente(clienteId: string): Promise<Endereco[]> {
    try {
      return await apiRequest<Endereco[]>(`/clientes/${clienteId}/enderecos`);
    } catch {
      return readLocal(clienteId);
    }
  },

  async save(clienteId: string, endereco: Endereco): Promise<Endereco> {
    try {
      if (endereco.id) {
        return await apiRequest<Endereco>(
          `/clientes/${clienteId}/enderecos/${endereco.id}`,
          { method: "PUT", json: endereco },
        );
      }
      return await apiRequest<Endereco>(`/clientes/${clienteId}/enderecos`, {
        method: "POST",
        json: endereco,
      });
    } catch {
      // fallback local
      const list = readLocal(clienteId);
      const saved: Endereco = {
        ...endereco,
        id: endereco.id ?? crypto.randomUUID(),
        clienteId,
      };
      const idx = list.findIndex((e) => e.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else {
        if (saved.principal) list.forEach((e) => (e.principal = false));
        list.push(saved);
      }
      writeLocal(clienteId, list);
      return saved;
    }
  },

  async remove(clienteId: string, enderecoId: string): Promise<void> {
    try {
      await apiRequest(`/clientes/${clienteId}/enderecos/${enderecoId}`, {
        method: "DELETE",
      });
    } catch {
      writeLocal(
        clienteId,
        readLocal(clienteId).filter((e) => e.id !== enderecoId),
      );
    }
  },

  async getPrincipal(clienteId: string): Promise<Endereco | null> {
    const list = await enderecosService.listByCliente(clienteId);
    return list.find((e) => e.principal) ?? list[0] ?? null;
  },
};
