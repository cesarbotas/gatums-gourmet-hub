import { describe, expect, it } from "vitest";
import { changeSaleQuantity, saleTotal } from "@/lib/quick-sale";
import type { Produto } from "@/lib/api/produtos";
const p = { id: "p", disponivel: true, preco: 19.99, estoque: 3, estoqueInformado: true } as Produto;
describe("venda rápida", () => {
  it("calcula total em centavos para produtos e quantidades selecionados", () => {
    expect(saleTotal([{ produto: p, quantidade: 3 }, { produto: { ...p, id: "q", preco: 0.1 }, quantidade: 3 }])).toBe(60.27);
  });
  it("bloqueia produto indisponível", () => expect(() => changeSaleQuantity([], { ...p, disponivel: false }, 1)).toThrow("indisponível"));
  it("bloqueia quantidade maior que o saldo informado", () => expect(() => changeSaleQuantity([], p, 4)).toThrow("Estoque insuficiente"));
  it("remove produto ao reduzir para zero", () => expect(changeSaleQuantity([{ produto: p, quantidade: 1 }], p, 0)).toEqual([]));
});