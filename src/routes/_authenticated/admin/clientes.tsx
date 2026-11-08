import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
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
import { clientesService, rolesService, usuariosService, type Role, type Usuario, type Cliente } from "@/lib/api";
import { enderecosService, type Endereco } from "@/lib/api/enderecos";
import { EnderecoForm, emptyEndereco } from "@/components/EnderecoForm";
import { SearchPagination } from "@/components/SearchPagination";
import { findCustomerAccount, saveCustomerAccount } from "@/lib/customer-account";
import { pageHead } from "@/lib/route-head";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => pageHead("Clientes — Gatums Gourmet", "Pesquise clientes e gerencie os perfis de acesso."),
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
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(empty);
  const [endereco, setEndereco] = useState<Endereco>(emptyEndereco);

  const load = () => {
    setListLoading(true); setListError("");
    clientesService.list({ page, pageSize, search }).then((r) => {
      setItems(r.items); setTotal(r.total);
    }).catch((err) => { setItems([]); setTotal(0); setListError(err instanceof Error ? err.message : "Erro ao pesquisar clientes."); }).finally(() => setListLoading(false));
  };
  useEffect(load, [page, pageSize, search]);

  const loadAccess = async () => {
    setAccessLoading(true); setAccessError("");
    try {
      const [availableRoles, accounts] = await Promise.all([rolesService.list(), usuariosService.list()]);
      setRoles(availableRoles); setUsers(accounts);
    } catch (err) { setAccessError(err instanceof Error ? err.message : "Não foi possível carregar os perfis."); }
    finally { setAccessLoading(false); }
  };
  useEffect(() => { void loadAccess(); }, []);
  const account = findCustomerAccount(users, form.email);
  const defaultRole = roles.find((role) => role.nome.toLowerCase() === "cliente");
  const startEdit = async (customer: Cliente) => {
    setEditing(customer); setForm(customer); setPassword("");
    const linked = findCustomerAccount(users, customer.email);
    const role = roles.find((role) => linked?.roles?.some((name) => name.toLowerCase() === role.nome.toLowerCase()));
    setRoleId(String(role?.id ?? defaultRole?.id ?? ""));
    setEndereco(customer.endereco ?? { ...emptyEndereco, cidade: customer.cidade });
    setView("form");
    try {
      const address = await enderecosService.getPrincipal(customer.id);
      if (address) setEndereco(address);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível carregar o endereço."); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!roleId || accessLoading || accessError) { toast.error("Carregue e selecione o perfil do cliente."); return; }
    if (!editing && (!endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.uf)) {
      toast.error("Preencha o endereço completo (use a busca por CEP)"); return;
    }
    setSaving(true);
    let customerSaved = false;
    try {
      // Preflight prevents a missing password from saving a half-complete registration.
      const accounts = await usuariosService.list();
      setUsers(accounts);
      if (!findCustomerAccount(accounts, form.email) && !password.trim()) {
        throw new Error("Informe uma senha inicial para criar o usuário deste cliente.");
      }
      const payload = { ...form, cidade: endereco.cidade || form.cidade };
      const customer = editing
        ? await clientesService.update(editing.id, payload)
        : await clientesService.create({ ...payload, endereco });
      customerSaved = true;
      // Keep the returned ID so a retry cannot create a duplicate CRM customer.
      setEditing(customer);
      await saveCustomerAccount({ nome: form.nome, email: form.email, telefone: form.telefone, roleId: Number(roleId), senha: password });
      if (endereco.cep && endereco.logradouro) {
        await enderecosService.save(customer.id, { ...endereco, principal: true });
      }
      toast.success("Cliente e perfil salvos");
      setPassword(""); setView("list"); load(); await loadAccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(customerSaved ? `Dados do cliente salvos, mas há uma pendência: ${message}. Tente salvar novamente.` : message);
    } finally { setSaving(false); }
  };

  const remove = async (c: Cliente) => {
    if (!confirm(`Excluir cliente "${c.nome}"?`)) return;
    try { await clientesService.remove(c.id); toast.success("Cliente excluído"); load(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir cliente."); }
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
              setEndereco(emptyEndereco); setPassword(""); setRoleId(String(defaultRole?.id ?? ""));
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

      {view === "list" && <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input aria-label="Pesquisar clientes" className="w-full sm:max-w-sm" placeholder="Buscar cliente por nome ou e-mail..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        {search && <Button variant="ghost" onClick={() => { setSearch(""); setPage(1); }}><X className="h-4 w-4" /> Limpar filtros</Button>}
        {listLoading && <p role="status" className="text-sm text-muted-foreground">Pesquisando...</p>}
        {listError && <p role="alert" className="text-sm text-destructive">{listError}</p>}
      </div>}
      {view === "list" ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Perfil</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{accessLoading ? "Carregando..." : accessError ? "Indisponível" : findCustomerAccount(users, c.email)?.roles?.join(", ") || "Sem usuário"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar cliente ${c.nome}`}
                        title="Editar cliente"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Excluir cliente ${c.nome}`}
                        title="Excluir cliente"
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
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
          <SearchPagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
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
            <Label htmlFor="customer-role">Perfil de acesso</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={accessLoading || !!accessError}>
              <SelectTrigger id="customer-role"><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
              <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={String(role.id)}>{role.nome}</SelectItem>)}</SelectContent>
            </Select>
            {account && <p className="mt-2 text-xs text-muted-foreground">Perfil atual: {account.roles?.join(", ") || "Sem perfil"}</p>}
            {accessError && <><p role="alert" className="mt-2 text-xs text-destructive">{accessError}</p><Button type="button" variant="outline" size="sm" onClick={loadAccess}>Tentar novamente</Button></>}
          </div>
          {!account && !accessLoading && !accessError && <div>
            <Label htmlFor="customer-password">Senha inicial do usuário</Label>
            <Input id="customer-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>}
          <div className="md:col-span-2">
            <h3 className="mt-2 text-sm font-semibold text-foreground">Endereço</h3>
            <p className="text-xs text-muted-foreground">
              Informe o CEP e use a busca para preencher automaticamente.
            </p>
            <div className="mt-3">
              <EnderecoForm value={endereco} onChange={setEndereco} showPrincipal />
            </div>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={saving || accessLoading || !!accessError}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
            <Button type="button" variant="outline" onClick={() => setView("list")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
