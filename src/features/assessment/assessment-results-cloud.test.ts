import { describe, expect, it } from "vitest";
import { refusalMessage, rowToVersion, versionsToOperations, type ResultVersionRow } from "./assessment-results-cloud";

const row = (over: Partial<ResultVersionRow> = {}): ResultVersionRow => ({
  id: "a", logical_entry_id: "res-i-s", version_number: 1, supersedes_version_id: null,
  instrument_id: "i", student_id: "s", placement: {}, value: { kind: "numerica", value: 7 },
  value_label: null, origin: "diario", origin_metadata: {}, rectification: null,
  batch_plan_id: "p", authorizing_engagement_id: "e", recorded_at: "2026-09-29T00:00:00Z", ...over,
});

describe("resultados oficiais no Cloud", () => {
  it("v1 é registrada, sem ato de retificação e com proveniência do lote", () => {
    const v = rowToVersion(row());
    expect(v.status).toBe("registrado");
    expect(v.rectification).toBeUndefined();
    expect(v.originMetadata?.['batchPlanId']).toBe("p");
  });
  it("v1→v2: a base esperada enviada ao banco é a versão substituída", () => {
    const v2 = rowToVersion(row({ id: "b", version_number: 2, supersedes_version_id: "a", rectification: { agentId: "x" } }));
    expect(versionsToOperations([v2])[0]!.expectedBaseVersionId).toBe("a");
    expect(versionsToOperations([rowToVersion(row())])[0]!.expectedBaseVersionId).toBeNull();
  });
  it("Não registrado preserva natureza e motivo; nunca vira zero", () => {
    const v = rowToVersion(row({ value: { kind: "nao-registrado", reason: "Ausente na aplicação" } }));
    expect(v.value).toEqual({ kind: "nao-registrado", reason: "Ausente na aplicação" });
    expect(versionsToOperations([v])[0]!.value).not.toHaveProperty("value");
  });
  it("recusas do servidor dizem que nada foi gravado", () => {
    for (const code of ["concurrent-change:s1", "capability-missing", "no-change:s", "missing-reason-required:s"])
      expect(refusalMessage(code)).toMatch(/Nada foi gravado/);
    expect(refusalMessage("??")).toMatch(/nada foi gravado/);
  });
});
