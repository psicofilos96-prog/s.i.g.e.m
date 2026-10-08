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
    expect(docs()[2]).toContain("01/10/2026 20:30");
  });
});

// NPDF.3 — mesmos critérios estendidos a Mapa, Horários, Avaliação, relatório evolutivo e dossiê.
import { schedulePrintHtml } from "@/features/schedules/schedule-print";
import { renderMapDocument } from "@/features/statistical-map/map-structures";
import { evolutionReportHtml } from "@/features/inclusion/clinical-model";
import { dossierPrintHtml } from "@/features/school-management/management-panel";
import { HEATMAP_REPORT } from "@/features/performance/performance-station";

const snap = { schemaVersion: 1, competence: { year: 2026, month: 9, key: "2026-09", window: { from: "2026-09-01", to: "2026-09-30" } }, snapshotDate: "2026-09-30",
  rule: { id: "r", version: 1 }, cells: [{ cellId: "c", sectionId: "matricula", label: "X".repeat(200), origin: "calculado", state: "disponivel", value: 1, unit: null, reference: null }],
  declarations: { observations: "", observationsEventId: null } } as never;
const map = () => renderMapDocument({ headerLines: ["P"], schoolName: "E", snapshot: snap, statusLabel: "Aprovado", revision: 1, signatures: [], generatedAt: "x" });
const more = () => [
  map(),
  schedulePrintHtml({ scope: "escola", subject: "E", validOn: "2026-10-08", rows: [{ className: "T", weekday: 1, startsAt: "07:00", endsAt: "07:50", block: "B", responsibles: "R" }], conflicts: [], className: (x) => x, personName: (x) => x, coverage: null }),
  toPrintableHtml(runReport(HEATMAP_REPORT, { params: {} } as never, [], new Date("2026-10-08T12:00:00Z")), { headerLines: [], title: "A" }),
  evolutionReportHtml({ school: "E", student: "S", records: [], generatedOn: "2026-10-08" }),
  dossierPrintHtml(toPrintableHtml(runReport(def, { params: {} } as never, [], new Date("2026-10-08T12:00:00Z")), { headerLines: [], title: "D" }), []),
];

describe("auditoria de PDFs (NPDF.3)", () => {
  it("A4, quebra de texto longo, sem interface do app e cabeçalho de tabela repetido", () => {
    for (const h of more()) {
      expect(h).toMatch(/@page\{size: ?A4/);
      expect(h).toMatch(/overflow-wrap:anywhere/);
      expect(h).not.toMatch(/<nav|<aside|data-app-shell/);
      expect(h).toMatch(/thead\{display:table-header-group\}/);
    }
  });
  it("Mapa: a mesma fotografia reproduz o mesmo documento", () => { expect(map()).toBe(map()); });
});

describe("auditoria de impressão (NPRINT.4)", () => {
  it("todo documento A4 numera as páginas no rodapé ('Página X de Y')", () => {
    for (const h of [...docs(), ...more()]) expect(h).toMatch(/@page\{size: ?A4[^}]*@bottom-right\{content:"Página " counter\(page\) " de " counter\(pages\)/);
  });
});
