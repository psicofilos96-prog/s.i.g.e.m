import { describe, expect, it } from "vitest";
import { NEI_AREAS, dashTotals, grantShapeProblem, visibleAreas, type NeiAccess } from "./nei-areas";

const acc = (role: string, scope: NeiAccess["scope_kind"] = "escola"): NeiAccess => ({ source: "papel", role, scope_kind: scope, school_id: scope === "rede" ? null : "A", school_name: "Escola A", student_scoped: scope === "caso", valid_until: null, can_manage_staff: false, can_manage_coordinators: false });

describe("NEI.1 áreas", () => {
  it("tem 18 áreas, cada uma com tela existente ou motivo de pendência", () => {
    expect(NEI_AREAS).toHaveLength(18);
    for (const a of NEI_AREAS) expect(Boolean(a.path) !== Boolean(a.pending)).toBe(true);
  });
  it("sem acesso ao NEI, nenhuma área", () => expect(visibleAreas([])).toEqual([]));
  it("AEE não vê laudos nem equipe", () => {
    const ids = visibleAreas([acc("aee")]).map((a) => a.id);
    expect(ids).not.toContain("laudos");
    expect(ids).not.toContain("equipe");
    expect(ids).toContain("aee");
  });
  it("coordenação vê laudos e equipe", () => {
    const ids = visibleAreas([acc("coordenador", "rede")]).map((a) => a.id);
    expect(ids).toContain("laudos");
    expect(ids).toContain("equipe");
  });
});

describe("NEI.1 regras de concessão", () => {
  it("coordenação só na rede", () => expect(grantShapeProblem("coordenador", "escola", "A", "", "motivo ok")).not.toBeNull());
  it("AEE nunca na rede", () => expect(grantShapeProblem("aee", "rede", "", "", "motivo ok")).not.toBeNull());
  it("caso exige estudante", () => expect(grantShapeProblem("tecnico", "caso", "A", "", "motivo ok")).not.toBeNull());
  it("técnico por escola com motivo é aceito", () => expect(grantShapeProblem("tecnico", "escola", "A", "", "Atende a escola A")).toBeNull());
});

describe("NEI.1 totais", () => {
  it("contagem clínica some se alguma escola não a traz", () => {
    const t = dashTotals([
      { school_id: "A", school_name: "A", students_with_record: 2, aee_active: 1, aee_sessions_30d: 3, mediations_active: 1, clinical_students: 1, students_in_case_scope: 0 },
      { school_id: "B", school_name: "B", students_with_record: 1, aee_active: 0, aee_sessions_30d: 0, mediations_active: 0, clinical_students: null, students_in_case_scope: 0 },
    ]);
    expect(t.students).toBe(3);
    expect(t.clinical).toBeNull();
  });
});
