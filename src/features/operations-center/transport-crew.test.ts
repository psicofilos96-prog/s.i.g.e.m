import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CREW_FABRICATES_ACTS, crewFitness, currentRequirement, doubleBookings, type Designation } from "./transport-crew";

const SQL = readFileSync("drizzle/migrations/0427_ops19_transport_crew.sql", "utf8");
const D: Designation = { id: "d", role: "motorista", personId: "p", engagementActive: () => true, validFrom: "2026-01-01", validUntil: null, revokedOn: null };
const R = [{ role: "motorista" as const, version: 1, requiredKeys: ["cnh-d", "curso-transporte-escolar"], approved: true }];

describe("Centro de Operações L19 — motoristas e monitores", () => {
  it("habilitações exigidas só por requisito aprovado e vigente", () => {
    expect(crewFitness(D, [{ key: "cnh-d", validUntil: "2027-01-01" }, { key: "curso-transporte-escolar", validUntil: "2027-01-01" }], R, "2026-10-12").ok).toBe(true);
    expect(crewFitness(D, [{ key: "cnh-d", validUntil: "2026-01-01" }], R, "2026-10-12").reasons).toEqual(["habilitacao-ausente-ou-vencida:cnh-d", "habilitacao-ausente-ou-vencida:curso-transporte-escolar"]);
    expect(currentRequirement([...R, { ...R[0]!, version: 2, approved: false }], "motorista")).toBeNull();
  });
  it("designação revogada ou atuação encerrada impedem escala; conflito de pessoa", () => {
    expect(crewFitness({ ...D, revokedOn: "2026-10-01", engagementActive: () => false }, [], R, "2026-10-12").reasons.slice(0, 2)).toEqual(["designacao-nao-vigente", "atuacao-nao-vigente"]);
    expect(doubleBookings([{ personId: "p", onDate: "2026-10-12", shift: "manhã", routeVersionId: "a" }, { personId: "p", onDate: "2026-10-12", shift: "manhã", routeVersionId: "b" }])).toHaveLength(1);
    expect(CREW_FABRICATES_ACTS).toBe(false);
  });
  it("banco: ato juntado obrigatório, sem autodesignação, requisitos ≠ autor, sem número de habilitação guardado", () => {
    for (const r of ["opscrew:act-required", "opscrew:self-designation", "opscrew:engagement-not-active", "opscrew:self-approval", "opsshift:designation-not-active", "opsshift:route-not-approved", "opsshift:requirements-not-approved", "opsshift:credential-missing-or-expired", "opsshift:person-double-booked"]) expect(SQL).toContain(r);
    expect(SQL).not.toMatch(/license_number|cnh_number|numero_cnh/i);
    expect(SQL).toMatch(/REVOKE ALL ON public\.ops_crew_designations[^;]*FROM anon, authenticated/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
