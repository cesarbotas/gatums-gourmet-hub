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
  const { user } = useAuth();
  const userId = user?.id ?? "guest";
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(cartService.get(userId));
  }, [userId]);

  const add = useCallback(
    (p: Produto, qtd = 1) => {
      cartService.add(userId, p, qtd).then(setItems);
    },
    [userId],
  );
  const setQty = useCallback(
    (produtoId: string, qtd: number) => setItems(cartService.setQty(userId, produtoId, qtd)),
    [userId],
  );
  const remove = useCallback(
    (produtoId: string) => setItems(cartService.remove(userId, produtoId)),
    [userId],
  );
  const clear = useCallback(() => {
    cartService.clear(userId);
    setItems([]);
  }, [userId]);
  const checkout = useCallback(async () => {
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
