import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { DEV_REPORTS, DEV_PRIVATE_BUCKET, auditedDevExport, perspectivesOf, reportsFor } from "./development-reports";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("L23 relatórios e perspectivas", () => {
  it("20 relatórios únicos, com fonte, metodologia e data de referência obrigatória", () => {
    expect(DEV_REPORTS).toHaveLength(20);
    expect(new Set(DEV_REPORTS.map((r) => r.id)).size).toBe(20);
    for (const r of DEV_REPORTS) {
      expect(r.source.length).toBeGreaterThan(5);
      expect(r.methodology.length).toBeGreaterThan(10);
      expect(r.params.find((p) => p.id === "asOf")?.required).toBe(true);
      expect(r.columns.some((c) => c.id === "proveniencia")).toBe(true);
    }
  });
  it("toda tabela-fonte citada existe", () => {
    const tables = DEV_REPORTS.flatMap((r) => r.source.match(/dev_[a-z_]+/g) ?? []);
    for (const t of tables) expect(types, t).toMatch(new RegExp(`      ${t}: \\{`));
  });
  it("perspectiva vem de fatos, não de cargo; participante não vê relatórios de coordenação", () => {
    expect(perspectivesOf({ caps: new Set(), activeTrainer: false, hasEnrollment: false })).toEqual([]);
    const mine = reportsFor(perspectivesOf({ caps: new Set(), activeTrainer: false, hasEnrollment: true })).map((r) => r.id);
    expect(mine).toContain("dev-meu-historico");
    expect(mine).not.toContain("dev-formadores");
  });
  it("exportação exige capacidade, recusa relatório bloqueado e registra SHA", async () => {
    const rep = DEV_REPORTS.find((r) => r.id === "dev-catalogo")!;
    const record = async () => ({ verification_code: "ABC" });
    await expect(auditedDevExport({ caps: new Set(), report: rep, format: "csv", rows: 1, content: "a", key: "k", record })).rejects.toThrow();
    await expect(auditedDevExport({ caps: new Set(["exportar-relatorios-de-formacao"]), report: DEV_REPORTS.find((r) => r.dependency)!, format: "csv", rows: 1, content: "a", key: "k", record })).rejects.toThrow(/bloqueado/);
    const ok = await auditedDevExport({ caps: new Set(["exportar-relatorios-de-formacao"]), report: rep, format: "csv", rows: 1, content: "a", key: "k", record });
    expect(ok.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("anexos permanecem em bucket privado com política", () => {
    const sql = readdirSync("drizzle/migrations").filter((f) => f.startsWith("0442")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join();
    expect(sql).toContain(`bucket_id = '${DEV_PRIVATE_BUCKET}'`);
  });
});
