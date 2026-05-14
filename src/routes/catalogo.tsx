import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { produtosService, type Produto } from "@/lib/api";

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

function CatalogoPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("Todas");

  useEffect(() => {
    produtosService.list({ pageSize: 100, search }).then((r) => setItems(r.items));
  }, [search]);

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(items.map((i) => i.categoria)))],
    [items],
  );

  const visiveis = items.filter((p) => categoria === "Todas" || p.categoria === categoria);

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

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou categoria..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={c === categoria ? "default" : "outline"}
                    onClick={() => setCategoria(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          {visiveis.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visiveis.map((p) => (
                <article
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-warm"
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
                  </div>
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-wide text-accent">{p.categoria}</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{p.nome}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.descricao}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-display text-xl text-foreground">
                        R$ {p.preco.toFixed(2)}
                      </span>
                      <Button size="sm" disabled={!p.disponivel}>
                        {p.disponivel ? "Encomendar" : "Indisponível"}
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
