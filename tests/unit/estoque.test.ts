import { describe, it, expect } from "vitest";
import { estoqueBaixo } from "@/lib/api/produtos";

describe("estoqueBaixo", () => {
  it("alerta quando estoque é igual ao mínimo", () => expect(estoqueBaixo({ estoque: 5, estoqueMinimo: 5 })).toBe(true));
  it("não alerta acima do mínimo", () => expect(estoqueBaixo({ estoque: 6, estoqueMinimo: 5 })).toBe(false));
});
