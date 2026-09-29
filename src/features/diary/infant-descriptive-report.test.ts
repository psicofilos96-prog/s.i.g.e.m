import { describe, expect, it } from "vitest";
import {
  admissibleObjectivesForClass,
  conferReport,
  createInMemoryReportRepository,
  currentReportVersion,
  draftFromCurrent,
  officializeReport,
  reportAuthorFor,
  reportPeriodsForClass,
  reportSubsidies,
  type DescriptiveReportVersion,
} from "./infant-descriptive-report";
import { infantExperienceFixtures } from "./infant-experiences";
import { ageGroupsForClass } from "./infant-experiences";

const classId = "tur-009";
const period = reportPeriodsForClass(classId)[0]!;
const key = { studentId: "alu-X", classId, periodId: period.id };
const author = reportAuthorFor("pro-006", classId, "2026-09-23")!;

function officialize(repo = createInMemoryReportRepository(), text = "Texto qualitativo.") {
  const draft = { ...draftFromCurrent(key, currentReportVersion(repo.chain(key))), text };
  const c = conferReport({ draft, author, repo });
  if (!c.ok) throw new Error(c.message);
  const r = officializeReport({ conference: c.conference, repo });
  if (!r.ok) throw new Error(r.message);
  return { repo, version: r.version };
}

describe("6D.5.2 — Parecer descritivo", () => {
  it("períodos vêm da configuração e o autor da atuação vigente", () => {
    expect(period).toBeDefined();
    expect(author.pedagogicalAssignmentId).toBe("atp-002");
    expect(reportAuthorFor("pro-011", classId, "2026-09-23")).toBeNull();
  });

  it("pertence ao estudante e período corretos; rascunho e conferência não registram", () => {
    const repo = createInMemoryReportRepository();
    const draft = { ...draftFromCurrent(key, null), text: "Rascunho." };
    const c = conferReport({ draft, author, repo });
    expect(c.ok).toBe(true);
    expect(repo.chain(key)).toHaveLength(0);
    const { version } = officialize(repo);
    expect(version).toMatchObject({ studentId: "alu-X", periodId: period.id, versionNumber: 1 });
    expect(repo.chain({ ...key, studentId: "alu-Y" })).toHaveLength(0);
  });

  it("correção cria nova versão e preserva a anterior intacta", () => {
    const { repo, version: v1 } = officialize();
    const draft = { ...draftFromCurrent(key, v1), text: "Nova redação.", correctionReason: "Revisão" };
    const c = conferReport({ draft, author, repo });
    if (!c.ok) throw new Error(c.message);
    expect(c.conference.before?.text).toBe("Texto qualitativo.");
    const r = officializeReport({ conference: c.conference, repo });
    expect(r.ok && r.version.supersedesVersionId).toBe(v1.id);
    expect(repo.chain(key)[0]!.text).toBe("Texto qualitativo.");
    expect(Object.isFrozen(repo.chain(key)[0])).toBe(true);
    expect(currentReportVersion(repo.chain(key))?.text).toBe("Nova redação.");
  });

  it("concorrência entre conferência e oficialização falha fechada", () => {
    const { repo, version: v1 } = officialize();
    const mk = (text: string) => conferReport({ draft: { ...draftFromCurrent(key, v1), text, correctionReason: "x" }, author, repo });
    const a = mk("A");
    const b = mk("B");
    if (!a.ok || !b.ok) throw new Error();
    expect(officializeReport({ conference: a.conference, repo }).ok).toBe(true);
    const late = officializeReport({ conference: b.conference, repo });
    expect(late).toMatchObject({ ok: false, code: "concurrent-change" });
    expect(repo.chain(key)).toHaveLength(2);
  });

  it("política com etapa adicional falha fechada; sem política basta o rito mínimo", () => {
    const repo = createInMemoryReportRepository();
    const c = conferReport({ draft: { ...draftFromCurrent(key, null), text: "t" }, author, repo });
    if (!c.ok) throw new Error();
    expect(officializeReport({ conference: c.conference, repo, policy: { additionalStepIds: ["coord"] } }).ok).toBe(false);
    expect(repo.chain(key)).toHaveLength(0);
  });

  it("registros subsidiam sem alterar o parecer", () => {
    const fixture = infantExperienceFixtures.find((r) => r.individualObservations.length)!;
    const k = { studentId: fixture.individualObservations[0]!.studentId, classId, periodId: period.id };
    const subsidies = reportSubsidies(k, period, infantExperienceFixtures);
    expect(subsidies.length).toBeGreaterThan(0);
    expect(draftFromCurrent(k, null).text).toBe("");
  });

  it("objetivos vêm da Matriz e respeitam o grupo BNCC declarado pela turma", () => {
    const groups = ageGroupsForClass(classId);
    const list = admissibleObjectivesForClass(classId);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((o) => groups.includes(o.ageGroupId))).toBe(true);
    const repo = createInMemoryReportRepository();
    const base = { ...draftFromCurrent(key, null), text: "t" };
    expect(conferReport({ draft: { ...base, objectiveIds: ["inventado"] }, author, repo })).toMatchObject({ code: "objective-not-in-matrix" });
    if (!groups.includes("EI01"))
      expect(conferReport({ draft: { ...base, objectiveIds: ["bncc:EI01EO01"] }, author, repo })).toMatchObject({ code: "objective-not-applicable" });
  });

  it("ausência de parecer não é julgamento e nada numérico é derivado", () => {
    const repo = createInMemoryReportRepository();
    expect(currentReportVersion(repo.chain(key))).toBeNull();
    const { version } = officialize();
    const keys = Object.keys(version as DescriptiveReportVersion);
    for (const forbidden of ["score", "grade", "average", "percent", "classification", "value"])
      expect(keys).not.toContain(forbidden);
  });
});
