import { describe, expect, it } from "vitest";
import {
  councilDates,
  dayType,
  periodSchoolDays,
  resolveCalendar,
  totalSchoolDays,
} from "./calendar-engine";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { mutateCalendar, transitionCalendar } from "./calendar-governance";
import type { CalendarActor, DayTypeCode, NetworkCalendar } from "./calendar-types";

const { supervisao, escola, professor } = demoActors;
const regular = () => createCalendarFixtures()[0]!;
const total = (c: NetworkCalendar) => totalSchoolDays(resolveCalendar(c));
const type = (c: NetworkCalendar, d: string) => dayType(resolveCalendar(c), d);
const restore = (c: NetworkCalendar, date: string, actor: CalendarActor = supervisao) =>
  mutateCalendar(c, actor, { kind: "restaurar-dia-letivo", date });
const set = (c: NetworkCalendar, date: string, t: DayTypeCode) => {
  const r = mutateCalendar(c, supervisao, { kind: "definir-dia", date, type: t });
  if (!r.ok) throw new Error(r.reason);
  return r.calendar;
};
const ok = (r: ReturnType<typeof restore>) => {
  if (!r.ok) throw new Error(r.reason);
  return r.calendar;
};
const WED = "2027-03-03"; // quarta-feira comum

describe("Dia letivo — remoção de classificação especial", () => {
  it("dia comum de fábrica é VAZIO e conta como letivo", () => {
    expect(type(regular(), WED)).toBe("VAZIO");
  });

  it("Feriado → Dia letivo remove F e volta a contar", () => {
    const base = regular();
    const f = set(base, WED, "FERIADO");
    expect(total(f)).toBe(total(base) - 1);
    const back = ok(restore(f, WED));
    expect(type(back, WED)).toBe("VAZIO");
    expect(total(back)).toBe(total(base));
  });

  it("Recesso pontual → Dia letivo recalcula totais", () => {
    const base = regular();
    const r = set(base, WED, "RECESSO");
    const back = ok(restore(r, WED));
    expect(type(back, WED)).toBe("VAZIO");
    expect(total(back)).toBe(total(base));
  });

  it("Conselho de Classe → Dia letivo remove o CC do período", () => {
    const base = regular();
    const cc = base.events.find((e) => e.type === "CC")!.date;
    expect(councilDates(base).some((c) => c.date === cc)).toBe(true);
    const back = ok(restore(base, cc));
    expect(type(back, cc)).toBe("VAZIO");
    expect(councilDates(back).some((c) => c.date === cc)).toBe(false);
  });

  it("Dia letivo → evento → Dia letivo retorna ao estado inicial", () => {
    const base = regular();
    const back = ok(restore(set(base, WED, "PP"), WED));
    expect(back.overrides).toEqual(base.overrides);
    expect(back.events).toEqual(base.events);
    expect(total(back)).toBe(total(base));
  });

  it("decisão do usuário: 'Dia letivo' vale também dentro de férias e no fim de semana", () => {
    const base = regular();
    const fer = base.ranges.find((r) => r.type === "FERIAS")!;
    expect(type(ok(restore(set(base, fer.start, "PP"), fer.start)), fer.start)).toBe("VAZIO");
    const sat = "2027-03-06";
    expect(type(ok(restore(base, sat)), sat)).toBe("VAZIO");
  });

  it("totais por período reagem", () => {
    const base = regular();
    const p = base.periods.find((x) => x.start <= WED && x.end >= WED)!;
    const f = set(base, WED, "FERIADO");
    const days = (c: NetworkCalendar) => periodSchoolDays(resolveCalendar(c), p);
    expect(JSON.stringify(days(f))).not.toBe(JSON.stringify(days(base)));
    expect(JSON.stringify(days(ok(restore(f, WED))))).toBe(JSON.stringify(days(base)));
  });

  it("registra auditoria", () => {
    const back = ok(restore(set(regular(), WED, "FERIADO"), WED));
    expect(back.audit.at(-1)).toMatchObject({ actorId: supervisao.id, action: "alterado" });
    expect(back.audit.at(-1)!.detail).toMatch(/dia letivo/);
  });

  it("governança: escola/professor e estados imutáveis recusam", () => {
    const f = set(regular(), WED, "FERIADO");
    expect(restore(f, WED, escola).ok).toBe(false);
    expect(restore(f, WED, professor).ok).toBe(false);
    const rev = transitionCalendar(f, supervisao, "enviar-revisao");
    if (rev.ok) {
      expect(restore(rev.calendar, WED).ok).toBe(false);
      const hom = transitionCalendar(rev.calendar, supervisao, "homologar", {
        confirmCritical: true,
      });
      if (hom.ok) {
        expect(restore(hom.calendar, WED).ok).toBe(false);
        const arq = transitionCalendar(hom.calendar, supervisao, "arquivar");
        if (arq.ok) expect(restore(arq.calendar, WED).ok).toBe(false);
      }
    }
  });

  it("fixtures 2027 inalteradas sem edição", () => {
    expect(createCalendarFixtures()).toEqual(createCalendarFixtures());
  });
});
