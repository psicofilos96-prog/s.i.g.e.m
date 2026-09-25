import { describe, expect, it } from "vitest";
import { createCalendarFixtures } from "./calendar-fixtures";
import { createInMemoryCalendarRepository, type CalendarStorage } from "./calendar-store";

function memStorage(): CalendarStorage & { data: string | null } {
  const s = {
    data: null as string | null,
    load: () => (s.data ? JSON.parse(s.data) : null),
    store: (c: unknown) => {
      s.data = JSON.stringify(c);
    },
  };
  return s;
}

describe("persistência do rascunho salvo", () => {
  it("salvar grava; nova sessão recupera; não salvo não grava", () => {
    const storage = memStorage();
    const a = createInMemoryCalendarRepository(createCalendarFixtures(), storage);
    a.hydrate();
    const cal = a.list()[0]!;
    const renamed = { ...cal, title: "Nome salvo" };
    expect(storage.data).toBeNull();
    const b = createInMemoryCalendarRepository([renamed, ...a.list().slice(1)], storage);
    b.save(renamed.id);
    expect(storage.data).not.toBeNull();
    const c = createInMemoryCalendarRepository(createCalendarFixtures(), storage);
    c.hydrate();
    expect(c.get(cal.id)?.title).toBe("Nome salvo");
    expect(c.hasUnsavedChanges(cal.id)).toBe(false);
  });
});
