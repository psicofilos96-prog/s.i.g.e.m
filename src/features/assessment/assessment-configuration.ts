/**
 * Etapa 12B — configuração avaliativa utilizável pela interface.
 * Tudo aqui é estrutural: nenhuma função calcula média, situação ou frequência.
 */
import {
  classAcademicYear,
  classStage,
  getAcademicYear,
} from "@/features/academic/academic-structure";
import {
  assessmentConfigurations,
  instrumentTypes,
  periodStructures,
  PENDING_NORMATIVE_RULES,
} from "./assessment-fixtures";
import {
  resolveConfiguration,
  validatePeriodStructure,
  type PeriodIssue,
} from "./assessment-rules";
import type {
  AcademicYear,
  AssessmentConfiguration,
  AssessmentPeriod,
  AssessmentPeriodStructure,
  NormativeStatus,
  ScaleDefinition,
} from "./assessment-types";

// --------------------------------------------------- Homologação x configuração

export const NORMATIVE_STATUS_LABEL: Record<NormativeStatus, string> = {
  pendente: "Pendente de homologação",
  demonstrativo: "Demonstrativo",
  configurado: "Configurado, não homologado",
  homologado: "Homologado",
};

/**
 * Homologação é propriedade explícita: só é oficial quando a configuração, sua
 * estrutura de períodos, escalas e regras estão todas homologadas e não há pendência.
 * Uma fixture configurada nunca é automaticamente regra oficial.
 */
export function isHomologated(
  configuration: AssessmentConfiguration,
  structure: AssessmentPeriodStructure | undefined,
) {
  return (
    configuration.normativeStatus === "homologado" &&
    structure?.normativeStatus === "homologado" &&
    configuration.pendingRuleIds.length === 0 &&
    configuration.scales.every(
      (s) => s.kind === "descritiva" || s.normativeStatus === "homologado",
    ) &&
    configuration.consolidationRules.every((r) => r.normativeStatus === "homologado")
  );
}

// ------------------------------------------------------------ Capacidades

/** O que a estratégia admite — a UI consulta isto, nunca a etapa. */
export type StrategyCapabilities = {
  grades: boolean;
  promotionDecision: boolean;
  /** Nenhuma média existe nesta etapa, em nenhuma estratégia. */
  average: false;
  scales: ScaleDefinition[];
  instruments: Array<{ id: string; label: string }>;
  pedagogicalRecords: boolean;
};

export function strategyCapabilities(configuration: AssessmentConfiguration): StrategyCapabilities {
  return {
    grades: configuration.allowsGrades,
    promotionDecision: configuration.allowsPromotionDecision,
    average: false,
    scales: configuration.scales,
    instruments: instrumentTypes.filter((t) =>
      configuration.allowedInstrumentTypeIds.includes(t.id),
    ),
    pedagogicalRecords: configuration.usesPedagogicalRecords,
  };
}

// --------------------------------------------------------------- Permissões

/** Perfil demonstrativo. Autorização real depende do backend. */
export type AssessmentViewer = "professor" | "coordenacao" | "secretaria";

export type AssessmentPermissions = {
  consult: boolean;
  /** Capacidade futura — nunca concedida nesta etapa. */
  configure: { future: true; granted: false; reason: string };
  homologate: { future: true; granted: false; reason: string };
  authorizationFinal: false;
};

export function assessmentPermissions(viewer: AssessmentViewer): AssessmentPermissions {
  return {
    consult: true,
    configure: {
      future: true,
      granted: false,
      reason:
        viewer === "professor"
          ? "O professor consulta a configuração; não administra regras acadêmicas."
          : "Configuração institucional depende de autorização real ainda não implementada.",
    },
    homologate: {
      future: true,
      granted: false,
      reason: "Homologação depende de ato normativo da rede e de autorização real.",
    },
    authorizationFinal: false,
  };
}

// ----------------------------------------------------------- Estado da configuração

export type ConfigurationState =
  | { kind: "inexistente"; reason: string }
  | { kind: "erro"; reason: string }
  | {
      kind: "incompleta" | "demonstrativa" | "pendencias" | "estruturalmente-pronta" | "homologada";
      configuration: AssessmentConfiguration;
      year: AcademicYear;
      structure: AssessmentPeriodStructure;
      issues: PeriodIssue[];
      missing: string[];
      pendingRules: typeof PENDING_NORMATIVE_RULES;
      homologated: boolean;
    };

export function configurationCompleteness(configuration: AssessmentConfiguration): string[] {
  const missing: string[] = [];
  if (!configuration.periodStructureId) missing.push("Estrutura de períodos");
  if (configuration.allowsGrades && configuration.scales.every((s) => s.kind === "descritiva"))
    missing.push("Escala compatível com nota");
  if (!configuration.usesPedagogicalRecords && configuration.allowedInstrumentTypeIds.length === 0)
    missing.push("Tipos de instrumento");
  if (configuration.scales.length === 0 && !configuration.usesPedagogicalRecords)
    missing.push("Escala ou registro descritivo");
  return missing;
}

export function configurationState(input: {
  configuration: AssessmentConfiguration;
  structures?: AssessmentPeriodStructure[];
  years?: AcademicYear[];
}): ConfigurationState {
  const { configuration } = input;
  const year = getAcademicYear(configuration.academicYearId, input.years);
  const structure = (input.structures ?? periodStructures).find(
    (s) => s.id === configuration.periodStructureId,
  );
  if (!year) return { kind: "erro", reason: "Ano letivo referenciado não existe." };
  const missing = configurationCompleteness(configuration);
  if (!structure) return { kind: "erro", reason: "Estrutura de períodos referenciada não existe." };
  if (structure.academicYearId !== year.id)
    return { kind: "erro", reason: "A estrutura de períodos pertence a outro ano letivo." };
  const issues = [
    ...validatePeriodStructure(structure, year.validity),
    ...validateStructureOwnership(structure),
  ];
  const pendingRules = PENDING_NORMATIVE_RULES.filter((r) =>
    configuration.pendingRuleIds.includes(r.id),
  );
  const homologated = isHomologated(configuration, structure);
  const base = { configuration, year, structure, issues, missing, pendingRules, homologated };
  if (missing.length || issues.length) return { kind: "incompleta", ...base };
  if (homologated) return { kind: "homologada", ...base };
  if (configuration.normativeStatus === "demonstrativo") return { kind: "demonstrativa", ...base };
  if (pendingRules.length) return { kind: "pendencias", ...base };
  return { kind: "estruturalmente-pronta", ...base };
}

/** Configuração aplicável à turma no seu próprio ano letivo (por ID). */
export function classConfigurationState(classId: string): ConfigurationState {
  const year = classAcademicYear(classId);
  if (!year) return { kind: "erro", reason: "Turma sem ano letivo identificado." };
  const resolution = resolveConfiguration(classId, year.id, assessmentConfigurations);
  if (resolution.status === "pendente") return { kind: "inexistente", reason: resolution.reason };
  return configurationState({ configuration: resolution.configuration });
}

export function classStageLabel(classId: string) {
  return classStage(classId)?.label ?? "Etapa não referenciada";
}

// ------------------------------------------------ Edição estrutural de períodos

/** Operações puras (rascunho local). Não publicam nem persistem. */
export function addPeriod(
  structure: AssessmentPeriodStructure,
  period: Omit<AssessmentPeriod, "structureId" | "academicYearId" | "sequence">,
): AssessmentPeriodStructure {
  const sequence = Math.max(0, ...structure.periods.map((p) => p.sequence)) + 1;
  return {
    ...structure,
    periods: [
      ...structure.periods,
      { ...period, structureId: structure.id, academicYearId: structure.academicYearId, sequence },
    ],
  };
}

export function removePeriod(structure: AssessmentPeriodStructure, periodId: string) {
  const periods = structure.periods
    .filter((p) => p.id !== periodId)
    .sort((a, b) => a.sequence - b.sequence)
    .map((p, index) => ({ ...p, sequence: index + 1 }));
  return { ...structure, periods };
}

export function renamePeriod(
  structure: AssessmentPeriodStructure,
  periodId: string,
  label: string,
) {
  return {
    ...structure,
    periods: structure.periods.map((p) => (p.id === periodId ? { ...p, label } : p)),
  };
}

/** Invariante estrutural adicional: período deve pertencer ao ano da estrutura. */
export function validateStructureOwnership(structure: AssessmentPeriodStructure): PeriodIssue[] {
  return structure.periods
    .filter((p) => p.academicYearId !== structure.academicYearId || p.structureId !== structure.id)
    .map((p) => ({
      periodId: p.id,
      message: "Período vinculado a outra estrutura ou ano letivo.",
    }));
}
