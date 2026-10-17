import { describe, expect, it } from "vitest";
import { coveredOn, periodDays, projectJustifications, type JustificationEvent } from "./absence-justification";

const reg = (id: string, s: string, e: string): JustificationEvent => ({ justification_id: id, act: "registrar", doc_kind: "atestado-medico", starts_on: s, ends_on: e, issuer_name: "Dra. Ana", issuer_registry: "CRM 1", delivered_by: null, delivered_on: s, reason: null, recorded_at: "2026-10-01" });

describe("atestados", () => {
  it("conta os dias inclusive o primeiro e o último", () => {
    expect(periodDays("2026-10-05", "2026-10-07")).toBe(3);
    expect(periodDays("2026-10-05", "2026-10-05")).toBe(1);
  });
  it("atestado anulado não ampara a falta", () => {
    const list = projectJustifications([reg("a", "2026-10-05", "2026-10-07"), { ...reg("a", "2026-10-05", "2026-10-07"), act: "anular", reason: "erro de data" }]);
    expect(list[0].voided).toBe(true);
    expect(coveredOn(list, "2026-10-06")).toBeNull();
  });
  it("ampara só dentro do período", () => {
    const list = projectJustifications([reg("a", "2026-10-05", "2026-10-07")]);
    expect(coveredOn(list, "2026-10-07")?.id).toBe("a");
    expect(coveredOn(list, "2026-10-08")).toBeNull();
  });
});
