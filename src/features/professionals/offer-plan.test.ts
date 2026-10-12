import { describe, expect, it } from "vitest";
import { planOffer, schoolTotals, type OfferInput } from "./offer-plan";

const base: OfferInput = {
  cls: { classId: "T1", schoolId: "E1", academicYearId: "2026", positionKey: "6ano" },
  matrix: { status: "ok", source: "curricular_matrices_items_at", knownAt: "2026-03-01", value: [
    { matrixVersionId: "MV1", itemId: "I1", componentId: "MAT", weeklyClassHours: 2, durationContext: "EF-AF" },
    { matrixVersionId: "MV1", itemId: "I2", componentId: "POR", weeklyClassHours: null, durationContext: "EF-AF" },
  ] },
  calendar: { status: "ok", source: "calendar_at", knownAt: "2026-03-01", value: { calendarVersionId: "C1", periodFrom: "2026-02-02", periodUntil: "2026-12-18" } },
  schedule: { status: "ok", source: "class_schedule_at", knownAt: "2026-03-01", value: [{ blockId: "B1", componentId: "MAT" }] },
  durationMinutes: (c) => (c === "EF-AF" ? 50 : null),
};

describe("planejamento da oferta", () => {
  it("linha guarda só IDs + proveniência + período", () => {
    const p = planOffer(base);
    const mat = p.lines.find((l) => l.componentId === "MAT")!;
    expect(mat.provenance).toEqual({ matrixVersionId: "MV1", itemId: "I1", calendarVersionId: "C1", scheduleBlockIds: ["B1"] });
    expect(mat.period).toEqual({ from: "2026-02-02", until: "2026-12-18" });
    expect(mat.weeklyMinutes).toBe(100);
    expect(mat.gaps).toEqual(["blocos-a-menos"]);
  });
  it("carga ausente é lacuna, nunca zero", () => {
    const por = planOffer(base).lines.find((l) => l.componentId === "POR")!;
    expect(por.weeklyClassHours).toBeNull(); expect(por.weeklyMinutes).toBeNull();
    expect(por.gaps).toContain("carga-nao-configurada");
  });
  it("fonte não lida ≠ ausência confirmada", () => {
    expect(planOffer({ ...base, matrix: { status: "nao-lida", source: "m", reason: "rls" } }).classGaps).toEqual(["matriz-nao-lida"]);
    expect(planOffer({ ...base, matrix: { ...base.matrix, value: [] } as OfferInput["matrix"] }).classGaps).toEqual(["sem-matriz-vigente"]);
    const p = planOffer({ ...base, calendar: { status: "nao-lida", source: "c", reason: "x" }, schedule: { status: "nao-lida", source: "s", reason: "x" } });
    expect(p.classGaps).toEqual(["calendario-nao-lido", "grade-nao-lida"]);
    expect(p.lines[0]!.scheduledBlocks).toBeNull();
    expect(p.lines[0]!.period).toBeNull();
  });
  it("duração sem regra torna minutos indeterminados", () => {
    const l = planOffer({ ...base, durationMinutes: () => null }).lines[0]!;
    expect(l.gaps).toContain("duracao-sem-regra"); expect(l.weeklyMinutes).toBeNull();
  });
  it("total da escola não fecha com linha indeterminada", () => {
    expect(schoolTotals([planOffer(base)]).get("E1")?.minutes).toBeNull();
    const only = planOffer({ ...base, matrix: { ...base.matrix, value: [base.matrix.status === "ok" ? base.matrix.value[0]! : null!] } as OfferInput["matrix"] });
    expect(schoolTotals([only]).get("E1")?.minutes).toBe(100);
  });
});
