import { describe, expect, it } from "vitest";
import { standingDeliberationFor } from "./collegial-standing-bridge";
import type { CollegialDeliberation } from "./collegial-types";

const base = (id: string, at: string, standingId?: string): CollegialDeliberation => ({
  id, sessionId: "s", agendaItemId: "a", bodyId: "b", competenceId: "c", competenceLabel: "C",
  studentId: "alu", cycleId: "cic",
  decision: { outcomeId: "o", outcomeLabel: "O", ...(standingId ? { standingId } : {}) },
  rationale: "fundamentação", dossier: { referenceSnapshotAt: at, sources: [], facts: [] },
  actor: { actorId: "x", actorName: "X", profileLabel: "P", at }, at,
});

describe("6D.4.1 ponte colegiado → situação", () => {
  it("lê a deliberação mais recente do escopo derivado, sem inventar situação", () => {
    const r = standingDeliberationFor([base("d1", "2026-01-01", "s1"), base("d2", "2026-02-01")], "cic|alu", () => "Órgão");
    expect(r?.id).toBe("d2");
    expect(r?.decision.standingId).toBeUndefined();
    expect(r?.bodyLabel).toBe("Órgão");
  });
  it("sem deliberação no escopo ⇒ ausência", () => {
    expect(standingDeliberationFor([base("d1", "2026-01-01")], "outro|alu", () => undefined)).toBeUndefined();
  });
});
