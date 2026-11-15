import { describe, expect, it } from "vitest";
import { collectPages, paginateItems } from "@/lib/page-data";

describe("paginação das pesquisas", () => {
  it("mostra 10 itens por página e inclui o restante na segunda", () => {
    const rows = Array.from({ length: 13 }, (_, i) => i + 1);
    expect(paginateItems(rows, 1, 10).items).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(paginateItems(rows, 2, 10).items).toEqual([11,12,13]);
  });
  it("ajusta a página quando um filtro reduz a quantidade de resultados", () => {
    expect(paginateItems(["Ana"], 3, 10)).toEqual({ items: ["Ana"], page: 1, totalPages: 1 });
  });
  it("carrega todas as páginas antes de pesquisar localmente", async () => {
    const requested: number[] = [];
    const rows = await collectPages(async (page) => { requested.push(page); return { items: page === 1 ? [1, 2] : [3], total: 3, page, pageSize: 2 }; });
    expect(rows).toEqual([1, 2, 3]); expect(requested).toEqual([1, 2]);
  });
});