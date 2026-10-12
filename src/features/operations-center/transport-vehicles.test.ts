import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usableCapacity, vehicleFitness, type VehicleEvent } from "./transport-vehicles";

const SQL = readFileSync("drizzle/migrations/0425_ops18_transport_vehicles.sql", "utf8");
const FIX = readFileSync("drizzle/migrations/0426_ops18_vehicles_hide_doc_refs.sql", "utf8");
const E: VehicleEvent[] = [
  { kind: "capacidade", seq: 1, seats: 40, accessibleSeats: 2 },
  { kind: "documento", seq: 2, docKey: "crlv", validUntil: "2026-12-31" },
  { kind: "vistoria", seq: 3, result: "aprovado", onDate: "2026-07-01" },
  { kind: "disponibilidade", seq: 4, available: true, onDate: "2026-07-02" },
];
const CFG = { requiredDocs: ["crlv"], inspectionValidityDays: 180 };

describe("Centro de Operações L18 — veículos", () => {
  it("apto só com capacidade, documentos, vistoria e disponibilidade válidos", () => {
    expect(vehicleFitness(E, CFG, "2026-10-12").status).toBe("apto");
    expect(usableCapacity(vehicleFitness(E, CFG, "2026-10-12"))).toBe(40);
    expect(vehicleFitness(E, CFG, "2027-02-01").reasons).toEqual(["documento-vencido:crlv", "vistoria-vencida"]);
    expect(vehicleFitness([...E, { kind: "disponibilidade", seq: 5, available: false, onDate: "2026-10-01" }], CFG, "2026-10-12").status).toBe("inapto");
  });
  it("sem configuração ou dado ⇒ indeterminado, nunca apto", () => {
    const f = vehicleFitness(E, { requiredDocs: null, inspectionValidityDays: null }, "2026-10-12");
    expect(f.status).toBe("indeterminado");
    expect(usableCapacity(f)).toBeNull();
    expect(vehicleFitness([], CFG, "2026-10-12").status).toBe("inapto");
  });
  it("banco: próprio exige bem oficial ativo, contratado exige contrato juntado, referências ocultas", () => {
    for (const r of ["opsveh:unknown-asset", "opsveh:asset-written-off", "opsveh:contract-doc-required", "opsvev:conflict", "opsvev:inspect-forbidden", "opsvev:invalid-doc", "opsvev:future-date"]) expect(SQL).toContain(r);
    expect(SQL).toContain("event_type = 'documento_juntado'");
    expect(FIX).toMatch(/REVOKE SELECT ON public\.ops_vehicles, public\.ops_vehicle_events FROM authenticated/);
    expect(FIX).not.toMatch(/contract_doc_ref|\bdoc_ref\b/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
