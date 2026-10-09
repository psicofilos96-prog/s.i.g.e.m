import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let caps: { capabilityId: string }[] = [];
const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => <a>{children as never}</a>,
  useNavigate: () => navigate,
}));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => ({ status: "signed-in", capabilities: caps }) }));
const section = vi.fn();
vi.mock("@/features/institutional-admin/schools-admin-section", () => ({
  SchoolsAdminSection: (p: { focus: { schoolId: string | null }; onExit: (s: boolean) => void }) => { section(p); return <button onClick={() => p.onExit(true)}>salvar</button>; },
}));
import { UnitEditorPage } from "./unit-editor-page";

describe("Nova/Editar unidade", () => {
  beforeEach(() => { section.mockClear(); navigate.mockClear(); });
  it("sem a capacidade de rede, não abre o formulário", () => {
    caps = [];
    render(<UnitEditorPage schoolId={null} />);
    expect(screen.getByText("Sem permissão para alterar o cadastro")).toBeTruthy();
    expect(section).not.toHaveBeenCalled();
  });
  it("com a capacidade, edita a unidade pedida e volta à lista ao salvar", () => {
    caps = [{ capabilityId: "manter-cadastro-unidade-escolar" }];
    render(<UnitEditorPage schoolId="inep-33000000" />);
    expect(section.mock.calls[0][0].focus).toEqual({ schoolId: "inep-33000000" });
    screen.getByText("salvar").click();
    expect(navigate).toHaveBeenCalledWith({ to: "/unidades" });
  });
});
