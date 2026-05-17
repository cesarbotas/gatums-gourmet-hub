import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cartService, type Pedido } from "@/lib/api/carrinho";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({ meta: [{ title: "Minha conta — Gatums Gourmet" }] }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    if (user) setPedidos(cartService.pedidosByUser(user.id));
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-foreground">Olá, {user.nome.split(" ")[0]}</h1>
        <p className="mt-2 text-muted-foreground">Bem-vindo ao seu painel.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Seus dados</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nome</dt>
                <dd className="font-medium text-foreground">{user.nome}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="font-medium text-foreground">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium text-foreground capitalize">{user.role}</dd>
              </div>
            </dl>
            <Button variant="outline" className="mt-6 w-full" onClick={logout}>
              Sair da conta
            </Button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Meus pedidos</h2>
            {pedidos.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Você ainda não tem pedidos.</p>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/catalogo">Ver catálogo</Link>
                </Button>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {pedidos.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <Package className="h-4 w-4 text-accent" />
                        #{p.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(p.data).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.itens.length} {p.itens.length === 1 ? "item" : "itens"} · status: {p.status}
                    </p>
                    <p className="mt-1 font-display text-lg text-foreground">
                      R$ {p.total.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
