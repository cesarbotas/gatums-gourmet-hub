import { usuariosService, type Usuario } from "./api/usuarios";

export function findCustomerAccount(users: Usuario[], email: string): Usuario | undefined {
  const normalized = email.trim().toLowerCase();
  return users.find((user) => user.email.trim().toLowerCase() === normalized);
}

/** The external API authorizes both creation and role assignment. */
export async function saveCustomerAccount(input: { nome: string; email: string; telefone: string; roleId: number; senha?: string }) {
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) throw new Error("Selecione um perfil válido.");
  const users = await usuariosService.list();
  const account = findCustomerAccount(users, input.email);
  if (account) {
    await usuariosService.setRoles(account.id, [input.roleId]);
    return account.id;
  }
  if (!input.senha?.trim()) throw new Error("Informe uma senha inicial para criar o usuário deste cliente.");
  const created = await usuariosService.create({
    nome: input.nome, email: input.email.trim(), telefone: input.telefone,
    senha: input.senha, roleIds: [input.roleId],
  });
  return created.id;
}