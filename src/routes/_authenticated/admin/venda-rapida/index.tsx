import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Search,
  ArrowLeft,
  CheckCircle2,
  Banknote,
  CreditCard,
  QrCode,
  X,
  Maximize2,
  ChevronRight,
  Loader2,
  Smartphone,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { SearchPagination } from "@/components/SearchPagination";
import { collectPages, paginateItems } from "@/lib/page-data";
import { pageHead } from "@/lib/route-head";
import { produtosService, produtoDisponivel, type Produto } from "@/lib/api/produtos";
import { changeSaleQuantity, saleTotal, type SaleLine } from "@/lib/quick-sale";
import {
  vendaPresencialService,
  type PagamentoPresencialResposta,
} from "@/lib/api/venda-presencial";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/venda-rapida/")({
  head: () =>
    pageHead(
      "Venda rápida — Gatums Gourmet",
      "Selecione produtos e processe o pagamento para atendimento presencial da Gatums Gourmet.",
    ),
  component: VendaRapidaPage,
});

// ── Types ──────────────────────────────────────────────────────────────────

export type FormaPagamento =
  | "dinheiro"
  | "cartao_debito"
  | "cartao_credito"
  | "pix";

/**
 * Passos do painel lateral:
 * cart          → resumo + seleção de produtos
 * payment       → escolha de forma + troco
 * loading       → aguardando resposta da API (criar pedido + iniciar pagamento)
 * maquininha    → cartão: operador confirma após maquininha aprovar
 * pix_qr        → Pix: exibe QR Code + Copia e Cola; operador aguarda cliente escanear
 * pix_aguardo   → Pix: polling de status após operador confirmar escaneio
 * done          → venda concluída
 */
export type PanelStep =
  | "cart"
  | "payment"
  | "loading"
  | "maquininha"
  | "pix_qr"
  | "pix_aguardo"
  | "done";

interface PaymentState {
  forma: FormaPagamento;
  valorRecebido: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const FORMAS: {
  id: FormaPagamento;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "dinheiro",       label: "Dinheiro",      icon: Banknote   },
  { id: "cartao_debito",  label: "Débito",         icon: CreditCard },
  { id: "cartao_credito", label: "Crédito",        icon: CreditCard },
  { id: "pix",            label: "Pix",            icon: QrCode     },
];

// ── Page ───────────────────────────────────────────────────────────────────

function VendaRapidaPage() {
  const { user } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cliente, setCliente] = useState("");

  // Sidebar flow
  const [step, setStep] = useState<PanelStep>("cart");
  const [payment, setPayment] = useState<PaymentState>({
    forma: "dinheiro",
    valorRecebido: "",
  });
  // Resultado do pagamento (preenchido após confirmar)
  const [pagamentoResp, setPagamentoResp] =
    useState<PagamentoPresencialResposta | null>(null);

  // Modal de apresentação de valor
  const [showPresent, setShowPresent] = useState(false);
  // Mobile cart drawer
  const [showCart, setShowCart] = useState(false);

  // ── Carregar catálogo ──────────────────────────────────────────────────
  useEffect(() => {
    collectPages((p) => produtosService.list({ page: p, pageSize: 100 }))
      .then(setProdutos)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o catálogo.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, categoria]);

  // ── Mudar quantidade ───────────────────────────────────────────────────
  const change = (p: Produto, qty: number) => {
    if (step !== "cart") setStep("cart");
    try {
      setLines(changeSaleQuantity(lines, p, qty));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quantidade inválida.");
    }
  };

  // ── Nova venda ─────────────────────────────────────────────────────────
  const startNewSale = () => {
    setLines([]);
    setCliente("");
    setPayment({ forma: "dinheiro", valorRecebido: "" });
    setPagamentoResp(null);
    setStep("cart");
  };

  // ── Confirmar pagamento ────────────────────────────────────────────────
  const confirmarPagamento = async () => {
    if (!user) return;
    setStep("loading");

    try {
      // 1. Criar pedido presencial
      const venda = await vendaPresencialService.criar(
        {
          clienteNome: cliente,
          operadorId: user.id,
          itens: lines.map((l) => ({
            produtoId: l.produto.id,
            quantidade: l.quantidade,
          })),
        },
        async (ids) =>
          produtos
            .filter((p) => ids.includes(p.id))
            .map((p) => ({ id: p.id, nome: p.nome, preco: p.preco })),
      );

      // 2. Iniciar pagamento
      const valorNum =
        payment.forma === "dinheiro"
          ? parseFloat(payment.valorRecebido.replace(",", ".")) || venda.total
          : venda.total;

      const pg = await vendaPresencialService.iniciarPagamento({
        pedidoId: venda.pedidoId,
        metodo: payment.forma,
        valor: venda.total,
        valorRecebido: payment.forma === "dinheiro" ? valorNum : undefined,
      });

      setPagamentoResp(pg);

      if (payment.forma === "dinheiro") {
        setStep("done");
        return;
      }

      if (
        payment.forma === "cartao_debito" ||
        payment.forma === "cartao_credito"
      ) {
        setStep("maquininha");
        return;
      }

      // Pix → mostra QR primeiro, polling só depois
      setStep("pix_qr");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar venda.",
      );
      setStep("payment");
    }
  };

  // ── Confirmar maquininha ───────────────────────────────────────────────
  const confirmarMaquininha = async () => {
    if (!pagamentoResp) return;
    setStep("loading");
    try {
      const resp = await vendaPresencialService.confirmarCartao(
        pagamentoResp.id,
        { aprovado: true },
      );
      setPagamentoResp(resp);
      setStep("done");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao confirmar pagamento.",
      );
      setStep("maquininha");
    }
  };

  // ── Filtros e paginação ────────────────────────────────────────────────
  const categories = Array.from(
    new Set(produtos.map((p) => p.categoriaNome).filter(Boolean)),
  ).sort();

  const filtered = produtos.filter(
    (p) =>
      `${p.nome} ${p.descricao}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (categoria === "todas" || p.categoriaNome === categoria),
  );

  const paged = paginateItems(filtered, page, pageSize);
  const total = saleTotal(lines);
  const count = lines.reduce((n, l) => n + l.quantidade, 0);

  // ── Props compartilhadas do painel ─────────────────────────────────────
  const panelProps: SidePanelProps = {
    lines,
    total,
    count,
    cliente,
    step,
    payment,
    pagamentoResp,
    onClienteChange: setCliente,
    onChange: change,
    onStep: setStep,
    onPaymentChange: (patch) =>
      setPayment((prev) => ({ ...prev, ...patch })),
    onPresent: () => setShowPresent(true),
    onConfirmarPagamento: confirmarPagamento,
    onConfirmarMaquininha: confirmarMaquininha,
    onNewSale: startNewSale,
    onPixAprovado: (resp) => {
      setPagamentoResp(resp);
      setStep("done");
    },
  };

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-foreground">Venda rápida</h1>
        <Button
          variant="outline"
          className="relative lg:hidden"
          onClick={() => setShowCart(true)}
        >
          <ShoppingBag className="h-4 w-4" />
          {step === "done" ? "Pagamento" : "Carrinho"}
          {count > 0 && step === "cart" && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </div>

      {/* Layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* Catálogo */}
        <section className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Pesquisar produto"
                placeholder="Buscar produto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p role="status" className="mt-8 text-muted-foreground">
              Carregando catálogo…
            </p>
          ) : error ? (
            <p role="alert" className="mt-8 text-destructive">
              {error}
            </p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paged.items.map((p) => {
                  const available = produtoDisponivel(p);
                  const qty =
                    lines.find((l) => l.produto.id === p.id)?.quantidade ?? 0;
                  const atMax =
                    p.estoqueInformado !== false && qty >= p.estoque;

                  return (
                    <article
                      key={p.id}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-[16/9] bg-muted">
                        {p.foto ? (
                          <img
                            src={p.foto}
                            alt={p.nome}
                            className={`h-full w-full object-cover ${available ? "" : "grayscale opacity-60"}`}
                          />
                        ) : (
                          <ShoppingBag className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                        {!available && (
                          <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                            Indisponível
                          </span>
                        )}
                        {qty > 0 && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
                            {qty}
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <h2 className="line-clamp-1 text-sm font-semibold text-foreground">
                          {p.nome}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.categoriaNome}
                          {p.estoqueInformado !== false
                            ? ` · ${p.estoque} un.`
                            : ""}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {brl(p.preco)}
                          </span>
                          {qty === 0 ? (
                            <Button
                              size="sm"
                              disabled={!available}
                              onClick={() => change(p, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Adicionar
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                aria-label={`Diminuir ${p.nome}`}
                                onClick={() => change(p, qty - 1)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-7 text-center text-sm font-medium">
                                {qty}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                aria-label={`Aumentar ${p.nome}`}
                                disabled={!available || atMax}
                                onClick={() => change(p, qty + 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!filtered.length && (
                  <p className="col-span-full text-muted-foreground">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>

              <SearchPagination
                page={paged.page}
                pageSize={pageSize}
                total={filtered.length}
                onPage={setPage}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </section>

        {/* Painel desktop */}
        <SidePanel {...panelProps} />
      </div>

      {/* Drawer mobile */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-sm">
          <DialogTitle>
            {step === "cart"
              ? "Venda atual"
              : step === "payment"
                ? "Pagamento"
                : step === "done"
                  ? "Concluído"
                  : "Aguardando…"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Painel de venda presencial.
          </DialogDescription>
          <SidePanel {...panelProps} compact />
        </DialogContent>
      </Dialog>

      {/* Modal apresentar valor */}
      <Dialog open={showPresent} onOpenChange={setShowPresent}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-2xl">
              Gatums Gourmet
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tela cheia"
              onClick={() =>
                document.documentElement
                  .requestFullscreen?.()
                  .catch(() => null)
              }
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {cliente || "Atendimento presencial"} · {count}{" "}
            {count === 1 ? "item" : "itens"}
          </DialogDescription>

          <ul className="mt-2 divide-y divide-border text-sm">
            {lines.map((l) => (
              <li
                key={l.produto.id}
                className="flex justify-between gap-3 py-2"
              >
                <span className="text-foreground">
                  {l.produto.nome}
                  <span className="ml-1 text-muted-foreground">
                    × {l.quantidade}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {brl(l.produto.preco * l.quantidade)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl bg-secondary/60 py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total a pagar
            </p>
            <p className="mt-2 font-display text-5xl font-bold text-foreground">
              {brl(total)}
            </p>
          </div>

          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => setShowPresent(false)}
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Side panel ─────────────────────────────────────────────────────────────

interface SidePanelProps {
  lines: SaleLine[];
  total: number;
  count: number;
  cliente: string;
  step: PanelStep;
  payment: PaymentState;
  pagamentoResp: PagamentoPresencialResposta | null;
  onClienteChange: (v: string) => void;
  onChange: (p: Produto, qty: number) => void;
  onStep: (s: PanelStep) => void;
  onPaymentChange: (patch: Partial<PaymentState>) => void;
  onPresent: () => void;
  onConfirmarPagamento: () => void;
  onConfirmarMaquininha: () => void;
  onNewSale: () => void;
  onPixAprovado: (resp: PagamentoPresencialResposta) => void;
  compact?: boolean;
}

function SidePanel(props: SidePanelProps) {
  const wrapper = props.compact
    ? "min-w-0"
    : "hidden min-w-0 self-start rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:block";

  return (
    <aside className={wrapper}>
      {props.step === "cart" && <CartStep {...props} />}
      {props.step === "payment" && <PaymentStep {...props} />}
      {props.step === "loading" && <LoadingStep />}
      {props.step === "maquininha" && <MaquininhaStep {...props} />}
      {props.step === "pix_qr" && <PixQrStep {...props} />}
      {props.step === "pix_aguardo" && <PixAguardoStep {...props} />}
      {props.step === "done" && (
        <DoneStep
          total={props.total}
          payment={props.payment}
          pagamentoResp={props.pagamentoResp}
          onNewSale={props.onNewSale}
        />
      )}
    </aside>
  );
}

// ── Step: Cart ─────────────────────────────────────────────────────────────

function CartStep({
  lines, total, count, cliente, onClienteChange,
  onChange, onStep, onPresent, compact,
}: SidePanelProps) {
  return (
    <>
      {!compact && (
        <h2 className="font-display text-xl text-foreground">Venda atual</h2>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {count} {count === 1 ? "item" : "itens"}
      </p>

      <div className="mt-4">
        <Label htmlFor={compact ? "cliente-m" : "cliente"}>
          Cliente{" "}
          <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={compact ? "cliente-m" : "cliente"}
          className="mt-1"
          placeholder="Nome do cliente…"
          value={cliente}
          onChange={(e) => onClienteChange(e.target.value)}
        />
      </div>

      <ul className="mt-4 max-h-64 divide-y divide-border overflow-y-auto">
        {lines.map((l) => (
          <li key={l.produto.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium text-foreground leading-snug">
                {l.produto.nome}
              </p>
              <button
                aria-label={`Remover ${l.produto.nome}`}
                onClick={() => onChange(l.produto, 0)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon" variant="outline" className="h-7 w-7"
                  aria-label={`Diminuir ${l.produto.nome}`}
                  onClick={() => onChange(l.produto, l.quantidade - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm">{l.quantidade}</span>
                <Button
                  size="icon" variant="outline" className="h-7 w-7"
                  disabled={
                    l.produto.estoqueInformado !== false &&
                    l.quantidade >= l.produto.estoque
                  }
                  aria-label={`Aumentar ${l.produto.nome}`}
                  onClick={() => onChange(l.produto, l.quantidade + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm font-medium">
                {brl(l.produto.preco * l.quantidade)}
              </span>
            </div>
          </li>
        ))}
        {!lines.length && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            Nenhum produto selecionado.
          </li>
        )}
      </ul>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-display text-2xl text-foreground">{brl(total)}</p>
        </div>
        <Button
          className="mt-4 w-full"
          disabled={!lines.length}
          onClick={() => onStep("payment")}
        >
          Cobrar
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="mt-2 w-full"
          disabled={!lines.length}
          onClick={onPresent}
        >
          Apresentar valor
        </Button>
      </div>
    </>
  );
}

// ── Step: Payment ──────────────────────────────────────────────────────────

function PaymentStep({
  lines, total, payment, onPaymentChange,
  onStep, onConfirmarPagamento,
}: SidePanelProps) {
  const valorNum =
    parseFloat(payment.valorRecebido.replace(",", ".")) || 0;
  const troco =
    payment.forma === "dinheiro" && valorNum >= total
      ? valorNum - total
      : 0;
  const trocoInsuficiente =
    payment.forma === "dinheiro" &&
    payment.valorRecebido !== "" &&
    valorNum < total;
  const canConfirm =
    payment.forma !== "dinheiro" ||
    payment.valorRecebido === "" ||
    valorNum >= total;
  const valorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (payment.forma === "dinheiro") valorRef.current?.focus();
  }, [payment.forma]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          aria-label="Voltar ao carrinho"
          onClick={() => onStep("cart")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-xl text-foreground">Pagamento</h2>
      </div>

      {/* Resumo read-only */}
      <ul className="mt-3 max-h-36 divide-y divide-border overflow-y-auto text-sm">
        {lines.map((l) => (
          <li key={l.produto.id} className="flex justify-between gap-2 py-2">
            <span className="text-foreground">
              {l.produto.nome}
              <span className="ml-1 text-muted-foreground">× {l.quantidade}</span>
            </span>
            <span className="shrink-0 font-medium">
              {brl(l.produto.preco * l.quantidade)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="font-display text-2xl text-foreground">{brl(total)}</p>
      </div>

      {/* Formas de pagamento */}
      <div className="mt-5">
        <p className="text-sm font-medium text-foreground">Forma de pagamento</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FORMAS.map(({ id, label, icon: Icon }) => {
            const active = payment.forma === id;
            return (
              <button
                key={id}
                onClick={() => onPaymentChange({ forma: id })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campo troco (dinheiro) */}
      {payment.forma === "dinheiro" && (
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="valor-recebido">Valor recebido</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                ref={valorRef}
                id="valor-recebido"
                className={`pl-9 ${trocoInsuficiente ? "border-destructive focus-visible:ring-destructive" : ""}`}
                inputMode="decimal"
                placeholder="0,00"
                value={payment.valorRecebido}
                onChange={(e) =>
                  onPaymentChange({ valorRecebido: e.target.value })
                }
              />
            </div>
            {trocoInsuficiente && (
              <p className="mt-1 text-xs text-destructive">
                Valor insuficiente para cobrir o total.
              </p>
            )}
          </div>
          {troco > 0 && (
            <div className="rounded-lg bg-secondary/60 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Troco
              </p>
              <p className="mt-0.5 font-display text-3xl text-foreground">
                {brl(troco)}
              </p>
            </div>
          )}
        </div>
      )}

      <Button
        className="mt-5 w-full"
        disabled={!canConfirm}
        onClick={onConfirmarPagamento}
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirmar pagamento
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full text-muted-foreground"
        onClick={() => onStep("cart")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Button>
    </>
  );
}

// ── Step: Loading ──────────────────────────────────────────────────────────

function LoadingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Processando venda…</p>
    </div>
  );
}

// ── Step: Maquininha ───────────────────────────────────────────────────────

function MaquininhaStep({ payment, total, onConfirmarMaquininha, onNewSale }: SidePanelProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmar = async () => {
    setConfirming(true);
    try {
      await onConfirmarMaquininha();
    } finally {
      setConfirming(false);
    }
  };

  const formaLabel =
    FORMAS.find((f) => f.id === payment.forma)?.label ?? payment.forma;

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Smartphone className="h-7 w-7 text-foreground" />
      </span>

      <h2 className="mt-4 font-display text-xl text-foreground">
        Passe o cartão
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {formaLabel} · {brl(total)}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Passe ou aproxime o cartão na maquininha e clique em confirmar quando
        a operação for aprovada.
      </p>

      <Button
        className="mt-6 w-full"
        disabled={confirming}
        onClick={handleConfirmar}
      >
        {confirming ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Pagamento aprovado na maquininha
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full text-muted-foreground"
        onClick={onNewSale}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Cancelar venda
      </Button>
    </div>
  );
}

// ── Step: Pix — exibe QR Code ─────────────────────────────────────────────

function PixQrStep({ pagamentoResp, total, onStep, onNewSale }: SidePanelProps) {
  const [copied, setCopied] = useState(false);

  const copiar = () => {
    if (!pagamentoResp?.pixCopiaCola) return;
    navigator.clipboard.writeText(pagamentoResp.pixCopiaCola).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const expiraEm = pagamentoResp?.pixExpiraEm
    ? new Date(pagamentoResp.pixExpiraEm).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl text-foreground">Pix</h2>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Mostre o QR ao cliente ou envie o código Copia e Cola
      </p>

      {/* QR Code */}
      {pagamentoResp?.pixQrCodeDataUrl ? (
        <img
          src={pagamentoResp.pixQrCodeDataUrl}
          alt="QR Code Pix"
          className="mt-4 h-48 w-48 rounded-xl border border-border shadow-sm"
        />      ) : (
        <div className="mt-4 flex h-48 w-48 items-center justify-center rounded-xl border border-border bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Valor */}
      <p className="mt-3 font-display text-2xl text-foreground">{brl(total)}</p>

      {expiraEm && (
        <p className="mt-1 text-xs text-muted-foreground">Válido até {expiraEm}</p>
      )}

      {/* Copia e cola */}
      {pagamentoResp?.pixCopiaCola && (
        <div className="mt-4 w-full">
          <p className="mb-1 text-left text-xs font-medium text-muted-foreground">
            Pix Copia e Cola
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
            <p className="flex-1 truncate text-left font-mono text-xs text-foreground">
              {pagamentoResp.pixCopiaCola}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={copiar}
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {/* Avançar para polling */}
      <Button
        className="mt-5 w-full"
        onClick={() => onStep("pix_aguardo")}
      >
        <CheckCircle2 className="h-4 w-4" />
        Cliente escaneou — verificar pagamento
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full text-muted-foreground"
        onClick={onNewSale}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Cancelar venda
      </Button>
    </div>
  );
}

// ── Step: Pix — polling de confirmação ────────────────────────────────────

function PixAguardoStep({ pagamentoResp, onPixAprovado, onStep, onNewSale }: SidePanelProps) {
  const [status, setStatus] = useState<string>(
    pagamentoResp?.status ?? "aguardando_pagamento",
  );

  useEffect(() => {
    if (!pagamentoResp?.id) return;
    if (status === "aprovada" || status === "expirada") return;

    const interval = setInterval(async () => {
      try {
        const tx = await vendaPresencialService.consultarStatusPix(pagamentoResp.id);
        setStatus(tx.status);
        if (tx.status === "aprovada") {
          clearInterval(interval);
          onPixAprovado(tx as PagamentoPresencialResposta);
        }
        if (tx.status === "expirada" || tx.status === "cancelada") {
          clearInterval(interval);
          toast.error("Pix expirado. Inicie uma nova venda.");
        }
      } catch {
        // silencia erros de rede; tenta na próxima iteração
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [pagamentoResp?.id, status, onPixAprovado]);

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />

      <h2 className="mt-4 font-display text-xl text-foreground">
        Aguardando confirmação
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Verificando o pagamento junto ao banco…
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        A tela avança automaticamente quando o pagamento for confirmado.
      </p>

      {/* Voltar para o QR caso o cliente precise escanear de novo */}
      <Button
        variant="outline"
        className="mt-6 w-full"
        onClick={() => onStep("pix_qr")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao QR Code
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full text-muted-foreground"
        onClick={onNewSale}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Cancelar venda
      </Button>
    </div>
  );
}

// ── Step: Done ─────────────────────────────────────────────────────────────

interface DoneStepProps {
  total: number;
  payment: PaymentState;
  pagamentoResp: PagamentoPresencialResposta | null;
  onNewSale: () => void;
}

function DoneStep({ total, payment, pagamentoResp, onNewSale }: DoneStepProps) {
  const troco = pagamentoResp?.troco ?? 0;
  const formaLabel =
    FORMAS.find((f) => f.id === payment.forma)?.label ?? payment.forma;

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
        <CheckCircle2 className="h-8 w-8" />
      </span>

      <h2 className="mt-4 font-display text-xl text-foreground">
        Pagamento confirmado
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{formaLabel}</p>

      <div className="mt-5 w-full rounded-xl bg-secondary/60 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Total cobrado
        </p>
        <p className="mt-1 font-display text-4xl text-foreground">
          {brl(total)}
        </p>
      </div>

      {troco > 0 && (
        <div className="mt-3 w-full rounded-xl border border-border px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Troco
          </p>
          <p className="mt-0.5 font-display text-3xl text-foreground">
            {brl(troco)}
          </p>
        </div>
      )}

      <Button className="mt-6 w-full" onClick={onNewSale}>
        Nova venda
      </Button>
    </div>
  );
}
