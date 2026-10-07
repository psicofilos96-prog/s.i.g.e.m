import { describe, it, expect } from "vitest";
import { classNamesAt, groupClassRows } from "./class-names-batch";

describe("classNamesAt (NDB.1.1)", () => {
  it("uma chamada para N turmas; 0/1/>1 linhas viram ausente/ok/inconsistente", async () => {
    const calls: string[] = [];
    const db = { rpc: async (fn: string) => { calls.push(fn); return { data: [{ class_id: "a", name: "1A" }, { class_id: "c", name: "x" }, { class_id: "c", name: "y" }], error: null }; } };
    const m = await classNamesAt(db, ["a", "b", "c", "a"], { validOn: "2026-05-01" });
    expect(calls).toEqual(["classes_at_batch"]);
    expect(m.get("a")).toEqual({ kind: "ok", name: "1A" });
    expect(m.get("b")).toEqual({ kind: "ausente" });
    expect(m.get("c")).toEqual({ kind: "inconsistente" });
  });
  it("falha do lote cai para leitura individual e marca erro só na turma que falhou", async () => {
    const db = { rpc: async (fn: string, a: Record<string, unknown>) =>
      fn === "classes_at_batch" ? { data: null, error: { message: "x" } }
      : a["_class_id"] === "b" ? { data: null, error: { message: "denied" } } : { data: [{ name: "1A" }], error: null } };
    const m = await classNamesAt(db, ["a", "b"], { validOn: "2026-05-01", knownAt: "2026-05-02T00:00:00Z" });
    expect(m.get("a")).toEqual({ kind: "ok", name: "1A" });
    expect(m.get("b")).toEqual({ kind: "erro" });
  });
  it("dado ausente nunca vira nome", () => {
    expect(groupClassRows(["z"], []).get("z")).toEqual({ kind: "ausente" });
  });
});
