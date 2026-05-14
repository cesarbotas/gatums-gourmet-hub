import { readStore, writeStore, uid } from "./storage";
import type { PaginatedResponse } from "./config";

const KEY = "gg.produtos";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  foto: string;
  disponivel: boolean;
  criadoEm: string;
}

const SEED: Produto[] = [
  {
    id: uid(),
    nome: "Geleia de Pimenta com Damasco",
    descricao: "Doce, cítrica e levemente picante. Acompanha queijos e carnes.",
    categoria: "Geleias",
    preco: 32,
    foto: "https://images.unsplash.com/photo-1597528380103-fe1d6c5dbeec?w=800&auto=format&fit=crop",
    disponivel: true,
    criadoEm: new Date().toISOString(),
  },
  {
    id: uid(),
    nome: "Brownie Belga 70%",
    descricao: "Massa densa, recheio cremoso e cobertura crocante. Caixa com 6 unidades.",
    categoria: "Doces",
    preco: 48,
    foto: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop",
    disponivel: true,
    criadoEm: new Date().toISOString(),
  },
  {
    id: uid(),
    nome: "Patê Artesanal de Cogumelos",
    descricao: "Mix de funghi, manteiga noisette e ervas frescas. Pote 180g.",
    categoria: "Patês",
    preco: 39,
    foto: "https://images.unsplash.com/photo-1559054663-e8d23213f55c?w=800&auto=format&fit=crop",
    disponivel: true,
    criadoEm: new Date().toISOString(),
  },
  {
    id: uid(),
    nome: "Pão de Fermentação Natural",
    descricao: "Casca rústica, miolo aerado, 36h de fermentação. Unidade 500g.",
    categoria: "Padaria",
    preco: 28,
    foto: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop",
    disponivel: true,
    criadoEm: new Date().toISOString(),
  },
  {
    id: uid(),
    nome: "Trufas de Caramelo Salgado",
    descricao: "Chocolate ao leite, recheio cremoso e flor de sal. Caixa com 9.",
    categoria: "Doces",
    preco: 54,
    foto: "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800&auto=format&fit=crop",
    disponivel: false,
    criadoEm: new Date().toISOString(),
  },
  {
    id: uid(),
    nome: "Azeite Aromatizado com Alho Negro",
    descricao: "Extra virgem, infusionado a frio. Garrafa 250ml.",
    categoria: "Mercearia",
    preco: 62,
    foto: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&auto=format&fit=crop",
    disponivel: true,
    criadoEm: new Date().toISOString(),
  },
];

function load(): Produto[] {
  const stored = readStore<Produto[]>(KEY, []);
  if (stored.length === 0) {
    writeStore(KEY, SEED);
    return SEED;
  }
  return stored;
}

function save(list: Produto[]) {
  writeStore(KEY, list);
}

export const produtosService = {
  async list(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<
    PaginatedResponse<Produto>
  > {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const search = (params.search ?? "").toLowerCase().trim();
    let items = load();
    if (search) {
      items = items.filter(
        (p) =>
          p.nome.toLowerCase().includes(search) ||
          p.categoria.toLowerCase().includes(search),
      );
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  },

  async getById(id: string): Promise<Produto | null> {
    return load().find((p) => p.id === id) ?? null;
  },

  async create(input: Omit<Produto, "id" | "criadoEm">): Promise<Produto> {
    const item: Produto = { ...input, id: uid(), criadoEm: new Date().toISOString() };
    save([item, ...load()]);
    return item;
  },

  async update(id: string, input: Partial<Produto>): Promise<Produto> {
    const list = load();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Produto não encontrado");
    const updated = { ...list[idx], ...input, id };
    list[idx] = updated;
    save(list);
    return updated;
  },

  async remove(id: string): Promise<void> {
    save(load().filter((p) => p.id !== id));
  },
};
