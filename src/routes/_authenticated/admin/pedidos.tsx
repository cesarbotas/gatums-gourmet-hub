import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Store,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PedidoTimeline } from "@/components/PedidoTimeline";
import { pedidosService, type Pedido } from "@/lib/api/pedidos";
import {
  proximaAcaoLabel,
  statusPedidoLabel,
  etapaAtual,
  proximaEtapa,
} from "@/lib/pedido-flow";
import type { EntregaTipo } from "@/lib/pedido-flow";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: AdminPedidosPage,
});

function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [entregaTipo, setEntregaTipo] = useState<EntregaTipo>("transporte");
  const [loading, setLoading] = useState<string | null>(null);

  const reload = useCallback(() => {
    pedidosService.listAll().then(setPedidos).catch(() => setPedidos([]));
  }, []);

  useEffect(reload, [reload]);

  const avancar = async (id: string) => {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;
    const prox = proximaEtapa(etapaAtual(pedido.timeline));
    setLoading(id);
    try {
      await pedidosService.avancar(id, "admin", {
        observacao: observacao.trim() || undefined,
        entregaTipo: prox === "entregue" ? entregaTipo : undefined,
      });
      toast.success("Etapa atualizada.");
      setObservacao("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setLoading(null);
    }
  };

  const pendentes = pedidos.filter((p) => etapaAtual(p.timeline) !== "finalizado").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie o fluxo completo: aprovação, pagamento, envio e entrega.
          </p>
        </div>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
          {pendentes} em andamento
        </span>
      </div>

      {pedidos.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum pedido registrado ainda.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {pedidos.map((p) => {
            const atual = etapaAtual(p.timeline);
            const aberto = expanded === p.id;
            const acao = proximaAcaoLabel(p.timeline, "admin");
            const prox = proximaEtapa(atual);
            const podeAgir = pedidosService.podeAvancar(p, "admin");

            return (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-secondary/40"
                  onClick={() => setExpanded(aberto ? null : p.id)}
                >
                  <Package className="h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      #{p.id.slice(0, 6).toUpperCase()} · {p.clienteNome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.data).toLocaleString("pt-BR")} · {p.itens.length}{" "}
                      {p.itens.length === 1 ? "item" : "itens"} ·{" "}
                      <span className="text-accent">{statusPedidoLabel(atual)}</span>
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-lg text-foreground">
                    R$ {p.total.toFixed(2)}
                  </p>
                  {aberto ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                {aberto && (
                  <div className="border-t border-border px-4 py-5">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Itens</h3>
                        <ul className="mt-2 space-y-2 text-sm">
                          {p.itens.map((i) => (
                            <li key={i.produtoId} className="flex justify-between gap-2">
                              <span>
                                {i.nome} ×{i.quantidade}
                              </span>
                              <span className="text-muted-foreground">
                                R$ {(i.preco * i.quantidade).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {p.pagamento && (
                          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                            <p className="font-medium text-foreground">Pagamento (API)</p>
                            <p className="mt-1 text-muted-foreground">{p.pagamento.resumo}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Transação: {p.pagamento.transacaoId}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
                        <PedidoTimeline timeline={p.timeline} className="mt-3" />
                      </div>
                    </div>

                    {podeAgir && acao && (
                      <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
                        <p className="text-sm font-medium text-foreground">Próxima ação: {acao}</p>

                        {prox === "entregue" && (
                          <div className="mt-3">
                            <Label>Tipo de entrega</Label>
                            <Select
                              value={entregaTipo}
                              onValueChange={(v) => setEntregaTipo(v as EntregaTipo)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="transporte">
                                  <span className="inline-flex items-center gap-2">
                                    <Truck className="h-4 w-4" /> Transportadora
                                  </span>
                                </SelectItem>
                                <SelectItem value="retirada">
                                  <span className="inline-flex items-center gap-2">
                                    <Store className="h-4 w-4" /> Retirada no local
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="mt-3">
                          <Label htmlFor={`obs-${p.id}`}>Observação (opcional)</Label>
                          <Textarea
                            id={`obs-${p.id}`}
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Código de rastreio, horário de retirada..."
                            className="mt-1"
                            rows={2}
                          />
                        </div>

                        <Button
                          className="mt-4"
                          disabled={loading === p.id}
                          onClick={() => avancar(p.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {acao}
                        </Button>
                      </div>
                    )}

                    {atual === "finalizado" && (
                      <p className="mt-4 text-sm text-muted-foreground">Pedido concluído.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
