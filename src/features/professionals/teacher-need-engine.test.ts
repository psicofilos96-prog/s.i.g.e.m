import { describe, expect, it } from "vitest";
import { aggregate, NEED_METHODOLOGY, needLine, uncoveredPackages, type Assignment } from "./teacher-need-engine";
import type { OfferLine } from "./offer-plan";

const line = (o: Partial<OfferLine> = {}): OfferLine => ({
  classId: "T1", schoolId: "E1", componentId: "MAT",
  provenance: { matrixVersionId: "MV1", itemId: "I1", calendarVersionId: "C1", scheduleBlockIds: ["B1", "B2", "B3"] },
  period: { from: "2026-02-02", until: "2026-12-18" }, weeklyClassHours: 4, weeklyMinutes: 200, scheduledBlocks: 3, gaps: ["blocos-a-menos"], ...o,
});
const asg = (o: Partial<Assignment> = {}): Assignment => ({ assignmentId: "A1", classId: "T1", componentId: "MAT", blockIds: ["B1", "B2"], personId: "P1", validFrom: "2026-02-01", validUntil: null, ...o });
const D = "2026-03-02";

describe("necessidade de professores", () => {
  it("necessárias, ofertadas, atribuídas e descobertas separadas", () => {
    const n = needLine(line(), [asg()], D);
    expect(n).toMatchObject({ needed: 4, offered: 3, assigned: 2, uncovered: 2, unassignedBlockIds: ["B3"], assignmentRefs: ["A1"], methodology: "necessidade-professores@1" });
    expect(n.inheritedGaps).toEqual(["blocos-a-menos"]);
  });
  it("atribuição fora da vigência não cobre", () => {
    expect(needLine(line(), [asg({ validUntil: "2026-02-28" })], D).assigned).toBe(0);
  });
  it("carga ou grade indeterminada ⇒ descobertas null", () => {
    expect(needLine(line({ weeklyClassHours: null }), [], D).uncovered).toBeNull();
    expect(needLine(line({ scheduledBlocks: null }), [], D).assigned).toBeNull();
  });
  it("pacotes descobertos com requisito e horários; candidatos só se avaliados", () => {
    const n = needLine(line(), [asg()], D);
    expect(uncoveredPackages([n])).toEqual([{ schoolId: "E1", classId: "T1", componentId: "MAT", uncoveredClassHours: 2, blockIds: ["B3"], requiredQualification: "MAT", eligibleCandidates: null }]);
    expect(uncoveredPackages([n], () => 3)[0]!.eligibleCandidates).toBe(3);
  });
  it("nunca produz contagem de professores por divisão de jornada", () => {
    const n = needLine(line(), [], D);
    expect(Object.keys(n).some((k) => /teacher|professor|headcount/i.test(k))).toBe(false);
    expect(NEED_METHODOLOGY.steps.join(" ")).toContain("sem divisão por jornada nominal");
  });
  it("agregado só fecha sem linha indeterminada", () => {
    const a = aggregate([needLine(line(), [asg()], D), needLine(line({ classId: "T2", weeklyClassHours: null }), [], D)], "schoolId");
    expect(a[0]).toMatchObject({ key: "E1", needed: null, uncovered: null, lines: 2, indeterminate: 1 });
    expect(aggregate([needLine(line(), [asg()], D)], "componentId")[0]).toMatchObject({ key: "MAT", needed: 4, uncovered: 2 });
  });
});
