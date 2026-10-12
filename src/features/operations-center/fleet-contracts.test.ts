import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { availableOn, canProgramVehicle, costView, measure } from "./fleet-contracts";

const SQL = readFileSync("drizzle/migrations/0429_ops21_fleet_contracts_costs.sql", "utf8");

describe("Centro de Operações L21 — frota, contratos, medições e custos", () => {
  it("veículo sem disponibilidade informada ou indisponível só com validação de outra pessoa", () => {
    expect(availableOn([], "2026-10-12")).toBe(false);
    expect(availableOn([{ onDate: "2026-10-01", seq: 1, available: true }, { onDate: "2026-10-10", seq: 2, available: false }], "2026-10-12")).toBe(false);
    expect(availableOn([{ onDate: "2026-10-01", seq: 1, available: true }, { onDate: "2026-10-20", seq: 2, available: false }], "2026-10-12")).toBe(true);
    expect(canProgramVehicle({ available: false, validation: null, programmer: "a", lastInspectionFailed: false }).ok).toBe(false);
    expect(canProgramVehicle({ available: false, validation: { validatedBy: "a" }, programmer: "a", lastInspectionFailed: false })).toEqual({ ok: false, reason: "self-validated-use" });
    expect(canProgramVehicle({ available: false, validation: { validatedBy: "b" }, programmer: "a", lastInspectionFailed: true }).ok).toBe(false);
  });
  it("medição derivada das execuções; custo só com medição conferida e comprovante", () => {
    expect(measure([{ outcome: "realizada", tripDate: "2026-09-02", kmStart: 10, kmEnd: 52.5 }, { outcome: "nao-realizada", tripDate: "2026-09-03" }, { outcome: "realizada", tripDate: "2026-10-01", kmStart: 0, kmEnd: 9 }], "2026-09-01", "2026-09-30"))
      .toEqual({ tripsRealized: 1, tripsNotRealized: 1, kmRealized: 42.5 });
    expect(costView(null, { amountCents: 100, officialSystemRef: "x" }).status).toBe("medicao-nao-conferida");
    expect(costView("conferida", null)).toEqual({ amountCents: null, status: "nao-informado" });
  });
  it("banco: trava de uso, contrato juntado, medição sem digitação, conferência ≠ medidor, comprovante obrigatório", () => {
    for (const r of ["opstrip:vehicle-unavailable", "opstrip:self-validated-use", "opsuse:inspection-failed", "opsctr:contract-doc-required", "opsmeas:period-not-closed", "opsmeas:outside-contract", "opsmeas:self-conference", "opscost:measurement-not-conferred", "opscost:receipt-required"]) expect(SQL).toContain(r);
    expect(SQL).toMatch(/record_ops_transport_measurement\(_contract uuid, _start date, _end date, _doc uuid, _key text\)/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
