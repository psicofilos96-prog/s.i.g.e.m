import { describe, expect, it } from "vitest";
import { classifyChild, demandByGroup, offerAccepts, type EiGroupingRule } from "./early-childhood";

const rule: EiGroupingRule = { version: 1, cutoff: "2027-03-31", actRef: "ato-ei", actVerified: true, homologatedBy: "p", validFrom: "2027-01-01", validTo: null,
  bands: [{ groupId: "G1", segment: "creche", minMonths: 4, maxMonths: 24 }, { groupId: "G2", segment: "creche", minMonths: 24, maxMonths: 48 }, { groupId: "P1", segment: "pre-escola", minMonths: 48, maxMonths: 72 }] };

describe("Educação Infantil L17", () => {
  it("classifica pela data de corte e regra homologada", () => {
    expect(classifyChild("2023-03-31", [rule], "2027-02-01")).toMatchObject({ status: "ok", groupId: "P1", segment: "pre-escola", ageMonthsAtCutoff: 48 });
    expect(classifyChild("2023-04-01", [rule], "2027-02-01")).toMatchObject({ groupId: "G2" });
  });
  it("sem regra verificada, regra não homologada, ambiguidade ou nascimento ausente ⇒ não classifica", () => {
    expect(classifyChild("2024-01-01", [], "2027-02-01").status).toBe("indeterminado");
    expect(classifyChild("2024-01-01", [{ ...rule, actVerified: false }], "2027-02-01").status).toBe("indeterminado");
    expect(classifyChild("2024-01-01", [{ ...rule, homologatedBy: null }], "2027-02-01").status).toBe("indeterminado");
    expect(classifyChild("2024-01-01", [rule, { ...rule, version: 2 }], "2027-02-01").status).toBe("ambiguo");
    expect(classifyChild(null, [rule], "2027-02-01").status).toBe("indeterminado");
    expect(classifyChild("2020-01-01", [rule], "2027-02-01").status).toBe("fora-das-faixas");
  });
  it("turno e jornada só se declarados na oferta", () => {
    const o = { offerId: "o", schoolId: "E", groupId: "G2", shifts: ["manha"], journeys: ["parcial"] };
    expect(offerAccepts(o, { groupId: "G2", shift: "manha", journey: "parcial" }).ok).toBe(true);
    expect(offerAccepts(o, { groupId: "G2", shift: "manha", journey: "integral" }).ok).toBe(false);
    expect(offerAccepts(o, { groupId: "G1", shift: "tarde", journey: "parcial" })).toMatchObject({ ok: false });
  });
  it("demanda por grupo; indeterminados à parte; capacidade ausente ⇒ excesso null", () => {
    const ok = classifyChild("2024-01-01", [rule], "2027-02-01");
    const r = demandByGroup([
      { schoolId: "E", journey: "parcial", result: ok }, { schoolId: "E", journey: "parcial", result: ok },
      { schoolId: "E", journey: "parcial", result: { status: "indeterminado", reason: "x" } },
    ], new Map([["E|G2|parcial", 1]]));
    expect(r).toEqual({ rows: [{ key: "E|G2|parcial", demand: 2, authorized: 1, excess: 1 }], unclassified: 1 });
    expect(demandByGroup([{ schoolId: "E", journey: "parcial", result: ok }], new Map()).rows[0]?.excess).toBeNull();
  });
});
