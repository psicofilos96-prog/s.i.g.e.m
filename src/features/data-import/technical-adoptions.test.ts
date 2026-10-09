import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { readFileSync, readdirSync } from "node:fs";
import { compareDryRun, groupByLogicalBatch, reportedNumbers, type TechnicalAdoption } from "./technical-adoptions";

const a = (p: Partial<TechnicalAdoption>): TechnicalAdoption => ({
  id: "x", adapter_id: "tecnica-x", adapter_version: 1, parser_ref: "technical_x", source_name: "f.xlsx", source_sha256: "a".repeat(64),
  logical_batch_key: "lote:a", idempotency_key: "k", target_counts: {}, reported_result: {}, executed_at: "", adopted_at: "", ...p,
});

describe("NIMPORT.STANDARD.1", () => {
  it("carga e correção da mesma fonte formam um único lote lógico", () => {
    const g = groupByLogicalBatch([a({ id: "1", parser_ref: "technical_import_classes" }), a({ id: "2", parser_ref: "technical_correct_temporal" }), a({ id: "3", logical_batch_key: "lote:b" })]);
    expect(g).toHaveLength(2);
    expect(g[0]!.operations.map((o) => o.id)).toEqual(["1", "2"]);
  });
  it("reexecução do mesmo arquivo compara diferença; contagem ausente não vira zero", () => {
    expect(compareDryRun({ row_count: 2403 }, 2403).verdict).toBe("igual");
    expect(compareDryRun({ row_count: 2403 }, 2400).difference).toBe(-3);
    expect(compareDryRun({}, 10).adoptedRows).toBeNull();
  });
  it("só números entram no resumo informado", () => {
    expect(reportedNumbers({ row_count: 27, source_ref: "x" })).toEqual([["row_count", 27]]);
  });
  it("staging recusa novo lote para fonte já adotada (servidor)", () => {
    const f = readdirSync("drizzle/migrations").find((n) => n.includes("nimport_standard_1"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toMatch(/import_technical_adoptions a WHERE a\.source_sha256 = _source_sha256;\s*IF adopted IS NOT NULL THEN\s*RETURN/);
    expect(sql).toMatch(/'dry_run_only', true/);
  });
});
