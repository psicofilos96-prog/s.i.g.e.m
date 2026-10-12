import { describe, expect, it } from "vitest";
import { appendGed, gedCurrent, gedHistory, type GedVersion } from "./enrollment-ged";

const H = "a".repeat(64);
const v = (o: Partial<GedVersion>): GedVersion => ({ docId: "c1", version: 1, kind: "criterio", title: "Critério", contentHash: H, authorPersonId: "p1", authorIsTechnical: false, recordedAt: "2026-10-01T00:00:00Z", validFrom: "2026-10-01", event: "publicacao", justification: null, ...o });

describe("L23 GED", () => {
  it("append-only com autoria humana, histórico e revogação", () => {
    expect(() => appendGed(v({ authorIsTechnical: true }), [])).toThrow("executor técnico");
    let l = appendGed(v({}), []);
    expect(() => appendGed(v({ version: 2, event: "retificacao" }), l)).toThrow("justificativa");
    l = appendGed(v({ version: 2, event: "retificacao", justification: "erro material", recordedAt: "2026-10-05T00:00:00Z" }), l);
    expect(gedHistory("c1", l).map((x) => x.version)).toEqual([1, 2]);
    expect(gedCurrent("c1", l, "2026-10-10", "2026-10-02T00:00:00Z")?.version).toBe(1);
    l = appendGed(v({ version: 3, event: "revogacao", justification: "substituído" }), l);
    expect(gedCurrent("c1", l, "2026-10-10", "2026-10-12T00:00:00Z")).toBeNull();
  });
  it("decisão cita critério e tem autor distinto", () => {
    const l = appendGed(v({}), []);
    expect(() => appendGed(v({ docId: "d1", kind: "decisao", appliesCriterionDocId: "c1" }), l)).toThrow("autor da decisão");
    expect(appendGed(v({ docId: "d1", kind: "decisao", appliesCriterionDocId: "c1", authorPersonId: "p2" }), l)).toHaveLength(2);
  });
});
