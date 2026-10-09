import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { latestTemplates, prepareTemplate, SHARE_WITH_SECTOR_CAPABILITY, type TemplateRow } from "./report-templates-cloud";
import { BUILDER_SOURCES } from "./builder-sources";

const choice = { sourceId: "gerador-escolas", from: null, to: null, columns: ["name"], filters: [], sort: [] };
const validCols = BUILDER_SOURCES[0]!.definition.columns.filter((c) => !c.sensitive).map((c) => c.id);
const ch = { ...choice, columns: validCols.slice(0, 1) };
const row = (o: Partial<TemplateRow>): TemplateRow => ({ sector: "secretaria", name: "A", version: 1, archived: false, choice: ch, recorded_at: "2026-10-08T00:00:00Z", ...o });

describe("NREL.3 modelos pessoais no servidor", () => {
  it("versão mais alta vence; arquivado some", () => {
    expect(latestTemplates([row({}), row({ version: 2 })], "secretaria", BUILDER_SOURCES)[0]?.version).toBe(2);
    expect(latestTemplates([row({}), row({ version: 2, archived: true })], "secretaria", BUILDER_SOURCES)).toEqual([]);
  });
  it("modelo de outro setor ou assunto fora do setor não aparece", () => {
    expect(latestTemplates([row({ sector: "dp" })], "secretaria", BUILDER_SOURCES)).toEqual([]);
    expect(latestTemplates([row({ sector: "dp" })], "dp", BUILDER_SOURCES)).toEqual([]);
  });
  it("gravação recusa assunto fora do setor e nome vazio", () => {
    expect(() => prepareTemplate({ name: "x", sector: "dp", choice: ch, savedAt: "" }, BUILDER_SOURCES)).toThrow();
    expect(() => prepareTemplate({ name: "  ", sector: "secretaria", choice: ch, savedAt: "" }, BUILDER_SOURCES)).toThrow();
  });
  it("compartilhar fica desabilitado sem capability definida", () => expect(SHARE_WITH_SECTOR_CAPABILITY).toBeNull());
  it("migration: isolamento por dono, append-only e idempotência", () => {
    const sql = readFileSync("drizzle/migrations/0246_nrel3_personal_report_templates.sql", "utf8");
    expect(sql).toMatch(/USING \(owner_id = auth\.uid\(\)\)/);
    expect(sql).toMatch(/WITH CHECK \(owner_id = auth\.uid\(\)\)/);
    expect(sql).toMatch(/GRANT SELECT, INSERT ON public\.report_template_versions TO authenticated/);
    expect(sql).not.toMatch(/TO anon|GRANT[^;]*(UPDATE|DELETE)[^;]*TO authenticated/);
    expect(sql).toMatch(/UNIQUE \(owner_id, idempotency_key\)/);
    expect(sql).toMatch(/NEW\.owner_id := auth\.uid\(\)/);
  });
  it("Avaliação e DP seguem sem leitor transversal: recusam execução (Censo ganhou leitor em NCIECE.FINAL.2)", () => {
    for (const id of ["gerador-avaliacao", "gerador-dp"]) expect(BUILDER_SOURCES.find((s) => s.id === id)?.unavailable).toBeTruthy();
  });
});
