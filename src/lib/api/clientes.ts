import { readStore, writeStore, uid } from "./storage";
import type { PaginatedResponse } from "./config";

const KEY = "gg.clientes";

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  criadoEm: string;
}

const SEED: Cliente[] = [
  { id: uid(), nome: "Marina Souza", email: "marina@email.com", telefone: "(11) 98888-1234", cidade: "São Paulo", criadoEm: new Date().toISOString() },
  { id: uid(), nome: "Rafael Lima", email: "rafael@email.com", telefone: "(21) 99999-4321", cidade: "Rio de Janeiro", criadoEm: new Date().toISOString() },
  { id: uid(), nome: "Ana Beatriz", email: "ana@email.com", telefone: "(31) 97777-5555", cidade: "Belo Horizonte", criadoEm: new Date().toISOString() },
];

function load() {
  const stored = readStore<Cliente[]>(KEY, []);
  if (stored.length === 0) {
    writeStore(KEY, SEED);
    return SEED;
  }
  return stored;
}
function save(list: Cliente[]) {
  writeStore(KEY, list);
}

export const clientesService = {
  async list(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<
    PaginatedResponse<Cliente>
  > {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const search = (params.search ?? "").toLowerCase().trim();
    let items = load();
    if (search) {
      items = items.filter(
        (c) =>
          c.nome.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.cidade.toLowerCase().includes(search),
      );
    }
    return {
      items: items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
      total: items.length,
      page,
      pageSize,
    };
  },
  async create(input: Omit<Cliente, "id" | "criadoEm">) {
    const item: Cliente = { ...input, id: uid(), criadoEm: new Date().toISOString() };
    save([item, ...load()]);
    return item;
  },
  async update(id: string, input: Partial<Cliente>) {
    const list = load();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cliente não encontrado");
    list[idx] = { ...list[idx], ...input, id };
    save(list);
    return list[idx];
  },
  async remove(id: string) {
    save(load().filter((c) => c.id !== id));
  },
  async count() {
    return load().length;
  },
};
