import { describe, expect, it } from "vitest";
import { bookPrintHtml } from "@/features/school-secretariat/vacancies-book";
import { runReport, toPrintableHtml, type ReportDefinition } from "@/features/reports/report-engine";
import { reviewPrintHtml } from "@/features/teacher-review/teacher-work-review";

/** NDOC.2 — layout/renderização dos documentos imprimíveis (sem regra de negócio). */
const def = { id: "t", version: 1, title: "R", description: "", source: "x", params: [], columns: [{ id: "a", label: "A", kind: "text" }], formats: ["pdf"], reproducible: true, syncRowLimit: 10 } as unknown as ReportDefinition;
const docs = () => [
  bookPrintHtml({ school: "E", inep: null, year: "2026", knownAt: "x" }, []),
  toPrintableHtml(runReport(def, { params: {} } as never, [{ a: "X".repeat(300) }], new Date("2026-10-07T12:00:00Z")), { headerLines: [], title: "R" }),
  reviewPrintHtml("P", "em-analise", [{ heading: "S", body: "X".repeat(300) }], [{ seq: 1, event: "enviado", subject_version_id: "v", comment: null, by_author: true, recorded_at: "2026-10-01T23:30:00Z" }]),
];

describe("auditoria de PDFs (NDOC.2)", () => {
  it("todo documento quebra texto longo, define página A4 e não carrega a interface do app", () => {
    for (const h of docs()) {
      expect(h).toMatch(/overflow-wrap:anywhere/);
      expect(h).toMatch(/@page\{size: ?A4/);
      expect(h).not.toMatch(/<nav|<aside|data-app-shell/);
    }
  });
  it("tabelas repetem cabeçalho em cada página", () => {
    const [livro, rel] = docs();
    for (const h of [livro, rel]) expect(h).toMatch(/thead\{display:table-header-group\}/);
  });
  it("reprodução histórica: data do histórico usa o fuso de Itaperuna, não o do computador", () => {
    expect(docs()[2]).toContain("01/10/2026, 20:30:00");
  });
});
