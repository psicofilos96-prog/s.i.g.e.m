/**
 * 12B.3 — Projeção canônica única: grade, blocos, períodos, total anual e
 * validação derivam da mesma fonte e reagem juntos a qualquer alteração.
 */
import { describe, expect, it } from "vitest";
import { deriveCalendarProjection, shiftDays } from "./calendar-engine";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { mutateCalendar, type CalendarMutation } from "./calendar-governance";
import type { NetworkCalendar } from "./calendar-types";

const { supervisao, escola } = demoActors;
const eja = () => createCalendarFixtures()[1]!;
const regular = () => createCalendarFixtures()[0]!;
function apply(cal: NetworkCalendar, m: CalendarMutation) {
  const r = mutateCalendar(cal, supervisao, m);
  if (!r.ok) throw new Error(r.reason);
  return r.calendar;
}
const gridTotals = (cal: NetworkCalendar) =>
  deriveCalendarProjection(cal).grid.flatMap((r) => (r.kind === "total" ? [r.total] : []));

/** Encurta o último período até perder exatamente 1 dia letivo. */
function dropOneDay(cal: NetworkCalendar) {
  const p0 = deriveCalendarProjection(cal);
  const last = p0.periods[p0.periods.length - 1]!;
  let end = last.period.end;
  let c = cal;
  for (let i = 0; i < 20; i++) {
    end = shiftDays(end, -1);
    c = apply(cal, { kind: "salvar-periodo", period: { ...last.period, end } });
    const n = deriveCalendarProjection(c).periods.at(-1)!.schoolDays;
    if (n === last.schoolDays - 1) return { c, original: last.period };
  }
  throw new Error("não encontrou dia letivo");
}

describe("projeção canônica", () => {
  it("EJA de referência: 100/100/200 em todas as projeções", () => {
    const p = deriveCalendarProjection(eja());
    expect(p.groups.map((g) => g.total)).toEqual([100, 100]);
    expect(gridTotals(eja())).toEqual([100, 100]);
    expect(p.annualSchoolDays).toBe(200);
    expect(p.validation.some((v) => v.code === "BLOCO_ABAIXO_DO_MINIMO")).toBe(false);
  });

  it("encurtar período recompõe grade, blocos, total e validação (100/99/199) e reverte", () => {
    const { c, original } = dropOneDay(eja());
    const p = deriveCalendarProjection(c);
    expect(p.groups.map((g) => g.total)).toEqual([100, 99]);
    expect(gridTotals(c)).toEqual([100, 99]);
    expect(p.annualSchoolDays).toBe(199);
    const codes = p.validation.map((v) => v.code);
    expect(codes).toContain("BLOCO_ABAIXO_DO_MINIMO");
    expect(codes).toContain("MINIMO_LEGAL");
    expect(codes).toContain("SOMA_PERIODOS");
    const back = apply(c, { kind: "salvar-periodo", period: original });
    expect(gridTotals(back)).toEqual([100, 100]);
    expect(deriveCalendarProjection(back).annualSchoolDays).toBe(200);
  });

  it("grade segue os agrupamentos configurados, não a modalidade", () => {
    let r = regular();
    expect(gridTotals(r)).toEqual([200]);
    r = apply(r, { kind: "salvar-grupo", group: { name: "Bloco A", totalLabel: "TOTAL A" } });
    const g = r.periodGroups[0]!;
    for (const per of r.periods)
      r = apply(r, { kind: "salvar-periodo", period: { ...per, groupId: g.id } });
    const rows = deriveCalendarProjection(r).grid.filter((x) => x.kind === "total");
    expect(rows.map((x) => x.label)).toEqual(["TOTAL A"]);
    expect(rows[0]!.total).toBe(200);
  });

  it("regra ausente = sem validação; regra configurada não altera o valor", () => {
    const { c } = dropOneDay(eja());
    const noRules = { ...c, rules: [] };
    const p = deriveCalendarProjection(noRules);
    expect(p.annualSchoolDays).toBe(199);
    expect(p.validation.some((v) => v.code === "MINIMO_LEGAL")).toBe(false);
  });

  it("regras e documento são editáveis só pela Supervisão em rascunho", () => {
    const cal = eja();
    const r = mutateCalendar(cal, escola, { kind: "remover-regra", id: cal.rules[0]!.id });
    expect(r.ok).toBe(false);
    const c = apply(cal, {
      kind: "salvar-regra",
      rule: { kind: "minimo-periodo", enabled: true, severity: "atencao", value: 60 },
    });
    expect(deriveCalendarProjection(c).validation.some((v) => v.code === "PERIODO_ABAIXO_DO_MINIMO")).toBe(
      true,
    );
    const d = apply(c, { kind: "configurar-documento", patch: { document: { showHolidays: false } } });
    expect(d.document.showHolidays).toBe(false);
    expect(d.audit.length).toBe(cal.audit.length + 2);
  });

  it("remover agrupamento remove regras que apontavam para ele", () => {
    const c = apply(eja(), { kind: "remover-grupo", id: "grp-2027-eja-s2" });
    expect(c.rules.some((r) => r.targetId === "grp-2027-eja-s2")).toBe(false);
  });
});
