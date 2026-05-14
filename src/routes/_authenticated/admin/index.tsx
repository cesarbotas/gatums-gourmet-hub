import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, Users, ShoppingBag, DollarSign } from "lucide-react";
import { produtosService, clientesService, vendasService } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState({ produtos: 0, clientes: 0, pedidos: 0, faturamento: 0 });

  useEffect(() => {
    (async () => {
      const [p, c, r] = await Promise.all([
        produtosService.list({ pageSize: 1 }),
        clientesService.list({ pageSize: 1 }),
        vendasService.resumo(),
      ]);
      setStats({
        produtos: p.total,
        clientes: c.total,
        pedidos: r.totalPedidos,
        faturamento: r.totalFaturamento,
      });
    })();
  }, []);

  const cards = [
    { label: "Produtos", value: stats.produtos, icon: Package },
    { label: "Clientes", value: stats.clientes, icon: Users },
    { label: "Pedidos (30d)", value: stats.pedidos, icon: ShoppingBag },
    {
      label: "Faturamento (30d)",
      value: `R$ ${stats.faturamento.toFixed(2)}`,
      icon: DollarSign,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Visão geral</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Resumo rápido do seu negócio.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-warm text-primary-foreground">
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Bem-vindo ao painel</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use o menu lateral para gerenciar produtos, clientes e acompanhar relatórios de
          vendas. Os dados atuais são uma demonstração local — quando sua API estiver pronta,
          basta ajustar <code className="rounded bg-muted px-1">src/lib/api/config.ts</code>.
        </p>
      </section>
    </div>
  );
}
