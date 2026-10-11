import { describe, expect, it } from "vitest";
import { ageAt, bucketOf, buildMatrix, distortion, mergeAdjusted, T04_COLS, T04_ROWS } from "./t04-distortion";

describe("Tabela 04", () => {
  it("26 faixas: 0–1, 2 a 19 individuais, 20–24 … 50–59, 60+", () => {
    expect(T04_COLS.map((c) => c.key)).toEqual(["a0-1", ...Array.from({ length: 18 }, (_, i) => `a${i + 2}`), "a20-24", "a25-29", "a30-34", "a35-39", "a40-49", "a50-59", "a60"]);
    expect(T04_ROWS.map((r) => r.key)).toEqual(["creche", "pre1", "pre2", "ef1", "ef2", "ef3", "ef4", "ef5", "ef6", "ef7", "ef8", "ef9", "tec1-3", "tec1-4", "tec1-5", "tec2-6", "tec2-7", "tec2-8", "tec2-9", "eja1", "eja2"]);
  });
  it("idade completa na data de referência", () => {
    expect(ageAt("2020-03-31", "2026-03-31")).toBe(6);
    expect(ageAt("2020-04-01", "2026-03-31")).toBe(5);
    expect(ageAt("2027-01-01", "2026-03-31")).toBeNull();
  });
  it("faixas agregadas", () => {
    expect(bucketOf(0).key).toBe("a0-1"); expect(bucketOf(19).key).toBe("a19");
    expect(bucketOf(24).key).toBe("a20-24"); expect(bucketOf(45).key).toBe("a40-49"); expect(bucketOf(71).key).toBe("a60");
  });
  it("mesmo estudante não soma duas vezes; sem nascimento ou etapa vira lacuna", () => {
    const m = buildMatrix([{ studentId: "s1", birthDate: "2019-01-10", rowKey: "ef1" }, { studentId: "s1", birthDate: "2019-01-10", rowKey: "ef2" },
      { studentId: "s2", birthDate: null, rowKey: "ef1" }, { studentId: "s3", birthDate: "2019-01-10", rowKey: null }], "2026-03-31");
    expect(m).toEqual({ cells: { "m.ef1.a7": 1 }, counted: 1, withoutBirth: 1, withoutRow: 1, duplicates: 1 });
  });
  it("ajuste substitui a célula apurada, não soma", () => {
    expect(mergeAdjusted({ "m.ef1.a7": 4 }, [{ cell_key: "m.ef1.a7", value: 5, created_at: "2026-01-01" }])["m.ef1.a7"]).toBe(5);
  });
  it("distorção pela idade mínima da regra; sem regra não há indicador", () => {
    const v = { "m.ef1.a6": 8, "m.ef1.a7": 1, "m.ef1.a8": 1 };
    const row = distortion(v, { ef1: 8 }).find((r) => r.rowKey === "ef1")!;
    expect([row.total, row.distorted, row.pct]).toEqual([10, 1, 10]);
    expect(distortion(v, null).find((r) => r.rowKey === "ef1")!.pct).toBeNull();
  });
  it("faixa agregada que atravessa o limiar torna o indicador indeterminado", () => {
    expect(distortion({ "m.eja1.a20-24": 3 }, { eja1: 22 }).find((r) => r.rowKey === "eja1")!.pct).toBeNull();
    expect(distortion({ "m.eja1.a20-24": 3 }, { eja1: 20 }).find((r) => r.rowKey === "eja1")!.pct).toBe(100);
  });
});
