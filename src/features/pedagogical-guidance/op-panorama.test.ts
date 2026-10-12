import { describe, it, expect } from "vitest";
import { buildPanorama, centralPanorama, classHistory, type PanoramaSources } from "./op-panorama";

const src: PanoramaSources = {
  classes: [
    { classId: "5A", schoolId: "sA", stage: "EF-AI", modality: "regular" },
    { classId: "6A", schoolId: "sA", stage: "EF-AF", modality: "regular" },
    { classId: "E1", schoolId: "sA", stage: null, modality: "eja" },
    { classId: "7B", schoolId: "sB", stage: "EF-AF", modality: "regular" },
  ],
  allocations: [
    { studentId: "e1", classId: "5A", from: "2026-02-01", to: "2026-04-30" },
    { studentId: "e1", classId: "6A", from: "2026-05-01", to: null }, // remanejado: conta uma vez na data
    { studentId: "e2", classId: "5A", from: "2026-02-01", to: null },
    { studentId: "e3", classId: "5A", from: "2026-02-01", to: null },
    { studentId: "e3", classId: "E1", from: "2026-02-01", to: null }, // vínculo múltiplo simultâneo
    { studentId: "e9", classId: "7B", from: "2026-02-01", to: null },
  ],
  assignments: [
    { personId: "p1", classId: "5A", componentId: "MAT", from: "2026-02-01", to: null },
    { personId: "p1", classId: "6A", componentId: "MAT", from: "2026-02-01", to: null }, // mesma pessoa, duas turmas
    { personId: "p2", classId: "5A", componentId: "POR", from: "2026-02-01", to: "2026-03-01" },
  ],
  plans: [{ classId: "5A", componentId: "MAT", date: "2026-05-05" }, { classId: "5A", componentId: "MAT", date: "2026-01-10" }],
  lessons: [{ classId: "5A", componentId: "MAT", date: "2026-05-06" }],
  attendanceCalls: null, results: [], projects: [],
  interventions: [{ studentId: "e2", classId: "5A", from: "2026-05-01", to: null }, { studentId: "e2", classId: "5A", from: "2026-05-10", to: null }],
};
const period = { from: "2026-05-01", to: "2026-05-31" };

describe("OP L04 — panorama", () => {
  it("conta pessoas distintas na data, não vínculos", () => {
    const p = buildPanorama(src, { schoolId: "sA", period, date: "2026-05-10" });
    expect(p).toMatchObject({ classes: 3, students: 3, teachers: 1, multipleAllocations: 1, interventions: 1 });
  });
  it("alocação temporal: antes do remanejamento e1 está na 5A", () => {
    expect(buildPanorama(src, { classId: "5A", period, date: "2026-03-10" }).students).toBe(3);
    expect(buildPanorama(src, { classId: "5A", period, date: "2026-05-10" }).students).toBe(2);
  });
  it("filtros por etapa/componente; oferta ausente é declarada, não suposta", () => {
    const p = buildPanorama(src, { schoolId: "sA", stage: "EF-AF", period, date: "2026-05-10" });
    expect(p.classes).toBe(1); expect(p.unknownOffer).toBe(1);
    expect(buildPanorama(src, { schoolId: "sA", componentId: "MAT", period, date: "2026-05-10" }).plans).toBe(1);
  });
  it("fonte não lida é null, nunca zero", () => {
    const p = buildPanorama(src, { schoolId: "sA", period, date: "2026-05-10" });
    expect(p.attendanceCalls).toBeNull(); expect(p.results).toBe(0);
    expect(buildPanorama({ ...src, classes: null }, { period, date: "2026-05-10" }).students).toBeNull();
  });
  it("central vê só agregado com supressão", () => {
    const c = centralPanorama(src, ["sA", "sB"], { period, date: "2026-05-10" });
    expect(c[0]!.values.students).toBe("suprimido");
    expect(c[0]!.values.attendanceCalls).toBe("não disponível");
    expect(JSON.stringify(c)).not.toMatch(/e[0-9]/);
  });
  it("histórico da turma ordenado e com fontes não lidas declaradas", () => {
    const h = classHistory(src, "5A", period);
    expect(h.events.map((e) => e.kind)).toEqual(["plano", "aula"]);
    expect(h.notRead).toEqual(["attendanceCalls"]);
  });
});
