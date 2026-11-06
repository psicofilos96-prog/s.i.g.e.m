import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { comparableFollowupVisits, FollowupVisitComparison } from "./visit-comparison";
import type { FollowupVisit } from "./model";

const visit = (id: string, day: string, diagnosis: string, changes: Partial<FollowupVisit> = {}): FollowupVisit => ({
  id, logical_id: id, version: 1, school_id: "s1", visit_date: day,
  diagnosis, strengths: "", weaknesses: "", summary: null,
  participants_note: null, purpose_note: null, correction_reason: null,
  supersedes_id: null, created_at: day + "T10:00:00Z", author_name: "Equipe",
  ...changes,
});

describe("comparação descritiva de visitas institucionais", () => {
  it("limita a unidade e usa versão vigente por visita lógica, não retificação como outra visita", () => {
    const original = visit("old", "2026-09-01", "Texto substituído", { logical_id: "logical-a" });
    const corrected = visit("current", "2026-09-01", "Texto corrigido", {
      logical_id: "logical-a", version: 2, supersedes_id: "old",
      created_at: "2026-10-20T11:00:00Z",
    });
    const next = visit("next", "2026-10-01", "Visita posterior");
    const forbidden = visit("foreign", "2026-11-01", "Outra escola", { school_id: "s2" });
    const ordered = comparableFollowupVisits([original, forbidden, corrected, next], "s1");
    expect(ordered.map((v) => v.id)).toEqual(["next", "current"]);
    expect(ordered[1]?.diagnosis).toBe("Texto corrigido");
    expect(comparableFollowupVisits([forbidden], "s1")).toEqual([]);
  });

  it("informa insuficiência sem inventar visita ou conclusão", () => {
    const { rerender } = render(<FollowupVisitComparison schoolId="s1" visits={[]} />);
    expect(screen.getByText(/São necessárias pelo menos duas visitas distintas/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    rerender(<FollowupVisitComparison schoolId="s1" visits={[
      visit("a", "2026-09-01", "Único diagnóstico"),
    ]} />);
    expect(screen.getByText(/São necessárias pelo menos duas visitas distintas/)).toBeTruthy();
  });

  it("mostra os dois relatos sem interpretar progresso e permite mudar seleção", () => {
    const data = [
      visit("old", "2026-08-10", "Diagnóstico antigo", { strengths: "Equipe formada", weaknesses: "Biblioteca",
        summary: "Planejar revisão", purpose_note: "Primeira análise",
        participants_note: "Servidor de acompanhamento" }),
      visit("middle", "2026-09-15", "Diagnóstico intermediário"),
      visit("new", "2026-10-05", "Diagnóstico recente", { strengths: "Equipe presente", weaknesses: "Acervo",
        summary: "Revisar providências" }),
    ];
    render(<FollowupVisitComparison schoolId="s1" visits={data} />);
    const section = screen.getByRole("region", { name: "Comparar visitas registradas" });
    expect(within(section).getByText("Diagnóstico intermediário")).toBeTruthy();
    expect(within(section).getByText("Diagnóstico recente")).toBeTruthy();
    expect(within(section).queryByText("Diagnóstico antigo")).toBeNull();
    expect(within(section).getByText(/não estabelece evolução, qualidade/)).toBeTruthy();

    fireEvent.change(within(section).getByRole("combobox", { name: "Primeira visita escolhida" }),
      { target: { value: "old" } });
    expect(within(section).getByText("Diagnóstico antigo")).toBeTruthy();
    expect(within(section).getByText("Primeira análise")).toBeTruthy();
    expect(within(section).getByText("Servidor de acompanhamento")).toBeTruthy();
    expect(within(section).queryByText("Diagnóstico intermediário")).toBeNull();

    fireEvent.change(within(section).getByRole("combobox", { name: "Segunda visita escolhida" }),
      { target: { value: "old" } });
    expect(within(section).getByText(/Selecione duas visitas diferentes/)).toBeTruthy();
    expect(within(section).queryByText("Diagnóstico antigo")).toBeNull();
    fireEvent.change(within(section).getByRole("combobox", { name: "Segunda visita escolhida" }),
      { target: { value: "middle" } });
    expect(within(section).getByText("Diagnóstico antigo")).toBeTruthy();
    expect(within(section).getByText("Diagnóstico intermediário")).toBeTruthy();
  });
});
