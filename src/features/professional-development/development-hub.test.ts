import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EMPTY_FILTER, FUNCTION_FILTER_UNAVAILABLE, buildHub, type HubInput } from "./development-hub-model";

const base: HubInput = {
  programs: [{ id: "p1", title: "Alfabetização" }, { id: "p2", title: "Gestão" }],
  courses: [{ id: "c1", programId: "p1" }, { id: "c2", programId: "p2" }],
  versions: [
    { id: "v1", courseId: "c1", version: 1, title: "Curso A", hoursMinutes: 600, minAttendancePct: 75 },
    { id: "v2", courseId: "c1", version: 2, title: "Curso A revisto", hoursMinutes: 660, minAttendancePct: 75 },
    { id: "v3", courseId: "c2", version: 1, title: "Curso B", hoursMinutes: null, minAttendancePct: null },
  ],
  classes: [
    { id: "t1", courseVersionId: "v2", schoolId: "E1", label: "Turma 1", seats: 3, startsOn: "2026-11-01", endsOn: "2026-12-01" },
    { id: "t2", courseVersionId: "v3", schoolId: null, label: "Turma 2", seats: null, startsOn: "2027-02-01", endsOn: "2027-03-01" },
  ],
  enrollments: [
    { id: "e1", classId: "t1", personId: "a", functionalLinkId: "l1" },
    { id: "e2", classId: "t1", personId: "b", functionalLinkId: "l2" },
    { id: "e3", classId: "t1", personId: "c", functionalLinkId: null },
  ],
  events: [{ enrollmentId: "e1", seq: 1, kind: "conclusao", attendancePct: 90 }, { enrollmentId: "e3", seq: 1, kind: "desistencia", attendancePct: null }],
  certs: [{ enrollmentId: "e1", createdAt: "2026-12-02" }],
  links: [{ id: "l1", positionId: "PROF" }, { id: "l2", positionId: "COORD" }],
};

describe("L03 painel do SIGEM Desenvolvimento", () => {
  it("números só de linhas observadas; vaga não configurada torna total desconhecido", () => {
    const v = buildHub(base, EMPTY_FILTER, "2026-10-12");
    expect(v.totals).toEqual({ classes: 2, enrolled: 3, concluded: 1, certified: 1, seatsLeft: null });
    expect(v.classes.find((c) => c.id === "t1")!.seatsLeft).toBe(1);
    expect(v.classes.find((c) => c.id === "t2")!.seatsLeft).toBeNull();
  });
  it("filtros por ano, escola, programa e cargo", () => {
    expect(buildHub(base, { ...EMPTY_FILTER, year: 2027 }, "2026-10-12").totals.classes).toBe(1);
    expect(buildHub(base, { ...EMPTY_FILTER, schoolId: "E1" }, "2026-10-12").totals.seatsLeft).toBe(1);
    expect(buildHub(base, { ...EMPTY_FILTER, programId: "p2" }, "2026-10-12").catalog.map((c) => c.title)).toEqual(["Curso B"]);
    expect(buildHub(base, { ...EMPTY_FILTER, positionId: "PROF" }, "2026-10-12").totals.enrolled).toBe(1);
  });
  it("catálogo mostra a última versão; agenda só datas futuras", () => {
    const v = buildHub(base, EMPTY_FILTER, "2026-11-15");
    expect(v.catalog.find((c) => c.courseId === "c1")!.version).toBe(2);
    expect(v.agenda[0]).toMatchObject({ classId: "t1", kind: "fim" });
  });
  it("função sem fonte e cargo invisível ficam indisponíveis, nunca presumidos", () => {
    const v = buildHub(base, { ...EMPTY_FILTER, functionId: "x" }, "2026-10-12");
    expect(v.notes).toContain(FUNCTION_FILTER_UNAVAILABLE);
    expect(v.totals.enrolled).toBe(0);
    expect(buildHub({ ...base, links: null }, EMPTY_FILTER, "2026-10-12").options.positions).toBeNull();
  });
  it("tela só lê após a sessão e não grava", () => {
    const src = readFileSync("src/features/professional-development/development-hub-page.tsx", "utf8");
    expect(src).toContain('a.status === "signed-out"');
    expect(src).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/);
  });
});
