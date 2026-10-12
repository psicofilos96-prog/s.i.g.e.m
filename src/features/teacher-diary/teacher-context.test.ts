import { describe, expect, it } from "vitest";
import { myClasses, canRecord, canReadFact, scheduleClashes, classCard, type Engagement, type Assignment, type Substitution } from "./teacher-context";

const eng: Engagement[] = [
  { id: "eA", personId: "p1", schoolId: "A", from: "2026-02-01", to: "2026-06-30", kind: "lotacao" },
  { id: "eB", personId: "p1", schoolId: "B", from: "2026-07-01", to: null, kind: "lotacao" },
  { id: "eC", personId: "p1", schoolId: "C", from: "2026-03-01", to: null, kind: "cessao" },
  { id: "eT", personId: "p2", schoolId: "A", from: "2026-02-01", to: null, kind: "lotacao" },
];
const asg: Assignment[] = [
  { id: "a1", engagementId: "eA", classId: "A-5A", componentId: "MAT", from: "2026-02-01", to: null },
  { id: "a2", engagementId: "eB", classId: "B-6B", componentId: "MAT", from: "2026-07-01", to: null },
  { id: "a3", engagementId: "eC", classId: "C-7C", componentId: "CIE", from: "2026-03-01", to: null },
  { id: "aT", engagementId: "eT", classId: "A-4A", componentId: "POR", from: "2026-02-01", to: null },
];
const sub: Substitution[] = [{ id: "s1", substitutePersonId: "p1", assignmentId: "aT", from: "2026-04-01", to: "2026-04-30" }];
const at = (date: string, s = sub) => myClasses({ personId: "p1", date, engagements: eng, assignments: asg, substitutions: s });

describe("Perfil Docente L02 — minhas turmas por data", () => {
  it("só turmas da própria pessoa; atribuição futura não aparece", () => {
    const ids = at("2026-04-10").map((c) => c.classId);
    expect(ids).not.toContain("B-6B");
    expect(ids).toEqual(expect.arrayContaining(["A-5A", "C-7C", "A-4A"]));
  });
  it("mudança de escola: A vira leitura histórica, B edição", () => {
    const c = at("2026-08-01");
    expect(c.find((x) => x.classId === "A-5A")?.access).toBe("leitura-historica");
    expect(c.find((x) => x.classId === "B-6B")?.access).toBe("edicao");
    expect(canRecord(c, "A-5A", "MAT", "2026-08-01")).toBe(false);
    expect(canReadFact(c, "A-5A", "2026-05-10")).toBe(true);
    expect(canReadFact(c, "A-5A", "2026-07-15")).toBe(false);
  });
  it("substituto edita só na janela e depois só lê o próprio período", () => {
    expect(canRecord(at("2026-04-10"), "A-4A", "POR", "2026-04-10")).toBe(true);
    const later = at("2026-05-10");
    expect(later.find((x) => x.classId === "A-4A")?.access).toBe("leitura-historica");
    expect(canReadFact(later, "A-4A", "2026-03-15")).toBe(false);
  });
  it("cessão soma escola sem retirar a de origem; choque de horário detectado", () => {
    const c = at("2026-04-10");
    expect(new Set(c.filter((x) => x.access === "edicao").map((x) => x.schoolId))).toEqual(new Set(["A", "C"]));
    const clashes = scheduleClashes(c, [
      { classId: "A-5A", weekday: 1, start: "08:00", end: "08:50", assignmentId: "a1" },
      { classId: "C-7C", weekday: 1, start: "08:30", end: "09:20", assignmentId: "a3" },
      { classId: "C-7C", weekday: 2, start: "08:30", end: "09:20", assignmentId: "a3" },
    ]);
    expect(clashes).toHaveLength(1);
  });
  it("cartão: matrícula não lida fica null e aviso de somente leitura", () => {
    const hist = at("2026-08-01").find((x) => x.classId === "A-5A")!;
    const card = classCard(hist, null, [], 1);
    expect(card.enrolled).toBeNull();
    expect(card.note).toContain("2026-06-30");
  });
});
