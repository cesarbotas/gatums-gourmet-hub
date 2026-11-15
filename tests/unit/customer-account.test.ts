import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCustomerAccount, saveCustomerAccount } from "@/lib/customer-account";
import { usuariosService } from "@/lib/api/usuarios";

vi.mock("@/lib/api/usuarios", () => ({ usuariosService: { list: vi.fn(), create: vi.fn(), setRoles: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

describe("perfil de acesso do cliente", () => {
  it("encontra conta pelo e-mail sem diferenciar caixa ou espaços", () => {
    expect(findCustomerAccount([{ id: "u1", nome: "Ana", email: "ANA@EXEMPLO.COM" }], " ana@exemplo.com ")?.id).toBe("u1");
  });
  it("altera o perfil de um usuário existente sem criar outro", async () => {
    vi.mocked(usuariosService.list).mockResolvedValue([{ id: "u1", nome: "Ana", email: "ana@exemplo.com", roles: ["Cliente"] }]);
    await saveCustomerAccount({ nome: "Ana", email: "ana@exemplo.com", telefone: "13", roleId: 3 });
    expect(usuariosService.setRoles).toHaveBeenCalledWith("u1", [3]);
    expect(usuariosService.create).not.toHaveBeenCalled();
  });
  it("cria o usuário ausente com o perfil selecionado", async () => {
    vi.mocked(usuariosService.list).mockResolvedValue([]);
    vi.mocked(usuariosService.create).mockResolvedValue({ id: "new" });
    expect(await saveCustomerAccount({ nome: "Ana", email: "ana@exemplo.com", telefone: "13", roleId: 2, senha: "test-only" })).toBe("new");
    expect(usuariosService.create).toHaveBeenCalledWith({ nome: "Ana", email: "ana@exemplo.com", telefone: "13", roleIds: [2], senha: "test-only" });
    expect(usuariosService.setRoles).not.toHaveBeenCalled();
  });
  it("não cria usuário sem senha inicial", async () => {
    vi.mocked(usuariosService.list).mockResolvedValue([]);
    await expect(saveCustomerAccount({ nome: "Ana", email: "ana@exemplo.com", telefone: "", roleId: 2 })).rejects.toThrow("senha inicial");
    expect(usuariosService.create).not.toHaveBeenCalled();
  });
  it("não cria usuário quando a consulta de contas falha", async () => {
    vi.mocked(usuariosService.list).mockRejectedValue(new Error("Forbidden"));
    await expect(saveCustomerAccount({ nome: "Ana", email: "ana@exemplo.com", telefone: "", roleId: 2, senha: "test-only" })).rejects.toThrow("Forbidden");
    expect(usuariosService.create).not.toHaveBeenCalled();
  });
});