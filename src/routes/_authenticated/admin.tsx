import { createFileRoute, Outlet, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navigation } from "@/components/Navigation";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Gatums Gourmet" }] }),
  component: AdminLayout,
});

const adminLinks: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
];

function AdminLayout() {
  const { isAdmin, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) return null;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row">
        <aside className="lg:w-60">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Administração
            </p>
            <nav className="mt-1 space-y-0.5">
              {adminLinks.map((l) => {
                const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-gradient-warm text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
