import { describe, expect, it } from "vitest";
import { holidaysForDisplay } from "./calendar-engine";
import { createCalendarFixtures } from "./calendar-fixtures";

const regular = () => createCalendarFixtures()[0]!;

describe("feriado lançado pela pessoa sempre aparece na lista", () => {
  it("feriado com nome dentro de férias aparece", () => {
    const cal = regular();
    cal.events = [...cal.events, { id: "t1", type: "FERIADO", date: "2027-07-15", name: "Dia do Professor (teste)" }];
    expect(holidaysForDisplay(cal).some((h) => h.date === "2027-07-15" && h.name === "Dia do Professor (teste)")).toBe(true);
  });
  it("dia ajustado para Feriado sem evento aparece com o nome do tipo", () => {
    const cal = regular();
    cal.overrides = [...cal.overrides, { date: "2027-08-18", type: "FERIADO" }];
    expect(holidaysForDisplay(cal).some((h) => h.date === "2027-08-18")).toBe(true);
  });
});
