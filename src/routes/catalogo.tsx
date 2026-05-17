import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart, X, Package, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { produtosService, CATEGORIAS, type Produto } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Gatums Gourmet" },
      {
        name: "description",
        content: "Conheça todos os produtos artesanais da Gatums Gourmet.",
      },
    ],
  }),
  component: CatalogoPage,
});

type Ordem = "nome" | "preco-asc" | "preco-desc";

function CatalogoPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("Todas");
  const [tipo, setTipo] = useState<"todos" | "simples" | "combo">("todos");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [soDisponiveis, setSoDisponiveis] = useState(true);
  const [maxPreco, setMaxPreco] = useState<number | null>(null);

  const { isAuthenticated, isAdmin } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    produtosService.list({ pageSize: 500 }).then((r) => setItems(r.items));
  }, []);

  const precoMaximo = useMemo(
    () => Math.ceil(items.reduce((m, p) => Math.max(m, p.preco), 0)),
    [items],
  );

  const visiveis = useMemo(() => {
    const s = search.toLowerCase().trim();
    let list = items.filter((p) => {
      if (categoria !== "Todas" && p.categoria !== categoria) return false;
      if (tipo !== "todos" && p.tipo !== tipo) return false;
      if (soDisponiveis && !p.disponivel) return false;
      if (maxPreco !== null && p.preco > maxPreco) return false;
      if (s && !(p.nome.toLowerCase().includes(s) || p.descricao.toLowerCase().includes(s) || p.categoria.toLowerCase().includes(s))) return false;
      return true;
    });
    list = list.sort((a, b) => {
      if (ordem === "preco-asc") return a.preco - b.preco;
      if (ordem === "preco-desc") return b.preco - a.preco;
      return a.nome.localeCompare(b.nome);
    });
    return list;
  }, [items, search, categoria, tipo, soDisponiveis, maxPreco, ordem]);

  const handleAdd = (p: Produto) => {
    if (!isAuthenticated) {
      toast.info("Faça login para adicionar ao carrinho.");
      navigate({ to: "/login" });
      return;
    }
    if (isAdmin) {
      toast.error("Use uma conta de cliente para comprar.");
      return;
    }
    add(p, 1);
    toast.success(`${p.nome} adicionado ao carrinho.`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoria("Todas");
    setTipo("todos");
    setOrdem("nome");
    setSoDisponiveis(true);
    setMaxPreco(null);
  };

  const filtrosAtivos =
    !!search || categoria !== "Todas" || tipo !== "todos" || !soDisponiveis || maxPreco !== null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h1 className="font-display text-4xl text-foreground">Catálogo completo</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Explore nossas receitas e encomende seus favoritos.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, descrição ou categoria..."
                  className="pl-9"
                />
              </div>
              <div className="md:col-span-3">
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todas">Todas as categorias</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="simples">Produtos</SelectItem>
                    <SelectItem value="combo">Combos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome (A-Z)</SelectItem>
                    <SelectItem value="preco-asc">Menor preço</SelectItem>
                    <SelectItem value="preco-desc">Maior preço</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-4 md:col-span-12">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={soDisponiveis}
                    onChange={(e) => setSoDisponiveis(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Apenas disponíveis
                </label>
                {precoMaximo > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Preço até</span>
                    <input
                      type="range"
                      min={0}
                      max={precoMaximo}
                      value={maxPreco ?? precoMaximo}
                      onChange={(e) => setMaxPreco(Number(e.target.value))}
                      className="w-40 accent-primary"
                    />
                    <span className="font-medium text-foreground">
                      R$ {(maxPreco ?? precoMaximo).toFixed(0)}
                    </span>
                  </div>
                )}
                {filtrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" /> Limpar filtros
                  </Button>
                )}
                <span className="ml-auto text-sm text-muted-foreground">
                  {visiveis.length} {visiveis.length === 1 ? "item" : "itens"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          {visiveis.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">Nenhum produto encontrado com os filtros atuais.</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visiveis.map((p) => (
                <article
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-warm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={p.foto}
                      alt={p.nome}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {!p.disponivel && (
                      <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
                        Esgotado
                      </span>
                    )}
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground">
                      {p.tipo === "combo" ? <Boxes className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                      {p.tipo === "combo" ? "Combo" : "Produto"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs uppercase tracking-wide text-accent">{p.categoria}</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{p.nome}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descricao}</p>
                    {p.tipo === "combo" && (p.itens?.length ?? 0) > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Inclui {p.itens!.length} {p.itens!.length === 1 ? "item" : "itens"}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <span className="font-display text-xl text-foreground">
                        R$ {p.preco.toFixed(2)}
                      </span>
                      <Button size="sm" disabled={!p.disponivel} onClick={() => handleAdd(p)}>
                        <ShoppingCart className="h-4 w-4" /> Adicionar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

// silence unused import warning in some bundlers
void Link;
