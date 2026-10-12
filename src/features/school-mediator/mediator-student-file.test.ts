import { describe, it, expect } from "vitest";
import { buildStudentFile, DEFAULT_CONTACTS } from "./mediator-student-file";
import type { InclusionRecordRow } from "./mediator-central";

const student = { mediation_logical_id: "L1", school_id: "sA", student_id: "e1", student_name: "ANA", class_id: "5A", valid_from: "2026-02-01", valid_to: null };
const rec = (id: string, record_type: string, body: string): InclusionRecordRow => ({ id, logical_id: id, version: 1, supersedes_id: null, event_kind: "registro", record_type, student_id: "e1", body, educational_purpose: "x", valid_from: "2026-02-10", valid_to: null, share_with_mediation: true, recorded_at: "t" });

describe("Mediador L05 — ficha de acompanhamento", () => {
  it("enturmação oficial prevalece e dá o turno; mudança de turma entra na linha do tempo", () => {
    const f = buildStudentFile({ date: "2026-03-10", student, contacts: DEFAULT_CONTACTS, records: [], designationChain: [],
      episodes: [{ classId: "5A", className: "5º A", shift: "manhã", from: "2026-02-01", to: "2026-02-28" }, { classId: "5B", className: "5º B", shift: "tarde", from: "2026-03-01", to: null }] });
    expect(f.identification).toMatchObject({ classId: "5B", shift: "tarde" });
    expect(f.limitations[0]).toMatch(/difere/);
    expect(f.timeline.map((t) => t.label)).toContain("Saída da turma 5º A");
  });
  it("fonte não lida declarada, nunca vazia silenciosa", () => {
    const f = buildStudentFile({ date: "2026-03-10", student, contacts: [], records: null, designationChain: null, episodes: null });
    expect(f.enrollmentState).toBe("nao-disponivel");
    expect(f.guidance).toBeNull(); expect(f.resources).toBeNull();
    expect(f.limitations).toHaveLength(3);
  });
  it("recursos e rotinas só de orientação partilhada; laudo nunca aparece", () => {
    const f = buildStudentFile({ date: "2026-03-10", student, contacts: DEFAULT_CONTACTS, designationChain: [], episodes: [],
      records: [rec("r1", "recurso", "Prancha de comunicação"), rec("r2", "rotina", "Pausa a cada 40 min"), rec("r3", "recurso", "Conforme laudo CID F84")] });
    expect(f.resources).toEqual(["Prancha de comunicação"]);
    expect(f.routines).toEqual(["Pausa a cada 40 min"]);
    expect(JSON.stringify(f)).not.toMatch(/laudo|CID|F84/);
  });
  it("ambiguidade e contatos só internos", () => {
    const f = buildStudentFile({ date: "2026-03-10", student, records: [], designationChain: [],
      contacts: [...DEFAULT_CONTACTS, { role: "x", label: "x", channel: "direcao", href: "https://fora" }],
      episodes: [{ classId: "5A", className: null, shift: "manhã", from: "2026-02-01", to: null }, { classId: "AEE", className: null, shift: "tarde", from: "2026-02-01", to: null }] });
    expect(f.enrollmentState).toBe("ambigua"); expect(f.identification.shift).toBeNull();
    expect(f.contacts.every((c) => c.href.startsWith("/"))).toBe(true);
  });
});
