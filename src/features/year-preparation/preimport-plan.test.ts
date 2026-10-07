import { describe, it, expect } from "vitest";
import { buildPreimportPlan, planSummary } from "./preimport-plan";
const base = { adapter: "prof", version: 1, sourceSha256: "abc", existing: new Map([["1", "p1"]]) };
describe("buildPreimportPlan", () => {
  it("links known, proposes unknown, rejects duplicates and missing keys", () => {
    const p = buildPreimportPlan({ ...base, keys: ["1", "2", "3", "3", null, " "] });
    expect(planSummary(p)).toEqual({ ligar: 1, "criar-candidato": 1, "rejeitar-duplicado": 1, "rejeitar-sem-chave": 2 });
    expect(p.find((r) => r.key === "2")!.idempotencyKey).toBe("prof@1:abc:2");
    expect(p.find((r) => r.key === "3")!.idempotencyKey).toBeNull();
  });
  it("is deterministic and idempotent for the same source", () => {
    expect(buildPreimportPlan({ ...base, keys: ["2", "1"] })).toEqual(buildPreimportPlan({ ...base, keys: ["1", "2"] }));
  });
  it("a different source hash yields different idempotency keys", () => {
    const a = buildPreimportPlan({ ...base, keys: ["2"] })[0]!.idempotencyKey;
    const b = buildPreimportPlan({ ...base, sourceSha256: "def", keys: ["2"] })[0]!.idempotencyKey;
    expect(a).not.toBe(b);
  });
});
