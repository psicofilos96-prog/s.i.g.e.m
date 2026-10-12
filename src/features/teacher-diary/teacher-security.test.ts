import { describe, it, expect } from "vitest";
import { canTeacherWrite, canCorrectOthers, executorAllowed, projectForSector, attachmentPathOk, exportAllowed, versionAuthorshipIntact, type Principal } from "./teacher-security";

const prof: Principal = { kind: "pessoa", personId: "p1", capabilities: [] };
const dir: Principal = { kind: "pessoa", personId: "d1", capabilities: ["gerir-escola"] };
const bot: Principal = { kind: "executor-tecnico", executorId: "x", scope: ["reindexar", "registrar-aula"] };
const asg = [{ personId: "p1", schoolId: "s1", classId: "c1", componentId: "mat", from: "2026-02-01", to: "2026-06-30" }];
const t = { schoolId: "s1", classId: "c1", componentId: "mat", date: "2026-03-10", authorPersonId: "p1" };

describe("L19 segurança docente", () => {
  it("escrita só com atribuição vigente na escola/turma/componente/data", () => {
    expect(canTeacherWrite(prof, asg, t).ok).toBe(true);
    expect(canTeacherWrite(prof, asg, { ...t, date: "2026-07-01" }).ok).toBe(false);
    expect(canTeacherWrite(prof, asg, { ...t, componentId: "port" }).ok).toBe(false);
    expect(canTeacherWrite(prof, asg, { ...t, schoolId: "s2" }).ok).toBe(false);
    expect(canTeacherWrite(bot, asg, t).ok).toBe(false);
  });
  it("Direção/Secretaria/Supervisão não alteram registro do docente sem capacidade de correção", () => {
    expect(canCorrectOthers(dir, t, null).ok).toBe(false);
    expect(canCorrectOthers(dir, t, "corrigir-diario").ok).toBe(false);
    expect(canCorrectOthers({ ...dir, capabilities: ["corrigir-diario"] } as Principal, t, "corrigir-diario").ok).toBe(true);
  });
  it("executor técnico não é pessoa: nunca registra, mesmo com escopo", () => {
    expect(executorAllowed(bot, "reindexar")).toBe(true);
    expect(executorAllowed(bot, "registrar-aula")).toBe(false);
    expect(executorAllowed(prof, "reindexar")).toBe(false);
  });
  it("compartilhamento por allowlist; família só a própria criança; sem clínico", () => {
    const row = { studentId: "e1", classId: "c1", attendanceRate: 0.9, laudo: "x", observacao: "y", nome: "Ana" };
    expect(projectForSector("direcao", row)).toEqual({ classId: "c1" });
    expect(projectForSector("familia", row, { familyStudentIds: ["e2"] })).toBeNull();
    expect(projectForSector("familia", row, { familyStudentIds: ["e1"] })).toEqual({ studentId: "e1", attendanceRate: 0.9 });
    expect(Object.keys(projectForSector("nei", row) ?? {})).not.toContain("laudo");
  });
  it("anexos, exportação e autoria de versões protegidos", () => {
    expect(attachmentPathOk("diario/s1/p1/a.pdf", "s1", "p1")).toBe(true);
    expect(attachmentPathOk("diario/s1/p1/../p2/a.pdf", "s1", "p1")).toBe(false);
    expect(attachmentPathOk("https://x/a.pdf", "s1", "p1")).toBe(false);
    expect(exportAllowed(prof, null, "conferência do bimestre").ok).toBe(false);
    expect(exportAllowed(bot, "exportar", "conferência do bimestre").ok).toBe(false);
    expect(versionAuthorshipIntact([{ version: 1, authorPersonId: "p1", supersedes: null }, { version: 2, authorPersonId: "p1", supersedes: 1 }])).toBe(true);
    expect(versionAuthorshipIntact([{ version: 1, authorPersonId: "p1", supersedes: null }, { version: 3, authorPersonId: "", supersedes: 1 }])).toBe(false);
  });
});
