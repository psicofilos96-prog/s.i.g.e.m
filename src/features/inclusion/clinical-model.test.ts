import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clinicalHeads, clinicalHistory, studentInclusionReportHtml, type ClinicalRow } from "./clinical-model";

const row = (p: Partial<ClinicalRow>): ClinicalRow => ({ id: "a", logical_id: "L", version: 1, event_kind: "registro", cid_as_written: "F84.0", source_document: "Laudo",
  dimension_scheme_id: null, dimension_value_id: null, note: null, attachment_id: null, valid_from: "2026-03-01", valid_to: null, reason: null, recorded_at: "2026-03-01T12:00:00Z", is_head: true, ...p });
const sql = readFileSync("drizzle/migrations/0243_ninc1_inclusion_clinical_records.sql", "utf8") + readFileSync("drizzle/migrations/0244_ninc1_clinical_denial_trail_kept.sql", "utf8");

describe("NINC.1 — registro clínico restrito", () => {
  it("vigente = cabeça não encerrada; histórico ordenado por versão", () => {
    const rows = [row({ id: "a", is_head: false }), row({ id: "b", version: 2, is_head: true }), row({ id: "c", logical_id: "M", event_kind: "encerramento" })];
    expect(clinicalHeads(rows).map((r) => r.id)).toEqual(["b"]);
    expect(clinicalHistory([rows[1]!, rows[0]!], "L").map((r) => r.version)).toEqual([1, 2]);
  });
  it("relatório escapa HTML, sai como não oficial e sem clínico quando não foi lido com permissão", () => {
    const html = studentInclusionReportHtml({ school: "E1", student: "<s>", records: [], clinical: null, generatedOn: "2026-10-08" });
    expect(html).toContain("&lt;s&gt;"); expect(html).toContain("não oficial"); expect(html).not.toContain("Registro clínico restrito");
    expect(html).not.toMatch(/assinatura:\s*_/i);
    expect(studentInclusionReportHtml({ school: "E1", student: "x", records: [], clinical: [row({})], generatedOn: "2026-10-08" })).toContain("F84.0");
  });
  it("banco: nenhuma capability nova, sem acesso direto à tabela, leitura exige finalidade e grava trilha antes de recusar", () => {
    const caps = [...sql.matchAll(/inclusion_(?:require|grant)\('([a-z-]+)'/g)].map((m) => m[1]);
    expect(new Set(caps)).toEqual(new Set(["registrar-apoio-inclusivo", "consultar-documento-sensivel-inclusao"]));
    expect(sql).toContain("REVOKE ALL ON public.inclusion_clinical_records FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(/GRANT [A-Z, ]+ ON public\.inclusion_clinical\w* TO (anon|authenticated)/);
    expect(sql).not.toMatch(/TO anon/);
    const fixed = readFileSync("drizzle/migrations/0244_ninc1_clinical_denial_trail_kept.sql", "utf8");
    expect(fixed).toMatch(/INSERT INTO public\.inclusion_clinical_access_events[\s\S]*IF g IS NULL THEN RETURN;/);
    expect(sql).toContain("inclusion:purpose-required");
    expect(sql).toContain("FOR EACH ROW EXECUTE FUNCTION public.import_append_only()");
  });
});
