import { describe, expect, it } from "vitest";
import { inspectCycleClosing } from "./cycle-closing-inspector";
import { demonstrationClosingPolicyFull } from "./cycle-closing-fixtures";
import type { CycleClosingPolicy } from "./cycle-closing-types";

const ctx = (extra: object = {}) => ({
  classId: "t1", cycleId: "c1", academicYearId: "a1", students: [], expectations: [],
  observations: [{ sourceKind: "calendario", sourceId: "cal-x", state: "homologado", dimensions: { academicYearId: "a1" } }],
  now: "2026-10-03T00:00:00Z", ...extra,
});
const unavailable = [{ sourceKind: "calendario", state: "indisponivel" as const, reason: "Calendário institucional indisponível." }];
const calendarReq = demonstrationClosingPolicyFull.requirements.find((r) => r.id === "req-demo-calendario")!;
const withCalendar: CycleClosingPolicy = { ...demonstrationClosingPolicyFull, requirements: [calendarReq], terminalStandingRequirement: undefined as never };

describe("B4.6.2b.1 — disponibilidade genérica de fontes", () => {
  it("requisito com sourceKind indisponível: inconclusivo, nunca satisfeito, motivo 'indisponível'", () => {
    const d = inspectCycleClosing({ policy: withCalendar, context: ctx({ sourceAvailability: unavailable }) });
    expect(d.classRequirements[0]!.status).toBe("inconclusivo");
    expect(d.classRequirements[0]!.reason).toMatch(/indisponível/);
    expect(d.classRequirements[0]!.reason).not.toMatch(/não homologado|não existe|0 calend/i);
    expect(d.closable).toBe(false);
  });
  it("sem indisponibilidade, o avaliador declarado continua apurando (compatibilidade)", () => {
    const d = inspectCycleClosing({ policy: withCalendar, context: ctx() });
    expect(d.classRequirements[0]!.status).toBe("satisfeito");
  });
  it("política sem requisito calendario: nenhum bloqueio novo", () => {
    const other = { ...withCalendar, requirements: [{ ...calendarReq, id: "r2", parameters: { sourceKind: "deliberacao", acceptedStates: ["x"], minimumCount: 0 } }] };
    const a = inspectCycleClosing({ policy: other, context: ctx() });
    const b = inspectCycleClosing({ policy: other, context: ctx({ sourceAvailability: unavailable }) });
    expect(b.classRequirements.map((r) => [r.status, r.reason])).toEqual(a.classRequirements.map((r) => [r.status, r.reason]));
    expect(b.impediments).toEqual(a.impediments);
  });
});
