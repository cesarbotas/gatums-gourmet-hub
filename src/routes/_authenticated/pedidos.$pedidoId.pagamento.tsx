import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { PagamentoCheckout } from "@/components/PagamentoCheckout";
import { useAuth } from "@/lib/auth-context";
import { pedidosService, type Pedido } from "@/lib/api/pedidos";
import { etapaAtual } from "@/lib/pedido-flow";

export const Route = createFileRoute("/_authenticated/pedidos/$pedidoId/pagamento")({
  head: () => ({ meta: [{ title: "Pagamento — Gatums Gourmet" }] }),
  component: PagamentoPedidoPage,
});

function PagamentoPedidoPage() {
  const { pedidoId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    pedidosService.getById(pedidoId).then((p) => {
      if (!p || !user || p.userId !== user.id) {
        setPedido(null);
        return;
      }
      setPedido(p);
    }).catch(() => setPedido(null));
  }, [pedidoId, user]);

  if (isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
          <p className="text-muted-foreground">Administradores não realizam pagamentos.</p>
          <Button asChild className="mt-4">
            <Link to="/admin/pedidos">Ver pedidos</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
          <p className="text-muted-foreground">Pedido não encontrado.</p>
          <Button asChild className="mt-4">
            <Link to="/minha-conta">Minha conta</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const atual = etapaAtual(pedido.timeline);
  const podePagar = pedidosService.podeAvancar(pedido, "cliente") && atual === "aprovado";

  if (!podePagar) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
          <p className="text-muted-foreground">
            Este pedido não está disponível para pagamento no momento.
          </p>
          <Button asChild className="mt-4">
            <Link to="/minha-conta">Voltar aos pedidos</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/minha-conta">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>

        <h1 className="font-display text-3xl text-foreground">Pagamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedido #{pedido.id.slice(0, 6).toUpperCase()} · Total R$ {pedido.total.toFixed(2)}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <PagamentoCheckout
            pedido={pedido}
            onSucesso={() => navigate({ to: "/minha-conta" })}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
