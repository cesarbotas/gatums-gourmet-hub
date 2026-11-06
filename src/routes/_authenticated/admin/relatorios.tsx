import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  CreditCard,
  Users,
  Package,
  Clock,
  Truck,
  Tags,
  XCircle,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { vendasService } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Gatums Gourmet" }] }),
  component: RelatoriosPage,
});

interface Resumo {
  totalFaturamento: number;
  totalPedidos: number;
  ticket: number;
  topProdutos: { nome: string; quantidade: number; total: number }[];
  serieDiaria: { dia: string; total: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizar(raw: any): Resumo {
  const num = (v: unknown) => Number(v ?? 0) || 0;
  return {
    totalFaturamento: num(raw?.totalFaturamento ?? raw?.faturamento),
    totalPedidos: num(raw?.totalPedidos ?? raw?.pedidos),
    ticket: num(raw?.ticket ?? raw?.ticketMedio),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topProdutos: (raw?.topProdutos ?? []).map((p: any) => ({
      nome: p.nome ?? p.produtoNome ?? "—",
      quantidade: num(p.quantidade),
      total: num(p.total ?? p.faturamento),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serieDiaria: (raw?.serieDiaria ?? []).map((d: any) => ({
      dia: String(d.dia ?? d.data ?? ""),
      total: num(d.total ?? d.faturamento),
    })),
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Opcao = { titulo: string; desc: string; endpoint: string; icon: LucideIcon; status: "disponivel" | "proposto" };

const OPCOES: Opcao[] = [
  { titulo: "Resumo de vendas (30 dias)", desc: "Faturamento, pedidos, ticket médio, top produtos e série diária.", endpoint: "GET /relatorios/vendas/resumo", icon: TrendingUp, status: "disponivel" },
  { titulo: "Vendas por período", desc: "Mesmo resumo com filtro de data inicial/final e agrupamento por dia, semana ou mês.", endpoint: "GET /relatorios/vendas?dataInicio=&dataFim=&agrupamento=", icon: CalendarRange, status: "proposto" },
  { titulo: "Vendas por forma de pagamento", desc: "Total e quantidade por Pix, cartão de crédito e débito; taxa de aprovação.", endpoint: "GET /relatorios/pagamentos/metodos", icon: CreditCard, status: "proposto" },
  { titulo: "Vendas por categoria", desc: "Participação de Hambúrgueres, Bebidas, Acompanhamentos etc. no faturamento.", endpoint: "GET /relatorios/vendas/categorias", icon: Tags, status: "proposto" },
  { titulo: "Ranking de clientes", desc: "Clientes que mais compram, frequência e valor gasto.", endpoint: "GET /relatorios/clientes/top", icon: Users, status: "proposto" },
  { titulo: "Pedidos por etapa", desc: "Quantos pedidos estão aguardando, em preparo, em entrega ou concluídos.", endpoint: "GET /relatorios/pedidos/etapas", icon: Truck, status: "proposto" },
  { titulo: "Horários de pico", desc: "Pedidos por hora do dia e dia da semana para planejar a produção.", endpoint: "GET /relatorios/pedidos/horarios", icon: Clock, status: "proposto" },
  { titulo: "Produtos sem venda", desc: "Itens do catálogo sem vendas no período, para revisar o cardápio.", endpoint: "GET /relatorios/produtos/sem-venda", icon: Package, status: "proposto" },
  { titulo: "Cancelamentos e recusas", desc: "Pedidos cancelados e pagamentos recusados/expirados com motivos.", endpoint: "GET /relatorios/pedidos/cancelados", icon: XCircle, status: "proposto" },
];

function RelatoriosPage() {
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    vendasService
      .resumo()
      .then((raw) => setR(normalizar(raw)))
      .catch((e: Error) => setErro(e.message || "Não foi possível carregar o resumo."));
  }, []);

  const max = r ? Math.max(...r.serieDiaria.map((d) => d.total), 1) : 1;

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Relatórios</h1>
      <p className="mt-1 text-sm text-muted-foreground">Resumo de vendas dos últimos 30 dias e opções de relatórios.</p>

      {erro && (
        <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>
      )}
      {!r && !erro && <p className="mt-6 text-sm text-muted-foreground">Carregando relatórios...</p>}

      {r && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Faturamento", value: brl(r.totalFaturamento), icon: DollarSign },
              { label: "Pedidos", value: r.totalPedidos, icon: ShoppingBag },
              { label: "Ticket médio", value: brl(r.ticket), icon: TrendingUp },
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
            {r.serieDiaria.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Sem vendas no período.</p>
            ) : (
              <>
                <div className="mt-6 flex h-48 items-end gap-1">
                  {r.serieDiaria.map((d) => (
                    <div
                      key={d.dia}
                      className="flex-1 rounded-t-md bg-gradient-warm transition-opacity hover:opacity-80"
                      style={{ height: `${(d.total / max) * 100}%` }}
                      title={`${d.dia}: ${brl(d.total)}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{r.serieDiaria[0]?.dia.slice(5, 10)}</span>
                  <span>{r.serieDiaria[r.serieDiaria.length - 1]?.dia.slice(5, 10)}</span>
                </div>
              </>
            )}
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="px-6 pt-6">
              <h2 className="text-lg font-semibold text-foreground">Top produtos</h2>
              <p className="text-sm text-muted-foreground">Os mais vendidos do período.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="mt-4 w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Produto</th>
                    <th className="px-6 py-3">Qtd.</th>
                    <th className="px-6 py-3">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {r.topProdutos.map((p) => (
                    <tr key={p.nome} className="border-t border-border">
                      <td className="px-6 py-3 font-medium text-foreground">{p.nome}</td>
                      <td className="px-6 py-3 text-muted-foreground">{p.quantidade}</td>
                      <td className="px-6 py-3 text-muted-foreground">{brl(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Opções de relatórios</h2>
        <p className="text-sm text-muted-foreground">
          O que já existe na API e o que pode ser criado. Os propostos estão detalhados no guia da API.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OPCOES.map((o) => (
            <div key={o.titulo} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                  <o.icon className="h-4 w-4" />
                </span>
                <span
                  className={
                    o.status === "disponivel"
                      ? "rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {o.status === "disponivel" ? "Disponível" : "Proposto"}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-foreground">{o.titulo}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{o.desc}</p>
              <code className="mt-3 break-all rounded-md bg-secondary/60 px-2 py-1 text-xs text-foreground">{o.endpoint}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
