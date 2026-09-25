import { describe, expect, it } from "vitest";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import { createInMemoryCalendarRepository } from "./calendar-store";

const sup = demoActors.supervisao;

describe("salvar rascunho do calendário", () => {
  it("marca alterações, salva, descarta e bloqueia transição com pendência", () => {
    const draft = createCalendarFixtures().map((c) => ({ ...c, status: "rascunho" as const }));
    const repo = createInMemoryCalendarRepository(draft);
    const id = draft[0]!.id;
    expect(repo.hasUnsavedChanges(id)).toBe(false);
    const before = repo.get(id);
    expect(repo.mutate(id, sup, { kind: "definir-dia", date: "2027-03-03", type: "FL" }).ok).toBe(
      true,
    );
    expect(repo.hasUnsavedChanges(id)).toBe(true);
    expect(repo.transition(id, sup, "enviar-revisao").ok).toBe(false);
    repo.discard(id);
    expect(repo.get(id)).toBe(before);
    expect(repo.hasUnsavedChanges(id)).toBe(false);
    repo.mutate(id, sup, { kind: "definir-dia", date: "2027-03-03", type: "FL" });
    repo.save(id);
    expect(repo.hasUnsavedChanges(id)).toBe(false);
    expect(repo.get(id)).not.toBe(before);
    expect(repo.transition(id, sup, "enviar-revisao").ok).toBe(true);
  });
});
