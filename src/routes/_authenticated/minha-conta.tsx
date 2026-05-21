import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Package, ChevronDown, ChevronUp, CreditCard, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { PedidoTimeline } from "@/components/PedidoTimeline";
import { pedidosService, type Pedido } from "@/lib/api/pedidos";
import { enderecosService, type Endereco } from "@/lib/api/enderecos";
import { EnderecoForm, emptyEndereco } from "@/components/EnderecoForm";
import {
  etapaAtual,
  proximaAcaoLabel,
  statusPedidoLabel,
} from "@/lib/pedido-flow";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({ meta: [{ title: "Minha conta — Gatums Gourmet" }] }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const { user, logout, isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<Endereco>(emptyEndereco);
  const [editEnd, setEditEnd] = useState(false);
  const [savingEnd, setSavingEnd] = useState(false);

  const reload = useCallback(() => {
    if (user) pedidosService.listByUser(user.id).then(setPedidos).catch(() => setPedidos([]));
  }, [user]);

  useEffect(reload, [reload]);

  useEffect(() => {
    if (!user) return;
    enderecosService.getPrincipal(user.id).then((e) => {
      if (e) setEndereco(e);
      else setEditEnd(true);
    });
  }, [user]);

  if (!user) return null;
  if (isAdmin) return <Navigate to="/admin/pedidos" />;

  const salvarEndereco = async () => {
    if (!endereco.cep || !endereco.logradouro || !endereco.numero) {
      toast.error("Preencha CEP, logradouro e número");
      return;
    }
    setSavingEnd(true);
    try {
      const saved = await enderecosService.save(user.id, { ...endereco, principal: true });
      setEndereco(saved);
      setEditEnd(false);
      toast.success("Endereço salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingEnd(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-foreground">Olá, {user.nome.split(" ")[0]}</h1>
        <p className="mt-2 text-muted-foreground">Acompanhe seus pedidos e o status de cada etapa.</p>

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
            </dl>
            <Button variant="outline" className="mt-6 w-full" onClick={logout}>
              Sair da conta
            </Button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:col-span-2">
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
                {pedidos.map((p) => {
                  const atual = etapaAtual(p.timeline);
                  const aberto = expanded === p.id;
                  const acao = proximaAcaoLabel(p.timeline, "cliente");
                  const podePagar = pedidosService.podeAvancar(p, "cliente");

                  return (
                    <li key={p.id} className="overflow-hidden rounded-xl border border-border">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-secondary/30"
                        onClick={() => setExpanded(aberto ? null : p.id)}
                      >
                        <Package className="h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            #{p.id.slice(0, 6).toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.data).toLocaleDateString("pt-BR")} ·{" "}
                            {statusPedidoLabel(atual)}
                          </p>
                        </div>
                        <p className="font-display text-lg text-foreground">
                          R$ {p.total.toFixed(2)}
                        </p>
                        {aberto ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {aberto && (
                        <div className="border-t border-border px-4 pb-4">
                          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                            {p.itens.map((i) => (
                              <li key={i.produtoId} className="flex justify-between">
                                <span>
                                  {i.nome} ×{i.quantidade}
                                </span>
                                <span>R$ {(i.preco * i.quantidade).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>

                          {p.pagamento && (
                            <p className="mt-3 text-xs text-accent">
                              Pagamento: {p.pagamento.resumo}
                            </p>
                          )}

                          <h3 className="mt-4 text-sm font-semibold text-foreground">
                            Acompanhamento
                          </h3>
                          <PedidoTimeline timeline={p.timeline} className="mt-2" />

                          {podePagar && acao && (
                            <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
                              <p className="text-sm font-medium text-foreground">{acao}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Débito, crédito ou Pix com validação pela operadora.
                              </p>
                              <Button asChild size="sm" className="mt-3">
                                <Link
                                  to="/pedidos/$pedidoId/pagamento"
                                  params={{ pedidoId: p.id }}
                                >
                                  <CreditCard className="h-4 w-4" />
                                  Ir para pagamento
                                </Link>
                              </Button>
                            </div>
                          )}

                          {atual === "criado" && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Aguardando aprovação da loja.
                            </p>
                          )}
                          {atual === "pagamento" && !podePagar && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Pagamento em análise pela loja.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
