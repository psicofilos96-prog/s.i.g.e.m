/** Fixture SINTÉTICA para testes golden: valores derivados só do esquema (nunca dado real de escola/pessoa). */
import { kindOf, type LayoutSpec, type RecordSpec } from "./layout-schema";

export function syntheticValues(rec: RecordSpec): string[] {
  return rec.fields.map((f) => {
    if (f.n === 1 && rec.file === "importacao") return rec.record;
    if (f.obligation !== "sim") return "";
    const k = kindOf(f), L = f.size.length ?? 1;
    if (k === "num") return f.size.fixed ? "1".repeat(L) : "1";
    if (k === "selec") return f.codes?.list[0]?.code ?? "";
    if (k === "data") return "01/02/2026";
    if (k === "hora") return "08:00";
    if (k === "email") return "TESTE@SINTETICO.INVALID".slice(0, L);
    if (k === "alfa") return f.size.fixed ? "T".repeat(L) : "TESTE SINTETICO".slice(0, L);
    return "";
  });
}
export function syntheticSchoolBlock(spec: LayoutSpec) {
  return ["00", "10", "20", "30", "40", "50", "60"].map((record) => ({ record, values: syntheticValues(spec.records.find((r) => r.file === "importacao" && r.record === record)!) }));
}
