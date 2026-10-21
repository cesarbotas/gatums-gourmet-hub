import { apiRequest } from "./client";
import { produtosService, type Produto } from "./produtos";
import { pedidosService, type Pedido } from "./pedidos";

export type { Pedido } from "./pedidos";

export interface CartItem {
  produtoId: string;
  nome: string;
  preco: number;
  foto: string;
  quantidade: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(raw: any): CartItem {
  return {
    produtoId: raw.produtoId ?? raw.produto?.id ?? "",
    nome: raw.nome ?? raw.produto?.nome ?? "",
    preco: raw.preco ?? raw.produto?.preco ?? 0,
    foto: raw.foto ?? raw.produto?.fotoUrl ?? raw.produto?.foto ?? "",
    quantidade: raw.quantidade ?? 1,
  };
}

export const cartService = {
  async getRemote(): Promise<CartItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<any>("/carrinho");
    return (res.itens ?? res.items ?? []).map(mapItem);
  },

  // Kept for sync access in cart-context; falls back to empty until loaded
  get(_userId: string): CartItem[] {
    return [];
  },

  set(_userId: string, _items: CartItem[]) {
    // no-op: state managed by API
  },

  async add(_userId: string, produto: Produto, qtd = 1): Promise<CartItem[]> {
    await apiRequest("/carrinho/itens", {
      method: "POST",
      json: { produtoId: produto.id, quantidade: qtd },
    });
    return cartService.getRemote();
  },

  async setQtyRemote(produtoId: string, qtd: number): Promise<CartItem[]> {
    if (qtd <= 0) {
      await apiRequest(`/carrinho/itens/${produtoId}`, { method: "DELETE" });
    } else {
      await apiRequest(`/carrinho/itens/${produtoId}`, {
        method: "PATCH",
        json: { quantidade: qtd },
      });
    }
    return cartService.getRemote();
  },

  setQty(_userId: string, produtoId: string, qtd: number): CartItem[] {
    // sync stub — cart-context will call setQtyRemote
    return [];
  },

  async removeRemote(produtoId: string): Promise<CartItem[]> {
    await apiRequest(`/carrinho/itens/${produtoId}`, { method: "DELETE" });
    return cartService.getRemote();
  },

  remove(_userId: string, _produtoId: string): CartItem[] {
    return [];
  },

  async clearRemote(): Promise<void> {
    await apiRequest("/carrinho", { method: "DELETE" });
  },

  clear(_userId: string) {
    // no-op
  },

  total(items: CartItem[]): number {
    return items.reduce((s, i) => s + i.preco * i.quantidade, 0);
  },

  async checkout(_userId: string, clienteNome: string): Promise<Pedido> {
    // A API retorna 201 { pedidoId } — buscamos o pedido completo em seguida.
    const raw = await apiRequest<{ pedidoId: string }>("/pedidos/checkout", {
      method: "POST",
      json: { clienteNome },
    });
    const pedido = await pedidosService.getById(raw.pedidoId);
    if (!pedido) throw new Error("Pedido criado, mas não foi possível carregá-lo.");
    return pedido;
  },

  pedidosByUser(_userId: string): Pedido[] {
    return [];
  },

  pedidosAll(): Pedido[] {
    return [];
  },
};

export { produtosService };
