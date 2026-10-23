import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Categoria } from "@/lib/api";

interface CategoriaComboboxProps {
  categorias: Categoria[];
  /** Valor selecionado como string: id da categoria (String(id)) ou o sentinel. */
  value: string;
  onChange: (value: string) => void;
  /** Texto do botão quando nada está selecionado. */
  placeholder?: string;
  /** Opção fixa no topo (ex.: filtro "Todas as categorias"). Não é filtrável. */
  allOption?: { value: string; label: string };
  className?: string;
  disabled?: boolean;
}

/**
 * Select de categoria com busca (Popover + Command). Substitui o <Select> quando
 * há muitas categorias — o CommandInput filtra a lista por nome enquanto digita.
 */
export function CategoriaCombobox({
  categorias,
  value,
  onChange,
  placeholder = "Selecione a categoria",
  allOption,
  className,
  disabled,
}: CategoriaComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    allOption && value === allOption.value
      ? allOption.label
      : categorias.find((c) => String(c.id) === value)?.nome;

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria..." />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            <CommandGroup>
              {allOption && (
                <CommandItem
                  // value fixo para o sentinel nunca ser filtrado por nome
                  value={allOption.label}
                  onSelect={() => select(allOption.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === allOption.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {allOption.label}
                </CommandItem>
              )}
              {categorias.map((c) => (
                <CommandItem key={c.id} value={c.nome} onSelect={() => select(String(c.id))}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(c.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {c.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
