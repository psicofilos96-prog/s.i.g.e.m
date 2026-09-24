/**
 * Etapa 12F — Ponte entre a regra institucional e o motor da 12E.
 *
 * Somente regra HOMOLOGADA alimenta cálculo institucional. Rascunho e em
 * revisão alimentam exclusivamente a prévia e o simulador (dados fictícios).
 */
import { calendarRepository, type CalendarRepository } from "@/features/calendar/calendar-store";
import type { NetworkCalendar } from "@/features/calendar/calendar-types";
import type { CompositionModel } from "./assessment-composition-types";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { NormativeStatus } from "./assessment-types";

/** Regra que pode alimentar cálculo oficial. Estado, não heurística. */
export const ruleFuelsEngine = (rule: InstitutionalAssessmentRule) => rule.status === "homologada";

const modelStatus = (rule: InstitutionalAssessmentRule): NormativeStatus =>
  rule.status === "homologada" ? "homologado" : "configurado";

/**
 * Projeta a regra no modelo que o motor consome. Em rascunho/revisão o modelo
 * sai marcado como apenas configurado — e o motor devolve bloqueio informativo.
 */
export function compositionModelFromRule(rule: InstitutionalAssessmentRule): CompositionModel {
  const status = modelStatus(rule);
  return {
    id: `mc-${rule.id}-v${rule.version}`,
    label: rule.name,
    configurationId: rule.configurationId ?? rule.id,
    configurationVersion: rule.version,
    scaleSemantics: rule.scaleSemantics,
    categories: rule.categories,
    periodAggregation: rule.periodAggregation,
    // Consolidação anual pendente permanece pendente: o motor bloqueia o cálculo.
    ...(rule.annualAggregation ? { annualAggregation: rule.annualAggregation } : {}),
    requiresAllPeriods: rule.requiresAllPeriods,
    rounding: { ...rule.rounding, normativeStatus: status },
    administrativeEntries: { ...rule.administrativeEntries, normativeStatus: status },
    normativeStatus: status,
    version: rule.version,
  };
}

/** Modelo oficial: existe apenas quando a regra está homologada. */
export function officialModelFromRule(rule: InstitutionalAssessmentRule): CompositionModel | null {
  return ruleFuelsEngine(rule) ? compositionModelFromRule(rule) : null;
}

export type RuleResolution =
  | { status: "resolvida"; rule: InstitutionalAssessmentRule; calendar?: NetworkCalendar }
  | { status: "sem-regra-homologada"; reason: string };

/**
 * Resolve a regra homologada aplicável a um contexto, por identidade
 * (ano letivo, etapa/modalidade, turma) e vigência. Nunca por nome.
 */
export function resolveApplicableRule(args: {
  academicYearId: string;
  stageId?: string | undefined;
  classId?: string | undefined;
  date?: string | undefined;
  rules: readonly InstitutionalAssessmentRule[];
  calendars?: CalendarRepository;
}): RuleResolution {
  const homologated = args.rules.filter(
    (r) => r.status === "homologada" && r.scope.academicYearId === args.academicYearId,
  );
  if (homologated.length === 0)
    return {
      status: "sem-regra-homologada",
      reason: "Não existe regra avaliativa homologada aplicável a este contexto.",
    };
  const inForce = homologated.filter((r) => {
    if (!args.date) return true;
    if (r.validFrom && args.date < r.validFrom) return false;
    if (r.validUntil && args.date > r.validUntil) return false;
    return true;
  });
  const byClass = args.classId
    ? inForce.filter((r) => r.scope.classIds?.includes(args.classId!))
    : [];
  const byStage = args.stageId
    ? inForce.filter((r) => r.scope.stageIds.includes(args.stageId!))
    : [];
  const candidates = byClass.length > 0 ? byClass : byStage;
  if (candidates.length === 0)
    return {
      status: "sem-regra-homologada",
      reason: "Não existe regra avaliativa homologada aplicável a esta turma.",
    };
  if (candidates.length > 1)
    return {
      status: "sem-regra-homologada",
      reason:
        "Mais de uma regra homologada é aplicável a este contexto: a definição depende da Supervisão.",
    };
  const rule = candidates[0]!;
  const calendar = (args.calendars ?? calendarRepository).get(rule.scope.calendarId);
  return { status: "resolvida", rule, ...(calendar ? { calendar } : {}) };
}

/**
 * Total anual possível DERIVADO dos tetos dos períodos informados
 * (ex.: 100+100+100 = 300; 100+100+200 = 400). `null` quando algum teto falta.
 */
export function annualMaxScore(
  rule: InstitutionalAssessmentRule,
  calendarPeriodIds: readonly string[],
): number | null {
  if (rule.annualAggregation?.kind !== "soma" || calendarPeriodIds.length === 0) return null;
  let total = 0;
  for (const id of calendarPeriodIds) {
    const max =
      rule.periodMaxScores?.find((p) => p.calendarPeriodId === id)?.maxScore ?? rule.periodMaxScore;
    if (max === undefined) return null;
    total += max;
  }
  return total;
}
