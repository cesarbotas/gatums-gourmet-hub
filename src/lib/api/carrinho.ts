// Carrinho por cliente (mock, persistido por userId no localStorage).
import { readStore, writeStore, uid } from "./storage";
import { produtosService, type Produto } from "./produtos";

const cartKey = (userId: string) => `gg.cart.${userId}`;
const VENDAS_KEY = "gg.vendas";

export interface CartItem {
  produtoId: string;
  nome: string;
  preco: number;
  foto: string;
  quantidade: number;
}

export interface Pedido {
  id: string;
  userId: string;
  clienteNome: string;
  itens: CartItem[];
  total: number;
  data: string;
  status: "recebido" | "preparando" | "entregue";
}

const PEDIDOS_KEY = "gg.pedidos";

export const cartService = {
  get(userId: string): CartItem[] {
    return readStore<CartItem[]>(cartKey(userId), []);
  },
  set(userId: string, items: CartItem[]) {
    writeStore(cartKey(userId), items);
  },
  async add(userId: string, produto: Produto, qtd = 1) {
    const items = cartService.get(userId);
    const idx = items.findIndex((i) => i.produtoId === produto.id);
    if (idx >= 0) items[idx].quantidade += qtd;
    else
      items.push({
        produtoId: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        foto: produto.foto,
        quantidade: qtd,
      });
    cartService.set(userId, items);
    return items;
  },
  setQty(userId: string, produtoId: string, qtd: number) {
    const items = cartService
      .get(userId)
      .map((i) => (i.produtoId === produtoId ? { ...i, quantidade: qtd } : i))
      .filter((i) => i.quantidade > 0);
    cartService.set(userId, items);
    return items;
  },
  remove(userId: string, produtoId: string) {
    const items = cartService.get(userId).filter((i) => i.produtoId !== produtoId);
    cartService.set(userId, items);
    return items;
  },
  clear(userId: string) {
    cartService.set(userId, []);
  },
  total(items: CartItem[]) {
    return items.reduce((s, i) => s + i.preco * i.quantidade, 0);
  },

  async checkout(userId: string, clienteNome: string): Promise<Pedido> {
    const items = cartService.get(userId);
    if (items.length === 0) throw new Error("Carrinho vazio");
    const total = cartService.total(items);
    const pedido: Pedido = {
      id: uid(),
      userId,
      clienteNome,
      itens: items,
      total,
      data: new Date().toISOString(),
      status: "recebido",
    };
    const pedidos = readStore<Pedido[]>(PEDIDOS_KEY, []);
    writeStore(PEDIDOS_KEY, [pedido, ...pedidos]);

    // refletir nas vendas para o relatório admin
    const vendas = readStore<unknown[]>(VENDAS_KEY, []);
    const novasVendas = items.map((i) => ({
      id: uid(),
      produtoId: i.produtoId,
      produtoNome: i.nome,
      quantidade: i.quantidade,
      total: i.preco * i.quantidade,
      data: pedido.data,
    }));
    writeStore(VENDAS_KEY, [...novasVendas, ...vendas]);

    cartService.clear(userId);
    return pedido;
  },

  pedidosByUser(userId: string): Pedido[] {
    return readStore<Pedido[]>(PEDIDOS_KEY, []).filter((p) => p.userId === userId);
  },
  pedidosAll(): Pedido[] {
    return readStore<Pedido[]>(PEDIDOS_KEY, []);
  },
};

export { produtosService };
