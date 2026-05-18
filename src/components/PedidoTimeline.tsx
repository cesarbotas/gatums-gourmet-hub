import { Check, Circle, Clock } from "lucide-react";
import {
  ETAPAS_ORDEM,
  ETAPA_META,
  etapaConcluida,
  etapaAtual,
  type PedidoEvento,
} from "@/lib/pedido-flow";
import { cn } from "@/lib/utils";

interface PedidoTimelineProps {
  timeline: PedidoEvento[];
  className?: string;
}

function descricaoParaTimeline(descricao: string) {
  return descricao.replace("Admin ", "Loja ").replace("pelo admin", "pela loja");
}

export function PedidoTimeline({ timeline, className }: PedidoTimelineProps) {
  const atual = etapaAtual(timeline);

  return (
    <ol className={cn("space-y-0", className)}>
      {ETAPAS_ORDEM.map((etapa, index) => {
        const done = etapaConcluida(timeline, etapa);
        const current = atual === etapa;
        const pending = !done;
        const evento = timeline.find((e) => e.etapa === etapa);
        const meta = ETAPA_META[etapa];

        return (
          <li key={etapa} className="relative flex gap-3 pb-6 last:pb-0">
            {index < ETAPAS_ORDEM.length - 1 && (
              <span
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5",
                  done ? "bg-accent" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                done && "border-accent bg-accent text-primary-foreground",
                current && !done && "border-accent bg-background text-accent",
                pending && !current && "border-border bg-muted text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" />
              ) : current ? (
                <Clock className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-2 w-2 fill-current" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  done || current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {meta.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {descricaoParaTimeline(meta.descricao)}
              </p>
              {evento && (
                <p className="mt-1 text-xs text-accent">
                  {new Date(evento.em).toLocaleString("pt-BR")}
                  {evento.entregaTipo &&
                    ` · ${evento.entregaTipo === "transporte" ? "Transportadora" : "Retirada no local"}`}
                  {evento.observacao && ` · ${evento.observacao}`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
