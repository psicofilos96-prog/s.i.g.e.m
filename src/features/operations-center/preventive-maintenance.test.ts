import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alerts, availabilityOn, certificateState, claimsSafetyCertification, nature, planStatus, planUsable, problemHistory, type PlanVersion } from "./preventive-maintenance";

const P = (x: Partial<PlanVersion> = {}): PlanVersion => ({ id: "p1", planKey: "extintores", version: 1, spaceId: null, activity: "Recarga de extintores",
  periodicityDays: 365, basisKind: "norma", basisRef: "NBR 12962", startsOn: "2026-01-01", active: true, authorPerson: "a", approval: { approverPerson: "b", decisionRef: "Ata 9" }, ...x });
const SQL = readFileSync("drizzle/migrations/0410_ops07_preventive_availability.sql", "utf8");

describe("Centro de Operações L07 — preventiva, disponibilidade, alertas", () => {
  it("plano só utilizável aprovado por outra pessoa, ativo e na última versão", () => {
    expect(planUsable([P()], "p1")).not.toBeNull();
    expect(planUsable([P({ approval: { approverPerson: "a", decisionRef: "x" } })], "p1")).toBeNull();
    expect(planUsable([P({ active: false })], "p1")).toBeNull();
    expect(planUsable([P(), P({ id: "p2", version: 2, approval: null })], "p1")).toBeNull();
  });
  it("periodicidade conta do último serviço CONFIRMADO; janela a vencer só se configurada", () => {
    expect(planStatus(P(), [], "2026-10-12", null)).toMatchObject({ state: "vencida", nextDue: "2026-01-01", lastDone: null });
    const s = planStatus(P(), [{ maintenanceOrderId: "m", confirmedOn: "2025-11-01" }], "2026-10-12", null);
    expect(s).toMatchObject({ nextDue: "2026-11-01", state: "em-dia" });
    expect(planStatus(P(), [{ maintenanceOrderId: "m", confirmedOn: "2025-11-01" }], "2026-10-12", 30).state).toBe("a-vencer");
  });
  it("preventiva × corretiva e reincidência só com limiar configurado", () => {
    const links = new Set(["m1"]);
    const e = [
      { orderId: "m1", spaceId: "s", category: "eletrica", openedOn: "2026-09-01", nature: nature("m1", links) },
      { orderId: "m2", spaceId: "s", category: "eletrica", openedOn: "2026-09-10", nature: nature("m2", links) },
      { orderId: "m3", spaceId: "s", category: "eletrica", openedOn: "2026-10-01", nature: nature("m3", links) },
    ];
    expect(problemHistory(e, "s", "2026-10-12", null)).toMatchObject({ corrective: 2, preventive: 1, recurring: null });
    expect(problemHistory(e, "s", "2026-10-12", { count: 2, windowDays: 90 }).recurring).toEqual([{ category: "eletrica", count: 2 }]);
  });
  it("disponibilidade sem evento não é presumida; certificado só de documento, nunca inventado", () => {
    expect(availabilityOn([], "2026-10-12")).toBe("nao-informada");
    expect(availabilityOn([{ seq: 1, status: "indisponivel", effectiveFrom: "2026-10-01", reason: "Infiltração no teto" }], "2026-10-12")).toBe("indisponivel");
    expect(certificateState([], "AVCB", "2026-10-12").state).toBe("sem-certificado-registrado");
    expect(certificateState([{ kind: "AVCB", issuer: "CBMBA", issuedOn: "2023-01-01", validUntil: "2026-01-01", spaceId: null }], "AVCB", "2026-10-12").state).toBe("vencido");
    expect(claimsSafetyCertification("Escola regularizada pelos bombeiros")).toBe(true);
    const a = alerts({ plans: [planStatus(P(), [], "2026-10-12", null)], certificates: [{ kind: "AVCB", state: "sem-certificado-registrado" }], recurring: [], unavailable: [] });
    expect(a.map((x) => x.kind)).toEqual(["preventiva-vencida"]);
  });
  it("banco: fonte da periodicidade, aprovação ≠ autor, vínculo só a plano aprovado, certificado exige documento, append-only", () => {
    for (const t of ["opspp_immutable", "opsppa_immutable", "opspl_immutable", "opssa_immutable", "opssc_immutable"]) expect(SQL).toContain(`${t} BEFORE UPDATE OR DELETE`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(SQL).toMatch(/basis_ref text NOT NULL/);
    for (const m of ["opspp:self-approval", "opspp:plan-not-approved", "opssc:document-required", "opssa:retroactive", "opssa:conflict", "opspp:conflict"]) expect(SQL).toContain(m);
    expect(SQL).toMatch(/doc_ref uuid NOT NULL REFERENCES public\.admin_case_events/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*doc_ref/);
  });
});
