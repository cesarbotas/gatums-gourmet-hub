import { Input } from "@/components/ui/input";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface PrecoInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  placeholder?: string;
}

/**
 * Campo de valor monetário em R$ com máscara pt-BR.
 * O usuário digita apenas números; os centavos são montados da direita
 * para a esquerda (ex.: digitar 1999 vira 19,99).
 */
export function PrecoInput({ id, value, onChange, required, placeholder }: PrecoInputProps) {
  const cents = Math.round((value || 0) * 100);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    onChange(Number(digits || "0") / 100);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-9 text-right"
        value={formatBRL(cents)}
        onChange={handleChange}
        required={required}
        placeholder={placeholder ?? "0,00"}
      />
    </div>
  );
}
