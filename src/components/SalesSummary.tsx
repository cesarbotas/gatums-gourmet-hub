import { useEffect, useState } from "react";
import { DollarSign, ShoppingBag, TrendingUp, RefreshCw } from "lucide-react";
import { vendasService } from "@/lib/api/vendas";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SearchPagination } from "./SearchPagination";
import { paginateItems } from "@/lib/page-data";

export interface SalesSummaryData {
  faturamento: number;
  totalPedidos: number;
  ticketMedio: number;
  topProdutos: { produtoId?: string; nome: string; quantidade: number; total: number }[];
  serieDiaria: { data: string; faturamento: number; pedidos?: number }[];
}

export function normalizeSalesSummary(raw: Record<string, unknown>): SalesSummaryData {
  const num = (value: unknown) => Number(value ?? 0) || 0;
  const products = (raw.topProdutos ?? []) as Record<string, unknown>[];
  const days = (raw.serieDiaria ?? []) as Record<string, unknown>[];
  return {
    faturamento: num(raw.faturamento ?? raw.totalFaturamento),
    totalPedidos: num(raw.totalPedidos ?? raw.pedidos),
    ticketMedio: num(raw.ticketMedio ?? raw.ticket),
    topProdutos: products.map((p) => ({ produtoId: p.produtoId as string | undefined, nome: String(p.nome ?? p.produtoNome ?? "—"), quantidade: num(p.quantidade), total: num(p.total ?? p.faturamento) })),
    serieDiaria: days.map((d) => ({ data: String(d.data ?? d.dia ?? ""), faturamento: num(d.faturamento ?? d.total), pedidos: d.pedidos === undefined ? undefined : num(d.pedidos) })),
  };
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => { const date = new Date(value.slice(0, 10) + "T12:00:00"); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR"); };

export function SalesSummary() {
  const [summary, setSummary] = useState<SalesSummaryData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setSummary(normalizeSalesSummary(await vendasService.resumo())); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o relatório."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const products = summary?.topProdutos.filter((p) => p.nome.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const paginated = paginateItems(products, page, pageSize);
  const max = Math.max(1, ...(summary?.serieDiaria.map((day) => day.faturamento) ?? []));
  return <div className="mt-6 space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground">Resumo de vendas</h2>
      <Button variant="outline" disabled={loading} onClick={load}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Carregando relatório...</p>}
    {!loading && !error && summary && <>
      <div className="grid gap-4 sm:grid-cols-3">{[
        { label: "Faturamento", value: brl(summary.faturamento), icon: DollarSign },
        { label: "Pedidos", value: summary.totalPedidos, icon: ShoppingBag },
        { label: "Ticket médio", value: brl(summary.ticketMedio), icon: TrendingUp },
      ].map((item) => <div key={item.label} className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="flex justify-between gap-2"><p className="text-sm text-muted-foreground">{item.label}</p><item.icon className="h-5 w-5 text-accent" /></div><p className="mt-3 break-words font-display text-2xl text-foreground">{item.value}</p></div>)}</div>
      <section>
        <h3 className="text-lg font-semibold text-foreground">Faturamento diário</h3>
        {summary.serieDiaria.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Sem vendas no período.</p> : <>
          <div className="mt-4 flex h-48 items-end gap-1" role="img" aria-label="Gráfico de faturamento diário">{summary.serieDiaria.map((day) => <div key={day.data} className="min-w-0 flex-1 rounded-t bg-primary" style={{ height: `${Math.max(1, day.faturamento / max * 100)}%` }} title={`${dateLabel(day.data)}: ${brl(day.faturamento)}${day.pedidos === undefined ? "" : ` · ${day.pedidos} pedidos`}`} />)}</div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{dateLabel(summary.serieDiaria[0]?.data ?? "")}</span><span>{dateLabel(summary.serieDiaria.at(-1)?.data ?? "")}</span></div>
        </>}
      </section>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-foreground">Produtos mais vendidos</h3><Input aria-label="Buscar produto no relatório" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:w-64" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar produto..." /></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary/60 text-left text-muted-foreground"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Faturamento</th></tr></thead><tbody>{paginated.items.map((p) => <tr key={p.produtoId ?? p.nome} className="border-b border-border"><td className="px-4 py-3 text-foreground">{p.nome}</td><td className="px-4 py-3">{p.quantidade}</td><td className="whitespace-nowrap px-4 py-3">{brl(p.total)}</td></tr>)}{products.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}</tbody></table></div>
        <SearchPagination page={paginated.page} pageSize={pageSize} total={products.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
      </section>
    </>}
  </div>;
}