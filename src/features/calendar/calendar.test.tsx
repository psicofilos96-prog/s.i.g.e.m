import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { academicYears, getAcademicYear, schoolCalendars, type SchoolCalendar } from "@/features/academic/academic-structure";
import { periodStructures } from "@/features/assessment/assessment-fixtures";
import type { AssessmentPeriodStructure } from "@/features/assessment/assessment-types";
import { daysInMonth, isLeapYear, monthGrid, monthsCovering, weekdayOf } from "@/lib/academic-date";
import { calendarEvents, dayCategories } from "./calendar-fixtures";
import {
  buildCalendarIndex,
  calendarForYear,
  calendarState,
  countSchoolDays,
  diaryDateStatus,
  hasInstitutionalEvent,
  hasSuspension,
  instrumentTemporalCoherence,
  isCalendarHomologated,
  isSchoolDay,
  isSchoolSaturday,
  nextSchoolDay,
  periodForDate,
  validateCalendar,
  validateCalendarPeriods,
} from "./calendar-rules";
import { calendarRepository, createInMemoryCalendarRepository } from "./calendar-store";
import { CalendarPrintDocument } from "./calendar-print-view";
import type { CalendarEvent } from "./calendar-types";

const resolved = calendarForYear("ano-2026")!;
const index = buildCalendarIndex({ ...resolved, events: calendarEvents });
const structureA = periodStructures.find((s) => s.id === "est-2026-a")!;

beforeEach(() => calendarRepository.reset());

describe("aritmética temporal", () => {
  it("ano comum e bissexto sem tabela fixa", () => {
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it("primeiro dia de diferentes meses posiciona a grade pelo dia da semana real", () => {
    expect(weekdayOf("2026-01-01")).toBe(4);
    expect(monthGrid(2026, 1).findIndex(Boolean)).toBe(4);
    expect(monthGrid(2026, 2).findIndex(Boolean)).toBe(0);
    expect(monthGrid(2026, 8).findIndex(Boolean)).toBe(6);
    expect(monthGrid(2028, 2).filter(Boolean)).toHaveLength(29);
  });
  it("meses cobertos dependem da vigência, não de 12 fixos", () => {
    expect(monthsCovering("2026-02-05", "2026-12-18")).toHaveLength(11);
    expect(monthsCovering("2026-08-01", "2027-03-10").map((m) => m.key).at(-1)).toBe("2027-03");
  });
});

describe("calendário como entidade acadêmica", () => {
  it("liga-se ao ano letivo por ID", () => {
    expect(resolved.calendar.academicYearId).toBe("ano-2026");
    expect(resolved.year.calendarId).toBe(resolved.calendar.id);
  });
  it("renomear o ano não quebra a referência", () => {
    const renamed = academicYears.map((y) => (y.id === "ano-2026" ? { ...y, label: "Outro nome" } : y));
    const year = getAcademicYear("ano-2026", renamed)!;
    const idx = buildCalendarIndex({ calendar: resolved.calendar, year, events: calendarEvents });
    expect(countSchoolDays(idx, year.validity.start, year.validity.end)).toBe(
      countSchoolDays(index, year.validity.start, year.validity.end),
    );
  });
  it("não usa texto exibido para determinar regra temporal", () => {
    const retitled = calendarEvents.map((e) => ({ ...e, title: "Letivo" }));
    const idx = buildCalendarIndex({ ...resolved, events: retitled });
    expect(isSchoolDay(idx, "2026-06-10")).toBe(false);
  });
});

describe("dias letivos", () => {
  it("dia letivo explícito", () => expect(isSchoolDay(index, "2026-03-10")).toBe(true));
  it("sábado letivo explícito, sábado comum não", () => {
    expect(isSchoolSaturday(index, "2026-03-14")).toBe(true);
    expect(isSchoolDay(index, "2026-03-21")).toBe(false);
  });
  it("dia útil não letivo", () => {
    expect(weekdayOf("2026-06-10")).toBe(3);
    expect(isSchoolDay(index, "2026-06-10")).toBe(false);
    expect(isSchoolDay(index, "2026-02-05")).toBe(false);
  });
  it("sem evento classificador o dia não é presumido letivo", () => {
    const idx = buildCalendarIndex({ ...resolved, events: [] });
    expect(idx.days.get("2026-03-10")!.status).toBe("sem-classificacao");
  });
  it("marcador não altera a condição letiva; suspensão sim", () => {
    expect(hasInstitutionalEvent(index, "2026-05-15")).toBe(true);
    expect(isSchoolDay(index, "2026-05-15")).toBe(true);
    expect(hasSuspension(index, "2026-08-21")).toBe(true);
  });
  it("próximo dia letivo e contagem", () => {
    expect(nextSchoolDay(index, "2026-03-13")).toBe("2026-03-14");
    expect(nextSchoolDay(index, "2026-06-09")).toBe("2026-06-11");
    expect(nextSchoolDay(index, "2026-12-18")).toBeNull();
    expect(countSchoolDays(index, "2026-03-09", "2026-03-15")).toBe(6);
  });
  it("ajuste local altera só o dia e é reversível", () => {
    const repo = createInMemoryCalendarRepository();
    repo.setDayCategory("cal-ano-2026", "2026-03-10", "cat-feriado");
    let idx = buildCalendarIndex({ ...resolved, events: repo.events("cal-ano-2026") });
    expect(isSchoolDay(idx, "2026-03-10")).toBe(false);
    expect(isSchoolDay(idx, "2026-03-11")).toBe(true);
    repo.setDayCategory("cal-ano-2026", "2026-03-10", null);
    idx = buildCalendarIndex({ ...resolved, events: repo.events("cal-ano-2026") });
    expect(isSchoolDay(idx, "2026-03-10")).toBe(true);
  });
});

describe("validação", () => {
  const ev = (patch: Partial<CalendarEvent>): CalendarEvent => ({
    id: "x", calendarId: "cal-ano-2026", categoryId: "cat-feriado", title: "t", start: "2026-03-10", end: "2026-03-10", ...patch,
  });
  const codes = (events: CalendarEvent[]) => validateCalendar({ ...resolved, events }).map((i) => i.code);
  it("fixtures válidas", () => expect(validateCalendar({ ...resolved, events: calendarEvents })).toEqual([]));
  it("evento fora da vigência, intervalo invertido, id duplicado, categoria inválida", () => {
    expect(codes([ev({ start: "2026-01-10", end: "2026-01-10" })])).toContain("fora-da-vigencia");
    expect(codes([ev({ start: "2026-03-12", end: "2026-03-10" })])).toContain("intervalo-invertido");
    expect(codes([ev({}), ev({})])).toContain("id-duplicado");
    expect(codes([ev({ categoryId: "cat-x" })])).toContain("categoria-invalida");
    expect(codes([ev({ calendarId: "cal-ano-2025" })])).toContain("calendario-incompativel");
  });
  it("ano incompatível", () => {
    const cal: SchoolCalendar = { ...resolved.calendar, academicYearId: "ano-2025" };
    expect(validateCalendar({ calendar: cal, year: resolved.year, events: [] })[0]!.code).toBe("ano-incompativel");
  });
  it("conflito estrutural: mesma precedência e efeitos opostos", () => {
    const categories = [...dayCategories, { ...dayCategories[0]!, id: "cat-l80", precedence: 80 }];
    const issues = validateCalendar({ ...resolved, categories, events: [ev({}), ev({ id: "y", categoryId: "cat-l80" })] });
    expect(issues.map((i) => i.code)).toContain("conflito");
  });
});

describe("períodos avaliativos", () => {
  it("busca período por data e data sem período", () => {
    expect(periodForDate(structureA, "2026-06-01")?.id).toBe("pa-2026-a2");
    expect(periodForDate(structureA, "2026-09-07")).toBeNull();
  });
  it("lacuna com dia letivo é observação, não erro", () => {
    const issues = validateCalendarPeriods(index, structureA);
    expect(issues.every((i) => i.severity === "observacao")).toBe(true);
    expect(issues[0]!.code).toBe("lacuna-com-dia-letivo");
  });
  it("período de outro ano e fora da vigência são erros", () => {
    const other = periodStructures.find((s) => s.academicYearId === "ano-2025")!;
    expect(validateCalendarPeriods(index, other).some((i) => i.code === "periodo-ano-incompativel")).toBe(true);
    const bad: AssessmentPeriodStructure = {
      ...structureA,
      periods: [{ ...structureA.periods[0]!, end: "2027-01-10" }],
    };
    expect(validateCalendarPeriods(index, bad).some((i) => i.code === "periodo-fora-da-vigencia")).toBe(true);
  });
  it("coerência temporal de instrumento para a 12C", () => {
    const p = structureA.periods[0]!;
    expect(instrumentTemporalCoherence({ date: "2026-03-10", period: p, index }).coherent).toBe(true);
    expect(instrumentTemporalCoherence({ date: "2026-06-01", period: p, index }).coherent).toBe(false);
  });
});

describe("homologação e Diário", () => {
  it("calendário demonstrativo não é oficial", () => {
    expect(calendarState(index)).toBe("demonstrativo");
    expect(isCalendarHomologated(index)).toBe(false);
  });
  it("homologado só quando calendário, ano e categorias em uso são homologados", () => {
    const year = { ...resolved.year, normativeStatus: "homologado" as const };
    const calendar = { ...resolved.calendar, normativeStatus: "homologado" as const };
    const partial = buildCalendarIndex({ calendar, year, events: calendarEvents });
    expect(calendarState(partial)).toBe("configurado");
    const categories = dayCategories.map((c) => ({ ...c, normativeStatus: "homologado" as const }));
    const full = buildCalendarIndex({ calendar, year, events: calendarEvents, categories });
    expect(isCalendarHomologated(full)).toBe(true);
    expect(isCalendarHomologated(full, [{ severity: "erro", code: "conflito", message: "" }])).toBe(false);
  });
  it("nenhuma fixture de calendário é homologada", () => {
    expect(schoolCalendars.some((c) => c.normativeStatus === "homologado")).toBe(false);
    expect(dayCategories.some((c) => c.normativeStatus === "homologado")).toBe(false);
  });
  it("seletor do Diário distingue data excepcional sem alterar o Diário", () => {
    expect(diaryDateStatus(index, "2026-06-10", { plannedLesson: true })).toMatchObject({ status: "nao-letivo", exceptional: true });
    expect(diaryDateStatus(index, "2026-01-15").status).toBe("fora-da-vigencia");
    expect(diaryDateStatus(null, "2026-03-10").status).toBe("sem-calendario");
  });
});

describe("impressão", () => {
  it("documento de impressão não contém controles de aplicação", () => {
    render(<CalendarPrintDocument index={index} structure={structureA} official={false} />);
    const article = screen.getByRole("article", { name: "Calendário para impressão" });
    expect(within(article).queryAllByRole("button")).toHaveLength(0);
    expect(within(article).getByText(/não é o calendário oficial/)).toBeInTheDocument();
    expect(within(article).getByText("Período demonstrativo 2")).toBeInTheDocument();
  });
});
