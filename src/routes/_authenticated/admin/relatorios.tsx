import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, DollarSign } from "lucide-react";
import { vendasService } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  component: RelatoriosPage,
});

interface Resumo {
  totalFaturamento: number;
  totalPedidos: number;
  ticket: number;
  topProdutos: { nome: string; quantidade: number; total: number }[];
  serieDiaria: { dia: string; total: number }[];
}

function RelatoriosPage() {
  const [r, setR] = useState<Resumo | null>(null);

  useEffect(() => {
    vendasService.resumo().then(setR);
  }, []);

  if (!r) return <p className="text-sm text-muted-foreground">Carregando relatórios...</p>;

  const max = Math.max(...r.serieDiaria.map((d) => d.total), 1);

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Relatórios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Últimos 30 dias de vendas (dados de demonstração).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Faturamento", value: `R$ ${r.totalFaturamento.toFixed(2)}`, icon: DollarSign },
          { label: "Pedidos", value: r.totalPedidos, icon: ShoppingBag },
          { label: "Ticket médio", value: `R$ ${r.ticket.toFixed(2)}`, icon: TrendingUp },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Faturamento diário</h2>
        <div className="mt-6 flex h-48 items-end gap-1">
          {r.serieDiaria.map((d) => (
            <div
              key={d.dia}
              className="group relative flex-1 rounded-t-md bg-gradient-warm transition-opacity hover:opacity-80"
              style={{ height: `${(d.total / max) * 100}%` }}
              title={`${d.dia}: R$ ${d.total.toFixed(2)}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{r.serieDiaria[0]?.dia.slice(5)}</span>
          <span>{r.serieDiaria[r.serieDiaria.length - 1]?.dia.slice(5)}</span>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-6 pt-6">
          <h2 className="text-lg font-semibold text-foreground">Top produtos</h2>
          <p className="text-sm text-muted-foreground">Os mais vendidos do período.</p>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-3">Produto</th>
              <th className="px-6 py-3">Quantidade</th>
              <th className="px-6 py-3">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {r.topProdutos.map((p) => (
              <tr key={p.nome} className="border-t border-border">
                <td className="px-6 py-3 font-medium text-foreground">{p.nome}</td>
                <td className="px-6 py-3 text-muted-foreground">{p.quantidade}</td>
                <td className="px-6 py-3 text-muted-foreground">R$ {p.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
