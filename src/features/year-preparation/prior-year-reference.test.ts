import { describe, it, expect } from "vitest";
import { buildReferenceRows, compareNote, REFERENCE_ITEMS, readYearReference } from "./prior-year-reference";
import type { ReadClient } from "./readiness-probes";

const def = (id: string) => REFERENCE_ITEMS.find((d) => d.id === id)!;

describe("N2026.REFERENCE.2027", () => {
  it("2027 vazio aparece como não configurado, nunca pronto pela referência", () => {
    expect(compareNote(def("turmas"), { kind: "count", n: 698 }, { kind: "count", n: 0 })).toBe("2027 ainda não configurado.");
  });
  it("ausência de leitura nunca vira zero", () => {
    const rows = buildReferenceRows({ turmas: { kind: "denied" } }, {});
    expect(rows.find((r) => r.def.id === "turmas")!.y2026).toEqual({ kind: "denied" });
    expect(rows.find((r) => r.def.id === "turmas")!.y2027).toEqual({ kind: "not-read" });
  });
  it("cadastro sem ano não ganha coluna 2027", () => {
    expect(buildReferenceRows({}, {}).find((r) => r.def.id === "cadastro")!.y2027).toBeNull();
  });
  it("leitor usa só select (cliente sem métodos de escrita)", async () => {
    const q: any = { in: () => q, eq: () => q, gte: () => q, lte: () => q, range: () => q, then: (r: any) => r({ data: [], error: null }) };
    const c: ReadClient = { from: () => ({ select: () => q }) };
    const r = await readYearReference(c, 2027, "2026-10-09T00:00:00Z");
    expect(r["turmas"]).toEqual({ kind: "count", n: 0 });
  });
});
