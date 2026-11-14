import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, ShoppingBag, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchPagination } from "@/components/SearchPagination";
import { collectPages, paginateItems } from "@/lib/page-data";
import { pageHead } from "@/lib/route-head";
import { produtosService, produtoDisponivel, type Produto } from "@/lib/api/produtos";
import { changeSaleQuantity, saleTotal, type SaleLine } from "@/lib/quick-sale";

export const Route = createFileRoute("/_authenticated/admin/venda-rapida")({
  head: () => pageHead("Venda rápida — Gatums Gourmet", "Selecione produtos e apresente o total de atendimento presencial da Gatums Gourmet."),
  component: VendaRapidaPage,
});

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function VendaRapidaPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [showTotal, setShowTotal] = useState(false);
  const [cliente, setCliente] = useState("");
  useEffect(() => {
    collectPages((page) => produtosService.list({ page, pageSize: 100 })).then(setProdutos).catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o catálogo.")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { setPage(1); }, [search, categoria]);
  const change = (p: Produto, qtd: number) => {
    try { setLines(changeSaleQuantity(lines, p, qtd)); } catch (err) { toast.error(err instanceof Error ? err.message : "Quantidade inválida."); }
  };
  const categories = Array.from(new Set(produtos.map((p) => p.categoriaNome).filter(Boolean))).sort();
  const filtered = produtos.filter((p) => `${p.nome} ${p.descricao}`.toLowerCase().includes(search.trim().toLowerCase()) && (categoria === "todas" || p.categoriaNome === categoria));
  const paged = paginateItems(filtered, page, pageSize);
  const total = saleTotal(lines);
  const count = lines.reduce((n, line) => n + line.quantidade, 0);
  return <div className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl text-foreground">Venda rápida</h1>{review ? <Button variant="outline" onClick={() => setReview(false)}><ArrowLeft className="h-4 w-4" /> Produtos</Button> : <Button variant="outline" disabled={!lines.length} onClick={() => { if (confirm("Limpar os produtos desta venda?")) { setLines([]); setCliente(""); } }}><Trash2 className="h-4 w-4" /> Limpar venda</Button>}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0">
        {!review ? <>
          <div className="search-filters grid gap-3 sm:grid-cols-2"><Input aria-label="Pesquisar produtos para venda" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={categoria} onValueChange={setCategoria}><SelectTrigger aria-label="Categoria da venda"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          {loading ? <p role="status" className="mt-6 text-muted-foreground">Carregando catálogo...</p> : error ? <p role="alert" className="mt-6 text-destructive">{error}</p> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {paged.items.map((p) => { const available = produtoDisponivel(p); const qtd = lines.find((line) => line.produto.id === p.id)?.quantidade ?? 0; return <article key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-[3/2] bg-muted">{p.foto ? <img src={p.foto} alt={p.nome} className={`h-full w-full object-cover ${available ? "" : "grayscale"}`} /> : <ShoppingBag className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}{!available && <span className="absolute left-3 top-3 rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground">Indisponível</span>}</div>
              <div className="p-4"><h2 className="font-sans text-base font-semibold text-foreground">{p.nome}</h2><p className="mt-1 text-xs text-muted-foreground">{p.categoriaNome}{p.estoqueInformado !== false ? ` · ${p.estoque} un.` : ""}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-foreground">{currency(p.preco)}</span><Button size="sm" disabled={!available || (p.estoqueInformado !== false && qtd >= p.estoque)} onClick={() => change(p, qtd + 1)}><Plus className="h-4 w-4" /> Adicionar</Button></div></div>
            </article>; })}
            {!filtered.length && <p className="text-muted-foreground">Nenhum produto encontrado.</p>}
          </div>}
          <SearchPagination page={paged.page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </> : <>
          <h2 className="font-display text-2xl text-foreground">Conferência da venda</h2>
          <div className="mt-4"><Label htmlFor="sale-customer">Nome do cliente (opcional)</Label><Input id="sale-customer" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
          <ul className="mt-5 divide-y divide-border">{lines.map((line) => <li key={line.produto.id} className="flex justify-between gap-3 py-3 text-sm"><span>{line.produto.nome} × {line.quantidade}</span><span className="shrink-0 font-medium">{currency(line.produto.preco * line.quantidade)}</span></li>)}</ul>
          <div className="mt-6 border-t border-border pt-5"><p role="alert" className="text-sm text-destructive">O pagamento presencial ainda não está disponível na API para administradores. Esta seleção não registra venda, não baixa estoque e não gera cobrança.</p><Button className="mt-4" disabled><CreditCard className="h-4 w-4" /> Pagamento aguardando API</Button></div>
        </>}
      </section>
      <aside className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <h2 className="font-display text-xl text-foreground">Venda atual</h2><p className="mt-1 text-sm text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</p>
        <ul className="mt-3 divide-y divide-border">{lines.map((line) => <li key={line.produto.id} className="py-3"><p className="text-sm font-medium text-foreground">{line.produto.nome}</p><div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label={`Diminuir ${line.produto.nome}`} onClick={() => change(line.produto, line.quantidade - 1)}><Minus className="h-4 w-4" /></Button><span className="w-6 text-center text-sm">{line.quantidade}</span><Button size="icon" variant="outline" disabled={line.produto.estoqueInformado !== false && line.quantidade >= line.produto.estoque} aria-label={`Aumentar ${line.produto.nome}`} onClick={() => change(line.produto, line.quantidade + 1)}><Plus className="h-4 w-4" /></Button></div><span className="text-sm font-medium">{currency(line.produto.preco * line.quantidade)}</span></div></li>)}{!lines.length && <li className="py-6 text-sm text-muted-foreground">Nenhum produto selecionado.</li>}</ul>
        <div className="mt-5 border-t border-border pt-4"><p className="text-sm text-muted-foreground">Total</p><p className="mt-1 font-display text-3xl text-foreground">{currency(total)}</p><Button className="mt-4 w-full" disabled={!lines.length} onClick={() => setReview(true)}><CreditCard className="h-4 w-4" /> Seguir para pagamento</Button><Button variant="outline" className="mt-2 w-full" disabled={!lines.length} onClick={() => setShowTotal(true)}>Apresentar valor</Button></div>
      </aside>
    </div>
    <Dialog open={showTotal} onOpenChange={setShowTotal}><DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><DialogTitle>Gatums Gourmet</DialogTitle><DialogDescription>{cliente || "Atendimento presencial"} · {count} {count === 1 ? "item" : "itens"}</DialogDescription><p className="py-8 text-center font-display text-4xl text-foreground">{currency(total)}</p><p className="text-center text-sm text-muted-foreground">Total a pagar · pagamento não iniciado</p></DialogContent></Dialog>
  </div>;
}