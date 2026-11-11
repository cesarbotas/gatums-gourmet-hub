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
  estoque: number;
  estoqueMinimo: number;
  /** False when the published API has not returned stock fields yet. */
  estoqueInformado?: boolean;
  /** Somente na criação: quantidade inicial em estoque. */
  estoqueInicial?: number;
  criadoEm: string;
}

export type TipoMovimentoEstoque = "entrada" | "saida" | "ajuste" | "venda";
const TIPOS_MOV: TipoMovimentoEstoque[] = ["entrada", "saida", "ajuste", "venda"];

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number;
  saldoResultante: number;
  pedidoId: string | null;
  observacao: string | null;
  data: string;
}

export function estoqueBaixo(p: Pick<Produto, "estoque" | "estoqueMinimo">): boolean {
  return Number.isFinite(p.estoque) && p.estoque <= p.estoqueMinimo;
}

export function produtoDisponivel(p: Pick<Produto, "disponivel" | "estoque" | "estoqueInformado">): boolean {
  return p.disponivel && (p.estoqueInformado === false || p.estoque > 0);
}

export function validarMovimento(tipo: Exclude<TipoMovimentoEstoque, "venda">, quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade === 0 || (tipo !== "ajuste" && quantidade < 0)) {
    throw new Error(tipo === "ajuste" ? "Informe uma quantidade inteira diferente de zero (+/-)." : "Informe uma quantidade inteira maior que zero.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTipoMov(v: any): TipoMovimentoEstoque {
  if (typeof v === "number") return TIPOS_MOV[v] ?? "ajuste";
  const k = String(v ?? "").toLowerCase();
  return (TIPOS_MOV as string[]).includes(k) ? (k as TipoMovimentoEstoque) : "ajuste";
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
    disponivel: (raw.disponivel ?? true) && (raw.estoque == null || Number(raw.estoque) > 0),
    tipo: toTipo(raw.tipo),
    itens: raw.itens,
    estoque: Number(raw.estoque ?? 0),
    estoqueMinimo: Number(raw.estoqueMinimo ?? 0),
    estoqueInformado: raw.estoque != null,
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
        disponivel: input.disponivel && (input.estoqueInicial ?? 0) > 0,
        tipo: fromTipo(input.tipo),
        itens: input.itens,
        estoqueInicial: input.estoqueInicial ?? 0,
        estoqueMinimo: input.estoqueMinimo ?? 0,
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
        disponivel: input.estoqueInformado === false || input.estoque == null ? input.disponivel : input.disponivel && input.estoque > 0,
        estoqueMinimo: input.estoqueMinimo ?? 0,
      },
    });
    return mapProduto(raw);
  },

  async getEstoque(id: string): Promise<{ estoque: number; estoqueMinimo: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await apiRequest<any>(`/produtos/${id}/estoque`);
    return { estoque: Number(raw?.estoque ?? 0), estoqueMinimo: Number(raw?.estoqueMinimo ?? 0) };
  },

  /** Enum no body como inteiro: 0=Entrada, 1=Saida, 2=Ajuste. */
  async ajustarEstoque(
    id: string,
    input: { tipo: Exclude<TipoMovimentoEstoque, "venda">; quantidade: number; observacao?: string },
  ): Promise<void> {
    validarMovimento(input.tipo, input.quantidade);
    await apiRequest(`/produtos/${id}/estoque`, {
      method: "PUT",
      json: { tipo: TIPOS_MOV.indexOf(input.tipo), quantidade: input.quantidade, observacao: input.observacao || null },
    });
  },

  async movimentos(id: string): Promise<MovimentoEstoque[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>(`/produtos/${id}/estoque/movimentos`);
    const list = Array.isArray(res) ? res : (res?.itens ?? res?.items ?? res?.data ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((m: any) => ({
      id: m.id, produtoId: m.produtoId, tipo: toTipoMov(m.tipo), quantidade: Number(m.quantidade ?? 0),
      saldoResultante: Number(m.saldoResultante ?? 0), pedidoId: m.pedidoId ?? null,
      observacao: m.observacao ?? null, data: m.data ?? "",
    }));
  },

  async estoqueBaixo(): Promise<Produto[]> {
    const res = await apiRequest<unknown>("/estoque/baixo");
    return mapPaginated(res, mapProduto, { page: 1, pageSize: 100 }).items;
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/produtos/${id}`, { method: "DELETE" });
  },
};
