import { describe, expect, it } from "vitest";
import { validateStages, stagesOfYear, schoolChecklist, readiness, canOperateEducacenso, followUp, type StageConfig } from "./census-cycles";
import type { SchoolRow } from "@/features/educacenso/educacenso-control";

const mi: StageConfig = { year: 2026, stageKey: "matricula-inicial", label: "Matrícula Inicial", referenceDate: { value: "2026-05-27", source: "portaria INEP registrada" },
  schedule: [{ milestone: "coleta", from: "2026-06-01", to: "2026-07-31", source: "cronograma INEP" }], requiredDocuments: [{ id: "d", title: "Caderno", sha256: "abc" }], responsibles: [{ role: "CIECE", engagementId: "e1" }] };
const sa: StageConfig = { ...mi, stageKey: "situacao-do-aluno", referenceDate: null, responsibles: [] };
const row = (o: Partial<SchoolRow> = {}): SchoolRow => ({ school_id: "s1", inep: "33012345", head: { seq: 1, state: "conferida-pela-escola", protocol_ref: null, reason: "", actor_scope: "escola", recorded_at: "" }, receipt: { version: 1, issued_at: "", closed_at: null }, enrollments_without_start: 0, ...o });

describe("CIECE L08 ciclos do Censo", () => {
  it("etapas separadas e configuração sem data/responsável denunciada", () => {
    const y = stagesOfYear([mi, sa], 2026);
    expect(y.initial?.stageKey).toBe("matricula-inicial"); expect(y.situation?.stageKey).toBe("situacao-do-aluno");
    const v = validateStages([mi, sa, { ...mi, referenceDate: { value: "2025-05-27", source: "x" } }]);
    expect(v[0].problems).toEqual([]);
    expect(v[1].problems).toEqual(expect.arrayContaining(["sem-data-de-referencia", "responsavel-nao-designado"]));
    expect(v[2].problems).toEqual(expect.arrayContaining(["etapa-duplicada", "data-fora-do-ano-base"]));
  });
  it("checklist: fonte não lida é inconclusiva, nunca pronta; sem recibo é pendente", () => {
    expect(readiness(schoolChecklist(mi, row(), []))).toBe("pronta");
    expect(readiness(schoolChecklist(mi, row(), null))).toBe("inconclusiva");
    expect(readiness(schoolChecklist(mi, row({ enrollments_without_start: 9811 }), []))).toBe("pendente");
    expect(readiness(schoolChecklist(mi, row({ receipt: null }), []))).toBe("pendente");
    expect(followUp(mi, [row(), row({ school_id: "s2", head: null })], []).pendente).toBe(1);
  });
  it("acesso ao SIGEM não autoriza Educacenso", () => {
    expect(canOperateEducacenso("e1", "s1", 2026, []).reason).toBe("sem-habilitacao-educacenso-declarada");
    const op = [{ engagementId: "e1", schoolId: "s1", year: 2026, inepProfile: "gestor-escolar", declaredBy: "ciece", evidenceRef: "" }];
    expect(canOperateEducacenso("e1", "s1", 2026, op).ok).toBe(false);
    expect(canOperateEducacenso("e1", "s1", 2027, [{ ...op[0], evidenceRef: "ref" }]).ok).toBe(false);
    expect(canOperateEducacenso("e1", "s1", 2026, [{ ...op[0], evidenceRef: "ref" }]).ok).toBe(true);
  });
});
