import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateVisitStep, projectVisits, mobileAgenda, type VisitRow } from "./visits";

const base: Omit<VisitRow, "visitRef" | "seq"> = { caseId: "C", kind: "visita", status: "planejada", objective: "Conversar sobre retorno às aulas", scheduledOn: "2026-10-15",
  occurredOn: null, professionalPerson: "P", companionPerson: "Q", safetyChecked: true, safetyNote: "ir em dupla", providences: null, returnNeeded: null, returnOn: null, justification: null };
const row = (o: Partial<VisitRow>): VisitRow => ({ visitRef: "V", seq: 1, ...base, ...o });
const sess = (person: string, ...c: string[]) => ({ person, caps: new Set(["planejar-visitas-do-caso", ...c]) });

describe("L11 visitas e atendimentos", () => {
  it("planejar exige segurança conferida e recusa dado privado", () => {
    expect(validateVisitStep(null, { ...base, safetyChecked: false }, sess("A"), "2026-10-12")).toMatch(/segurança/);
    expect(validateVisitStep(null, { ...base, safetyNote: "endereço: rua X" }, sess("A"), "2026-10-12")).toMatch(/endereço/);
    expect(validateVisitStep(null, base, sess("A"), "2026-10-12")).toBeNull();
    expect(validateVisitStep(null, { ...base, kind: "atendimento", safetyChecked: false }, sess("A"), "2026-10-12")).toBeNull();
  });
  it("realização só pelo profissional competente, data passada e decisão de retorno", () => {
    const prev = row({});
    const done = { ...base, status: "realizada" as const, occurredOn: "2026-10-15", returnNeeded: true, returnOn: "2026-10-30" };
    expect(validateVisitStep(prev, done, sess("A", "realizar-visitas-do-caso"), "2026-10-16")).toMatch(/profissional responsável/);
    expect(validateVisitStep(prev, done, sess("P"), "2026-10-16")).toMatch(/competência/);
    expect(validateVisitStep(prev, done, sess("P", "realizar-visitas-do-caso"), "2026-10-14")).toMatch(/futura/);
    expect(validateVisitStep(prev, { ...done, returnNeeded: null, returnOn: null }, sess("P", "realizar-visitas-do-caso"), "2026-10-16")).toMatch(/retorno/);
    expect(validateVisitStep(prev, done, sess("P", "realizar-visitas-do-caso"), "2026-10-16")).toBeNull();
    expect(validateVisitStep(row({ seq: 2, status: "cancelada" }), done, sess("P", "realizar-visitas-do-caso"), "2026-10-16")).toMatch(/encerrada/);
  });
  it("agenda móvel só do próprio profissional/acompanhante e sem dado de segurança", () => {
    const vs = projectVisits([row({}), row({ visitRef: "W", professionalPerson: "Z", companionPerson: null })], "2026-10-16");
    const a = mobileAgenda(vs, "Q", "2026-10-16");
    expect(a.map((x) => x.visitRef)).toEqual(["V"]);
    expect(a[0]!.overdue).toBe(true);
    expect(JSON.stringify(a)).not.toMatch(/dupla/);
  });
  it("banco: append-only, só o profissional registra, RLS restrita", () => {
    const sql = readFileSync("drizzle/migrations/0399_perm11_visits.sql", "utf8");
    expect(sql).toMatch(/permvisit:only-professional-records/);
    expect(sql).toMatch(/ler-visitas-do-caso/);
    expect(sql).not.toMatch(/address|endereco text/i);
  });
});
