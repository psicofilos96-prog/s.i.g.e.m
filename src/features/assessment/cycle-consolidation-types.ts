/**
 * Etapa 12H — Consolidação do Percurso Avaliativo (tipos).
 *
 * O "ciclo avaliativo" é a estrutura GENÉRICA de fechamento do percurso. Pode
 * ser anual, por fase, modular ou qualquer outra organização: o motor não
 * conhece modalidade, etapa, fase, ano civil nem quantidade de períodos. O
 * ciclo chega ao motor JÁ RESOLVIDO, declarando quais períodos oficiais o
 * compõem (por identidade estável).
 *
 * Quatro camadas SEMPRE separadas:
 *   1. resultado matemático consolidado do ciclo;
 *   2. recuperação final;
 *   3. resultado consolidado pós-recuperação;
 *   4. situação acadêmica — NÃO produzida aqui (etapa posterior).
 *
 * Nenhuma aprovação, reprovação, dependência, progressão, retenção, efeito de
 * frequência ou deliberação de Conselho é produzida nesta etapa.
 */
import type { PeriodCoverage } from "./assessment-rules";
import type { ClosingSourceReference } from "./period-closing-types";
import type { CurriculumRef } from "./assessment-types";

// ------------------------------------------------------------------- Ciclo

/** Período oficial que compõe o ciclo. Identidade sempre por ID. */
export type CyclePeriodRef = {
  /** Período da estrutura avaliativa. */
  periodId: string;
  /** Período oficial do calendário homologado, quando existir. */
  calendarPeriodId?: string;
  sequence: number;
  label: string;
  start: string;
  end: string;
  /** Este período vem de calendário homologado? */
  official: boolean;
};

/**
 * Ciclo avaliativo resolvido. `kindId` e `label` vêm da CONFIGURAÇÃO — nunca de
 * modalidade, etapa ou nome de fase interpretado pelo motor. A quantidade de
 * períodos é livre: nada aqui pressupõe 2, 3, 4 ou qualquer número.
 */
export type AssessmentCycle = {
  id: string;
  /** Identificador livre do tipo de ciclo, declarado pela configuração. */
  kindId: string;
  /** Rótulo de exibição, declarado pela configuração. */
  label: string;
  academicYearId: string;
  configurationId: string;
  /** Agrupamento do calendário que originou o ciclo, quando houver. */
  periodGroupId?: string;
  calendarId?: string;
  periods: CyclePeriodRef[];
};

/** Intervalo do ciclo DERIVADO dos períodos; nunca digitado. */
export function cycleRange(cycle: AssessmentCycle): { start: string; end: string } | null {
  if (cycle.periods.length === 0) return null;
  const starts = cycle.periods.map((p) => p.start).sort();
  const ends = cycle.periods.map((p) => p.end).sort();
  return { start: starts[0]!, end: ends[ends.length - 1]! };
}

// -------------------------------------------------------------- Pendências

export type CyclePendencyCode =
  | "ciclo-sem-periodos"
  | "configuracao-nao-numerica"
  | "regra-nao-homologada"
  | "forma-de-consolidacao-do-ciclo-nao-definida"
  | "calendario-nao-homologado"
  | "periodo-sem-fechamento-oficial"
  | "periodo-com-fechamentos-concorrentes"
  | "periodo-sem-resultado-do-aluno"
  | "periodo-sem-cobertura-integral"
  | "resultado-nao-registrado-no-periodo"
  | "configuracao-divergente-entre-periodos"
  | "regra-divergente-entre-periodos"
  | "valor-administrativo-de-origem-externa"
  | "recuperacao-final-pendente-de-definicao"
  | "recuperacao-final-elegivel-sem-registro";

export type CyclePendencySeverity = "bloqueante" | "pendencia-administrativa" | "aviso";

export type CyclePendency = {
  code: CyclePendencyCode;
  severity: CyclePendencySeverity;
  message: string;
  /** Dimensões estruturadas para exploração analítica futura (CIECE). */
  periodId?: string;
  calendarPeriodId?: string;
  classId?: string;
  pendingRuleIds?: string[];
};

// ------------------------------------------------------ Contribuição do período

/**
 * O que cada período oficial contribuiu para o ciclo. Sempre derivado da VERSÃO
 * VIGENTE do fechamento (12G) — nunca de lançamento recalculado por fora.
 */
export type CyclePeriodContribution = {
  periodId: string;
  calendarPeriodId?: string;
  sequence: number;
  label: string;
  /** Turma em que o período foi fechado (pode variar dentro do ciclo). */
  classId?: string;
  closed: boolean;
  closingId?: string;
  closingVersion?: number;
  /** Resultado consolidado oficial do período (12G). Nunca recalculado aqui. */
  periodScore: number | null;
  rounded: boolean;
  /** Peso do período, quando a regra declarar consolidação ponderada. */
  weight: number;
  coverage: PeriodCoverage | null;
  unregistered: Array<{ entryId: string; reason: string }>;
  configurationId?: string;
  configurationVersion?: number;
  ruleId?: string;
  ruleVersion?: number;
};

// -------------------------------------------------------- Recuperação final

export type FinalRecoveryState =
  | "nao-configurada"
  | "desabilitada"
  | "nao-elegivel"
  | "pendente-de-definicao"
  | "elegivel-sem-registro"
  | "aplicada";

export const FINAL_RECOVERY_STATE_LABEL: Record<FinalRecoveryState, string> = {
  "nao-configurada": "Recuperação final não configurada nesta regra",
  desabilitada: "Recuperação final desabilitada nesta regra",
  "nao-elegivel": "Aluno não elegível à recuperação final",
  "pendente-de-definicao": "Recuperação final pendente de definição normativa",
  "elegivel-sem-registro": "Elegível à recuperação final, sem registro lançado",
  aplicada: "Recuperação final aplicada conforme a regra homologada",
};

export type FinalRecoveryProjection = {
  state: FinalRecoveryState;
  /** Valor da própria recuperação, em campo próprio. Nunca substitui o original. */
  recoveryScore: number | null;
  /** Prevalência configurada e efetivamente utilizada, quando aplicada. */
  prevalence: string | null;
  entryIds: string[];
  maxScore?: number;
  reason: string;
  /**
   * 6D.3.5.2 — Proveniência do cálculo: a identidade versionada vem do contexto
   * do ato (regra aplicável), nunca de `RecoveryRule`.
   */
  provenance?: FinalRecoveryProvenance;
};

// ------------------------------------------------------------- Consolidação

/**
 * Dimensões estruturadas para exploração futura (CIECE). São PROPRIEDADES com
 * identificadores estáveis, nunca apenas texto de interface. Esta etapa não
 * implementa relatório nem integração alguma.
 */
export type CycleConsolidationFacts = {
  cycleId: string;
  cycleKindId: string;
  academicYearId: string;
  configurationId: string;
  configurationVersion?: number;
  periodGroupId?: string;
  calendarId?: string;
  studentId: string;
  curriculumRef: CurriculumRef;
  curriculumKey: string;
  classIds: string[];
  periodIds: string[];
  closedPeriodIds: string[];
  openPeriodIds: string[];
  ruleId?: string;
  ruleVersion?: number;
  sourceClosings: ClosingSourceReference[];
  pendencyCodes: CyclePendencyCode[];
  pendingRuleIds: string[];
  finalRecoveryState: FinalRecoveryState;
  official: boolean;
};

export type CycleConsolidationBase = {
  cycle: AssessmentCycle;
  studentId: string;
  studentName?: string;
  curriculumRef: CurriculumRef;
  contributions: CyclePeriodContribution[];
  pendencies: CyclePendency[];
  facts: CycleConsolidationFacts;
};

/**
 * Resultado da consolidação do ciclo. Nenhuma variante produz situação
 * acadêmica: `academicStanding` é sempre `null` e existe apenas como ponto de
 * integração explícito para a etapa posterior.
 */
export type CycleConsolidation = CycleConsolidationBase &
  (
    | {
        /** Falta governança: regra/forma de consolidação não homologada. */
        kind: "bloqueado";
        reasons: string[];
        cycleScore: null;
        finalRecovery: null;
        postRecoveryScore: null;
        academicStanding: null;
        official: false;
      }
    | {
        /** Configuração sem consolidação numérica (ex.: registros descritivos). */
        kind: "nao-aplicavel";
        reason: string;
        cycleScore: null;
        finalRecovery: null;
        postRecoveryScore: null;
        academicStanding: null;
        official: false;
      }
    | {
        /** Ciclo em andamento. NUNCA tem semântica de resultado do ciclo. */
        kind: "acumulado-parcial";
        label: string;
        /** Acumulado informativo dos períodos já fechados, sem arredondamento de ciclo. */
        partialScore: number | null;
        cycleScore: null;
        finalRecovery: null;
        postRecoveryScore: null;
        academicStanding: null;
        official: false;
      }
    | {
        /** Exige regularização humana: nada é presumido, calculado ou zerado. */
        kind: "pendencia-administrativa";
        reasons: string[];
        cycleScore: null;
        finalRecovery: null;
        postRecoveryScore: null;
        academicStanding: null;
        official: false;
      }
    | {
        kind: "consolidado";
        /** 1. Resultado matemático consolidado do ciclo. */
        rawCycleScore: number;
        cycleScore: number;
        cycleRounded: boolean;
        /** 2. Recuperação final, em camada própria. */
        finalRecovery: FinalRecoveryProjection;
        /** 3. Resultado consolidado pós-recuperação. `null` quando pendente. */
        postRecoveryScore: number | null;
        postRecoveryRounded: boolean;
        /** 4. Situação acadêmica: ponto de integração da etapa seguinte. */
        academicStanding: null;
        /** Oficial apenas com calendário e regra homologados em todo o ciclo. */
        official: boolean;
      }
  );

export const CYCLE_CONSOLIDATION_NOTE =
  "Consolidação do ciclo avaliativo: resultado matemático, recuperação final e resultado pós-recuperação são informações distintas. Situação acadêmica, efeito da frequência e deliberação do Conselho de Classe pertencem a etapas posteriores e não são produzidos aqui.";

export type FinalRecoveryProvenance = {
  ruleId: string;
  ruleVersion: number;
  configurationId: string;
  configurationVersion?: number;
  recoveryRuleId: string;
  eligibilityEvaluatorId: string | null;
  eligibilityFacts: Record<string, number | string>;
  eligibilityReason: string;
  effect?: import("./assessment-recovery").RecoveryProvenance;
};
