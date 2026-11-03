import { describe, it, expect } from "vitest";
import { buildApiBaseUrl, mapPaginated, appendPageParams } from "@/lib/api/config";

describe("buildApiBaseUrl", () => {
  it("compoe /api/<versao> em raiz limpa", () => {
    expect(buildApiBaseUrl("http://localhost:5166", "v1")).toBe("http://localhost:5166/api/v1");
  });
  it("respeita raiz que ja inclui /api/vN", () => {
    expect(buildApiBaseUrl("http://x/api/v1", "v2")).toBe("http://x/api/v1");
  });
  it("anexa versao quando raiz termina em /api", () => {
    expect(buildApiBaseUrl("http://x/api", "v1")).toBe("http://x/api/v1");
  });
  it("remove barra final antes de compor", () => {
    expect(buildApiBaseUrl("http://x/", "v1")).toBe("http://x/api/v1");
  });
});

describe("appendPageParams", () => {
  it("usa defaults 1/10 e seta pagina/tamanho", () => {
    const qs = new URLSearchParams();
    const r = appendPageParams(qs);
    expect(qs.get("pagina")).toBe("1");
    expect(qs.get("tamanho")).toBe("10");
    expect(r).toEqual({ page: 1, pageSize: 10 });
  });
});

describe("mapPaginated", () => {
  it("traduz itens/totalRegistros e aplica mapItem", () => {
    const res = { itens: [{ n: 1 }], totalRegistros: 1, paginaAtual: 2, tamanhoPagina: 25 };
    const out = mapPaginated(res, (raw: unknown) => (raw as { n: number }).n, { page: 1, pageSize: 10 });
    expect(out).toEqual({ items: [1], total: 1, page: 2, pageSize: 25 });
  });
});
