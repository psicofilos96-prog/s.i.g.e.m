import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activeOn, designationProblems, personHistory, trainerCanRead, type Designation } from "./participants-trainers";

const d = (o: Partial<Designation> = {}): Designation => ({ id: "d1", classId: "c1", personId: "x", nature: "externo",
  validFrom: "2026-03-01", validUntil: "2026-06-30", endedOn: null, ...o });
const base = { designator: "g", personId: "x", naturalPerson: true, engagement: null, hasAnyEngagementInWindow: false,
  from: "2026-03-01", until: "2026-06-30", classStartsOn: "2026-03-01", classEndsOn: "2026-06-30", basis: "Convite da SEMED nº 12", existing: [], classId: "c1" };

describe("L11 participantes e formadores", () => {
  it("vigência temporal com encerramento exclusivo", () => {
    expect(activeOn(d(), "2026-04-01")).toBe(true);
    expect(activeOn(d({ endedOn: "2026-04-01" }), "2026-04-01")).toBe(false);
    expect(activeOn(d(), "2026-07-01")).toBe(false);
  });
  it("externo só lê a própria turma enquanto vigente", () => {
    expect(trainerCanRead([d()], "x", "c1", "2026-04-01")).toBe(true);
    expect(trainerCanRead([d()], "x", "c2", "2026-04-01")).toBe(false);
    expect(trainerCanRead([d()], "x", "c1", "2026-08-01")).toBe(false);
  });
  it("designação válida passa; autodesignação, fora do período e sem fundamento recusam", () => {
    expect(designationProblems(base)).toEqual([]);
    expect(designationProblems({ ...base, designator: "x", from: "2026-02-01", basis: "" })).toHaveLength(3);
  });
  it("interno exige atuação da pessoa cobrindo a janela; quem tem atuação não entra como externo", () => {
    expect(designationProblems({ ...base, engagement: { personId: "x", validFrom: "2026-04-01", validUntil: null } }).join()).toMatch(/cobre/);
    expect(designationProblems({ ...base, hasAnyEngagementInWindow: true }).join()).toMatch(/interna/);
  });
  it("sobreposição na mesma turma é recusada; após encerramento, nova designação cabe", () => {
    expect(designationProblems({ ...base, existing: [d()] }).join()).toMatch(/Já existe/);
    expect(designationProblems({ ...base, from: "2026-05-01", existing: [d({ endedOn: "2026-05-01" })] })).toEqual([]);
  });
  it("mudança de lotação preserva o histórico", () => {
    const h = personHistory([{ enrollmentId: "e1", courseTitle: "Alfabetização", functionalLinkId: "l1", schoolAtRequest: "E1", lastEvent: "conclusao" }], "E2");
    expect(h).toHaveLength(1); expect(h[0]!.movedSinceRequest).toBe(true);
  });
  it("migration 0440: append-only, acesso por vigência, sem capacidade para externo, histórico por pessoa", () => {
    const sql = readFileSync("drizzle/migrations/0440_dev11_participants_trainers.sql", "utf8");
    expect(sql).toMatch(/devtd_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/CREATE POLICY "dev enrollments active trainer"/);
    expect(sql).toMatch(/dev:self-designation/);
    expect(sql).toMatch(/WHERE e.person_id = _person/);
    expect(sql).not.toMatch(/INSERT INTO public\.(institutional_engagements|institutional_persons|capability)/);
  });
});
