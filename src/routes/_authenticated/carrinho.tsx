import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho — Gatums Gourmet" }] }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const { items, total, setQty, remove, checkout } = useCart();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  if (isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
          <h1 className="font-display text-3xl text-foreground">Carrinho</h1>
          <p className="mt-2 text-muted-foreground">
            O administrador não possui carrinho. Acesse como cliente para fazer pedidos.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const finalizar = async () => {
    try {
      const pedido = await checkout();
      toast.success(`Pedido #${pedido.id.slice(0, 6)} recebido!`);
      navigate({ to: "/minha-conta" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao finalizar");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-foreground">Seu carrinho</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.nome} — revise os itens antes de finalizar.
        </p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-foreground">Seu carrinho está vazio.</p>
            <Button asChild className="mt-4">
              <Link to="/catalogo">Ver catálogo</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <ul className="space-y-3">
              {items.map((i) => (
                <li
                  key={i.produtoId}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <img
                    src={i.foto}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{i.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {i.preco.toFixed(2)} cada
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-border">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setQty(i.produtoId, i.quantidade - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{i.quantidade}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setQty(i.produtoId, i.quantidade + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-foreground">
                      R$ {(i.preco * i.quantidade).toFixed(2)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(i.produtoId)}
                      className="mt-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Resumo</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd>R$ {total.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Entrega</dt>
                  <dd>A combinar</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 font-display text-xl text-foreground">
                  <dt>Total</dt>
                  <dd>R$ {total.toFixed(2)}</dd>
                </div>
              </dl>
              <Button className="mt-6 w-full" onClick={finalizar}>
                <Check className="h-4 w-4" /> Finalizar pedido
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/catalogo">Continuar comprando</Link>
              </Button>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
