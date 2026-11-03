import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mocks das dependências do componente ----------------------------------

// `login` do auth-context: controlado por teste via `loginMock`.
const loginMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login: loginMock }),
}));

// `useRouter().navigate` do TanStack Router. Mockamos o módulo inteiro para
// não precisar montar um router real (ver Notas do brief). `createFileRoute`
// é chamado no top-level de login.tsx, então precisa existir e retornar um
// factory que aceita o objeto de rota.
const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  useRouter: () => ({ navigate: navigateMock }),
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

// `toast` do sonner → no-op.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// `Navigation` (layout) → stub simples para não poluir a renderização.
vi.mock("@/components/Navigation", () => ({
  Navigation: () => <nav data-testid="navigation-stub" />,
}));

// Import após os mocks (hoisting do vi.mock garante que valham, mas mantemos
// o import aqui por clareza).
import { LoginPage } from "@/routes/login";

// --- Setup -----------------------------------------------------------------

beforeEach(() => {
  loginMock.mockReset();
  navigateMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// --- Caso 1: renderiza a tela ----------------------------------------------

describe("LoginPage — renderização", () => {
  it("mostra campo de e-mail, campo de senha e botão Entrar", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });
});

// --- Caso 2: olhinho de senha ----------------------------------------------

describe("LoginPage — olhinho de senha", () => {
  it("alterna o type do input entre password e text", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const password = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
  });
});

// --- Caso 3: roteamento por role -------------------------------------------

describe("LoginPage — roteamento pós-login por role", () => {
  async function submitLogin() {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "user@email.com");
    await user.type(screen.getByLabelText("Senha"), "secret123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
  }

  it("role Admin → navigate para /admin", async () => {
    loginMock.mockResolvedValue({
      id: "1",
      nome: "Adm",
      email: "user@email.com",
      roles: ["Admin"],
    });

    await submitLogin();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/admin" });
    });
  });

  it("role Cliente → navigate para /minha-conta", async () => {
    loginMock.mockResolvedValue({
      id: "2",
      nome: "Cli",
      email: "user@email.com",
      roles: ["Cliente"],
    });

    await submitLogin();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/minha-conta" });
    });
  });
});
