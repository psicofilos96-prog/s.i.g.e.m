import { it } from "vitest";
import { createCalendarFixtures } from "./calendar-fixtures";
import * as E from "./calendar-engine";
it("probe", () => {
  for (const cal of createCalendarFixtures()) {
    const r = E.resolveCalendar(cal);
    const out = [...r.byDate.keys()].filter((d) => E.isSchoolDay(r, d) && !cal.periods.some((p) => p.start <= d && p.end >= d));
    console.log(cal.id, cal.year, cal.name, "total", E.totalSchoolDays(r), "annual", E.annualSchoolDays(cal, r),
      "periods", cal.periods.map((p) => `${p.name}:${p.start}..${p.end}=${E.periodSchoolDays(r, p)}`).join(" | "), "outside", out.join(","));
  }
});
