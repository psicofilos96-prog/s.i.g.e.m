/**
 * 6D.3.5.7 — LABORATÓRIO da família de Recuperação (fixtures separadas).
 *
 * Nada aqui é regra ou dado institucional real: regras, fechamentos e versões
 * são construídos localmente só para exercitar o motor canônico
 * (`consolidateCycle`) e a apresentação (`presentFinalRecovery`). Nenhum
 * store é alterado e nenhuma norma real é modificada.
 */
import { assessmentConfigurations } from "./assessment-fixtures";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import { assessmentLogicalEntryId } from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";
import {
  compositionInputFromVersion,
  officialCurrentVersionsForStudent,
} from "./assessment-canonical-inputs";
import { consolidateCycle } from "./cycle-consolidation";
import type { AssessmentCycle, CycleConsolidation } from "./cycle-consolidation-types";
import type { PeriodClosingRecord } from "./period-closing-types";
import { presentFinalRecovery, type FinalRecoveryPresentation } from "./final-recovery-presentation";

const LAB_NOW = "2027-12-18T12:00:00.000Z";
const cfg = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const LAB_TYPE = "it-recuperacao-final";

const labInstrument = {
  id: "lab-ins-rf",
  title: "Recuperação final (laboratório)",
  instrumentTypeId: LAB_TYPE,
  periodId: "lab-p3",
  classId: "lab-turma",
} as AssessmentInstrument;

const periods = [1, 2, 3].map((n) => ({
  periodId: `lab-p${n}`,
  calendarPeriodId: `lab-cal-p${n}`,
  sequence: n,
  label: `Período ${n} (laboratório)`,
  start: `2027-0${n + 2}-01`,
  end: `2027-0${n + 2}-28`,
  official: true,
}));

const cycle: AssessmentCycle = {
  id: "lab-ciclo",
  kindId: "ciclo-completo",
  label: "Ciclo de laboratório",
  academicYearId: "lab-ano",
  configurationId: cfg.id,
  calendarId: "lab-cal",
  periods,
};

function labRule(finalRecovery?: Partial<RecoveryRule> | null): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  const { finalRecovery: _drop, ...rest } = base;
  const rule: InstitutionalAssessmentRule = {
    ...rest,
    id: "lab-regra",
    status: "homologada",
    configurationId: cfg.id,
    configurationVersion: cfg.version,
    cycleAggregation: { kind: "media-simples" },
  } as InstitutionalAssessmentRule;
  if (finalRecovery === null) return rule;
  return {
    ...rule,
    finalRecovery: {
      id: "lab-rf",
      enabled: true,
      scope: "anual",
      replacesCategoryIds: [],
      instrumentTypeIds: [LAB_TYPE],
      normativeStatus: "configurado",
      eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
      prevalence: "maior-resultado",
      ...finalRecovery,
    } as RecoveryRule,
  };
}

function closingOf(periodId: string, score: number): PeriodClosingRecord {
  return {
    id: `lab-fec-${periodId}`,
    scope: { classId: "lab-turma", academicYearId: "lab-ano", periodId, curriculumRef: { kind: "matriz", componentId: "lab" } },
    version: 1,
    resultKind: "resultado-consolidado-oficial-do-periodo",
    ruleId: "lab-regra",
    ruleVersion: 1,
    calendarId: "lab-cal",
    configurationId: cfg.id,
    configurationVersion: cfg.version,
    closedBy: { actorId: "lab", actorName: "Laboratório", profileLabel: "Laboratório", at: LAB_NOW },
    closedAt: LAB_NOW,
    results: [
      {
        studentId: "lab-aluno",
        studentName: "Estudante de laboratório",
        entryIds: [],
        usedEntryVersions: [],
        categories: [],
        consolidatedPeriodScore: score,
        rounded: false,
        complete: true,
        unregistered: [],
        coverage: "integral",
      },
    ],
  } as unknown as PeriodClosingRecord;
}

function version(id: string, n: number, value: number | null, over: Partial<AssessmentEntryVersion> = {}) {
  return {
    id,
    logicalEntryId: assessmentLogicalEntryId(labInstrument.id, "lab-aluno"),
    version: n,
    instrumentId: labInstrument.id,
    studentId: "lab-aluno",
    placement: {},
    value: value === null ? { kind: "nao-registrado", reason: "ausente" } : { kind: "numerica", value },
    status: "registrado",
    recordedAt: LAB_NOW,
    recordedByAssignmentId: "lab",
    ...over,
  } as unknown as AssessmentEntryVersion;
}

function run(rule: InstitutionalAssessmentRule, versions: AssessmentEntryVersion[], cycleScore: number): CycleConsolidation {
  const uses = officialCurrentVersionsForStudent({ studentId: "lab-aluno", instruments: [labInstrument], versions });
  return consolidateCycle({
    cycle,
    configuration: cfg,
    studentId: "lab-aluno",
    studentName: "Estudante de laboratório",
    curriculumRef: { kind: "matriz", componentId: "lab" },
    rule,
    closings: periods.map((p) => closingOf(p.periodId, cycleScore)),
    finalRecoveryEntries: uses.map((u) => compositionInputFromVersion(u, { id: cfg.id, version: cfg.version ?? 0 })),
    finalRecoveryVersions: uses.map((u) => ({
      versionId: u.version.id,
      logicalEntryId: u.version.logicalEntryId,
      version: u.version.version,
      instrumentId: u.instrument.id,
      instrumentTitle: u.instrument.title,
      isCorrection: Boolean(u.version.supersedesVersionId),
    })),
  });
}

export type LabScenario = {
  id: string;
  title: string;
  result: CycleConsolidation;
  view: FinalRecoveryPresentation;
};

export function finalRecoveryLabScenarios(): LabScenario[] {
  const s = (id: string, title: string, result: CycleConsolidation, valuesDisclosed = true): LabScenario => ({
    id,
    title,
    result: { ...result, studentName: title },
    view: presentFinalRecovery(result, { valuesDisclosed }),
  });
  const improved = run(labRule(), [version("v1", 1, 70)], 40);
  return [
    s("nao-configurada", "Recuperação final não configurada", run(labRule(null), [], 40)),
    s("melhora", "Elegível, recuperação melhora o resultado", improved),
    s("mantem", "Elegível, recuperação considerada sem alterar", run(labRule(), [version("v1", 1, 30)], 40)),
    s("nao-elegivel", "Não elegível pelo critério", run(labRule(), [version("v1", 1, 90)], 80)),
    s(
      "indeterminada",
      "Elegibilidade indeterminada (patamar não declarado)",
      run(labRule({ eligibility: { kind: "limite-de-pontuacao", basis: "resultado-anual" } }), [version("v1", 1, 70)], 40),
    ),
    s("sem-resultado", "Elegível sem resultado registrado", run(labRule(), [], 40)),
    s("nao-registrado", "Recuperação com “Não registrado”", run(labRule(), [version("v1", 1, null)], 40)),
    s(
      "corrigida",
      "Recuperação corrigida v1 → v2",
      run(labRule(), [version("v1", 1, 55), version("v2", 2, 75, { supersedesVersionId: "v1" })], 40),
    ),
    s(
      "sem-criterio",
      "Regra sem critério de elegibilidade",
      run(labRule({ eligibility: undefined }), [version("v1", 1, 70)], 40),
    ),
    s(
      "sem-restricao",
      "Regra com “sem restrição” explícito",
      run(labRule({ eligibility: { kind: "sem-restricao" } }), [version("v1", 1, 90)], 80),
    ),
    s("protegido", "Resultado protegido (sem divulgação de valores)", improved, false),
  ];
}
