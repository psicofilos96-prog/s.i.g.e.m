import { describe, it, expect } from "vitest";
import { projectDesignations, myStudentsOn, canOperate, planSubstitution, designationHistory, type MediationRow, type EngagementRef } from "./mediator-designations";
import type { FunctionConfig } from "./mediator-architecture";

const eng: EngagementRef[] = [
  { id: "gA", personId: "m1", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gB", personId: "m1", schoolId: "sB", from: "2026-02-01", to: null },
  { id: "gP", personId: "p2", schoolId: "sA", from: "2026-02-01", to: null },
  { id: "gS", personId: "sub", schoolId: "sA", from: "2026-03-01", to: "2026-03-31" },
];
const row = (o: Partial<MediationRow> & Pick<MediationRow, "id" | "logical_id" | "version">): MediationRow => ({
  supersedes_id: null, event_kind: "registro", school_id: "sA", student_id: "e1", class_id: "5A",
  mediator_engagement_id: "gA", valid_from: "2026-02-01", valid_to: null, reason: null, ...o,
});
const rows: MediationRow[] = [
  row({ id: "a1", logical_id: "L1", version: 1 }),
  row({ id: "a2", logical_id: "L1", version: 2, supersedes_id: "a1", event_kind: "retificacao", class_id: "5B", reason: "mudança de turma" }),
  row({ id: "b1", logical_id: "L2", version: 1, school_id: "sB", student_id: "e7", class_id: "3A", mediator_engagement_id: "gB" }),
  row({ id: "c1", logical_id: "L3", version: 1, mediator_engagement_id: "gP" }), // coexistência no mesmo estudante
  row({ id: "d1", logical_id: "L4", version: 1, student_id: "e2" }),
  row({ id: "d2", logical_id: "L4", version: 2, supersedes_id: "d1", event_kind: "encerramento", student_id: "e2", valid_to: "2026-04-30", reason: "revogado" }),
];
const fn = (l: string) => ({ L1: "mediador-escolar", L2: "mediador-escolar", L3: "profissional-de-apoio-escolar", L4: "mediador-escolar" } as Record<string, string>)[l] ?? null;
const cfg = (functionId: string, competences: string[]): FunctionConfig => ({ functionId, label: functionId, competences, homologated: true, source: "decisão", validFrom: "2026-01-01", validTo: null });
const configs = [cfg("mediador-escolar", ["registro-diario"]), cfg("profissional-de-apoio-escolar", ["apoio-higiene"])];
const { designations: ds } = projectDesignations(rows, eng, fn);

describe("Mediador L02 — designações e acesso temporal", () => {
  it("múltiplas escolas: cada escola só pela própria atuação", () => {
    expect(myStudentsOn("m1", ds, eng, "2026-03-10").map((s) => `${s.schoolId}:${s.studentId}`).sort()).toEqual(["sA:e1", "sA:e2", "sB:e7"]);
    expect(canOperate({ personId: "m1", studentId: "e7", schoolId: "sA", date: "2026-03-10", operation: "registro-diario", designations: ds, engagements: eng, configs }).ok).toBe(false);
  });
  it("mudança de turma é retificação: cabeça vigente com nova turma, histórico preservado", () => {
    expect(ds.find((d) => d.logicalId === "L1")?.classId).toBe("5B");
    expect(designationHistory(rows, "L1").map((h) => h.classId)).toEqual(["5A", "5B"]);
  });
  it("revogação encerra acesso após a data final, sem apagar o histórico", () => {
    const op = { personId: "m1", studentId: "e2", schoolId: "sA", operation: "registro-diario", designations: ds, engagements: eng, configs };
    expect(canOperate({ ...op, date: "2026-04-30" }).ok).toBe(true);
    expect(canOperate({ ...op, date: "2026-05-01" }).ok).toBe(false);
    expect(designationHistory(rows, "L4")).toHaveLength(2);
  });
  it("coexistência: profissionais diferentes no mesmo estudante não herdam competências", () => {
    const op = { studentId: "e1", schoolId: "sA", date: "2026-03-10", designations: ds, engagements: eng, configs };
    expect(canOperate({ ...op, personId: "m1", operation: "registro-diario" }).ok).toBe(true);
    expect(canOperate({ ...op, personId: "m1", operation: "apoio-higiene" }).ok).toBe(false);
    expect(canOperate({ ...op, personId: "p2", operation: "apoio-higiene" }).ok).toBe(true);
    expect(canOperate({ ...op, personId: "p2", operation: "registro-diario" }).ok).toBe(false);
  });
  it("sem função declarada ou sem config homologada: nada", () => {
    const { designations } = projectDesignations(rows, eng, () => null);
    expect(canOperate({ personId: "m1", studentId: "e1", schoolId: "sA", date: "2026-03-10", operation: "registro-diario", designations, engagements: eng, configs }).ok).toBe(false);
    expect(canOperate({ personId: "m1", studentId: "e1", schoolId: "sA", date: "2026-03-10", operation: "registro-diario", designations: ds, engagements: eng, configs: [] }).ok).toBe(false);
  });
  it("substituição: só no período do titular e da atuação do substituto", () => {
    const holder = ds.find((d) => d.logicalId === "L1")!;
    const sub = eng.find((e) => e.id === "gS")!;
    expect(planSubstitution(holder, sub, "2026-03-05", "2026-03-20", "licença").ok).toBe(true);
    expect(planSubstitution(holder, sub, "2026-03-05", "2026-04-10", "licença").ok).toBe(false);
    expect(planSubstitution(holder, sub, "2026-03-05", "2026-03-20", " ").ok).toBe(false);
    expect(planSubstitution(holder, eng.find((e) => e.id === "gB")!, "2026-03-05", "2026-03-20", "x").ok).toBe(false);
  });
  it("cadeia corrompida e atuação de outra escola são recusadas", () => {
    const bad = [...rows, row({ id: "x2", logical_id: "L1", version: 3, supersedes_id: "a1" })];
    expect(projectDesignations(bad, eng, fn).rejected).toContain("L1");
    expect(projectDesignations([row({ id: "y", logical_id: "L9", version: 1, mediator_engagement_id: "gB" })], eng, fn).rejected).toEqual(["L9"]);
  });
});
