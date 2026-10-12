import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { returnIssues, recordReturn, type ReturnInput } from "./school-return";

const ep = { id: "e1", studentId: "s1", schoolId: "sc", enrollmentId: "m1", classId: "t1", validFrom: "2026-03-01", endedOn: null, superseded: false };
const base: ReturnInput = { caseStudentId: "s1", caseSchoolId: "sc", caseOpenedOn: "2026-05-01", returnedOn: "2026-06-01", today: "2026-10-12", episode: ep, welcomeNote: null, idempotencyKey: "k" };

describe("L14 retorno à escola", () => {
  it("exige enturmação oficial vigente do mesmo estudante e escola", () => {
    expect(returnIssues(base)).toEqual([]);
    expect(returnIssues({ ...base, episode: null })).toContain("no-official-allocation");
    expect(returnIssues({ ...base, episode: { ...ep, studentId: "x" } })).toContain("no-official-allocation");
    expect(returnIssues({ ...base, episode: { ...ep, endedOn: "2026-05-30" } })).toContain("no-official-allocation");
    expect(returnIssues({ ...base, episode: { ...ep, superseded: true } })).toContain("no-official-allocation");
  });
  it("recusa data futura ou anterior ao caso e acolhimento vazio de conteúdo", () => {
    expect(returnIssues({ ...base, returnedOn: "2026-11-01" })).toContain("invalid-date");
    expect(returnIssues({ ...base, returnedOn: "2026-04-01" })).toContain("invalid-date");
    expect(returnIssues({ ...base, welcomeNote: "ok" })).toContain("welcome-note-too-short");
  });
  it("fail-closed: inválido não chama o banco", async () => {
    let called = false;
    const r = await recordReturn(async () => { called = true; return { data: null, error: null }; }, "c", { ...base, episode: null });
    expect(r.ok).toBe(false); expect(called).toBe(false);
  });
  it("migration só grava o fato do retorno, nunca presença/matrícula/enturmação", () => {
    const f = readdirSync("drizzle/migrations").find((n) => n.startsWith("0402_"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    const inserts = [...sql.matchAll(/INSERT INTO public\.(\w+)/g)].map((m) => m[1]);
    expect(inserts).toEqual(["permanence_returns"]);
    expect(sql).not.toMatch(/UPDATE public\./);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*permanence_returns TO authenticated/);
  });
});
