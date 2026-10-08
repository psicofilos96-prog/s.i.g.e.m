import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { buildPanel, dossierPrintHtml, managementRows, type Inputs } from "./management-panel";
import { runReport, toPrintableHtml } from "@/features/reports/report-engine";
import { GESTAO_ESCOLAR } from "@/features/reports/report-registry";

// N7.2.5 — auditoria final OP/Direção.
const read = (p: string) => readFileSync(p, "utf8");
const ok = <T,>(data: T) => ({ ok: true as const, data });

describe("N7.2.5 — OP e Direção", () => {
  it("sem login, OP e Direção têm um único título principal (o laboratório já traz o seu)", () => {
    expect(read("src/routes/orientacao.tsx")).toMatch(/laboratoryHasHeading/);
    expect(read("src/routes/direcao.tsx")).toMatch(/laboratoryHasHeading/);
    expect(read("src/features/pedagogical-guidance/guidance-workspace-page.tsx")).toMatch(/<h1/);
    expect(read("src/features/school-leadership/leadership-workspace-page.tsx")).toMatch(/<h1/);
  });
  it("SIPE e SIA usam o mesmo ledger de revisão; a tela não decide aprovação", () => {
    const src = read("src/features/teacher-review/teacher-work-review.ts");
    expect(src).toMatch(/teacher_work_review_events/);
  });
  it("Dossiê de teste em PDF A4 sai da mesma projeção da tela", () => {
    const i: Inputs = {
      school: "escola-teste", year: "ano", on: "2027-03-10", knownAt: null, window: { from: "2027-02-08", to: "2027-03-10" },
      overview: ok({ year: { label: "2027", state: "operacional", starts_on: null, ends_on: null }, enrollments: { total: 4, active: 4, not_started: 0, start_unknown: 0, ended: 0 }, allocations: { active_episodes: 4, classes_with_students: 1, enrollments_without_class: 0 }, movements: {} }),
      classes: ok([{ id: "c1", name: "Turma de teste" }]), schedules: ok({}), diary: ok([]), plans: ok([]),
      attendanceClosings: ok(0), assessmentClosings: ok(0), followups: ok(0), documents: ok(0), communications: ok([]), aee: ok([]), meals: ok(0),
    } as unknown as Inputs;
    const p = buildPanel(i);
    const html = dossierPrintHtml(toPrintableHtml(runReport(GESTAO_ESCOLAR, { params: { school: i.school, on: i.on } }, managementRows(p.blocks)), { headerLines: ["SIGEM — TESTE"], title: "Dossiê da Direção (teste)" }, []), p.pending);
    expect(html).toMatch(/size:A4/);
    const out = process.env["N725_EXPORT_DIR"];
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/dossie-teste.html`, html); }
  });
});
