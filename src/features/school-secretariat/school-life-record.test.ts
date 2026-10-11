import { describe, it, expect } from "vitest";
import { chronology, officialAttendance, resultsByHistoricalMatrix, correctResult, type Episode, type ResultVersion } from "./school-life-record";

const ep: Episode = { enrollmentId: "e", schoolId: "A", year: "2025", from: "2025-02-01", to: "2025-12-15", classId: "t", matrixVersionId: "m1" };

describe("vida escolar", () => {
  it("cronologia por ano com início ausente explícito", () => {
    const c = chronology([{ ...ep, year: "2026", from: null }, ep]);
    expect(c.map((e) => e.year)).toEqual(["2025", "2026"]);
    expect(c[1]!.startLabel).toBe("início não declarado");
  });
  it("frequência só oficial, na vigência, sem marcação não é falta", () => {
    const s = officialAttendance([
      { date: "2025-03-01", classId: "t", componentId: null, present: false, official: true },
      { date: "2025-03-02", classId: "t", componentId: null, present: true, official: true },
      { date: "2025-03-03", classId: "t", componentId: null, present: null, official: true },
      { date: "2025-03-04", classId: "t", componentId: null, present: false, official: false },
      { date: "2026-01-10", classId: "t", componentId: null, present: false, official: true },
    ], ep);
    expect(s).toEqual({ classes: 2, absences: 1, unmarked: 1, rate: 0.5, reason: null });
    expect(officialAttendance([], ep).rate).toBeNull();
  });
  it("resultados pela matriz congelada; não oficial não aparece como valor", () => {
    const r = resultsByHistoricalMatrix(ep, [{ matrixVersionId: "m1", componentId: "c1", label: "Língua" }, { matrixVersionId: "m2", componentId: "c2", label: "Nova" }],
      [{ logicalId: "r", version: 1, enrollmentId: "e", componentId: "c1", value: "8", officialized: false, authorPrincipalId: "prof", human: true, reason: null, supersedes: null }]);
    expect(r.rows).toEqual([{ componentId: "c1", label: "Língua", value: null, state: "não oficializado", author: "prof", versions: 1 }]);
  });
  it("correção encadeada preserva autoria anterior", () => {
    const chain: ResultVersion[] = [{ logicalId: "r", version: 1, enrollmentId: "e", componentId: "c1", value: "8", officialized: true, authorPrincipalId: "prof", human: true, reason: null, supersedes: null }];
    expect(correctResult(chain, { value: "9", authorPrincipalId: "sec", human: true, reason: "" }, 1)).toEqual({ ok: false, code: "reason-required" });
    expect(correctResult(chain, { value: "9", authorPrincipalId: "sec", human: true, reason: "erro" }, 0)).toEqual({ ok: false, code: "stale-base" });
    const ok = correctResult(chain, { value: "9", authorPrincipalId: "sec", human: true, reason: "erro de digitação" }, 1);
    expect(ok.ok && ok.value.map((v) => v.authorPrincipalId)).toEqual(["prof", "sec"]);
    expect(ok.ok && ok.value[1]!.officialized).toBe(false);
  });
});
