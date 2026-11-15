import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { produtosService } from "@/lib/api/produtos";

const fetchMock = vi.fn();
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
beforeEach(() => { window.localStorage.clear(); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe("contrato de estoque", () => {
  it("normaliza estoque zero como indisponível", async () => {
    fetchMock.mockResolvedValue(response({ itens: [{ id: "p", estoque: 0, estoqueMinimo: 3, disponivel: true }], totalRegistros: 1 }));
    const res = await produtosService.list();
    expect(res.items[0]).toMatchObject({ disponivel: false, estoque: 0, estoqueInformado: true });
  });
  it("criação sem saldo envia indisponível para API", async () => {
    fetchMock.mockResolvedValue(response({ id: "p" }));
    await produtosService.create({ nome: "Teste", descricao: "", categoriaId: 1, categoriaNome: "", preco: 10, foto: "", disponivel: true, tipo: "simples", estoque: 0, estoqueMinimo: 2, estoqueInicial: 0 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ disponivel: false, estoqueInicial: 0, estoqueMinimo: 2 });
  });
  it("edição com saldo zero envia indisponível", async () => {
    fetchMock.mockResolvedValue(response({ id: "p" }));
    await produtosService.update("p", { disponivel: true, estoque: 0, estoqueInformado: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).disponivel).toBe(false);
  });
  it.each([["entrada", 0], ["saida", 1], ["ajuste", 2]] as const)("envia enum inteiro para %s", async (tipo, valor) => {
    fetchMock.mockResolvedValue(response({}));
    await produtosService.ajustarEstoque("p", { tipo, quantidade: tipo === "ajuste" ? -2 : 2, observacao: "Conferência" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/produtos/p/estoque");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tipo: valor, quantidade: tipo === "ajuste" ? -2 : 2, observacao: "Conferência" });
  });
  it("consulta produtos abaixo do mínimo no endpoint documentado", async () => {
    fetchMock.mockResolvedValue(response([{ id: "p", estoque: 2, estoqueMinimo: 3 }]));
    expect(await produtosService.estoqueBaixo()).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/estoque/baixo");
  });
  it("normaliza histórico paginado com itens e enum de venda", async () => {
    fetchMock.mockResolvedValue(response({ itens: [{ id: "m", produtoId: "p", tipo: 3, quantidade: -2, saldoResultante: 0 }] }));
    expect(await produtosService.movimentos("p")).toEqual([expect.objectContaining({ tipo: "venda", quantidade: -2, saldoResultante: 0 })]);
  });
});