import { createFileRoute } from "@tanstack/react-router";
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
import { SalesSummary } from "@/components/SalesSummary";
import { pageHead } from "@/lib/route-head";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  head: () => pageHead("Relatórios — Gatums Gourmet", "Faturamento, pedidos, ticket médio e produtos mais vendidos."),
  component: RelatoriosPage,
});

type Opcao = { titulo: string; desc: string; endpoint: string; icon: LucideIcon; status: "disponivel" | "proposto" };

const OPCOES: Opcao[] = [
  { titulo: "Resumo de vendas", desc: "Faturamento, pedidos, ticket médio, top produtos e série diária.", endpoint: "GET /relatorios/vendas/resumo", icon: TrendingUp, status: "disponivel" },
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

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Relatórios</h1>
      <p className="mt-1 text-sm text-muted-foreground">Resumo de vendas e opções de relatórios.</p>

      <SalesSummary />

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
