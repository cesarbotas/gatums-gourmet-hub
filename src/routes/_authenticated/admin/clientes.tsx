import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientesService, PAGE_SIZE_OPTIONS, type Cliente } from "@/lib/api";
import { enderecosService, type Endereco } from "@/lib/api/enderecos";
import { EnderecoForm, emptyEndereco } from "@/components/EnderecoForm";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  component: AdminClientesPage,
});

const empty: Omit<Cliente, "id" | "criadoEm"> = {
  nome: "",
  email: "",
  telefone: "",
  cidade: "",
};

function AdminClientesPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(empty);
  const [endereco, setEndereco] = useState<Endereco>(emptyEndereco);

  const load = () => {
    clientesService.list({ page, pageSize }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };
  useEffect(load, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, cidade: endereco.cidade || form.cidade };
      let cli: Cliente;
      if (editing) {
        cli = await clientesService.update(editing.id, payload);
        toast.success("Cliente atualizado");
      } else {
        cli = await clientesService.create(payload);
        toast.success("Cliente criado");
      }
      if (endereco.cep && endereco.logradouro) {
        await enderecosService.save(cli.id, { ...endereco, principal: true });
      }
      setView("list");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const remove = async (c: Cliente) => {
    if (!confirm(`Excluir cliente "${c.nome}"?`)) return;
    await clientesService.remove(c.id);
    toast.success("Cliente excluído");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro completo dos seus clientes.
          </p>
        </div>
        {view === "list" ? (
          <Button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setEndereco(emptyEndereco);
              setView("form");
            }}
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setView("list")}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        )}
      </div>

      {view === "list" ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telefone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.cidade}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          setEditing(c);
                          const { id: _i, criadoEm: _ce, ...rest } = c;
                          setForm(rest);
                          const end = await enderecosService.getPrincipal(c.id);
                          setEndereco(end ?? { ...emptyEndereco, cidade: c.cidade });
                          setView("form");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(c)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Mostrando</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>de {total} registros</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">
                Página <strong className="text-foreground">{page}</strong> de {totalPages}
              </span>
              <Button
                size="icon"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h2 className="font-display text-xl text-foreground">
              {editing ? "Editar cliente" : "Novo cliente"}
            </h2>
          </div>
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              required
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              required
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit">{editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setView("list")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
