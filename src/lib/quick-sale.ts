import { produtoDisponivel, type Produto } from "@/lib/api/produtos";

export interface SaleLine { produto: Produto; quantidade: number }

export function changeSaleQuantity(lines: SaleLine[], produto: Produto, quantidade: number): SaleLine[] {
  if (!Number.isInteger(quantidade) || quantidade < 0) throw new Error("Quantidade inválida.");
  if (quantidade > 0 && !produtoDisponivel(produto)) throw new Error("Produto indisponível.");
  if (produto.estoqueInformado !== false && quantidade > produto.estoque) throw new Error(`Estoque insuficiente. Disponível: ${produto.estoque}.`);
  const rest = lines.filter((line) => line.produto.id !== produto.id);
  return quantidade === 0 ? rest : [...rest, { produto, quantidade }];
}

export function saleTotal(lines: SaleLine[]): number {
  return lines.reduce((total, line) => total + Math.round(line.produto.preco * 100) * line.quantidade, 0) / 100;
}