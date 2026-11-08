import { describe, expect, it } from "vitest";
import { normalizeSalesSummary } from "@/components/SalesSummary";

describe("resumo de vendas da API", () => {
  it("preserva os totais e os dados diários fornecidos pela API", () => {
    const result = normalizeSalesSummary({ faturamento: 18120, totalPedidos: 302, ticketMedio: 60, topProdutos: [{ produtoId: "p1", nome: "Produto", quantidade: 2, total: 120 }], serieDiaria: [{ data: "2026-11-01", faturamento: 120, pedidos: 2 }] });
    expect(result.faturamento).toBe(18120); expect(result.totalPedidos).toBe(302); expect(result.ticketMedio).toBe(60);
    expect(result.serieDiaria[0]).toEqual({ data: "2026-11-01", faturamento: 120, pedidos: 2 });
    expect(result.topProdutos[0].total).toBe(120);
  });
});