import { describe, expect, it } from "vitest";
import { IMPORT_ADAPTERS, adapterById } from "./adapters";
import { classifyRows, countRows, sha256Hex } from "./import-engine";

describe("AO — ingestão governada", () => {
  it("DP e Educacenso bloqueados por fonte; GPE sem contrato", () => {
    for (const id of ["dp-quadro-funcional", "educacenso-matricula", "gpe"]) {
      const a = adapterById(id)!;
      expect(a.layoutStatus).toBe("leiaute-ausente");
      expect(() => a.parse("")).toThrow(/não está disponível/);
    }
  });
  it("hash é determinístico (idempotência por arquivo)", async () => {
    const b = new TextEncoder().encode("sintetico;1");
    expect(await sha256Hex(b)).toBe(await sha256Hex(b));
    expect(await sha256Hex(b)).not.toBe(await sha256Hex(new TextEncoder().encode("sintetico;2")));
  });
  it("identidade igual com conteúdo divergente é conflito; repetida é duplicada; sem identidade rejeita", () => {
    const a = { ...IMPORT_ADAPTERS[0]!, comparedFields: ["v"], normalize: (r: { raw: Record<string, unknown> }) =>
      ({ identityKey: (r.raw["k"] as string) ?? null, values: { v: (r.raw["v"] as string) ?? null }, problems: [] }) };
    const rows = classifyRows(a as never, [
      { lineRef: "1", raw: { k: "A", v: "x" } }, { lineRef: "2", raw: { k: "B", v: "y" } },
      { lineRef: "3", raw: { k: "B", v: "y" } }, { lineRef: "4", raw: { v: "z" } }, { lineRef: "5", raw: { k: "C", v: "w" } },
    ], [{ identityKey: "A", canonicalRef: "c1", values: { v: "outro" } }, { identityKey: "C", canonicalRef: "c2", values: { v: "w" } }]);
    expect(rows.map((r) => r.outcome)).toEqual(["conflito", "valida", "duplicada-na-fonte", "rejeitada", "ja-reconciliada"]);
    expect(countRows(rows).total).toBe(5);
  });
});
