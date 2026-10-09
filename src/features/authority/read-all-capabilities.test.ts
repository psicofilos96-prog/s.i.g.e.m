import { describe, it, expect } from "vitest";
import { readAllEffectiveCapabilities, readRpcPages, expandGrants, type GrantRow } from "./read-all-capabilities";

function chain(rows: unknown[], calls: Array<[number, number]> = []) {
  const q = { order: () => q, range: (a: number, b: number) => { calls.push([a, b]); return Promise.resolve({ data: rows.slice(a, Math.min(b + 1, a + 1000)), error: null }); } };
  return q;
}
const g = (id: string, scope: string, school: string | null = null, cls: string | null = null): GrantRow =>
  ({ capability_id: id, engagement_id: "e1", policy_id: "p", policy_version: 1, scope_level: scope, school_id: school, class_id: cls, component_id: null, period_id: null });

describe("PERF.LOADING.3 — capacidades efetivas sem truncamento", () => {
  it("rede com 110 capacidades × 698 turmas expande para 76.780 linhas e inclui a que fica após a linha 1000", async () => {
    const grants = Array.from({ length: 110 }, (_, i) => g(`cap-${String(i).padStart(3, "0")}`, "rede"));
    const classes = Array.from({ length: 698 }, (_, i) => ({ school_id: `s${i % 55}`, class_id: `c${i}` }));
    const calls: Array<[number, number]> = [];
    const db = { rpc: (fn: string) => fn === "effective_capability_grants" ? chain(grants) : fn === "effective_capability_scope_classes" ? chain(classes, calls) : chain([]) };
    const r = await readAllEffectiveCapabilities(db, {}, "class");
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(76_780);
    const s = await readAllEffectiveCapabilities(db);
    expect(s.data).toHaveLength(110 * 55);
    expect((s.data as { capability_id: string; school_id: string; class_id: null }[]).some((x) => x.capability_id === "cap-109" && x.school_id === "s54" && x.class_id === null)).toBe(true);
    const rows = r.data as { capability_id: string; class_id: string }[];
    expect(rows.findIndex((x) => x.capability_id === "cap-109")).toBeGreaterThan(1000);
    expect(rows.some((x) => x.capability_id === "cap-109" && x.class_id === "c697")).toBe(true);
  });
  it("escola expande só para as turmas da escola; turma fica como está; designação sem turma", () => {
    const out = expandGrants([g("a", "escola", "s1"), g("b", "turma", "s2", "c9"), g("c", "designacao")], [{ school_id: "s1", class_id: "c1" }, { school_id: "s1", class_id: "c2" }, { school_id: "s2", class_id: "c3" }]);
    expect(expandGrants([g("a", "escola", "s1"), g("z", "escola", "s9")], [{ school_id: "s1", class_id: "c1" }, { school_id: "s1", class_id: "c2" }], "school").map((r) => `${r.capability_id}:${r.school_id}:${r.class_id}`)).toEqual(["a:s1:null"]);
    expect(out.map((r) => `${r.capability_id}:${r.school_id}:${r.class_id}`)).toEqual(["a:s1:c1", "a:s1:c2", "b:s2:c9", "c:null:null"]);
  });
  it("leitura paginada percorre todas as páginas e recusa parcial acima do teto", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => ({ i }));
    const calls: Array<[number, number]> = [];
    const ok = await readRpcPages({ rpc: () => chain(rows, calls) }, "f", ["i"]);
    expect(ok.data).toHaveLength(2345);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    const capped = await readRpcPages({ rpc: () => chain(Array(5000).fill({})) }, "f", [], {}, 1000, 3000);
    expect(capped.data).toBeNull();
  });
  it("erro em qualquer leitor recusa tudo", async () => {
    const bad = { order: () => bad, range: () => Promise.resolve({ data: null, error: { message: "x" } }) };
    const db = { rpc: (fn: string) => fn === "effective_capability_grants" ? chain([g("a", "rede")]) : fn === "effective_capability_scope_classes" ? bad : chain([]) };
    expect(await readAllEffectiveCapabilities(db)).toEqual({ data: null, error: { message: "x" } });
  });
});
