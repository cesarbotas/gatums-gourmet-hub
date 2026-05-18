import type { ComboItemResolvido } from "@/lib/combo-display";
import { cn } from "@/lib/utils";

interface ComboItensListProps {
  itens: ComboItemResolvido[];
  className?: string;
  compact?: boolean;
}

export function ComboItensList({ itens, className, compact }: ComboItensListProps) {
  if (itens.length === 0) return null;

  return (
    <ul
      className={cn(
        "mt-2 space-y-0.5 rounded-lg border border-border/80 bg-secondary/30",
        compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
        className,
      )}
    >
      <li className={cn("font-medium text-muted-foreground", compact ? "text-[10px] uppercase tracking-wide" : "text-xs uppercase tracking-wide")}>
        Itens do combo
      </li>
      {itens.map((item) => (
        <li key={item.produtoId} className="flex justify-between gap-2 text-foreground">
          <span className="truncate">{item.nome}</span>
          <span className="shrink-0 text-muted-foreground">×{item.quantidade}</span>
        </li>
      ))}
    </ul>
  );
}
