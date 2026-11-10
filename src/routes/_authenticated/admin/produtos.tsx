import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Package,
  Boxes,
  Loader2,
} from "lucide-react";
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
  categoriasService,
  imagensService,
  TAMANHO_MAX_IMAGEM,
  TIPOS_IMAGEM_ACEITOS,
  type Produto,
  type Categoria,
  type TipoProduto,
  type ItemCombo,
  type TipoMovimentoEstoque,
  estoqueBaixo,
} from "@/lib/api";
import { resolveComboItens } from "@/lib/combo-display";
import { ComboItensList } from "@/components/ComboItensList";
import { CategoriaCombobox } from "@/components/CategoriaCombobox";
import { SearchPagination } from "@/components/SearchPagination";
import { pageHead } from "@/lib/route-head";
import { PrecoInput } from "@/components/PrecoInput";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  head: () => pageHead("Produtos — Gatums Gourmet", "Pesquise produtos por nome, categoria, tipo e disponibilidade."),
  component: AdminProdutosPage,
});

const empty: Omit<Produto, "id" | "criadoEm"> = {
  nome: "",
  descricao: "",
  categoriaId: 0,
  categoriaNome: "",
  preco: 0,
  foto: "",
  disponivel: true,
  tipo: "simples",
  itens: [],
  estoque: 0,
  estoqueMinimo: 0,
  estoqueInicial: 0,
};

function EstoqueBadge({ p }: { p: Produto }) {
  const low = estoqueBaixo(p);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${low ? "bg-destructive/15 text-destructive" : "bg-secondary text-secondary-foreground"}`} title={`Mínimo: ${p.estoqueMinimo}`}>
      {p.estoque} un.{low ? " · Estoque baixo" : ""}
    </span>
  );
}

function AdminProdutosPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("todas");
  const [filterType, setFilterType] = useState<TipoProduto | "todos">("todos");
  const [filterAvailable, setFilterAvailable] = useState("todos");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [ajTipo, setAjTipo] = useState<Exclude<TipoMovimentoEstoque, "venda">>("entrada");
  const [ajQtd, setAjQtd] = useState("");
  const [ajObs, setAjObs] = useState("");
  const [ajSaving, setAjSaving] = useState(false);

  const ajustarEstoque = async () => {
    if (!editing) return;
    const q = Number(ajQtd);
    if (!Number.isFinite(q) || q === 0 || (ajTipo !== "ajuste" && q < 0)) {
      toast.error(ajTipo === "ajuste" ? "Informe uma quantidade diferente de zero (+/-)." : "Informe uma quantidade maior que zero.");
      return;
    }
    setAjSaving(true);
    try {
      await produtosService.ajustarEstoque(editing.id, { tipo: ajTipo, quantidade: q, observacao: ajObs.trim() });
      const e = await produtosService.getEstoque(editing.id);
      setEditing({ ...editing, ...e });
      setForm((f) => ({ ...f, estoque: e.estoque }));
      setAjQtd(""); setAjObs("");
      toast.success(`Estoque atualizado: ${e.estoque} un.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ajustar estoque");
    } finally {
      setAjSaving(false);
    }
  };

  useEffect(() => {
    categoriasService
      .list({ apenasAtivas: true, pageSize: 500 })
      .then((r) => setCategorias(r.items));
  }, []);

  const load = () => {
    setListLoading(true); setListError("");
    produtosService.list({ page, pageSize, search, categoriaId: filterCategory === "todas" ? undefined : Number(filterCategory), tipo: filterType, disponivel: filterAvailable === "todos" ? undefined : filterAvailable === "true" }).then((r) => {
      setItems(r.items); setTotal(r.total);
    }).catch((err) => { setItems([]); setTotal(0); setListError(err instanceof Error ? err.message : "Erro ao pesquisar produtos."); }).finally(() => setListLoading(false));
  };

  useEffect(load, [page, pageSize, search, filterCategory, filterType, filterAvailable]);
  useEffect(() => { produtosService.list({ pageSize: 500 }).then((r) => setAllProdutos(r.items)).catch(() => setAllProdutos([])); }, []);


  const startCreate = () => {
    setEditing(null);
    setForm(empty);
    setView("form");
  };
  const startEdit = (p: Produto) => {
    setEditing(p);
    const { id: _i, criadoEm: _c, ...rest } = p;
    setForm({ ...rest, itens: rest.itens ?? [] });
    setAjQtd(""); setAjObs(""); setAjTipo("entrada");
    setView("form");
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (!TIPOS_IMAGEM_ACEITOS.includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > TAMANHO_MAX_IMAGEM) {
      toast.error("Imagem muito grande (máx 5MB).");
      return;
    }
    setUploadingImg(true);
    try {
      const url = await imagensService.upload(file);
      setForm((f) => ({ ...f, foto: url }));
      toast.success("Imagem enviada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar imagem";
      toast.error(msg);
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addItemCombo = (produtoId: string) => {
    if (!produtoId) return;
    if (form.itens?.some((i) => i.produtoId === produtoId)) return;
    setForm({ ...form, itens: [...(form.itens ?? []), { produtoId, quantidade: 1 }] });
  };
  const setItemQty = (produtoId: string, q: number) =>
    setForm({
      ...form,
      itens: (form.itens ?? []).map((i) =>
        i.produtoId === produtoId ? { ...i, quantidade: q } : i,
      ),
    });
  const removeItem = (produtoId: string) =>
    setForm({ ...form, itens: (form.itens ?? []).filter((i) => i.produtoId !== produtoId) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.tipo === "combo" && (form.itens ?? []).length === 0) {
      toast.error("Combo precisa ter ao menos 1 produto.");
      return;
    }
    if ((form.estoqueMinimo ?? 0) < 0 || (form.estoqueInicial ?? 0) < 0) {
      toast.error("Estoque não pode ser negativo.");
      return;
    }
    if (!form.categoriaId) {
      toast.error("Selecione uma categoria.");
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

      {view === "list" && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input aria-label="Pesquisar produtos" placeholder="Buscar produto..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <CategoriaCombobox categorias={categorias} value={filterCategory} onChange={(value) => { setFilterCategory(value); setPage(1); }} allOption={{ value: "todas", label: "Todas as categorias" }} />
        <Select value={filterType} onValueChange={(value) => { setFilterType(value as typeof filterType); setPage(1); }}><SelectTrigger aria-label="Filtrar tipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os tipos</SelectItem><SelectItem value="simples">Simples</SelectItem><SelectItem value="combo">Combo</SelectItem></SelectContent></Select>
        <Select value={filterAvailable} onValueChange={(value) => { setFilterAvailable(value); setPage(1); }}><SelectTrigger aria-label="Filtrar disponibilidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem><SelectItem value="true">Disponível</SelectItem><SelectItem value="false">Esgotado</SelectItem></SelectContent></Select>
        {(search || filterCategory !== "todas" || filterType !== "todos" || filterAvailable !== "todos") && <Button variant="ghost" onClick={() => { setSearch(""); setFilterCategory("todas"); setFilterType("todos"); setFilterAvailable("todos"); setPage(1); }}><X className="h-4 w-4" /> Limpar filtros</Button>}
        {listLoading && <p role="status" className="text-sm text-muted-foreground">Pesquisando...</p>}
        {listError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{listError}</p>}
      </div>}
      {view === "list" ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Lista em cartões (celular) */}
          <div className="md:hidden">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 border-t border-border p-4 first:border-t-0"
              >
                <img
                  src={p.foto}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.categoriaNome} · {p.tipo === "combo" ? "Combo" : "Simples"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      R$ {p.preco.toFixed(2)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.disponivel
                          ? "bg-accent/15 text-accent"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.disponivel ? "Disponível" : "Esgotado"}
                    </span>
                    <EstoqueBadge p={p} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button aria-label={`Editar produto ${p.nome}`} title="Editar produto" size="icon" variant="ghost" onClick={() => startEdit(p)}>
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
              </div>
            ))}
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-muted-foreground">
                Nenhum produto cadastrado.
              </p>
            )}
          </div>

          {/* Tabela (desktop) */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Estoque</th>
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
                      {p.tipo === "combo" ? (
                        <Boxes className="h-3.5 w-3.5" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
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
                  <td className="px-4 py-3 text-muted-foreground">{p.categoriaNome}</td>
                  <td className="px-4 py-3 font-medium">R$ {p.preco.toFixed(2)}</td>
                  <td className="px-4 py-3"><EstoqueBadge p={p} /></td>
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
                      <Button aria-label={`Editar produto ${p.nome}`} title="Editar produto" size="icon" variant="ghost" onClick={() => startEdit(p)}>
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
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <SearchPagination
            page={page}
            pageSize={pageSize}
            total={total}
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Produto simples</SelectItem>
                <SelectItem value="combo">Combo (vários produtos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria</Label>
            <CategoriaCombobox
              categorias={categorias}
              value={String(form.categoriaId)}
              onChange={(v) => setForm({ ...form, categoriaId: Number(v) })}
              placeholder="Selecione a categoria"
            />
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
            <Label htmlFor="preco">Preço</Label>
            <PrecoInput
              id="preco"
              required
              value={form.preco}
              onChange={(v) => setForm({ ...form, preco: v })}
            />
          </div>

          {!editing && (
            <div>
              <Label htmlFor="estoqueInicial">Estoque inicial</Label>
              <Input id="estoqueInicial" type="number" min={0} step={1} inputMode="numeric" value={form.estoqueInicial ?? 0} onChange={(e) => setForm({ ...form, estoqueInicial: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
            </div>
          )}

          <div>
            <Label htmlFor="estoqueMinimo">Estoque mínimo</Label>
            <Input id="estoqueMinimo" type="number" min={0} step={1} inputMode="numeric" value={form.estoqueMinimo ?? 0} onChange={(e) => setForm({ ...form, estoqueMinimo: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
            <p className="mt-1 text-xs text-muted-foreground">Alerta de “Estoque baixo” quando o saldo chegar a este valor.</p>
          </div>

          {editing && (
            <div className="md:col-span-2 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Ajustar estoque</p>
                <EstoqueBadge p={editing} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[160px_140px_1fr_auto] sm:items-end">
                <div>
                  <Label>Movimento</Label>
                  <Select value={ajTipo} onValueChange={(v) => setAjTipo(v as typeof ajTipo)}>
                    <SelectTrigger aria-label="Tipo de movimento"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="ajuste">Ajuste (+/-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ajQtd">Quantidade</Label>
                  <Input id="ajQtd" type="number" step={1} value={ajQtd} onChange={(e) => setAjQtd(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ajObs">Observação</Label>
                  <Input id="ajObs" value={ajObs} onChange={(e) => setAjObs(e.target.value)} placeholder="Opcional" />
                </div>
                <Button type="button" variant="outline" disabled={ajSaving} onClick={ajustarEstoque}>
                  {ajSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Aplicar
                </Button>
              </div>
            </div>
          )}

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
                    disabled={uploadingImg}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploadingImg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingImg ? "Enviando..." : "Enviar do dispositivo"}
                  </Button>
                  {form.foto && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploadingImg}
                      onClick={() => setForm({ ...form, foto: "" })}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP até 5MB. Você também pode colar uma URL.
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
                    <span className="flex-1 text-sm text-foreground">
                      {produtoNome(it.produtoId)}
                    </span>
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
