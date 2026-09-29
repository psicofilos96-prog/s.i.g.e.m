import { describe, expect, it } from "vitest";
import { currentOccurrences, currentOccurrenceTypes, type OccurrenceRow } from "./attendance-occurrences-cloud";

const row = (over: Partial<OccurrenceRow>): OccurrenceRow => ({
  id: "v1", logical_id: "L", version: 1, supersedes_id: null, student_id: "s", class_id: "c",
  occurrence_type_id: "t", occurrence_type_version: 1, from_date: "2026-03-01", until_date: "2026-03-02",
  document_ref: null, note: null, annulled: false, created_at: "2026-03-01T00:00:00Z", author_person_id: null, ...over,
});

describe("6D.FINAL.6 — fonte institucional de ocorrências", () => {
  it("vigente é a versão não superada; anulada deixa de ser referenciada", () => {
    expect(currentOccurrences([row({}), row({ id: "v2", version: 2, supersedes_id: "v1", until_date: "2026-03-05" })]).map((o) => o.until)).toEqual(["2026-03-05"]);
    expect(currentOccurrences([row({}), row({ id: "v2", version: 2, supersedes_id: "v1", annulled: true })])).toEqual([]);
  });
  it("sem catálogo homologado não há tipo algum", () => {
    expect(currentOccurrenceTypes([], "2026-03-01")).toEqual([]);
    expect(currentOccurrenceTypes([{ id: "t", version: 1, code: "x", label: "X", description: "", requires_document: false, status: "arquivada", valid_from: "2026-01-01", valid_until: null }], "2026-03-01")).toEqual([]);
  });
});
