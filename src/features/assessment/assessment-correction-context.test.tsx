/** 6D.3.4.3b — integração do contexto pós-fechamento às superfícies de correção. */
import { fireEvent, render, screen } from "@testing-library/react";
import { AssessmentCorrectionPanel } from "@/components/sigem/assessment-correction-panel";
import { buildAssessmentCorrectionContext, currentClosingForInstrument } from "./assessment-correction-context";
import type { PeriodClosingRecord } from "./period-closing-types";
import { describe, expect, it } from "vitest";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type {
  ClosingAdmissibilityPolicy,
  ClosingRequirementDeclaration,
  InstitutionalAssessmentRule,
} from "./assessment-rule-types";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import { buildInstrument, instrumentRoster } from "./assessment-instruments";
import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
import { demonstrationStudents } from "@/features/students/students-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";
import {
  blocking,
  demonstrationActor,
  projectClosingAdmissibility,
  type ClosingContext,
} from "./period-closing";
import { createPeriodClosingStore } from "./period-closing-store";
import { assessmentPeriodV2Helper } from "./period-closing.test-helpers";
import { resolveAssessmentCorrection, type AssessmentCorrectionPolicy } from "./assessment-correction";
import {
  determineClosingImpact,
  projectClosingDivergence,
  projectClosingRegularization,
  withCurrentClosing,
  type ClosingRegularizationPolicy,
  type HistoricalNormativeArchive,
} from "./period-closing-divergence";

const NOW = "2026-04-20T12:00:00.000Z";
const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const structure = periodStructures.find((s) => s.id === "est-2026-a")!;
const period = structure.periods[0]!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;

function instrument(
  id: string,
  status: AssessmentInstrument["status"] = "aplicado",
  appliedOn = "2026-03-10",
): AssessmentInstrument {
  const r = buildInstrument({
    id,
    input: { title: `Instrumento ${id}`, instrumentTypeId: "it-prova", appliedOn },
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

function entries(i: AssessmentInstrument, skipFirst = false): AssessmentEntry[] {
  return instrumentRoster(i, demonstrationStudents)
    .eligible.slice(skipFirst ? 1 : 0)
    .map((e) => ({
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

const policy = (...requirements: ClosingRequirementDeclaration[]): ClosingAdmissibilityPolicy => ({
  id: "pfe-teste",
  version: 3,
  requirements,
});
const COMPLETUDE: ClosingRequirementDeclaration = {
  id: "req-c",
  label: "Completude",
  evaluatorId: "resultados-elegiveis-registrados",
};
const PLANEJADOS: ClosingRequirementDeclaration = {
  id: "req-p",
  label: "Planejados resolvidos",
  evaluatorId: "instrumentos-planejados-resolvidos",
};
const ENTREGA: ClosingRequirementDeclaration = {
  id: "req-e",
  label: "Entrega",
  evaluatorId: "ato-do-fluxo-realizado",
  parameters: { actionId: "entrega-docente" },
};
const CONFERENCIA: ClosingRequirementDeclaration = {
  id: "req-f",
  label: "Conferência",
  evaluatorId: "ato-do-fluxo-realizado",
  parameters: { actionId: "inicio-conferencia" },
};

function rule(p: ClosingAdmissibilityPolicy | undefined): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  const { closingAdmissibility: _drop, ...rest } = base;
  return { ...rest, status: "homologada", ...(p ? { closingAdmissibility: p } : {}) };
}

function ctxOf(over: {
  policy?: ClosingAdmissibilityPolicy;
  instruments?: AssessmentInstrument[];
  entries?: AssessmentEntry[];
  events?: ClosingContext["events"];
}): ClosingContext {
  const ins = over.instruments ?? [instrument("ins-a")];
  return {
    scope: {
      classId: "tur-001",
      academicYearId: quant.academicYearId,
      periodId: period.id,
      calendarPeriodId: "per-teste-1",
      curriculumRef: { kind: "atuacao", assignmentId: atp.id },
    },
    configuration: quant,
    period: { id: period.id, label: period.label, start: period.start, end: period.end },
    officialPeriod: true,
    calendarId: "cal-teste",
    rule: rule(over.policy),
    assignment: atp,
    instruments: ins,
    versions: (over.entries ?? ins.flatMap((i) => entries(i))).flatMap(assessmentVersionsFromLegacyEntry),
    students: demonstrationStudents,
    stage: "em-andamento",
    events: over.events ?? [],
  };
}

const secretaria = demonstrationActor("perfil-secretaria-escolar");

function closed() {
  const ctx = ctxOf({ policy: policy() });
  const store = createPeriodClosingStore();
  const r = store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW });
  if (!r.ok) throw new Error("fechamento de teste falhou");
  const record = store.current(ctx.scope)!;
  return { ctx, store, record, frozen: JSON.stringify(record), frozenV1: JSON.stringify(ctx.versions) };
}


const free: AssessmentCorrectionPolicy = {
  id: "pol-livre", version: 1, label: "Aberto", homologated: true,
  appliesWhenPeriodClosing: "absent", outcome: "admissible", requiredCapabilities: [],
  requirements: [], disclosesNormativeContext: true,
};
const simplesPos: AssessmentCorrectionPolicy = { ...free, id: "pol-pos-simples", appliesWhenPeriodClosing: "present" };
const exigentePos: AssessmentCorrectionPolicy = {
  ...free, id: "pol-pos", label: "Pós-fechamento", appliesWhenPeriodClosing: "present",
  requiredCapabilities: ["corrigir-apos-fechamento"],
  requirements: [{ code: "justificativa", label: "Justificativa da correção", provenance: "pol-pos" }],
};

function ctxFor(records: readonly PeriodClosingRecord[], ctx: ClosingContext, policies: AssessmentCorrectionPolicy[], capabilities: string[] = []) {
  const ins = ctx.instruments[0]!;
  return buildAssessmentCorrectionContext({
    agent: { agentId: "pro", capabilities },
    instrument: ins,
    configuration: ctx.configuration,
    policies,
    closingRecords: records,
    periodLabel: ctx.period.label,
  });
}
const project = (c: ReturnType<typeof ctxFor>, ctx: ClosingContext) =>
  resolveAssessmentCorrection({ ...c, versions: ctx.versions, baseVersionId: ctx.versions[0]!.id });

describe("6D.3.4.3b — contexto pós-fechamento", () => {
  it("A/B/F. sem fechamento: Pauta e Avaliação do período recebem o mesmo contexto aberto", () => {
    const ctx = ctxOf({ policy: policy() });
    const pauta = ctxFor([], ctx, [free]);
    const periodo = ctxFor([], ctx, [free]);
    expect(pauta.periodClosing).toBeUndefined();
    expect(project(pauta, ctx)).toEqual(project(periodo, ctx));
    expect(project(pauta, ctx).canCorrect).toBe(true);
    expect(project(pauta, ctx).requiredRitual).toEqual([]);
  });

  it("C. fechamento vigente + política sem requisito adicional → correção simples", () => {
    const { ctx, record } = closed();
    const c = ctxFor([record], ctx, [free, simplesPos]);
    expect(c.periodClosing).toMatchObject({ closingId: record.id, closingVersion: 1 });
    const p = project(c, ctx);
    expect(p.canCorrect).toBe(true);
    expect(p.requiredRitual).toEqual([]);
  });

  it("E/F. capacidade ausente bloqueia; projeção idêntica pelas duas superfícies", () => {
    const { ctx, record } = closed();
    const a = project(ctxFor([record], ctx, [free, exigentePos]), ctx);
    const b = project(ctxFor([record], ctx, [free, exigentePos]), ctx);
    expect(a).toEqual(b);
    expect(a.canCorrect).toBe(false);
    expect(a.blockingReasons.map((r) => r.code)).toContain("capacidade-ausente");
  });

  it("resolve só o fechamento do contexto exato do instrumento", () => {
    const { ctx, record } = closed();
    const other = { ...ctx.instruments[0]!, periodId: "outro-periodo" };
    expect(currentClosingForInstrument([record], other)).toBeUndefined();
    expect(currentClosingForInstrument([record], ctx.instruments[0]!)?.id).toBe(record.id);
  });
});

function mountPanel(ctx: ClosingContext, records: PeriodClosingRecord[], capabilities: string[]) {
  const versions = [...ctx.versions];
  const readContext = () => ctxFor(records, ctx, [free, exigentePos], capabilities);
  render(
    <AssessmentCorrectionPanel
      studentName="Estudante"
      instrumentLabel="Instrumento"
      logicalEntryId={versions[0]!.logicalEntryId}
      source={{ readVersions: () => versions, append: (v) => versions.push(v) }}
      context={readContext()}
      readContext={readContext}
      newVersionId={(base) => `${base.id}-v${base.version + 1}`}
      now={() => NOW}
    />,
  );
  return versions;
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
function fillAndReview() {
  click("Corrigir resultado");
  fireEvent.change(screen.getByRole("textbox", { name: /valor|resultado/i }), { target: { value: "11" } });
  fireEvent.change(screen.getByLabelText("Justificativa da correção"), { target: { value: "Erro de soma" } });
  click("Conferir correção");
}

describe("6D.3.4.3b — painel real", () => {
  it("D/H/I. justificativa vem da projeção; v2 criada; Closing v1 intacto; divergência detectada", () => {
    const { ctx, record, store, frozen } = closed();
    const records = [record];
    const versions = mountPanel(ctx, records, ["corrigir-apos-fechamento"]);
    click("Corrigir resultado");
    expect(screen.getByLabelText("Justificativa da correção")).toBeTruthy();
    click("Cancelar");
    fillAndReview();
    click("Registrar correção");
    expect(versions).toHaveLength(ctx.versions.length + 1);
    expect(versions.at(-1)!.supersedesVersionId).toBe(ctx.versions[0]!.id);
    expect(JSON.stringify(record)).toBe(frozen);
    expect(store.chain(ctx.scope)).toHaveLength(1);
    const div = projectClosingDivergence(record, versions);
    expect(div.superseded.map((d) => d.currentVersionId)).toEqual([versions.at(-1)!.id]);
  });

  it("G. fechamento muda entre abertura e registro → falha fechada, nenhuma versão espúria", () => {
    const { ctx, record } = closed();
    const records: PeriodClosingRecord[] = [record];
    const versions = mountPanel(ctx, records, ["corrigir-apos-fechamento"]);
    fillAndReview();
    records.push({ ...record, id: `${record.id}-v2`, version: 2, precedingClosingId: record.id });
    click("Registrar correção");
    expect(versions).toHaveLength(ctx.versions.length);
    expect(screen.getByRole("alert").textContent).toMatch(/situação oficial deste período mudou/);
  });
});
