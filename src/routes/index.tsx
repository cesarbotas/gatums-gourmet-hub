import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Leaf, Award } from "lucide-react";
import heroImage from "@/assets/hero-gourmet.jpg";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { produtosService, type Produto } from "@/lib/api";
import { resolveComboItens } from "@/lib/combo-display";
import { ComboItensList } from "@/components/ComboItensList";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gatums Gourmet — Produtos artesanais com alma" },
      {
        name: "description",
        content:
          "Geleias, doces, pães e patês artesanais. Conheça o catálogo Gatums Gourmet e faça seu pedido.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [destaques, setDestaques] = useState<Produto[]>([]);
  const [catalogo, setCatalogo] = useState<Produto[]>([]);

  useEffect(() => {
    produtosService.list({ pageSize: 500 }).then((r) => {
      setCatalogo(r.items);
      setDestaques(r.items.filter((p) => p.disponivel).slice(0, 3));
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" /> Produção artesanal
              </span>
              <h1 className="mt-4 font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
                Sabores feitos com <span className="text-gradient-warm">tempo e cuidado</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Geleias, pães de fermentação natural, patês e doces preparados em pequenos lotes —
                direto da nossa cozinha para a sua mesa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/catalogo">
                    Ver catálogo <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/sobre">Nossa história</Link>
                </Button>
              </div>

              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Receitas
                  </dt>
                  <dd className="mt-1 font-display text-2xl text-foreground">+40</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Clientes
                  </dt>
                  <dd className="mt-1 font-display text-2xl text-foreground">+800</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Anos</dt>
                  <dd className="mt-1 font-display text-2xl text-foreground">7</dd>
                </div>
              </dl>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-warm opacity-20 blur-3xl" />
              <img
                src={heroImage}
                alt="Tábua rústica com produtos gourmet artesanais"
                width={1600}
                height={1024}
                className="relative w-full rounded-3xl border border-border object-cover shadow-warm"
              />
            </div>
          </div>
        </section>

        {/* Pilares */}
        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
            {[
              {
                icon: Leaf,
                title: "Ingredientes selecionados",
                desc: "Produtores locais e matérias-primas frescas.",
              },
              {
                icon: Award,
                title: "Receitas próprias",
                desc: "Desenvolvidas e ajustadas ao longo de anos.",
              },
              {
                icon: Sparkles,
                title: "Pequenos lotes",
                desc: "Produção controlada para garantir qualidade.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-warm text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Destaques */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl text-foreground">Destaques da semana</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Algumas das receitas mais queridas pelos nossos clientes.
              </p>
            </div>
            <Link
              to="/catalogo"
              className="hidden text-sm font-medium text-accent hover:underline sm:inline"
            >
              Ver tudo →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {destaques.map((p) => (
              <article
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-warm"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={p.foto}
                    alt={p.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-wide text-accent">{p.categoriaNome}</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{p.nome}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descricao}</p>
                  {p.tipo === "combo" && (
                    <ComboItensList
                      itens={resolveComboItens(p, catalogo)}
                      compact
                      className="mt-2"
                    />
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-display text-xl text-foreground">
                      R$ {p.preco.toFixed(2)}
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/catalogo">Saiba mais</Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
