import { describe, it, expect } from "vitest";
import { catalogCandidates, classCandidates, journeyCandidates, parseHhmm, planFingerprint, professionalCandidates } from "./correspondence-dryrun";

const schools = new Map([["33000001", "s1"]]);
const ctx = { version: 1, sourceSha256: "abc", schools };

describe("NCFG.3 dry-run", () => {
  it("parseHhmm never turns garbage into zero", () => {
    expect(parseHhmm("20:30")).toBe(1230);
    expect(parseHhmm("")).toBeNull();
    expect(parseHhmm("abc")).toBeNull();
    expect(parseHhmm("10:75")).toBeNull();
  });
  it("professional × school: match, review, refusal", () => {
    const c = professionalCandidates({ ...ctx, persons: new Map([["p1", "P1"]]) }, [
      { person: "p1", school: "33000001" }, { person: "p1", school: "33000001" },
      { person: "p2", school: "33000001" }, { person: "p1", school: "99" }, { person: "", school: "33000001" }]);
    expect(c.map((x) => x.verdict).sort()).toEqual(["ambiguo", "match", "recusa", "recusa"]);
    expect(c.find((x) => x.verdict === "match")!.idempotencyKey).toBe("lotacao@1:abc:p1|33000001");
  });
  it("journey with diverging loads is ambiguous, unreadable load refused", () => {
    const c = journeyCandidates(ctx, [
      { person: "p", school: "33000001", classCode: "t1", weekly: "20:00" },
      { person: "p", school: "33000001", classCode: "t1", weekly: "10:00" },
      { person: "p", school: "33000001", classCode: "t2", weekly: "x" }]);
    expect(c.map((x) => x.reason)).toEqual(["cargas-divergentes", "carga-ilegivel"]);
  });
  it("a 2026 source never becomes a 2027 class", () => {
    const c = classCandidates({ ...ctx, sourceYear: 2026, targetYear: 2027 }, [{ classCode: "t1", school: "33000001" }]);
    expect(c[0]).toMatchObject({ verdict: "recusa", reason: "fonte-2026-nao-e-2027", idempotencyKey: null });
  });
  it("empty catalog leaves every value ambiguous", () => {
    const c = catalogCandidates({ version: 1, sourceSha256: "abc", domain: "etapa", homologated: new Map() }, ["Creche", "Creche", ""]);
    expect(c).toHaveLength(1);
    expect(c[0]!.reason).toBe("catalogo-vazio-DADO_AGUARDADO");
  });
  it("is deterministic regardless of row order (idempotent)", () => {
    const rows = [{ person: "a", school: "33000001" }, { person: "b", school: "33000001" }];
    const p = { ...ctx, persons: new Map([["a", "A"]]) };
    expect(planFingerprint(professionalCandidates(p, rows))).toBe(planFingerprint(professionalCandidates(p, [...rows].reverse())));
  });
});
