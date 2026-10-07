import { describe, it, expect } from "vitest";
import { dryRunSummary, schoolCodeDryRun } from "./school-code-dry-run";
const canon = [{ schoolId: "a", value: "33001464", name: "E M Chorão" }, { schoolId: "b", value: "33000001", name: "Outra" }, { schoolId: "c", value: "33000002", name: "X" }, { schoolId: "d", value: "33000002", name: "Y" }];
describe("schoolCodeDryRun", () => {
  const src = [{ code: "33001464", name: "E M CHORAO" }, { code: "33000001", name: "Nome diferente" }, { code: "33000002", name: "X" }, { code: "39999999", name: "Nova" }, { code: "38888888", name: "Dup" }, { code: "38888888", name: "Dup" }];
  it("classifies exact, conflict, ambiguous and absent", () => {
    const r = Object.fromEntries(schoolCodeDryRun(src, canon).map((x) => [x.code, x.outcome]));
    expect(r).toEqual({ "33001464": "exato", "33000001": "conflito", "33000002": "ambiguo", "39999999": "ausente-no-sigem", "38888888": "ambiguo" });
  });
  it("is deterministic regardless of input order", () => {
    expect(schoolCodeDryRun([...src].reverse(), [...canon].reverse())).toEqual(schoolCodeDryRun(src, canon));
    expect(dryRunSummary(schoolCodeDryRun(src, canon))).toEqual({ exato: 1, "ausente-no-sigem": 1, ambiguo: 2, conflito: 1 });
  });
});
