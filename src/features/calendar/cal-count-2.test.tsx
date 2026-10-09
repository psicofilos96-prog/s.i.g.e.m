/**
 * CAL.COUNT.1 (reabertura 2026-10-09) — identidade dos totais em todas as
 * apresentações e casos de sobreposição. Regra única: efeito declarado do tipo
 * (`countsAsSchoolDay` no laboratório, `school_day_effect` no institucional).
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { buildImportPlan, referenceCalendars2027 } from "./calendar-browser-import";
import {
  annualSchoolDays, countSchoolDays, periodSchoolDays, resolveCalendar, schoolDaysPerMonth,
  totalSchoolDays, validateCalendar,
} from "./calendar-engine";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { buildExternalViewModel, defaultProfile } from "./calendar-external-model";
import { MosaicSheet, PanoramicSheet } from "./calendar-external-sheets";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";
import type { NetworkCalendar } from "./calendar-types";

const refs = referenceCalendars2027();
const base = refs.find((c) => c.id === "cal-rede-2027-regular")!;
const withEdits = (e: Partial<NetworkCalendar>): NetworkCalendar => ({ ...base, ...e });
const total = (c: NetworkCalendar) => totalSchoolDays(resolveCalendar(c));
const D = "2027-03-10"; // quarta-feira letiva comum

/** Dias institucionais a partir da fonte: uma declaração diária com o efeito do tipo. */
function institutionalDays(cal: NetworkCalendar) {
  const plan = buildImportPlan(cal);
  const T = resolveCalendar(cal).types;
  const days: CalendarDayRead[] = plan.days.map((d) => ({
    on: d.day, state: "homologada",
    rows: [{
      declarationId: `d-${d.day}`, declarationKind: "intervalo", dayState: "declarado", startsOn: null, endsOn: null,
      eventLabel: d.label, dayTypeId: d.code, dayTypeVersionId: `tv-${d.code}`, dayTypeVersion: 1,
      dayTypeLabel: T[d.code]?.label ?? d.code, schoolDayEffect: T[d.code]?.countsAsSchoolDay ?? null,
    } as DayDeclarationRow],
  }));
  const presentation = { ...plan.presentation, typeMap: Object.fromEntries(plan.types.map((t) => [`tv-${t.code}`, t.code])) };
  const periods = cal.periods.map((p) => ({ name: p.name, startsOn: p.start, endsOn: p.end }));
  return { model: buildPrintModel(presentation, days, periods), presentation };
}

describe("CAL.COUNT.1 — identidade em todas as apresentações (3 calendários 2027)", () => {
  for (const cal of refs) {
    it(`${cal.id}: mês = período = anual = Interno = Panorâmico = Mosaico = 200`, () => {
      const r = resolveCalendar(cal);
      const monthly = schoolDaysPerMonth(r).reduce((a, b) => a + b, 0);
      const periods = cal.periods.reduce((a, p) => a + periodSchoolDays(r, p), 0);
      const { model, presentation } = institutionalDays(cal);
      const vm = buildExternalViewModel(model, presentation);
      const pan = render(<PanoramicSheet vm={vm} p={defaultProfile("externo-livre")} presentation={presentation} />);
      const panTotal = pan.getAllByTestId("cx-total-anual").at(-1)!.textContent;
      pan.unmount();
      const mos = render(<MosaicSheet vm={vm} p={defaultProfile("externo-livre")} presentation={presentation} />);
      const mosTotal = mos.getAllByTestId("cx-total-anual").at(-1)!.textContent;
      mos.unmount();
      const values = {
        total: totalSchoolDays(r), monthly, periods, interno: annualSchoolDays(cal, r),
        printMonths: model.months.reduce((a, m) => a + (m.total.schoolDays ?? NaN), 0),
        printPeriods: model.periods.reduce((a, p) => a + (p.schoolDays ?? NaN), 0),
        printAnnual: model.total.schoolDays, panoramico: Number(panTotal), mosaico: Number(mosTotal),
      };
      expect(Object.values(values).every((v) => v === 200), JSON.stringify(values)).toBe(true);
      expect(new Set(model.months.flatMap((m) => m.days.map((d) => d.on))).size).toBe(365);
      expect(r.countConflicts?.size ?? 0).toBe(0);
    });
  }
});

describe("CAL.COUNT.1 — casos de sobreposição", () => {
  it("dia com um único tipo letivo conta 1", () => {
    expect(countSchoolDays(resolveCalendar(base), D, D)).toBe(1);
  });
  it("tipo letivo + marcador letivo (Conselho) não soma em dobro", () => {
    const c = withEdits({ events: [...base.events, { id: "x1", type: "CC", date: D }, { id: "x2", type: "CENSO", date: D }] });
    expect(total(c)).toBe(200);
    expect(resolveCalendar(c).countConflicts?.size).toBe(0);
  });
  it("dia não letivo + marcador: só muda se o marcador declarar efeito próprio", () => {
    const fer = "2027-04-21"; // Tiradentes (feriado, não letivo)
    // Marcador não letivo sobre feriado: continua não letivo.
    const a = withEdits({ events: [...base.events, { id: "x", type: "PP", date: fer }] });
    expect(countSchoolDays(resolveCalendar(a), fer, fer)).toBe(0);
    // Evento é declaração explícita do dia (precedência por natureza): o efeito é o do evento, nunca o da ordem.
    const b = withEdits({ events: [{ id: "x", type: "CC", date: fer }, ...base.events] });
    const c = withEdits({ events: [...base.events, { id: "x", type: "CC", date: fer }] });
    expect(countSchoolDays(resolveCalendar(b), fer, fer)).toBe(countSchoolDays(resolveCalendar(c), fer, fer));
  });
  it("marcadores com efeitos opostos na mesma data: bloqueia, independente da ordem", () => {
    const a = withEdits({ events: [...base.events, { id: "x1", type: "CC", date: D }, { id: "x2", type: "MESTRE", date: D }] });
    const b = withEdits({ events: [...base.events, { id: "x2", type: "MESTRE", date: D }, { id: "x1", type: "CC", date: D }] });
    for (const c of [a, b]) {
      expect(resolveCalendar(c).countConflicts?.has(D)).toBe(true);
      expect(validateCalendar(c).some((i) => i.code === "CONTAGEM_EM_CONFLITO" && i.severity === "erro")).toBe(true);
    }
  });
  it("sobrescrita resolve o conflito explicitamente", () => {
    const c = withEdits({
      events: [...base.events, { id: "x1", type: "CC", date: D }, { id: "x2", type: "MESTRE", date: D }],
      overrides: [...base.overrides, { date: D, type: "CC" }],
    });
    expect(resolveCalendar(c).countConflicts?.size).toBe(0);
    expect(total(c)).toBe(200);
  });
  it("feriado letivo conta como letivo", () => {
    const c = withEdits({ overrides: [...base.overrides, { date: "2027-04-21", type: "FL" }] });
    expect(countSchoolDays(resolveCalendar(c), "2027-04-21", "2027-04-21")).toBe(1);
  });
  it("mudança de período: data de fronteira conta em um único período", () => {
    const r = resolveCalendar(base);
    const p = [...base.periods].sort((x, y) => x.order - y.order);
    expect(p[0]!.end < p[1]!.start).toBe(true);
    expect(p.reduce((a, x) => a + periodSchoolDays(r, x), 0)).toBe(totalSchoolDays(r));
  });
  it("meses de 28/29/30/31 dias contam só o próprio mês", () => {
    const leap = { ...base, year: 2028, ranges: [], events: [], overrides: [], inheritedHolidays: [], periods: [] };
    const months = schoolDaysPerMonth(resolveCalendar(leap));
    expect(months[1]).toBe(21); // fev/2028: 29 dias, 8 de fim de semana
    expect(schoolDaysPerMonth(resolveCalendar({ ...leap, year: 2027 }))[1]).toBe(20); // fev/2027: 28 dias
    expect(months.reduce((a, b) => a + b, 0)).toBe(totalSchoolDays(resolveCalendar(leap)));
  });
});
