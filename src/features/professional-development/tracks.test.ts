import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mandatoryOn, stepProblems, trackProgress } from "./tracks";

const SQL = readFileSync("drizzle/migrations/0434_dev06_programs_tracks.sql", "utf8");
const steps = [
  { ord: 1, title: "Fundamentos", courseId: "c1", prerequisiteOrds: [], elective: false },
  { ord: 2, title: "Prática", courseId: "c2", prerequisiteOrds: [1], elective: false },
  { ord: 3, title: "Optativa", courseId: "c3", prerequisiteOrds: [], elective: true },
];

describe("L06 trilhas", () => {
  it("pré-requisito só de etapa anterior; precisa de etapa obrigatória na trilha", () => {
    expect(stepProblems([{ title: "a", courseId: "c", prerequisiteOrds: [1], elective: false }])).toHaveLength(1);
    expect(stepProblems([{ title: "a", courseId: "c", prerequisiteOrds: [], elective: true }])).toContain("A trilha precisa de ao menos uma etapa não eletiva.");
  });
  it("progresso só por conclusão; eletiva não conta", () => {
    expect(trackProgress(steps, new Set()).states.map((s) => s.state)).toEqual(["liberada", "bloqueada", "liberada"]);
    const r = trackProgress(steps, new Set(["c1", "c2"]));
    expect(r).toMatchObject({ coreDone: 2, coreTotal: 2, complete: true });
  });
  it("obrigatória só com mandato vigente e não revogado", () => {
    const m = { id: "m", audience: "Coordenadores", legalBasis: "Resolução SEMED 1/2026", validFrom: "2026-03-01", validUntil: "2026-12-31", revokedOn: "2026-09-01" };
    expect(mandatoryOn([], "2026-05-01").mandatory).toBe(false);
    expect(mandatoryOn([m], "2026-05-01").mandatory).toBe(true);
    expect(mandatoryOn([m], "2026-09-01").mandatory).toBe(false);
  });
  it("banco: sem coluna de obrigatoriedade na trilha; mandato exige ato, capacidade e versão aprovada", () => {
    expect(SQL).not.toMatch(/\bmandatory\s+boolean/);
    for (const n of ["act_document_ref uuid NOT NULL", "determinar-obrigatoriedade-de-formacao", "dev:track-not-approved", "dev:invalid-prerequisite", "dev:self-approval"]) expect(SQL).toContain(n);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
