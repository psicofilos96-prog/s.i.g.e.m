/**
 * Regras puras e seletores do domínio de avaliação (Etapa 12A).
 * Nenhuma função aqui calcula média, situação final ou efeito da frequência.
 */
import {
  assignmentActiveOn,
  dateInRange,
  normalizedStudentDate,
} from "@/features/diary/diary-data";
import { classStage } from "@/features/academic/academic-structure";
import type { PedagogicalAssignmentRecord } from "@/features/pedagogical/pedagogical-data";
import type { DemonstrationStudent } from "@/features/students/students-data";
import type {
  AcademicPlacement,
  AcademicStanding,
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  AssessmentPeriod,
  AssessmentPeriodStructure,
  CurriculumRef,
  AssessmentResult,
  EntryValue,
  ResultLevel,
} from "./assessment-types";

// ---------------------------------------------------------- Configuração

export type ConfigurationResolution =
  | { status: "resolvida"; configuration: AssessmentConfiguration }
  | { status: "pendente"; reason: string };

/** Resolve a configuração da turma. Diferenças de segmento vivem só aqui. */
export function resolveConfiguration(
  classId: string,
  academicYearId: string,
  configurations: AssessmentConfiguration[],
): ConfigurationResolution {
  const candidates = configurations.filter((c) => c.academicYearId === academicYearId);
  const byClass = candidates.find((c) => c.scope.classIds?.includes(classId));
  if (byClass) return { status: "resolvida", configuration: byClass };
  const stageId = classStage(classId)?.id;
  const byStage = stageId ? candidates.filter((c) => c.scope.stageIds?.includes(stageId)) : [];
  const single = byStage.length === 1 ? byStage[0] : undefined;
  if (single) return { status: "resolvida", configuration: single };
  return {
    status: "pendente",
    reason:
      byStage.length > 1
        ? "Mais de uma configuração aplicável; decisão humana necessária."
        : "Nenhuma configuração avaliativa definida para este contexto.",
  };
}

// --------------------------------------------------------------- Períodos

export type PeriodIssue = { periodId?: string; message: string };

/** Valida sem pressupor quantidade de períodos nem nomes. */
export function validatePeriodStructure(
  structure: AssessmentPeriodStructure,
  year: { start: string; end: string },
): PeriodIssue[] {
  const issues: PeriodIssue[] = [];
  if (structure.periods.length === 0) issues.push({ message: "Estrutura sem períodos." });
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const sorted = [...structure.periods].sort((a, b) => a.sequence - b.sequence);
  sorted.forEach((period, index) => {
    if (ids.has(period.id)) issues.push({ periodId: period.id, message: "ID duplicado." });
    if (sequences.has(period.sequence))
      issues.push({ periodId: period.id, message: "Sequência duplicada." });
    ids.add(period.id);
    sequences.add(period.sequence);
    if (period.start > period.end)
      issues.push({ periodId: period.id, message: "Início após término." });
    if (period.start < year.start || period.end > year.end)
      issues.push({ periodId: period.id, message: "Fora do ano letivo." });
    const previous = sorted[index - 1];
    if (previous && period.start <= previous.end)
      issues.push({ periodId: period.id, message: "Sobreposição com o período anterior." });
  });
  return issues;
}

export function periodOn(structure: AssessmentPeriodStructure, date: string) {
  return structure.periods.find((p) => dateInRange(date, p.start, p.end)) ?? null;
}

// ------------------------------------------------ Matrícula e movimentação

/** Achata a trajetória existente em colocações temporais, com datas ISO. */
export function studentPlacements(student: DemonstrationStudent): AcademicPlacement[] {
  return student.enrollments.flatMap((enrollment) =>
    enrollment.academicLinks.flatMap((link) =>
      link.participations.flatMap((participation) =>
        participation.allocations.map((allocation) => ({
          studentId: student.id,
          enrollmentId: enrollment.id,
          unitId: link.unitId,
          academicLinkId: link.id,
          participationId: participation.id,
          participationNature: participation.nature,
          allocationId: allocation.id,
          classId: allocation.classId,
          from: normalizedStudentDate(allocation.from),
          until: normalizedStudentDate(allocation.until),
        })),
      ),
    ),
  );
}

export type PeriodCoverage =
  "integral" | "ingresso-posterior" | "saida-anterior" | "parcial" | "sem-vinculo";

export type PeriodEligibility = {
  coverage: PeriodCoverage;
  placements: AcademicPlacement[];
  /** Nenhuma regra de aproveitamento é aplicada — ver pn-movimentacao. */
  pendingRuleIds: string[];
};

/** Vínculo do aluno com a turma dentro do período — nunca o estado atual. */
export function eligibilityInPeriod(
  placements: AcademicPlacement[],
  classId: string,
  period: Pick<AssessmentPeriod, "start" | "end">,
): PeriodEligibility {
  const matching = placements.filter(
    (p) =>
      p.classId === classId &&
      (!p.from || p.from <= period.end) &&
      (!p.until || p.until >= period.start),
  );
  if (matching.length === 0) return { coverage: "sem-vinculo", placements: [], pendingRuleIds: [] };
  const earliest = matching.map((p) => p.from ?? period.start).sort()[0] ?? period.start;
  const latest = matching.some((p) => !p.until)
    ? period.end
    : (matching
        .map((p) => p.until as string)
        .sort()
        .reverse()[0] ?? period.end);
  const late = earliest > period.start;
  const early = latest < period.end;
  const coverage: PeriodCoverage =
    late && early ? "parcial" : late ? "ingresso-posterior" : early ? "saida-anterior" : "integral";
  return {
    coverage,
    placements: matching,
    pendingRuleIds: coverage === "integral" ? [] : ["pn-movimentacao"],
  };
}

/** Colocação válida na data (usada para fixar o contexto do lançamento). */
export function placementOn(placements: AcademicPlacement[], classId: string, date: string) {
  return (
    placements.find(
      (p) => p.classId === classId && (!p.from || p.from <= date) && (!p.until || p.until >= date),
    ) ?? null
  );
}

// ------------------------------------------------------- Atuação docente

/** 12D.1 — Identidade estável do componente/campo da atuação (nunca o rótulo). */
export function curriculumRefOf(assignment: PedagogicalAssignmentRecord): CurriculumRef {
  return assignment.fieldId
    ? { kind: "matriz", componentId: assignment.fieldId }
    : { kind: "atuacao", assignmentId: assignment.id };
}

export function sameCurriculum(a: CurriculumRef | undefined, b: CurriculumRef | undefined) {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "matriz"
    ? a.componentId === (b as typeof a).componentId
    : a.assignmentId === (b as typeof a).assignmentId;
}

/** Chave textual estável (para agrupamento), derivada só de IDs. */
export function curriculumKey(ref: CurriculumRef | undefined) {
  if (!ref) return "sem-identidade";
  return ref.kind === "matriz" ? `matriz:${ref.componentId}` : `atuacao:${ref.assignmentId}`;
}

export type RecordingReadiness = {
  /** Prontidão de domínio; a autorização definitiva depende do backend. */
  ready: boolean;
  reasons: string[];
  authorizationFinal: false;
};

/** profissional + atuação + turma + componente/campo + vigência + período. */
export function recordingReadiness(input: {
  professionalId: string;
  assignment: PedagogicalAssignmentRecord | undefined;
  instrument: Pick<AssessmentInstrument, "classId" | "appliedOn" | "snapshot" | "curriculumRef">;
  period: Pick<AssessmentPeriod, "start" | "end">;
}): RecordingReadiness {
  const { assignment, instrument, period } = input;
  const reasons: string[] = [];
  if (!assignment) reasons.push("Atuação pedagógica inexistente.");
  else {
    if (assignment.professionalId !== input.professionalId)
      reasons.push("A atuação pertence a outro profissional.");
    if (assignment.classId !== instrument.classId) reasons.push("A atuação é de outra turma.");
    if (!instrument.curriculumRef)
      reasons.push("Instrumento sem identidade estável de componente ou campo.");
    else if (!sameCurriculum(instrument.curriculumRef, curriculumRefOf(assignment)))
      reasons.push("Componente ou campo diferente da atuação.");
    if (!assignmentActiveOn(assignment, instrument.appliedOn))
      reasons.push("Atuação fora da vigência na data do instrumento.");
    if (!dateInRange(instrument.appliedOn, period.start, period.end))
      reasons.push("Data do instrumento fora do período avaliativo.");
  }
  return { ready: reasons.length === 0, reasons, authorizationFinal: false };
}

// ----------------------------------------------------------- Lançamentos

export function validateEntryValue(
  configuration: AssessmentConfiguration,
  value: EntryValue,
): string[] {
  if (value.kind === "nao-registrado") return value.reason.trim() ? [] : ["Informe o motivo."];
  if (value.kind === "descritiva" && configuration.usesPedagogicalRecords)
    return value.text.trim() ? [] : ["Registro descritivo vazio."];
  const scale = configuration.scales.find((s) => s.kind === value.kind);
  if (!scale) return [`Esta configuração não admite lançamento do tipo "${value.kind}".`];
  if (value.kind === "numerica" && !configuration.allowsGrades)
    return ["Esta configuração não admite nota."];
  if (value.kind === "numerica" && scale.kind === "numerica") {
    if (!Number.isFinite(value.value) || value.value < scale.min || value.value > scale.max)
      return ["Valor fora da escala configurada."];
  }
  if (value.kind === "conceitual" && scale.kind === "conceitual") {
    if (!scale.options.some((o) => o.id === value.optionId)) return ["Conceito inexistente."];
  }
  if (value.kind === "descritiva" && !value.text.trim()) return ["Registro descritivo vazio."];
  return [];
}

// ------------------------------------------------------------- Resultado

/** Deriva resultado apenas com regra homologada. Nesta etapa, nunca calcula. */
export function deriveResult(
  configuration: AssessmentConfiguration,
  level: ResultLevel,
  _entries: AssessmentEntry[],
): AssessmentResult {
  const rule = configuration.consolidationRules.find(
    (r) => r.level === level && r.normativeStatus === "homologado",
  );
  if (!rule)
    return {
      status: "sem-regra-homologada",
      level,
      pendingRuleIds: ["pn-consolidacao", ...(level === "final" ? ["pn-situacao"] : [])],
      official: false,
    };
  return { status: "regra-nao-implementada", level, ruleId: rule.id, official: false };
}

/**
 * Situação acadêmica. A frequência demonstrativa é aceita apenas para deixar
 * explícito que ela NÃO produz resultado oficial.
 */
export function academicStanding(
  configuration: AssessmentConfiguration,
  _context: { attendancePreviewPercent?: number | null },
): AcademicStanding {
  if (!configuration.allowsPromotionDecision)
    return {
      status: "nao-aplicavel",
      reason: "Este contexto não utiliza aprovação ou reprovação.",
      official: false,
    };
  return {
    status: "nao-determinada",
    reason: "Critérios de situação acadêmica e de frequência não homologados.",
    official: false,
  };
}

// --------------------------------------------------------------- Seletores

export function entriesForStudent(entries: AssessmentEntry[], studentId: string) {
  return entries.filter((e) => e.studentId === studentId);
}

export function instrumentsForAssignment(
  instruments: AssessmentInstrument[],
  assignmentId: string,
) {
  return instruments.filter((i) => i.pedagogicalAssignmentId === assignmentId);
}
