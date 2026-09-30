import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { setDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
import { AssessmentStructurePage } from "./assessment-structure-page";

vi.mock("@/features/authority/session-authority", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/authority/session-authority")>()),
  useSessionAuthority: () => ({ status: "signed-in", user: { id: "institutional-user" }, person: null, capabilities: [] }),
}));
vi.mock("./assessment-normative-sources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assessment-normative-sources")>()),
  useAssessmentNormativeSource: () => ({ origin: "banco", ready: true, state: { kind: "inexistente", reason: "Organização oficial indisponível." }, rules: [] }),
}));

afterEach(() => setDiaryPersistenceMode("laboratorio"));

describe("Visão Geral em sessão institucional", () => {
  it("aguarda o modo institucional antes de resolver um ID que também existe no laboratório", () => {
    setDiaryPersistenceMode("laboratorio");
    render(<AssessmentStructurePage classId="tur-001" search={{}} />);
    expect(screen.getByLabelText("Carregando estrutura avaliativa")).toBeInTheDocument();
    expect(screen.queryByText(/Configuração demonstrativa/)).toBeNull();
  });
  it("com modo institucional não usa turma demonstrativa que tenha o mesmo ID", () => {
    setDiaryPersistenceMode("cloud");
    render(<AssessmentStructurePage classId="tur-001" search={{}} />);
    expect(screen.getByText("Turma não encontrada")).toBeInTheDocument();
    expect(screen.getByText(/turma institucional acessível/)).toBeInTheDocument();
    expect(screen.queryByText(/Configuração demonstrativa/)).toBeNull();
  });
});
