import { describe, expect, it } from "vitest";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { mutateCalendar } from "./calendar-governance";
import { resolveCalendar } from "./calendar-engine";
import type { NetworkCalendar } from "./calendar-types";

const sup = (Object.values(demoActors) as { role: string }[]).find((a) => a.role === "supervisao") as never;
const draft = (c: NetworkCalendar): NetworkCalendar => ({ ...c, status: "rascunho" as never });

describe("feriado herdado em fim de semana", () => {
  const [regular] = createCalendarFixtures().map(draft);
  it("Supervisão troca 20/11 (sábado) de feriado para sábado e volta", () => {
    const cal = regular!;
    expect(resolveCalendar(cal).byDate.get("2027-11-20")).toBe("FERIADO");
    const back = mutateCalendar(cal, sup, { kind: "definir-dia", date: "2027-11-20", type: "FDS" });
    expect(back.ok).toBe(true);
    expect(resolveCalendar((back as { calendar: NetworkCalendar }).calendar).byDate.get("2027-11-20")).toBe("FDS");
  });
});
