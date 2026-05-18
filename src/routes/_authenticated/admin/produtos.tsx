import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, Upload, Package, Boxes } from "lucide-react";
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
import {
  produtosService,
  PAGE_SIZE_OPTIONS,
  CATEGORIAS,
  type Produto,
  type TipoProduto,
  type ItemCombo,
} from "@/lib/api";
import { resolveComboItens } from "@/lib/combo-display";
import { ComboItensList } from "@/components/ComboItensList";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: AdminProdutosPage,
});

const empty: Omit<Produto, "id" | "criadoEm"> = {
  nome: "",
  descricao: "",
  categoria: "Geleias",
  preco: 0,
  foto: "",
  disponivel: true,
  tipo: "simples",
  itens: [],
};

function AdminProdutosPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    produtosService.list({ page, pageSize }).then((r) => {
      setItems(r.items);
      setTotal(r.total);
    });
    produtosService.list({ pageSize: 500 }).then((r) => setAllProdutos(r.items));
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
    setForm({ ...rest, itens: rest.itens ?? [] });
    setView("form");
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 2MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, foto: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const addItemCombo = (produtoId: string) => {
    if (!produtoId) return;
    if (form.itens?.some((i) => i.produtoId === produtoId)) return;
    setForm({ ...form, itens: [...(form.itens ?? []), { produtoId, quantidade: 1 }] });
  };
  const setItemQty = (produtoId: string, q: number) =>
    setForm({
      ...form,
      itens: (form.itens ?? []).map((i) => (i.produtoId === produtoId ? { ...i, quantidade: q } : i)),
    });
  const removeItem = (produtoId: string) =>
    setForm({ ...form, itens: (form.itens ?? []).filter((i) => i.produtoId !== produtoId) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.tipo === "combo" && (form.itens ?? []).length === 0) {
      toast.error("Combo precisa ter ao menos 1 produto.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, itens: form.tipo === "combo" ? form.itens : [] };
      if (editing) {
        await produtosService.update(editing.id, payload);
        toast.success("Produto atualizado");
      } else {
        await produtosService.create(payload);
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

  const produtoNome = (id: string) => allProdutos.find((p) => p.id === id)?.nome ?? "—";

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
                <th className="px-4 py-3">Tipo</th>
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
                      <img src={p.foto} alt="" className="h-10 w-10 rounded-md object-cover" />
                      <div>
                        <p className="font-medium text-foreground">{p.nome}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{p.descricao}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {p.tipo === "combo" ? <Boxes className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                      {p.tipo === "combo" ? "Combo" : "Simples"}
                    </span>
                    {p.tipo === "combo" && (
                      <ComboItensList
                        itens={resolveComboItens(p, allProdutos)}
                        compact
                        className="mt-2 max-w-[220px]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.categoria}</td>
                  <td className="px-4 py-3 font-medium">R$ {p.preco.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.disponivel ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
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
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v as TipoProduto })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Produto simples</SelectItem>
                <SelectItem value="combo">Combo (vários produtos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
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

          <div className="flex items-center gap-3">
            <Switch
              id="disponivel"
              checked={form.disponivel}
              onCheckedChange={(v) => setForm({ ...form, disponivel: v })}
            />
            <Label htmlFor="disponivel" className="cursor-pointer">
              Disponível para venda
            </Label>
          </div>

          <div className="md:col-span-2">
            <Label>Imagem do produto</Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {form.foto ? (
                  <img src={form.foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem foto</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="URL da imagem (https://...)"
                  type="url"
                  value={form.foto.startsWith("data:") ? "" : form.foto}
                  onChange={(e) => setForm({ ...form, foto: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Enviar do dispositivo
                  </Button>
                  {form.foto && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, foto: "" })}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP até 2MB. Você também pode colar uma URL.
                </p>
              </div>
            </div>
          </div>

          {form.tipo === "combo" && (
            <div className="md:col-span-2 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium text-foreground">Itens do combo</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione os produtos que compõem este combo.
                  </p>
                </div>
                <Select onValueChange={addItemCombo}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Adicionar produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allProdutos
                      .filter((p) => p.tipo === "simples" && p.id !== editing?.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 space-y-2">
                {(form.itens ?? []).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum item no combo ainda.
                  </p>
                )}
                {(form.itens ?? []).map((it: ItemCombo) => (
                  <div
                    key={it.produtoId}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span className="flex-1 text-sm text-foreground">{produtoNome(it.produtoId)}</span>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantidade}
                      onChange={(e) =>
                        setItemQty(it.produtoId, Math.max(1, Number(e.target.value)))
                      }
                      className="h-8 w-20"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(it.produtoId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>de {total} registros</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-muted-foreground">
          Página <strong className="text-foreground">{page}</strong> de {totalPages}
        </span>
        <Button size="icon" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
