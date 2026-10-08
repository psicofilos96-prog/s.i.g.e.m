import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let state: { loading: boolean; user: unknown } = { loading: false, user: null };
vi.mock("@/features/authority/session-authority", () => ({ useSessionUser: () => ({ ...state, revision: 0 }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: unknown }) => <a>{children as never}</a> }));
import { DemoOnlyRoute } from "./demo-only-route";

describe("DemoOnlyRoute", () => {
  beforeEach(() => { state = { loading: false, user: null }; });
  it("com sessão real não renderiza a demonstração e mostra vazio honesto", () => {
    state = { loading: false, user: { id: "u" } };
    render(<DemoOnlyRoute what="Alunos fictícios." real="/administracao">{() => <p>Aluno Fictício 1</p>}</DemoOnlyRoute>);
    expect(screen.queryByText("Aluno Fictício 1")).toBeNull();
    expect(screen.getByText("Esta tela ainda não lê os dados da rede")).toBeTruthy();
  });
  it("carregando a sessão não abre a demonstração", () => {
    state = { loading: true, user: null };
    render(<DemoOnlyRoute what="x">{() => <p>Aluno Fictício 1</p>}</DemoOnlyRoute>);
    expect(screen.queryByText("Aluno Fictício 1")).toBeNull();
  });
  it("sem sessão o laboratório continua", () => {
    render(<DemoOnlyRoute what="x">{() => <p>Aluno Fictício 1</p>}</DemoOnlyRoute>);
    expect(screen.getByText("Aluno Fictício 1")).toBeTruthy();
  });
});
