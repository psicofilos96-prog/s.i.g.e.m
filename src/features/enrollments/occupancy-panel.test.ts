import { describe, expect, it } from "vitest";
import { buildPanel, projectCell, type CellInput } from "./occupancy-panel";

const base: CellInput = { schoolId: "E1", shiftId: "manha", stageId: "ano-1", authorized: 25, sumClassCapacities: 25, occupants: ["a", "b", "b"], activeReservations: [{ id: "r1", studentRef: "s9" }], occupantStudentRefs: [], waitingCount: 0, pendingRequests: 0 };
const th = { version: 2, ratio: 0.9, homologatedBy: "p", actRef: "ato-lim" };

describe("Ocupação e alertas L15", () => {
  it("disponível e taxa sem dupla contagem", () => {
    const r = projectCell(base, null);
    expect([r.occupants, r.reservations, r.available, r.rate]).toEqual([2, 1, 22, 2 / 25]);
    expect(r.alerts).toEqual([]);
    expect(projectCell({ ...base, occupantStudentRefs: ["s9"] }, null).reservations).toBe(0);
  });
  it("fonte não lida ⇒ null, nunca zero; taxa sem denominador ⇒ null", () => {
    const r = projectCell({ ...base, occupants: null }, null);
    expect([r.available, r.rate]).toEqual([null, null]);
    expect(r.alerts[0]?.kind).toBe("fonte-nao-lida");
    expect(projectCell({ ...base, authorized: 0 }, null).rate).toBeNull();
  });
  it("limite só com limiar homologado; excesso, divergência, demanda reprimida e pendência", () => {
    const full = { ...base, authorized: 2, sumClassCapacities: 3, waitingCount: 4, pendingRequests: 1 };
    expect(projectCell(full, null).alerts.map((a) => a.kind)).toEqual(["excesso", "divergencia", "demanda-reprimida", "pendencia"]);
    expect(projectCell(full, th).alerts.map((a) => a.kind)).toContain("limite");
  });
  it("totais só com todas as células lidas; impressão digital reproduzível e independente da ordem", () => {
    const b = { ...base, shiftId: "tarde" };
    const p1 = buildPanel([base, b], { asOf: "2027-03-01", knownAt: "2027-03-01T12:00:00Z", threshold: th });
    const p2 = buildPanel([b, { ...base, occupants: ["b", "a", "b"] }], { asOf: "2027-03-01", knownAt: "2027-03-01T12:00:00Z", threshold: th });
    expect(p1.totals.available).toBe(44);
    expect(p1.fingerprint).toBe(p2.fingerprint);
    expect(buildPanel([base], { asOf: "2027-03-02", knownAt: "2027-03-01T12:00:00Z", threshold: th }).fingerprint).not.toBe(p1.fingerprint);
    expect(buildPanel([base, { ...b, authorized: null }], { asOf: "2027-03-01", knownAt: "x", threshold: null }).totals).toMatchObject({ authorized: null, available: null, gaps: 1 });
  });
});
