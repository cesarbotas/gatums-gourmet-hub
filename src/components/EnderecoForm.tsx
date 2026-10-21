import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { consultarCep, type Endereco } from "@/lib/api/enderecos";

interface Props {
  value: Endereco;
  onChange: (v: Endereco) => void;
  showPrincipal?: boolean;
}

export function EnderecoForm({ value, onChange, showPrincipal }: Props) {
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof Endereco>(k: K, v: Endereco[K]) =>
    onChange({ ...value, [k]: v });

  const buscar = async () => {
    if (!value.cep) return;
    setLoading(true);
    try {
      const data = await consultarCep(value.cep);
      onChange({ ...value, ...data });
      toast.success("Endereço encontrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao buscar CEP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <Label htmlFor="cep">CEP</Label>
        <div className="flex gap-2">
          <Input
            id="cep"
            placeholder="00000-000"
            value={value.cep}
            onChange={(e) => set("cep", e.target.value)}
            onBlur={() => value.cep && !value.logradouro && buscar()}
            maxLength={9}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={buscar}
            disabled={loading}
            title="Buscar CEP"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="sm:col-span-4">
        <Label htmlFor="logradouro">Logradouro</Label>
        <Input
          id="logradouro"
          value={value.logradouro}
          onChange={(e) => set("logradouro", e.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="numero">Número</Label>
        <Input
          id="numero"
          value={value.numero}
          onChange={(e) => set("numero", e.target.value)}
        />
      </div>
      <div className="sm:col-span-4">
        <Label htmlFor="complemento">Complemento</Label>
        <Input
          id="complemento"
          value={value.complemento ?? ""}
          onChange={(e) => set("complemento", e.target.value)}
        />
      </div>

      <div className="sm:col-span-3">
        <Label htmlFor="bairro">Bairro</Label>
        <Input
          id="bairro"
          value={value.bairro}
          onChange={(e) => set("bairro", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="cidade">Cidade</Label>
        <Input
          id="cidade"
          value={value.cidade}
          onChange={(e) => set("cidade", e.target.value)}
        />
      </div>
      <div className="sm:col-span-1">
        <Label htmlFor="uf">UF</Label>
        <Input
          id="uf"
          maxLength={2}
          value={value.uf}
          onChange={(e) => set("uf", e.target.value.toUpperCase())}
        />
      </div>

      <div className="sm:col-span-6">
        <Label htmlFor="referencia">Ponto de referência</Label>
        <Input
          id="referencia"
          value={value.referencia ?? ""}
          onChange={(e) => set("referencia", e.target.value)}
        />
      </div>

      {showPrincipal && (
        <label className="flex items-center gap-2 text-sm sm:col-span-6">
          <input
            type="checkbox"
            checked={!!value.principal}
            onChange={(e) => set("principal", e.target.checked)}
          />
          Endereço principal de entrega
        </label>
      )}
    </div>
  );
}

export const emptyEndereco: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  referencia: "",
  principal: true,
};
