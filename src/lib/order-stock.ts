import { estoqueBaixo, type Produto } from "@/lib/api/produtos";

/** Current balance warning, not a second stock debit (checkout already debits). */
export function produtosBaixosNoPedido(itens: { produtoId: string }[], produtos: Produto[]): Produto[] {
  const ids = new Set(itens.map((i) => i.produtoId));
  return produtos.filter((p) => ids.has(p.id) && p.estoqueInformado !== false && estoqueBaixo(p));
}