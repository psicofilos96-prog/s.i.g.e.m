import { describe, expect, it } from "vitest";
import { buildSnapshot, compareSnapshots, officialize, reproduces, type SnapshotKey } from "./historical-snapshots";

const key: SnapshotKey = { year: "2026", stageKey: "matricula-inicial", referenceDate: "2026-05-27", ruleRef: "mi@1" };
const src = [{ name: "alocacoes", sha256: "h1", knownAt: "2026-06-01" }];
const f = (factId: string, o: Record<string, unknown> = {}) => ({ factId, personId: "p-" + factId, enrollmentId: "m-" + factId, schoolId: "A", classId: "T1", validFrom: "2026-02-01", validTo: null, version: 1, recordedAt: "2026-03-01", ...o });

describe("CIECE L11 fotografias históricas", () => {
  it("reprodutível e sem início é excluído, nunca contado", () => {
    const facts = [f("1"), f("2", { validFrom: null })];
    const a = buildSnapshot(key, facts, src, "2026-06-01", "2026-06-02");
    const b = buildSnapshot(key, [...facts].reverse(), src, "2026-06-01", "2026-06-09");
    expect(reproduces(a, b)).toBe(true);
    expect(a.counts.matriculas).toBe(1); expect(a.excluded).toEqual([{ factId: "2", reason: "inicio-nao-declarado" }]);
    expect(() => buildSnapshot(key, facts, [], "2026-06-01", "x")).toThrow("sem-fonte");
  });
  it("transferência e mudança de turma explicadas por fato", () => {
    const a = buildSnapshot(key, [f("1"), f("2")], src, "2026-06-01", "x");
    const b = buildSnapshot({ ...key, referenceDate: "2026-09-01" }, [f("1", { validTo: "2026-07-31" }), f("1b", { personId: "p-1", enrollmentId: "m-1b", schoolId: "B", validFrom: "2026-08-01" }), f("2", { classId: "T2", version: 1 })], src, "2026-06-01", "x");
    const d = compareSnapshots(a, b);
    expect(d.items).toEqual(expect.arrayContaining([{ factId: "1b", reason: "transferencia", detail: "A→B" }]));
    expect(d.items.some((i) => i.reason === "saida")).toBe(false);
    expect(d.delta.matriculas).toBe(0);
    expect(d.context[0]!.reason).toBe("data-diferente");
  });
  it("correção tardia gera nova versão; oficial anterior nunca muda", () => {
    const v1 = buildSnapshot(key, [f("1")], src, "2026-06-01", "x");
    const chain = officialize([], v1);
    const late = [f("1"), f("1", { version: 2, classId: "T9", recordedAt: "2026-10-01" })];
    // knownAt antigo reproduz v1 exatamente, mesmo com correção registrada depois
    expect(reproduces(v1, buildSnapshot(key, late, src, "2026-06-01", "y"))).toBe(true);
    const v2 = buildSnapshot(key, late, [{ name: "alocacoes", sha256: "h2", knownAt: "2026-10-01" }], "2026-10-02", "z", chain[0]);
    expect(v2.version).toBe(2); expect(v2.supersedes).toBe(1);
    const chain2 = officialize(chain, v2);
    expect(chain2[0]!.rows[0]!.classId).toBe("T1"); expect(Object.isFrozen(chain2[0])).toBe(true);
    expect(compareSnapshots(chain2[0]!, chain2[1]!).items).toEqual([{ factId: "1", reason: "correcao-tardia", detail: "v1→v2" }]);
    expect(() => officialize(chain2, v2)).toThrow();
  });
});
