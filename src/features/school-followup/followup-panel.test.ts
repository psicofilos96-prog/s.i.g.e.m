import { describe, expect, it } from "vitest";
import { buildPanel, clinicalWarning, display, followupMessage, visibleRecords } from "./followup-panel";
import { readFileSync } from "node:fs";

const cls = [{ id: "t1", name: "1A" }, { id: "t2", name: "2B" }];
describe("painel da escola", () => {
  it("fonte não legível é não disponível, nunca zero", () => {
    const p = buildPanel({ classes: cls, enrollments: null, allocations: null, attendanceClosings: null, assessmentClosings: null });
    expect(p.totals.enrollments.value).toBeNull();
    expect(display(p.classes[0]!.students.value)).toBe("não disponível");
    expect(p.pending).toEqual([]);
  });
  it("contagens têm drill-down até os registros e pendências são derivadas", () => {
    const p = buildPanel({
      classes: cls,
      enrollments: [{ id: "e1", student_id: "s1", ended_on: null }, { id: "e2", student_id: "s2", ended_on: null }, { id: "e3", student_id: "s3", ended_on: "2026-01-01" }],
      allocations: [{ id: "a1", enrollment_id: "e1", student_id: "s1", class_id: "t1", ended_on: null }],
      attendanceClosings: [{ id: "f1", class_id: "t1", period_id: "p1", version_number: 1, closed_at: "" }, { id: "f2", class_id: "t1", period_id: "p1", version_number: 2, closed_at: "" }],
      assessmentClosings: [],
    });
    expect(p.classes[0]!.students.records).toEqual(["a1"]);
    expect(p.classes[0]!.attendanceClosings.records).toEqual(["f2"]);
    expect(p.pending.map((x) => x.kind)).toEqual(["matricula-sem-turma", "turma-sem-fechamento-avaliativo", "turma-sem-fechamento-de-frequencia", "turma-sem-fechamento-avaliativo"]);
    expect(p.pending[0]!.subjectId).toBe("s2");
  });
  it("anulado sai da lista vigente; aviso de prontuário; mensagens humanas", () => {
    expect(visibleRecords([{ event_kind: "anulacao" } as never, { event_kind: "registro" } as never])).toHaveLength(1);
    expect(clinicalWarning("tem laudo de TDAH")).toBeTruthy();
    expect(clinicalWarning("faltou à reunião")).toBeNull();
    expect(followupMessage("capability:consultar-acompanhamento-pedagogico")).toMatch(/permissão/);
    expect(followupMessage("followup:only-author-rectifies")).toMatch(/Só quem/);
  });
  it("sem regras de nota/promoção nem fixtures no módulo oficial", () => {
    for (const f of ["followup-panel.ts", "followup-source.ts", "school-followup-page.tsx"]) {
      const s = readFileSync(`src/features/school-followup/${f}`, "utf8");
      expect(s).not.toMatch(/fixture|demo|media|aprovad[oa] por nota|frequencia minima/i);
      expect(s).not.toMatch(/\.from\("(attendance_record|assessment_entry)_versions"\)\.(insert|update)/);
    }
  });
});
