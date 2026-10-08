import { describe, expect, it } from "vitest";
import { buildPanel, dossierPrintHtml, managementRows, type Inputs } from "./management-panel";
import { runReport, toPrintableHtml } from "@/features/reports/report-engine";
import { GESTAO_ESCOLAR } from "@/features/reports/report-registry";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const no = (error: string) => ({ ok: false as const, error });
const school = (id: string, denied: boolean): Inputs => {
  const d = <T,>(v: T) => (denied ? no("access-denied") : ok(v));
  return {
    school: id, year: "ano", on: "2027-03-10", knownAt: null, window: { from: "2027-02-08", to: "2027-03-10" },
    overview: d({ year: { label: "2027", state: "operacional", starts_on: null, ends_on: null }, enrollments: { total: 4, active: 4, not_started: 0, start_unknown: 0, ended: 0 }, allocations: { active_episodes: 4, classes_with_students: 1, enrollments_without_class: 0 }, movements: {} }),
    classes: d([{ id: `${id}-c1`, name: "<b>1A</b>" }]), schedules: d({}), diary: d([]), plans: d([]),
    attendanceClosings: d(0), assessmentClosings: d(0), followups: d(0), documents: d(0), communications: d([]), aee: d([]), meals: d(0),
  };
};
const pdf = (i: Inputs) => { const p = buildPanel(i); const r = runReport(GESTAO_ESCOLAR, { params: { school: i.school, on: i.on } }, managementRows(p.blocks)); return { p, html: dossierPrintHtml(toPrintableHtml(r, { headerLines: ["SIGEM"], title: "Dossiê" }, []), p.pending) }; };

describe("N7.2.4 — Dossiê da Direção, duas escolas", () => {
  it("escola alcançada x escola não alcançada: nada vaza nem vira zero", () => {
    const a = pdf(school("escola-a", false)); const b = pdf(school("escola-b", true));
    expect(a.html).toContain("escola-a-c1".length ? "Turma &lt;b&gt;1A&lt;/b&gt;" : "");
    expect(b.html).not.toContain("escola-a"); expect(b.html).not.toContain("1A");
    expect(b.p.blocks.every((x) => x.value === null && x.state === "UNAVAILABLE")).toBe(true);
  });
  it("PDF escapa texto, declara não oficial e não afirma ordem sem pendência", () => {
    const { html } = pdf(school("escola-b", true));
    expect(html).toContain("não é documento oficial");
    const empty = dossierPrintHtml("<html><body></body></html>", []);
    expect(empty).toContain("não afirma que a escola está em ordem");
    expect(html).not.toMatch(/<b>1A/);
  });
});
