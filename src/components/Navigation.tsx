import { Link, useRouter } from "@tanstack/react-router";
import { Menu, X, ShoppingBag, Shield, User as UserIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const publicLinks = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/sobre", label: "Sobre" },
];

export function Navigation() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-warm text-primary-foreground shadow-warm">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            Gatums <span className="text-gradient-warm">Gourmet</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {publicLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link
              to="/minha-conta"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              Minha conta
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-secondary"
              activeProps={{ className: "bg-secondary" }}
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-muted-foreground lg:inline">
                Olá, {user?.nome.split(" ")[0]}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">
                  <UserIcon className="h-4 w-4" /> Criar conta
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-3">
            {publicLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                to="/minha-conta"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Minha conta
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-secondary"
              >
                Administração
              </Link>
            )}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              {isAuthenticated ? (
                <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                  Sair
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/login" onClick={() => setOpen(false)}>
                      Entrar
                    </Link>
                  </Button>
                  <Button size="sm" className="w-full" asChild>
                    <Link to="/register" onClick={() => setOpen(false)}>
                      Criar conta
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
