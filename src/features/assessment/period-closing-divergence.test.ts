/** 6D.3.4.3 — divergência pós-fechamento, impacto e regularização. */
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

const archiveOf = (ctx: ClosingContext): HistoricalNormativeArchive => ({
  rule: (id, v) => (ctx.rule && ctx.rule.id === id && ctx.rule.version === v ? ctx.rule : undefined),
  configuration: (id, v) => (ctx.configuration.id === id && ctx.configuration.version === v ? ctx.configuration : undefined),
});

/** v2 encadeada à versão vigente de um resultado usado pelo fechamento. */
function supersede(ctx: ClosingContext, index: number, value: Parameters<typeof assessmentPeriodV2Helper>[1]) {
  const v1 = ctx.versions[index]!;
  return assessmentPeriodV2Helper(v1, value);
}
const scoreOf = (ctx: ClosingContext, i: number) => {
  const v = ctx.versions[i]!.value;
  return v.kind === "numerica" ? v.value : 0;
};

describe("6D.3.4.3 — divergência, impacto e regularização", () => {
  it("A. versão usada continua vigente → no-divergence", () => {
    const { ctx, record } = closed();
    const impact = determineClosingImpact({ record, currentFacts: ctx, archive: archiveOf(ctx) });
    expect(impact.kind).toBe("no-divergence");
    expect(impact.divergence.stillCurrent.length).toBeGreaterThan(0);
  });

  it("B. v2 muda o resultado materializado → divergence-with-material-impact", () => {
    const { ctx, record, frozen, frozenV1 } = closed();
    const v2 = supersede(ctx, 0, { kind: "numerica", value: scoreOf(ctx, 0) === 10 ? 20 : 10 });
    const current = { ...ctx, versions: [...ctx.versions, v2] };
    const div = projectClosingDivergence(record, current.versions);
    expect(div.superseded).toHaveLength(1);
    expect(div.superseded[0]).toMatchObject({ usedVersionId: ctx.versions[0]!.id, currentVersionId: v2.id, currentVersion: 2 });
    const impact = determineClosingImpact({ record, currentFacts: current, archive: archiveOf(ctx) });
    expect(impact.kind).toBe("divergence-with-material-impact");
    expect(impact.changes.some((c) => c.factId === "resultado-do-periodo")).toBe(true);
    expect(impact.provenance.analyzedWithRule).toEqual({ id: record.ruleId, version: record.ruleVersion });
    expect(JSON.stringify(record)).toBe(frozen);
    expect(JSON.stringify(ctx.versions)).toBe(frozenV1);
  });

  it("C. v2 sem alterar fato materializado → divergence-without-material-impact", () => {
    const { ctx, record } = closed();
    const v2 = supersede(ctx, 0, ctx.versions[0]!.value);
    const impact = determineClosingImpact({ record, currentFacts: { ...ctx, versions: [...ctx.versions, v2] }, archive: archiveOf(ctx) });
    expect(impact.divergence.hasDivergence).toBe(true);
    expect(impact.kind).toBe("divergence-without-material-impact");
    const reg = projectClosingRegularization({ impact, policies: [] });
    expect(reg.status).toBe("nenhuma-acao-exigida");
  });

  it("D. múltiplas mudanças: impacto sobre o conjunto vigente, fechamento intacto", () => {
    const { ctx, record, frozen } = closed();
    const v2a = supersede(ctx, 0, { kind: "numerica", value: 10 });
    const v2b = supersede(ctx, 1, { kind: "numerica", value: 10 });
    const impact = determineClosingImpact({ record, currentFacts: { ...ctx, versions: [...ctx.versions, v2a, v2b] }, archive: archiveOf(ctx) });
    expect(impact.divergence.superseded).toHaveLength(2);
    expect(new Set(impact.changes.map((c) => c.studentId)).size).toBe(2);
    expect(JSON.stringify(record)).toBe(frozen);
  });

  it("E. artefato normativo histórico ausente → impact-undetermined, sem usar a regra atual", () => {
    const { ctx, record } = closed();
    const v2 = supersede(ctx, 0, { kind: "numerica", value: 10 });
    const currentRule = { ...ctx.rule!, version: ctx.rule!.version + 1 };
    const archive: HistoricalNormativeArchive = {
      rule: () => currentRule, // devolve só a regra atual: não serve para o passado
      configuration: archiveOf(ctx).configuration,
    };
    const impact = determineClosingImpact({ record, currentFacts: { ...ctx, versions: [...ctx.versions, v2] }, archive });
    expect(impact.kind).toBe("impact-undetermined");
    expect(impact.provenance.analyzedWithRule).toBeUndefined();
    expect(impact.undeterminedReasons[0]).toContain(`${record.ruleVersion}`);
  });

  const withImpact = () => {
    const { ctx, record, store, frozen } = closed();
    const v2 = supersede(ctx, 0, { kind: "numerica", value: 10 });
    const impact = determineClosingImpact({ record, currentFacts: { ...ctx, versions: [...ctx.versions, v2] }, archive: archiveOf(ctx) });
    return { ctx, record, store, frozen, impact };
  };
  const RETIFICAR: ClosingRegularizationPolicy = {
    id: "prf-teste",
    version: 2,
    homologated: true,
    appliesToImpactKinds: ["divergence-with-material-impact"],
    outcomeId: "retificacao-admissivel",
    requiredCapabilityIds: ["executar-retificacao-pos-fechamento"],
    requirements: [{ id: "rq-just", label: "Justificativa", natureId: "justificativa" }],
  };

  it("F. impacto + política sem rito → nenhuma obrigação inventada", () => {
    const { impact } = withImpact();
    const reg = projectClosingRegularization({ impact, policies: [], actor: secretaria });
    expect(reg.status).toBe("insuficiencia-normativa");
    expect(reg.requirements).toEqual([]);
    expect(reg.canProceed).toBe(false);
    const silenciosa = { ...RETIFICAR, outcomeId: "nenhuma-acao", requiredCapabilityIds: [], requirements: [] };
    const r2 = projectClosingRegularization({ impact, policies: [silenciosa], actor: secretaria });
    expect(r2.requirements).toEqual([]);
    expect(r2.requiredCapabilityIds).toEqual([]);
  });

  it("G. requisitos projetados exatamente como declarados", () => {
    const { impact } = withImpact();
    const reg = projectClosingRegularization({ impact, policies: [RETIFICAR], actor: secretaria });
    expect(reg).toMatchObject({ status: "rito-declarado", outcomeId: "retificacao-admissivel", canProceed: true });
    expect(reg.requirements).toEqual(RETIFICAR.requirements);
    expect(reg.provenance).toMatchObject({ policyId: "prf-teste", policyVersion: 2 });
  });

  it("H. agente sem capacidade → regularização bloqueada, fatos intactos", () => {
    const { impact, record, frozen, store, ctx } = withImpact();
    const reg = projectClosingRegularization({ impact, policies: [RETIFICAR], actor: demonstrationActor("perfil-docente") });
    expect(reg.canProceed).toBe(false);
    expect(reg.missingCapabilityIds).toEqual(["executar-retificacao-pos-fechamento"]);
    expect(JSON.stringify(record)).toBe(frozen);
    expect(store.chain(ctx.scope)).toHaveLength(1);
  });

  it("I. correção após fechamento recebe o fechamento vigente e o rito vem da política", () => {
    const { ctx, record } = closed();
    const pos: AssessmentCorrectionPolicy = {
      id: "pol-pos",
      version: 1,
      label: "Pós-fechamento",
      homologated: true,
      appliesWhenPeriodClosing: "present",
      outcome: "admissible",
      requiredCapabilities: ["cap-pos"],
      requirements: [{ code: "just", label: "Justificativa", provenance: "pol-pos" }],
      disclosesNormativeContext: true,
    };
    const pre: AssessmentCorrectionPolicy = { ...pos, id: "pol-pre", appliesWhenPeriodClosing: "absent", requiredCapabilities: [], requirements: [] };
    const input = withCurrentClosing(
      {
        baseVersionId: ctx.versions[0]!.id,
        versions: ctx.versions,
        agent: { agentId: "a", capabilities: ["cap-pos"] },
        instrument: ctx.instruments[0]!,
        configuration: ctx.configuration,
        policies: [pre, pos],
      },
      record,
      ctx.period.label,
    );
    expect(input.periodClosing).toEqual({ closingId: record.id, closingVersion: record.version, periodLabel: ctx.period.label });
    const projection = resolveAssessmentCorrection(input);
    expect(JSON.stringify(projection)).toContain("pol-pos");
    expect(JSON.stringify(projection)).not.toContain("pol-pre");
  });

  it("J. nenhuma operação desta etapa cria Closing v2", () => {
    const { impact, store, ctx, record, frozen } = withImpact();
    const reg = projectClosingRegularization({ impact, policies: [RETIFICAR], actor: secretaria });
    expect(reg.createsClosingVersion).toBe(false);
    expect(store.chain(ctx.scope).map((r) => r.version)).toEqual([1]);
    expect(JSON.stringify(record)).toBe(frozen);
  });
});
