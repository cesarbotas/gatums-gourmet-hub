import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { produtosService, PAGE_SIZE_OPTIONS, type Produto } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: AdminProdutosPage,
});

const empty: Omit<Produto, "id" | "criadoEm"> = {
  nome: "",
  descricao: "",
  categoria: "",
  preco: 0,
  foto: "",
  disponivel: true,
};

function AdminProdutosPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    produtosService.list({ page, pageSize }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
  };

  useEffect(load, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const startCreate = () => {
    setEditing(null);
    setForm(empty);
    setView("form");
  };
  const startEdit = (p: Produto) => {
    setEditing(p);
    const { id: _i, criadoEm: _c, ...rest } = p;
    setForm(rest);
    setView("form");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await produtosService.update(editing.id, form);
        toast.success("Produto atualizado");
      } else {
        await produtosService.create(form);
        toast.success("Produto criado");
      }
      setView("list");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    await produtosService.remove(p.id);
    toast.success("Produto excluído");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie o catálogo da Gatums Gourmet.
          </p>
        </div>
        {view === "list" ? (
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> Novo produto
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
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.foto}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                      <div>
                        <p className="font-medium text-foreground">{p.nome}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {p.descricao}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.categoria}</td>
                  <td className="px-4 py-3 font-medium">R$ {p.preco.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.disponivel
                          ? "bg-accent/15 text-accent"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.disponivel ? "Disponível" : "Esgotado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(p)}
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
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPage={setPage}
            onPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h2 className="font-display text-xl text-foreground">
              {editing ? "Editar produto" : "Novo produto"}
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
            <Label htmlFor="categoria">Categoria</Label>
            <Input
              id="categoria"
              required
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              required
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="preco">Preço (R$)</Label>
            <Input
              id="preco"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="foto">URL da foto</Label>
            <Input
              id="foto"
              type="url"
              required
              value={form.foto}
              onChange={(e) => setForm({ ...form, foto: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              id="disponivel"
              checked={form.disponivel}
              onCheckedChange={(v) => setForm({ ...form, disponivel: v })}
            />
            <Label htmlFor="disponivel" className="cursor-pointer">
              Disponível para venda
            </Label>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar produto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setView("list")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (n: number) => void;
  onPageSize: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Mostrando</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
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
          onClick={() => onPage(page - 1)}
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
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
