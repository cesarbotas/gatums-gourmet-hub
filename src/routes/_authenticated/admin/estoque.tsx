import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchPagination } from "@/components/SearchPagination";
import { collectPages, paginateItems } from "@/lib/page-data";
import { pageHead } from "@/lib/route-head";
import { produtosService, estoqueBaixo, type Produto, type MovimentoEstoque, type TipoMovimentoEstoque } from "@/lib/api/produtos";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  head: () => pageHead("Controle de estoque — Gatums Gourmet", "Consulte saldos, estoque mínimo e movimentos dos produtos da Gatums Gourmet."),
  component: EstoquePage,
});

function EstoquePage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Produto | null>(null);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState(10);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [tipo, setTipo] = useState<Exclude<TipoMovimentoEstoque, "venda">>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const all = await collectPages((page) => produtosService.list({ page, pageSize: 100 }));
      setItems(all);
      if (all.some((p) => p.estoqueInformado === false)) setError("A API ainda não informa o estoque dos produtos. Saldos e ajustes aguardam a publicação dos endpoints de estoque.");
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao consultar estoque."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { setPage(1); }, [search, status]);

  const open = async (p: Produto) => {
    setSelected(p); setDetailLoading(true); setDetailError(""); setMovimentos([]); setHistoryPage(1);
    setQuantidade(""); setObservacao(""); setTipo("entrada");
    try {
      const [saldo, history] = await Promise.all([produtosService.getEstoque(p.id), produtosService.movimentos(p.id)]);
      setSelected({ ...p, ...saldo, estoqueInformado: true }); setMovimentos(history);
    } catch (err) { setDetailError(err instanceof Error ? err.message : "Saldo e histórico indisponíveis."); }
    finally { setDetailLoading(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected || saving || detailError) return;
    setSaving(true);
    try {
      await produtosService.ajustarEstoque(selected.id, { tipo, quantidade: Number(quantidade), observacao: observacao.trim() });
      toast.success("Movimento registrado."); await open(selected); await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao ajustar estoque."); }
    finally { setSaving(false); }
  };
  const filtered = items.filter((p) => p.nome.toLowerCase().includes(search.trim().toLowerCase()) && (status === "todos" || (p.estoqueInformado !== false && (status === "zero" ? p.estoque === 0 : status === "baixo" ? estoqueBaixo(p) : !estoqueBaixo(p)))));
  const paged = paginateItems(filtered, page, pageSize);
  const history = paginateItems(movimentos, historyPage, historySize);
  return <div className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl text-foreground">Controle de estoque</h1>
      {selected ? <Button variant="outline" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" /> Voltar</Button> : <Button variant="outline" disabled={loading} onClick={() => void reload()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {!selected ? <>
      <div className="search-filters mt-6 grid gap-3 sm:grid-cols-2">
        <Input aria-label="Pesquisar estoque" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtrar estoque"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os saldos</SelectItem><SelectItem value="baixo">Estoque baixo</SelectItem><SelectItem value="zero">Sem estoque</SelectItem><SelectItem value="normal">Acima do mínimo</SelectItem></SelectContent></Select>
        {(search || status !== "todos") && <Button variant="ghost" onClick={() => { setSearch(""); setStatus("todos"); }}>Limpar filtros</Button>}
      </div>
      {loading ? <p role="status" className="mt-6 text-muted-foreground">Consultando estoque...</p> : <ul className="mt-6 divide-y divide-border">
        {paged.items.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0"><p className="font-medium text-foreground">{p.nome}</p><p className="text-sm text-muted-foreground">{p.categoriaNome}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className={p.estoqueInformado !== false && estoqueBaixo(p) ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{p.estoqueInformado === false ? "Saldo não informado" : `${p.estoque} un. · Mínimo ${p.estoqueMinimo}${estoqueBaixo(p) ? " · Estoque baixo" : ""}`}</span><Button variant="outline" onClick={() => void open(p)} aria-label={`Controlar estoque de ${p.nome}`}><Boxes className="h-4 w-4" /> Controlar</Button></div>
        </li>)}
        {!filtered.length && <li className="py-8 text-muted-foreground">Nenhum produto encontrado.</li>}
      </ul>}
      <SearchPagination page={paged.page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
    </> : <div className="mt-6">
      <h2 className="font-display text-2xl text-foreground">{selected.nome}</h2>
      {detailLoading ? <p role="status" className="mt-4 text-muted-foreground">Carregando saldo e histórico...</p> : detailError ? <p role="alert" className="mt-4 text-destructive">Consulta de estoque indisponível: {detailError}</p> : <>
        <p className="mt-2 text-muted-foreground">Saldo: {selected.estoque} un. · Mínimo: {selected.estoqueMinimo}</p>
        <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div><Label htmlFor="stock-type">Movimento</Label><Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}><SelectTrigger id="stock-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem><SelectItem value="ajuste">Ajuste (+/-)</SelectItem></SelectContent></Select></div>
          <div><Label htmlFor="stock-qty">Quantidade</Label><Input id="stock-qty" type="number" step={1} min={tipo === "ajuste" ? undefined : 1} required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
          <div><Label htmlFor="stock-note">Observação</Label><Input id="stock-note" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <Button className="self-end" disabled={saving}>{saving ? "Registrando..." : "Registrar movimento"}</Button>
        </form>
        <h3 className="mt-8 font-display text-xl text-foreground">Histórico de movimentos</h3>
        <ul className="mt-3 divide-y divide-border">{history.items.map((m) => <li key={m.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-foreground">{m.tipo === "saida" ? "Saída" : m.tipo === "entrada" ? "Entrada" : m.tipo === "venda" ? "Venda" : "Ajuste"} · {m.quantidade} un. · Saldo {m.saldoResultante}</span><span className="text-muted-foreground">{m.data ? new Date(m.data).toLocaleString("pt-BR") : "—"}</span></div>{m.observacao && <p className="mt-1 break-words text-muted-foreground">{m.observacao}</p>}{m.pedidoId && <p className="text-xs text-muted-foreground">Pedido #{m.pedidoId.slice(0, 6).toUpperCase()}</p>}</li>)}{!movimentos.length && <li className="py-6 text-sm text-muted-foreground">Nenhum movimento registrado.</li>}</ul>
        <SearchPagination page={history.page} pageSize={historySize} total={movimentos.length} onPage={setHistoryPage} onPageSize={(n) => { setHistorySize(n); setHistoryPage(1); }} />
      </>}
    </div>}
  </div>;
}