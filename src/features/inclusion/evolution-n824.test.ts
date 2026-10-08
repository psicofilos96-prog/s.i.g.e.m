import { describe, expect, it } from "vitest";
import { evolutionEntries, evolutionReportHtml } from "./clinical-model";
import type { InclusionRecord } from "./inclusion-model";

const r = (id: string, type: InclusionRecord["record_type"], from: string, kind: InclusionRecord["event_kind"] = "registro", body = "texto"): InclusionRecord => ({
  id, logical_id: id, version: 1, supersedes_id: null, event_kind: kind, record_type: type, school_id: "s", student_id: "e",
  category_scheme_id: null, category_value_id: null, educational_purpose: "acompanhar", body, valid_from: from, valid_to: null,
  share_with_mediation: false, reason: null, author_user_id: "u", author_person_id: null, recorded_at: `${from}T10:00:00Z`,
});

describe("N8.2.4 — relatório evolutivo", () => {
  const rs = [r("b", "relatorio-pedagogico", "2027-05-01"), r("a", "plano-educacional", "2027-02-10"), r("n", "necessidade-de-apoio", "2027-01-01", "registro", "CATEGORIA"), r("x", "relatorio-pedagogico", "2027-03-01", "encerramento")];
  it("ordem cronológica, só tipos pedagógicos, sem encerrados e sem necessidade/categoria", () => {
    expect(evolutionEntries(rs).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("PDF não oficial, escapado, sem medida de progresso nem diagnóstico", () => {
    const h = evolutionReportHtml({ school: "s", student: "e", records: [...rs, r("z", "relatorio-pedagogico", "2027-06-01", "registro", "<script>x</script>")], generatedOn: "2027-06-02" });
    expect(h).toContain("não oficial"); expect(h).toContain("size:A4"); expect(h).not.toContain("<script>x");
    expect(h).not.toContain("CATEGORIA"); expect(h.split("</style>")[1]).not.toMatch(/\bCID\b|laudo|\d\s?%/);
  });
  it("vazio não afirma ausência de necessidade", () => {
    expect(evolutionReportHtml({ school: "s", student: "e", records: [], generatedOn: "2027-06-02" })).toContain("não indica ausência de necessidade");
  });
});
