import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Loader2,
  QrCode,
  Smartphone,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  pagamentosService,
  OPCOES_PAGAMENTO,
  type MetodoPagamento,
  type TransacaoPagamento,
} from "@/lib/api/pagamentos";
import { pedidosService, type Pedido } from "@/lib/api/pedidos";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type EtapaUi = "metodo" | "dados" | "processando" | "sucesso";

interface PagamentoCheckoutProps {
  pedido: Pedido;
  onSucesso: () => void;
}

const iconesMetodo: Record<MetodoPagamento, typeof CreditCard> = {
  cartao_debito: CreditCard,
  cartao_credito: CreditCard,
  pix: QrCode,
};

export function PagamentoCheckout({ pedido, onSucesso }: PagamentoCheckoutProps) {
  const [etapa, setEtapa] = useState<EtapaUi>("metodo");
  const [metodo, setMetodo] = useState<MetodoPagamento>("pix");
  const [transacao, setTransacao] = useState<TransacaoPagamento | null>(null);
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [pollAtivo, setPollAtivo] = useState(false);

  const iniciarTransacao = useCallback(async () => {
    setEtapa("processando");
    try {
      const tx = await pagamentosService.iniciar(pedido.id, metodo, pedido.total);
      setTransacao(tx);
      setEtapa("dados");
      if (metodo === "pix") setPollAtivo(true);
    } catch (e) {
      setEtapa("metodo");
      toast.error(e instanceof ApiError ? e.message : "Erro ao iniciar pagamento");
    }
  }, [metodo, pedido.id, pedido.total]);

  const finalizarPedido = useCallback(
    async (tx: TransacaoPagamento) => {
      pedidosService.concluirPagamentoCliente(pedido.id, tx);
      setEtapa("sucesso");
      toast.success("Pagamento confirmado!");
      onSucesso();
    },
    [pedido.id, onSucesso],
  );

  const processarCartao = async () => {
    if (!transacao) return;
    setEtapa("processando");
    try {
      const tx = await pagamentosService.processarCartao(transacao.id, {
        numero,
        nome,
        validade,
        cvv,
      });
      await finalizarPedido(tx);
    } catch (e) {
      setEtapa("dados");
      toast.error(e instanceof ApiError ? e.message : "Pagamento recusado");
    }
  };

  const confirmarPixManual = async () => {
    if (!transacao) return;
    setEtapa("processando");
    try {
      const tx = await pagamentosService.confirmarPix(transacao.id);
      await finalizarPedido(tx);
    } catch (e) {
      setEtapa("dados");
      toast.error(e instanceof ApiError ? e.message : "Não foi possível validar o Pix");
    }
  };

  useEffect(() => {
    if (!pollAtivo || !transacao || metodo !== "pix") return;

    const id = window.setInterval(async () => {
      try {
        const tx = await pagamentosService.consultarStatus(transacao.id);
        setTransacao(tx);
        if (tx.status === "aprovada") {
          setPollAtivo(false);
          await finalizarPedido(tx);
        } else if (tx.status === "expirada" || tx.status === "recusada") {
          setPollAtivo(false);
          toast.error(tx.mensagemErro ?? "Pix expirado ou recusado");
        }
      } catch {
        /* polling silencioso */
      }
    }, 3000);

    return () => window.clearInterval(id);
  }, [pollAtivo, transacao, metodo, finalizarPedido]);

  const copiarPix = () => {
    if (!transacao?.pixCopiaCola) return;
    navigator.clipboard.writeText(transacao.pixCopiaCola);
    toast.success("Código Pix copiado");
  };

  const formatarCartao = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 ")
      .trim();

  const formatarValidade = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  if (etapa === "sucesso") {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
        <p className="mt-3 font-medium text-foreground">Pagamento aprovado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aguarde a confirmação da loja para seguir com o envio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {etapa === "metodo" && (
        <>
          <p className="text-sm text-muted-foreground">Escolha como deseja pagar:</p>
          <RadioGroup
            value={metodo}
            onValueChange={(v) => setMetodo(v as MetodoPagamento)}
            className="grid gap-3"
          >
            {OPCOES_PAGAMENTO.map((op) => {
              const Icon = iconesMetodo[op.id];
              return (
                <label
                  key={op.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors",
                    metodo === op.id && "border-accent bg-accent/5",
                  )}
                >
                  <RadioGroupItem value={op.id} className="mt-1" />
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">{op.label}</p>
                    <p className="text-xs text-muted-foreground">{op.descricao}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
          <Button className="w-full" onClick={iniciarTransacao}>
            Continuar · R$ {pedido.total.toFixed(2)}
          </Button>
        </>
      )}

      {etapa === "processando" && (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="mt-3 text-sm">Validando com a operadora...</p>
        </div>
      )}

      {etapa === "dados" && transacao && metodo === "pix" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o código. A confirmação é automática após o pagamento.
          </p>
          {transacao.pixQrCodeDataUrl && (
            <img
              src={transacao.pixQrCodeDataUrl}
              alt="QR Code Pix"
              className="mx-auto rounded-lg border border-border bg-white p-2"
              width={220}
              height={220}
            />
          )}
          <Button variant="outline" className="w-full" onClick={copiarPix}>
            <Copy className="h-4 w-4" /> Copiar código Pix
          </Button>
          {pollAtivo && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do banco...
            </p>
          )}
          <Button variant="secondary" className="w-full" onClick={confirmarPixManual}>
            <Smartphone className="h-4 w-4" /> Já paguei — validar agora
          </Button>
        </div>
      )}

      {etapa === "dados" && transacao && metodo !== "pix" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            processarCartao();
          }}
        >
          <div>
            <Label>Número do cartão</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(formatarCartao(e.target.value))}
              placeholder="0000 0000 0000 0000"
              autoComplete="cc-number"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nome impresso</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              placeholder="COMO NO CARTÃO"
              autoComplete="cc-name"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Validade</Label>
              <Input
                value={validade}
                onChange={(e) => setValidade(formatarValidade(e.target.value))}
                placeholder="MM/AA"
                autoComplete="cc-exp"
                className="mt-1"
              />
            </div>
            <div>
              <Label>CVV</Label>
              <Input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                autoComplete="cc-csc"
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pagamento processado de forma segura pela operadora. Dados validados via API.
          </p>
          <Button type="submit" className="w-full">
            Pagar R$ {pedido.total.toFixed(2)}
          </Button>
        </form>
      )}
    </div>
  );
}
