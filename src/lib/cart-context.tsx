import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cartService, type CartItem, type Pedido } from "@/lib/api/carrinho";
import type { Produto } from "@/lib/api/produtos";
import { useAuth } from "@/lib/auth-context";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Produto, qtd?: number) => void;
  setQty: (produtoId: string, qtd: number) => void;
  remove: (produtoId: string) => void;
  clear: () => void;
  checkout: () => Promise<Pedido>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { setItems([]); return; }
    cartService.getRemote().then(setItems).catch(() => setItems([]));
  }, [isAuthenticated]);

  const add = useCallback(
    (p: Produto, qtd = 1) => {
      cartService.add(user?.id ?? "guest", p, qtd).then(setItems).catch(console.error);
    },
    [user],
  );

  const setQty = useCallback((produtoId: string, qtd: number) => {
    cartService.setQtyRemote(produtoId, qtd).then(setItems).catch(console.error);
  }, []);

  const remove = useCallback((produtoId: string) => {
    cartService.removeRemote(produtoId).then(setItems).catch(console.error);
  }, []);

  const clear = useCallback(() => {
    cartService.clearRemote().then(() => setItems([])).catch(console.error);
  }, []);

  const checkout = useCallback(async (): Promise<Pedido> => {
    if (!user) throw new Error("Faça login para finalizar a compra");
    const p = await cartService.checkout(user.id, user.nome);
    setItems([]);
    return p;
  }, [user]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.quantidade, 0),
      total: cartService.total(items),
      add,
      setQty,
      remove,
      clear,
      checkout,
    }),
    [items, add, setQty, remove, clear, checkout],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
