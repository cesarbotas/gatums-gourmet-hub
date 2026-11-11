import { describe, it, expect } from "vitest";
import { estoqueBaixo, produtoDisponivel, validarMovimento } from "@/lib/api/produtos";
import { produtosBaixosNoPedido } from "@/lib/order-stock";
import type { Produto } from "@/lib/api/produtos";

describe("estoqueBaixo", () => {
  it("alerta quando estoque é igual ao mínimo", () => expect(estoqueBaixo({ estoque: 5, estoqueMinimo: 5 })).toBe(true));
  it("não alerta acima do mínimo", () => expect(estoqueBaixo({ estoque: 6, estoqueMinimo: 5 })).toBe(false));
});

describe("disponibilidade por saldo", () => {
  it("estoque zero impede venda mesmo com disponibilidade ativa", () => {
    expect(produtoDisponivel({ disponivel: true, estoque: 0, estoqueInformado: true })).toBe(false);
  });
  it("não inventa saldo zero quando API antiga não informa estoque", () => {
    expect(produtoDisponivel({ disponivel: true, estoque: 0, estoqueInformado: false })).toBe(true);
  });
  it("reposição não ativa produto desativado manualmente", () => {
    expect(produtoDisponivel({ disponivel: false, estoque: 12 })).toBe(false);
  });
});

describe("movimentos", () => {
  it("entrada exige quantidade inteira positiva", () => {
    expect(() => validarMovimento("entrada", 0)).toThrow();
    expect(() => validarMovimento("entrada", 1.5)).toThrow();
    expect(() => validarMovimento("entrada", 3)).not.toThrow();
  });
  it("saída exige quantidade inteira positiva", () => {
    expect(() => validarMovimento("saida", -3)).toThrow();
    expect(() => validarMovimento("saida", 3)).not.toThrow();
  });
  it("ajuste aceita inteiro negativo sem aceitar zero", () => {
    expect(() => validarMovimento("ajuste", -2)).not.toThrow();
    expect(() => validarMovimento("ajuste", 0)).toThrow();
  });
});

describe("alerta em pedidos", () => {
  it("marca apenas itens do pedido cujo saldo atual chegou ao mínimo", () => {
    const produtos = [
      { id: "baixo", estoque: 2, estoqueMinimo: 2 },
      { id: "normal", estoque: 3, estoqueMinimo: 2 },
      { id: "outro", estoque: 0, estoqueMinimo: 2 },
      { id: "antigo", estoque: 0, estoqueMinimo: 2, estoqueInformado: false },
    ] as Produto[];
    expect(produtosBaixosNoPedido([{ produtoId: "baixo" }, { produtoId: "normal" }, { produtoId: "antigo" }], produtos).map((p) => p.id)).toEqual(["baixo"]);
  });
});
