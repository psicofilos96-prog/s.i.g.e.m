import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import axe from "axe-core";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: state.pathname } }),
}));
vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => ({ status: "signed-out" }),
  useSessionUser: () => ({ loading: false, user: null, revision: 0 }),
  sessionContextKey: () => null,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, rpc: vi.fn() } }));
import { AppShell } from "./app-shell";

const page = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AppShell><h1>A rede, escola por escola</h1></AppShell></QueryClientProvider>);
beforeEach(() => { state.pathname = "/"; });

describe("entrada pública sem contexto institucional fictício", () => {
  it("mantém identidade e acesso, sem menu de trabalho, busca privada ou escola presumida", () => {
    page();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A rede, escola por escola");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Trocar a unidade em que estou atuando" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Demonstrativa|Águas Claras/);
    expect(screen.getByRole("main")).toHaveAttribute("id", "conteudo");
  });

  it("atalho privado não intercepta o teclado antes da autenticação", () => {
    page();
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("estrutura pública mantém os nomes acessíveis e os marcos de navegação", async () => {
    const { container } = page();
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
});
