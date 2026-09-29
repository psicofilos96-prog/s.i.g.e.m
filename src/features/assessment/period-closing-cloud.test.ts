import { describe, expect, it } from "vitest";
import { closingStateFromRows, usedEntryVersionIds } from "./period-closing-cloud";
import type { PeriodClosingRecord } from "./period-closing-types";

const scope = { classId: "t1", academicYearId: "a", periodId: "p1", curriculumRef: { kind: "matriz", componentId: "c" } };
const rec = { scope, results: [{ usedEntryVersions: [{ versionId: "u1" }, { versionId: "u2" }] }, { usedEntryVersions: [{ versionId: "u1" }] }] } as unknown as PeriodClosingRecord;
const ev = (id: string, seq: number, action: string, closing: string | null = null) => ({
  id, scope_key: "k", sequence: seq, action, scope, detail: "", justification: null,
  closing_version_id: closing, author_person_id: "pessoa", acted_at: "2026-09-29T00:00:00Z",
});

describe("fechamento no Cloud", () => {
  it("estágio e versão vigente são projeção do ledger persistido", () => {
    const s = closingStateFromRows(
      [ev("e2", 2, "fechamento-oficial", "v1"), ev("e1", 1, "entrega-docente"), ev("e3", 3, "reabertura-integral")],
      [{ id: "v1", preceding_closing_id: null, version_number: 1, record: rec }],
    );
    expect(s.workflows["k"]!.stage).toBe("reaberto");
    expect(s.workflows["k"]!.events.map((e) => e.action)).toEqual(["entrega-docente", "fechamento-oficial", "reabertura-integral"]);
    expect(s.workflows["k"]!.events[1]!.closingId).toBe("v1");
    expect(s.lastEventIds["k"]).toBe("e3");
    expect(s.records[0]!.id).toBe("v1");
  });
  it("usedEntryVersions vira lista de IDs imutáveis sem duplicar", () => {
    expect(usedEntryVersionIds(rec)).toEqual(["u1", "u2"]);
  });
});
