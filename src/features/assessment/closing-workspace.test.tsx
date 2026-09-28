/** 6D.3.4.4 — invariantes cirúrgicos do Closing Workspace 2.0. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { ClosingAdmissibilityPolicy, ClosingRequirementDeclaration, InstitutionalAssessmentRule } from "./assessment-rule-types";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import { buildInstrument, instrumentRoster } from "./assessment-instruments";
import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
import { demonstrationStudents } from "@/features/students/students-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";
import { demonstrationActor, type ClosingContext } from "./period-closing";
import { createPeriodClosingStore } from "./period-closing-store";
import { assessmentPeriodV2Helper } from "./period-closing.test-helpers";
import type { ClosingRegularizationPolicy, HistoricalNormativeArchive } from "./period-closing-divergence";
import { CANNOT_CLOSE_TITLE, DIVERGENCE_TITLE, PROTECTED_VALUE_LABEL, projectClosingWorkspace } from "./closing-workspace-presentation";
import { ClosingWorkspace } from "./period-closing-pages";

const NOW = "2026-04-20T12:00:00.000Z";
const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const structure = periodStructures.find((s) => s.id === "est-2026-a")!;
const period = structure.periods[0]!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;
const secretaria = demonstrationActor("perfil-secretaria-escolar");

function instrument(id: string, status: AssessmentInstrument["status"] = "aplicado"): AssessmentInstrument {
  const r = buildInstrument({
    id,
    input: { title: `Instrumento ${id}`, instrumentTypeId: "it-prova", appliedOn: "2026-03-10" },
    configuration: quant,
    structure,
    assignment: atp,
    professionalId: atp.professionalId,
    classId: "tur-001",
    now: NOW,
  });
  if (!r.ok) throw new Error(r.reasons.join(" "));
  return { ...r.value, status };
}
function entries(i: AssessmentInstrument, skip = 0): AssessmentEntry[] {
  return instrumentRoster(i, demonstrationStudents).eligible.slice(skip).map((e) => ({
    id: `lan-${i.id}-${e.student.id}`,
    instrumentId: i.id,
    studentId: e.student.id,
    placement: { enrollmentId: "m", academicLinkId: "v", participationId: "p", allocationId: "a" },
    value: { kind: "numerica", value: 80 },
    recordedAt: NOW,
    recordedByAssignmentId: atp.id,
    status: "registrado",
  })) as AssessmentEntry[];
}
const policy = (...requirements: ClosingRequirementDeclaration[]): ClosingAdmissibilityPolicy => ({ id: "pfe-t", version: 1, requirements });
const COMPLETUDE: ClosingRequirementDeclaration = { id: "req-c", label: "Completude", evaluatorId: "resultados-elegiveis-registrados" };
function rule(p: ClosingAdmissibilityPolicy): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  return { ...base, status: "homologada", configurationId: quant.id, configurationVersion: quant.version, closingAdmissibility: p };
}
function ctxOf(p: ClosingAdmissibilityPolicy, skip = 0): ClosingContext {
  const ins = instrument("ins-a");
  return {
    scope: { classId: "tur-001", academicYearId: quant.academicYearId, periodId: period.id, curriculumRef: { kind: "atuacao", assignmentId: atp.id } },
    configuration: quant,
    period: { id: period.id, label: period.label, start: period.start, end: period.end },
    officialPeriod: true,
    calendarId: "cal-teste",
    rule: rule(p),
    assignment: atp,
    instruments: [ins],
    versions: entries(ins, skip).flatMap(assessmentVersionsFromLegacyEntry),
    students: demonstrationStudents,
    stage: "em-andamento",
    events: [],
  };
}
const archiveOf = (ctx: ClosingContext): HistoricalNormativeArchive => ({
  rule: (id, v) => (ctx.rule?.id === id && ctx.rule.version === v ? ctx.rule : undefined),
  configuration: (id, v) => (ctx.configuration.id === id && ctx.configuration.version === v ? ctx.configuration : undefined),
});
const view = (ctx: ClosingContext, over: Partial<Parameters<typeof projectClosingWorkspace>[0]> = {}) =>
  projectClosingWorkspace({ ctx, actor: secretaria, current: undefined, archive: archiveOf(ctx), regularizationPolicies: [], ...over });

function closedWithV2(policies: ClosingRegularizationPolicy[] = []) {
  const ctx = ctxOf(policy());
  const store = createPeriodClosingStore();
  expect(store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW }).ok).toBe(true);
  const record = store.current(ctx.scope)!;
  const frozen = JSON.stringify(record);
  const v1 = ctx.versions[0]!;
  const later = { ...ctx, stage: store.stage(ctx.scope), versions: [...ctx.versions, assessmentPeriodV2Helper(v1, { kind: "numerica", value: 10 })] };
  return { later, record, frozen, v: view(later, { current: record, regularizationPolicies: policies }) };
}

describe("6D.3.4.4 — Closing Workspace 2.0", () => {
  it("A + E. fechamento permitido → confirmação → Closing criado e tela em estado oficial", () => {
    const ctx = ctxOf(policy());
    const store = createPeriodClosingStore();
    render(
      <ClosingWorkspace ctx={ctx} actor={secretaria} store={store} archive={archiveOf(ctx)} policies={[]} heading="Turma" classId="tur-001" classSearch={{}} now={() => NOW} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar período" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Fechar este período?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar período" }));
    expect(store.chain(ctx.scope)).toHaveLength(1);
    expect(screen.getByText("Período fechado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fechar período" })).toBeNull();
  });

  it("B. requisito não atendido bloqueia com razão concreta", () => {
    const v = view(ctxOf(policy(COMPLETUDE), 2));
    if (v.phase !== "open") throw new Error();
    expect(v.canClose).toBe(false);
    expect(v.unmet.map((u) => u.text)).toContain("2 estudantes ainda precisam de resultado, conforme a regra deste período.");
    expect(v.unmet.some((u) => /pendências/i.test(u.text))).toBe(false);
    expect(CANNOT_CLOSE_TITLE).toBe("Este período ainda não pode ser fechado.");
  });

  it("C. política sem requisitos → fechamento direto", () => {
    const v = view(ctxOf(policy()));
    expect(v.phase === "open" && v.canClose && v.direct).toBe(true);
  });

  it("D. sem resultado nunca aparece como zero", () => {
    const v = view(ctxOf(policy(), 1));
    if (v.phase !== "open") throw new Error();
    const row = v.conference[0]!;
    expect(row.resultLine).toBe("Sem resultado registrado");
    expect(v.conference.every((r) => !/\b0\b/.test(r.resultLine))).toBe(true);
  });

  it("F + G. correção posterior não altera o Closing e a divergência aparece sem recálculo", () => {
    const { later, record, frozen, v } = closedWithV2();
    expect(JSON.stringify(record)).toBe(frozen);
    if (v.phase !== "closed" || v.divergence.kind !== "divergent") throw new Error();
    expect(v.record).toBe(record);
    expect(v.conference.some((r) => /\b10\b/.test(r.resultLine))).toBe(false);
    expect(v.divergence.impactLine).toMatch(/mudariam o que foi oficializado/);
    expect(DIVERGENCE_TITLE).toMatch(/alterações posteriores/);
    expect(later.versions.length).toBeGreaterThan(record.results.length);
  });

  it("H. política que exige regularização mostra a exigência", () => {
    const { v } = closedWithV2([
      { id: "pr", version: 1, homologated: true, appliesToImpactKinds: ["divergence-with-material-impact"], outcomeId: "retificacao-admissivel", requiredCapabilityIds: [], requirements: [{ id: "j", label: "Justificativa da retificação", natureId: "justificativa" }] },
    ]);
    if (v.phase !== "closed" || v.divergence.kind !== "divergent") throw new Error();
    expect(v.divergence.regularization.kind).toBe("required");
    expect(v.divergence.regularization.kind === "required" && v.divergence.regularization.requirements).toEqual(["Justificativa da retificação"]);
  });

  it("I. sem política de regularização não inventa exigência", () => {
    const { v } = closedWithV2();
    if (v.phase !== "closed" || v.divergence.kind !== "divergent") throw new Error();
    expect(v.divergence.regularization.kind).toBe("insufficient");
    expect(v.divergence.regularization.text).toBe("Não há regra suficiente para determinar automaticamente o procedimento.");
  });

  it("J. sem divulgação de valores nada reconstruível é entregue", () => {
    const open = view(ctxOf(policy()), { valueReadCapability: "ler-valores" });
    const { later, record } = closedWithV2();
    const closed = view(later, { current: record, valueReadCapability: "ler-valores" });
    for (const v of [open, closed]) {
      const text = JSON.stringify({ c: v.conference, s: v.summary, d: v.phase === "closed" ? v.divergence : null });
      expect(text).not.toMatch(/Resultado do período|80|Não registrado/);
      expect(v.conference.every((r) => r.resultLine === PROTECTED_VALUE_LABEL)).toBe(true);
    }
    if (closed.phase === "closed" && closed.divergence.kind === "divergent")
      expect(closed.divergence.affectedStudentNames).toEqual([]);
  });
});
