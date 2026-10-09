import { describe, expect, it } from "vitest";
import { deriveCalendarProjection, shiftDays } from "./calendar-engine";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { mutateCalendar } from "./calendar-governance";
import type { NetworkCalendar } from "./calendar-types";

/** Cada linha "TOTAL" da grade é a soma da coluna Total dos meses acima dela. */
function columnMatchesTotals(cal: NetworkCalendar) {
  let acc = 0;
  for (const row of deriveCalendarProjection(cal).grid) {
    if (row.kind === "mes") acc += row.total ?? (row.splitTotal ? row.splitTotal[0] + row.splitTotal[1] : 0);
    else if (row.kind === "total") { expect(acc).toBe(row.total); acc = 0; }
  }
}

describe("coluna Total da grade soma a linha de total", () => {
  it("EJA semestral com período encurtado (dias letivos fora de período não entram na coluna)", () => {
    const eja = createCalendarFixtures()[1]!;
    const last = [...eja.periods].sort((a, b) => b.order - a.order)[0]!;
    for (let k = 1; k <= 6; k++) {
      const r = mutateCalendar(eja, demoActors.supervisao, { kind: "salvar-periodo", period: { ...last, end: shiftDays(last.end, -k) } });
      if (!r.ok) throw new Error(r.reason);
      columnMatchesTotals(r.calendar);
    }
    for (const cal of createCalendarFixtures()) columnMatchesTotals(cal);
  });
});
