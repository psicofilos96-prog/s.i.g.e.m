import { describe, expect, it } from "vitest";
import type { ClassSchedule } from "@/features/student-life/class-schedule-source";
import { coverageNote, crossClassTeacherConflicts, conflictsOfClass, readAccessibleSchedules, type Registered } from "./teacher-cross-class-conflicts";
import { rowsOf, schedulePrintHtml } from "./schedule-print";

const t = { validOn: "2026-10-08", knownAt: "2026-10-08T12:00:00Z" };
const block = (blockId: string, startsAt: string, endsAt: string, engagementIds: string[]) => ({
  blockId, blockKey: blockId, weekday: 1, startsAt, endsAt, minutes: 50, componentId: null, componentVersion: null, componentName: "Matemática",
  nature: null, engagementIds, state: "utilizavel", issues: [], overlapsWith: [], coverage: "nao-verificada", coverageMatrixIds: [],
});
const sched = (classId: string, blocks: ReturnType<typeof block>[]): Registered => ({
  kind: "registrada", classId, ...t, state: "utilizavel", scheduleId: `s-${classId}`, versionId: "v", version: 1, changeKind: "c", validFrom: "2026-02-01",
  effectiveUntil: null, actRef: "a", changeReason: null, recordedAt: t.knownAt, days: [{ weekday: 1, minutes: 50, blocks }], weekMinutes: 50,
} as unknown as Registered);
// fixtures: pessoa P tem atuações distintas (e1 na A, e2 na B) — o conflito só aparece pela pessoa.
const persons = new Map([["e1", "P"], ["e2", "P"], ["e3", "Q"]]);

describe("NHOR.4 — mesmo profissional em turmas diferentes", () => {
  it("detecta sobreposição pela pessoa, mesmo com atuações diferentes", () => {
    const { conflicts } = crossClassTeacherConflicts([sched("A", [block("a1", "07:00", "07:50", ["e1"])]), sched("B", [block("b1", "07:30", "08:20", ["e2"])])], persons);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ personId: "P", overlapStart: "07:30", overlapEnd: "07:50", a: { classId: "A" }, b: { classId: "B" } });
  });
  it("aulas encostadas não conflitam; pessoas diferentes não conflitam; mesma turma fica com NHOR.3", () => {
    const r = crossClassTeacherConflicts([
      sched("A", [block("a1", "07:00", "07:50", ["e1"]), block("a2", "07:00", "07:50", ["e1"])]),
      sched("B", [block("b1", "07:50", "08:40", ["e2"]), block("b2", "07:00", "07:50", ["e3"])]),
    ], persons);
    expect(r.conflicts).toEqual([]);
  });
  it("atuação sem pessoa legível não vira conflito e torna a verificação parcial", () => {
    const r = crossClassTeacherConflicts([sched("A", [block("a1", "07:00", "07:50", ["x"])]), sched("B", [block("b1", "07:00", "07:50", ["x"])])], persons);
    expect(r.conflicts).toEqual([]);
    expect(r.unresolvedEngagements).toEqual(["x"]);
    expect(coverageNote({ denied: [], failed: [] }, 1)).toMatch(/^Verificação parcial: 1 atuação/);
  });
  it("leitura em lote: negada/ausente/erro ficam declaradas, nunca viram 'sem conflito'", async () => {
    const read = async (id: string): Promise<ClassSchedule> => {
      if (id === "N") return { kind: "negado", classId: id, ...t };
      if (id === "Z") return { kind: "ausente", classId: id, ...t };
      if (id === "E") throw new Error("boom");
      return sched(id, []);
    };
    const r = await readAccessibleSchedules(["B", "N", "E", "Z", "A", "A"], t, read, 2);
    expect(r.schedules.map((s) => s.classId)).toEqual(["A", "B"]);
    expect(r).toMatchObject({ denied: ["N"], absent: ["Z"], failed: ["E"] });
    expect(coverageNote(r, 0)).toBe("Verificação parcial: 1 turma sem permissão de leitura; 1 turma com falha de leitura. Conflitos nessas grades não foram verificados.");
  });
  it("conflictsOfClass filtra pela turma de qualquer lado", () => {
    const { conflicts } = crossClassTeacherConflicts([sched("A", [block("a1", "07:00", "07:50", ["e1"])]), sched("B", [block("b1", "07:00", "07:50", ["e2"])])], persons);
    expect(conflictsOfClass(conflicts, "B")).toHaveLength(1);
    expect(conflictsOfClass(conflicts, "C")).toHaveLength(0);
  });
  it("grande volume: 300 turmas × 25 blocos em menos de 1 s", () => {
    const many = Array.from({ length: 300 }, (_, c) => sched(`C${c}`, Array.from({ length: 25 }, (_, b) => block(`C${c}-${b}`, `${String(7 + (b % 10)).padStart(2, "0")}:00`, `${String(7 + (b % 10)).padStart(2, "0")}:50`, [`e${c}`]))));
    const map = new Map(Array.from({ length: 300 }, (_, c) => [`e${c}`, `P${c % 150}`] as const));
    const t0 = performance.now(); const r = crossClassTeacherConflicts(many, map);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.conflicts.length).toBeGreaterThan(0);
  });
});

describe("NHOR.4 — PDF da grade", () => {
  const schedules = [sched("A", [block("a1", "07:00", "07:50", ["e1"])]), sched("B", [block("b1", "07:30", "08:20", ["e2"])])];
  const { conflicts } = crossClassTeacherConflicts(schedules, persons);
  const html = (rows = rowsOf(schedules, (id) => `Turma ${id}`, () => "Prof. <P>")) => schedulePrintHtml({ scope: "escola", subject: "E", validOn: t.validOn, rows, conflicts, className: (id) => `Turma ${id}`, personName: () => "Prof. <P>", coverage: null });
  it("A4, quebra de texto, cabeçalho repetido, escape e sem interface do app", () => {
    const h = html();
    expect(h).toMatch(/@page\{size: ?A4/); expect(h).toMatch(/overflow-wrap:anywhere/); expect(h).toMatch(/thead\{display:table-header-group\}/);
    expect(h).toContain("Prof. &lt;P&gt;"); expect(h).not.toMatch(/<nav|<aside|data-app-shell/);
    expect(h).toContain("O mesmo profissional está em aulas de turmas diferentes");
  });
  it("profissional: só os blocos das atuações da pessoa", () => {
    expect(rowsOf(schedules, (id) => id, () => "x", new Set(["e2"])).map((r) => r.className)).toEqual(["B"]);
  });
  it("sem grade: diz que não há grade registrada, sem inventar linha", () => {
    expect(html([])).toContain("Grade não registrada.");
  });
});
