import { describe, expect, it } from "vitest";
import { AssignmentShapeError, humanAssignmentError, mapAssignmentRows, type RawAssignmentRow } from "./teaching-assignment-source";

const row = (o: Partial<RawAssignmentRow> = {}): RawAssignmentRow => ({
  assignment_id: "ta-1", version_id: "v1", version: 1, change_kind: "constituicao", effective_from: "2027-02-01",
  effective_until: null, engagement_id: "e1", person_id: "p1", matrix_id: "m", matrix_version_id: "mv", item_key: "k",
  component_id: "c", component_label_snapshot: "Rótulo literal", element_value_id: null, role_value_id: null,
  source_ref: null, change_reason: null, recorded_at: "2026-10-05T00:00:00Z", assignment_state: "vigente",
  co_assigned_engagement_ids: ["e2"], ...o,
});

describe("B4.8 atribuição docente (fonte)", () => {
  it("vazio é vazio, sem inferência", () => expect(mapAssignmentRows([])).toEqual([]));
  it("projeta co-responsabilidade sem semântica", () => expect(mapAssignmentRows([row()])[0].coAssignedCount).toBe(1));
  it("estado desconhecido falha fechado", () => expect(() => mapAssignmentRows([row({ assignment_state: "ok" })])).toThrow(AssignmentShapeError));
  it("duas versões efetivas da mesma atribuição falham", () => expect(() => mapAssignmentRows([row(), row({ version_id: "v2" })])).toThrow(AssignmentShapeError));
  it("sem rótulo declarado não traduz identificador", () => expect(mapAssignmentRows([row({ component_label_snapshot: null })])[0].elementLabel).toBeNull());
  it("humaniza falhas do writer", () => {
    expect(humanAssignmentError(new Error("capability:manter-atribuicao-docente"))).toMatch(/competência/);
    expect(humanAssignmentError(new Error("assignment:overlap"))).toMatch(/sobrepõe/);
    expect(humanAssignmentError(new Error("assignment:stale-head"))).toMatch(/Recarregue/);
    expect(humanAssignmentError(new Error("assignment:matrix-not-applicable"))).toMatch(/matriz/);
  });
});
