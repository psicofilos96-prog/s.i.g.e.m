import { describe, expect, it } from "vitest";
import { INDICATORS, share, totals, type IndicatorRow } from "./nei-indicators";

const row = (o: Partial<IndicatorRow>): IndicatorRow => ({
  school_id: "a", followed: 0, with_paee: 0, with_pei: 0, plans_total: 0, plans_overdue: 0, aee_services: 0, aee_planned: 0, aee_started: 0, aee_interrupted: 0,
  cases_open: 0, cases_overdue: 0, support_open: 0, actions_open: 0, actions_overdue: 0, mediations: 0, mediations_uncovered: 0, protocols_sent: 0, protocols_answered: 0,
  protocol_reply_days_median: null, support_first_move_days_median: null, barriers_open: 0, ...o,
});
const def = (k: string) => INDICATORS.find((d) => d.key === k)!;

describe("NEI.6 indicadores", () => {
  it("percentual usa o denominador declarado", () => { expect(share(def("with_paee"), row({ followed: 4, with_paee: 1 }))).toBe(25); });
  it("denominador zero não vira 0%", () => { expect(share(def("plans_overdue"), row({}))).toBeNull(); });
  it("medianas não são somadas no total", () => {
    const t = totals([row({ followed: 2, protocol_reply_days_median: 3 }), row({ followed: 3, protocol_reply_days_median: 5 })]);
    expect(t.followed).toBe(5); expect(t.protocol_reply_days_median).toBeNull();
  });
  it("todo indicador declara fórmula e fonte", () => { for (const d of INDICATORS) { expect(d.formula.length).toBeGreaterThan(10); expect(d.source).toBeTruthy(); } });
});
