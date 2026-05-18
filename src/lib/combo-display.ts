import type { ItemCombo, Produto } from "@/lib/api/produtos";

export interface ComboItemResolvido {
  produtoId: string;
  nome: string;
  quantidade: number;
}

export function resolveComboItens(produto: Produto, catalogo: Produto[]): ComboItemResolvido[] {
  if (produto.tipo !== "combo" || !produto.itens?.length) return [];
  return produto.itens.map((item: ItemCombo) => ({
    produtoId: item.produtoId,
    nome: catalogo.find((p) => p.id === item.produtoId)?.nome ?? "Produto removido",
    quantidade: item.quantidade,
  }));
}
