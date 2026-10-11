import { describe, it, expect } from "vitest";
import { offerOverview, calendarFollowUp, pedagogyFollowUp, enrollmentHistory } from "./supervision-pedagogy";

describe("oferta", () => {
  it("agrega só escolas visíveis e ausência não vira zero", () => {
    const r = offerOverview([
      { schoolId: "E1", classId: "a", stage: "EF", modality: null, shift: "M", capacity: 30, activeAllocations: 15, teachersAssigned: 3, componentsRequired: 5 },
      { schoolId: "E1", classId: "b", stage: "EF", modality: null, shift: "M", capacity: null, activeAllocations: 10, teachersAssigned: null, componentsRequired: 5 },
      { schoolId: "E2", classId: "c", stage: "EF", modality: null, shift: "M", capacity: 30, activeAllocations: 30, teachersAssigned: 5, componentsRequired: 5 },
    ], ["E1"], "stage");
    expect(r[0]!.classes).toBe(2);
    expect(r[0]!.enrolled).toEqual({ state: "registrado", value: 25 });
    expect(r[0]!.capacity.state).toBe("nao-registrado");
    expect(r[0]!.occupancy).toBeNull();
    expect(r[0]!.teachingGaps).toEqual(["a"]);
    expect(r[0]!.teachingUnknown).toEqual(["b"]);
    expect(enrollmentHistory([{ on: "2026-05", total: null }])[0]!.total.state).toBe("nao-registrado");
  });
});

describe("calendário", () => {
  it("bloqueia sem calendário único e aponta suspensão sem reposição", () => {
    expect(calendarFollowUp(["a", "b"], [], "2026-03-01")).toEqual({ blocked: "mais de um calendário aplicável" });
    const r = calendarFollowUp(["c"], [
      { date: "2026-03-02", planned: true, held: true, suspended: false, replacementOf: null },
      { date: "2026-03-03", planned: true, held: false, suspended: true, replacementOf: null },
      { date: "2026-03-07", planned: false, held: true, suspended: false, replacementOf: null },
    ], "2026-03-10");
    if ("blocked" in r) throw new Error();
    expect(r.planned.value).toBe(2);
    expect(r.held.value).toBe(1);
    expect(r.suspensionsWithoutReplacement).toEqual(["2026-03-03"]);
    expect(r.divergences).toEqual(["2026-03-07"]);
  });
});

describe("pedagogia", () => {
  it("só verifica andamento, nunca edita", () => {
    const r = pedagogyFollowUp([
      { schoolId: "E1", kind: "ppp", status: "rascunho", updatedAt: null, deadline: "2026-02-01" },
      { schoolId: "E1", kind: "intervencao", status: null, updatedAt: null, deadline: null },
    ], ["E1"], "2026-03-01");
    expect(r[0]!.overdue).toBe(true);
    expect(r[1]!.reading).toBe("não verificável");
    expect(r[1]!.owner).toBe("Orientação Pedagógica");
    expect(r.every((x) => x.editable === false)).toBe(true);
  });
});
