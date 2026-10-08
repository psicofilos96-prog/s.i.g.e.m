/**
 * CAL.COUNT.1 — reconciliação do total de dias letivos de 2027 sobre a fonte
 * canônica (calendar-fixtures). Regra única: countsAsSchoolDay do tipo do dia
 * (nunca cor, símbolo ou nome). Cada data civil conta no máximo uma vez.
 */
import { describe, expect, it } from "vitest";
import { createCalendarFixtures } from "./calendar-fixtures";
import { countSchoolDays, isSchoolDay, periodSchoolDays, resolveCalendar, schoolDaysPerMonth, totalSchoolDays } from "./calendar-engine";

const cal = createCalendarFixtures().find((c) => c.year === 2027)!;
const r = resolveCalendar(cal);

describe("CAL.COUNT.1 — total de dias letivos de 2027 reconciliado", () => {
  it("datas civis são únicas e todas de 2027", () => {
    const dates = [...r.byDate.keys()];
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.every((d) => d.startsWith("2027-"))).toBe(true);
  });
  it("anual = soma mensal = contagem dia a dia", () => {
    const total = totalSchoolDays(r);
    const monthly = schoolDaysPerMonth(r);
    expect(monthly.reduce((a, b) => a + b, 0)).toBe(total);
    expect(countSchoolDays(r, "2027-01-01", "2027-12-31")).toBe(total);
    // Fonte canônica real (fixture e 3 versões no banco) soma 200; o 198 era a proposta de outubro NÃO aplicada.
    expect(total).toBe(200);
  });
  it("soma dos períodos = dias letivos dentro dos períodos", () => {
    const inPeriods = [...r.byDate.keys()].filter((d) => isSchoolDay(r, d) && cal.periods.some((p) => p.start <= d && p.end >= d)).length;
    expect(cal.periods.reduce((a, p) => a + periodSchoolDays(r, p), 0)).toBe(inPeriods);
  });
});
