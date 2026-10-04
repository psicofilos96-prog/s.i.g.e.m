import { describe, expect, it } from "vitest";
import { createInMemoryCalendarRepository, type CalendarStorage } from "./calendar-store";
import { createCalendarFixtures } from "./calendar-fixtures";
import type { NetworkCalendar } from "./calendar-types";

describe("Supervisão: restauração do calendário salvo no navegador", () => {
  it("hidrata o artefato personalizado, preserva campos e reabre após salvar", () => {
    const ref = createCalendarFixtures().find((c) => c.year === 2027)!;
    const custom: NetworkCalendar = { ...ref, title: "MEU CALENDÁRIO", signatures: ["Assinatura X"] };
    let stored: NetworkCalendar[] | null = [custom];
    const storage: CalendarStorage = { load: () => stored, store: (c) => { stored = c; return true; } };
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), storage);
    repo.hydrate();
    const got = repo.get(ref.id)!;
    expect(got.title).toBe("MEU CALENDÁRIO");
    expect(got.signatures).toEqual(["Assinatura X"]);
    expect(got.events).toEqual(custom.events);
    const reopened = createInMemoryCalendarRepository(createCalendarFixtures(), storage);
    reopened.hydrate();
    expect(reopened.get(ref.id)!.title).toBe("MEU CALENDÁRIO");
  });
  it("registro ausente não grava nada", () => {
    let writes = 0;
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), { load: () => null, store: () => { writes++; return true; } });
    repo.hydrate();
    expect(writes).toBe(0);
  });
});
