/**
 * Etapa 12L — projetor canônico.
 *
 * FONTE OFICIAL ÚNICA: a projeção nasce do snapshot versionado da 12K e nunca
 * reconsulta calendário, regras, lançamentos ou cadastros. Alterar hoje uma
 * fonte não altera a projeção de um encerramento lavrado no passado.
 *
 * O projetor é primitivo: agrupa fatos por escopo declarado, preserva valores e
 * proveniência e publica pendências estruturadas. Ele não conhece componente,
 * frequência, modalidade, etapa, segmento nem situação: os agrupamentos com
 * significado institucional entram por CONFIGURAÇÃO (`ProjectionOptions`).
 */
import type {
  ClassCycleClosingSnapshot,
  ClosingMaterializedFact,
  ClosingSourceReference,
  RequirementDiagnosis,
  StudentCycleClosingRecord,
} from "@/features/cycle-closing/cycle-closing-types";
import {
  ACADEMIC_PROJECTION_SCHEMA_VERSION,
  type AcademicAttendanceProjection,
  type AcademicDimensionProjection,
  type AcademicProjectionIssue,
  type AcademicProvenanceProjection,
  type ClassAcademicCycleProjection,
  type ProjectionFact,
  type ProjectionScopeReference,
  type ProjectionSourceReference,
  type StudentAcademicCycleProjection,
} from "./academic-projection-types";

/**
 * Configuração da projeção. Tudo é OPCIONAL: nada declarado ⇒ nenhum
 * agrupamento institucional é presumido, e os fatos permanecem publicados como
 * fatos do percurso.
 */
export type ProjectionOptions = {
  /** Vigência declarada; normalmente derivada da cadeia por `projectClosingChain`. */
  isCurrentClosingVersion?: boolean;
  /** Dimensões cujas naturezas representam frequência, declaradas por cadastro. */
  attendanceDimensionKindIds?: readonly string[];
  /** Fatos não dimensionais de frequência, declarados por cadastro. */
  attendanceFactIds?: readonly string[];
  /** Naturezas de fonte que representam deliberação colegiada. */
  deliberationSourceKinds?: readonly string[];
  /** Estados de diagnóstico que constituem pendência publicável. */
  issueStatuses?: readonly string[];
  /** Natureza usada quando o escopo do fato não declara dimensão alguma. */
  undeclaredDimensionKindId?: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
};

const DEFAULT_ISSUE_STATUSES = ["nao-satisfeito", "inconclusivo", "erro-configuracao"] as const;

const UNDECLARED_DIMENSION_KIND = "dimensao-nao-declarada";

// ------------------------------------------------------------------- Escopo

/**
 * Escopo declarado em pares `chave=valor` separados por `|`. Chaves são abertas:
 * o projetor não possui vocabulário próprio. Quando não há pares, o escopo
 * inteiro é preservado como chave opaca.
 */
export function parseProjectionScope(scopeKey: string | undefined): ProjectionScopeReference {
  if (!scopeKey) return { dimensions: {} };
  const entries = scopeKey
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index > 0
        ? ([part.slice(0, index).trim(), part.slice(index + 1).trim()] as const)
        : null;
    })
    .filter((pair): pair is readonly [string, string] => pair !== null);
  return {
    scopeKey,
    dimensions: Object.fromEntries(entries),
  };
}

/**
 * Remove do escopo, POR VALOR, as chaves que apenas repetem o contexto
 * (estudante, turma, ciclo). Comparação por valor evita que o projetor adote
 * qualquer vocabulário de nomes de chave.
 */
const dimensionalPart = (
  scope: ProjectionScopeReference,
  context: readonly (string | undefined)[],
): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(
    Object.entries(scope.dimensions).filter(([, value]) => !context.includes(value)),
  );

const toProjectionFact = (
  fact: ClosingMaterializedFact,
  scope: ProjectionScopeReference,
): ProjectionFact => ({
  factId: fact.factId,
  ...(fact.label ? { labelSnapshot: fact.label } : {}),
  value: fact.value ?? null,
  ...(fact.unit ? { unit: fact.unit } : {}),
  ...(fact.unavailableReason ? { unavailableReason: fact.unavailableReason } : {}),
  scopeReference: scope,
  provenance: fact.provenance,
});

const toSourceReference = (source: ClosingSourceReference): ProjectionSourceReference => ({
  kind: source.kind,
  id: source.id,
  ...(source.version !== undefined ? { version: source.version } : {}),
  ...(source.state ? { state: source.state } : {}),
  ...(source.label ? { labelSnapshot: source.label } : {}),
  ...(source.materializedAt ? { materializedAt: source.materializedAt } : {}),
});

// --------------------------------------------------------------- Dimensões

type GroupedFacts = {
  dimensions: AcademicDimensionProjection[];
  facts: ProjectionFact[];
};

/**
 * Agrupa fatos materializados por dimensão declarada. Uma dimensão inédita —
 * desconhecida hoje pelo projetor — aparece publicada sem qualquer alteração
 * deste arquivo.
 */
function groupFacts(
  facts: readonly ClosingMaterializedFact[],
  context: readonly (string | undefined)[],
  options: ProjectionOptions,
): GroupedFacts {
  const dimensionMap = new Map<string, AcademicDimensionProjection & { facts: ProjectionFact[] }>();
  const loose: ProjectionFact[] = [];

  for (const fact of facts) {
    const scope = parseProjectionScope(fact.scopeKey);
    const dimensional = dimensionalPart(scope, context);
    const entries = Object.entries(dimensional).filter(([, value]) => value !== undefined) as [
      string,
      string,
    ][];

    if (entries.length === 0) {
      loose.push(toProjectionFact(fact, scope));
      continue;
    }

    const last = entries[entries.length - 1]!;
    const parent = entries.length > 1 ? entries[entries.length - 2]! : undefined;
    const dimensionKindId = last[0];
    const dimensionId = last[1];
    const key = entries.map(([k, v]) => `${k}=${v}`).join("|");

    const existing = dimensionMap.get(key);
    if (existing) {
      existing.facts.push(toProjectionFact(fact, scope));
      continue;
    }

    dimensionMap.set(key, {
      dimensionId,
      dimensionKindId:
        dimensionKindId ||
        options.undeclaredDimensionKindId ||
        UNDECLARED_DIMENSION_KIND,
      ...(parent ? { parentDimensionId: parent[1] } : {}),
      ...(fact.label ? {} : {}),
      scopeReference: { ...(scope.scopeKey ? { scopeKey: key } : {}), dimensions: dimensional },
      facts: [toProjectionFact(fact, scope)],
    });
  }

  return { dimensions: [...dimensionMap.values()], facts: loose };
}

const splitAttendance = (
  grouped: GroupedFacts,
  options: ProjectionOptions,
): { dimensions: AcademicDimensionProjection[]; attendance: AcademicAttendanceProjection; facts: ProjectionFact[] } => {
  const attendanceKinds = options.attendanceDimensionKindIds ?? [];
  const attendanceFactIds = options.attendanceFactIds ?? [];
  const attendanceDimensions = grouped.dimensions.filter((dimension) =>
    attendanceKinds.includes(dimension.dimensionKindId),
  );
  const otherDimensions = grouped.dimensions.filter(
    (dimension) => !attendanceKinds.includes(dimension.dimensionKindId),
  );
  const attendanceFacts = grouped.facts.filter((fact) => attendanceFactIds.includes(fact.factId));
  const otherFacts = grouped.facts.filter((fact) => !attendanceFactIds.includes(fact.factId));
  return {
    dimensions: otherDimensions,
    attendance: { facts: attendanceFacts, dimensions: attendanceDimensions },
    facts: otherFacts,
  };
};

// -------------------------------------------------------------- Pendências

const diagnosisIssues = (
  diagnoses: readonly RequirementDiagnosis[],
  scope: ProjectionScopeReference,
  prefix: string,
  options: ProjectionOptions,
): AcademicProjectionIssue[] => {
  const statuses = options.issueStatuses ?? DEFAULT_ISSUE_STATUSES;
  return diagnoses
    .filter((diagnosis) => statuses.includes(diagnosis.status))
    .map((diagnosis) => {
      const evidence = diagnosis.evidence?.[0];
      return {
        issueId: `${prefix}-${diagnosis.requirementId}`,
        issueTypeId: diagnosis.requirementId,
        status: diagnosis.status,
        scopeReference: scope,
        ...(evidence ? { sourceReference: toSourceReference(evidence) } : {}),
        ...(diagnosis.reason ? { description: diagnosis.reason } : {}),
      };
    });
};

// ---------------------------------------------------------------- Projeções

const provenanceOf = (snapshot: ClassCycleClosingSnapshot): AcademicProvenanceProjection => ({
  closingSnapshotId: snapshot.id,
  closingVersion: snapshot.version,
  policyId: snapshot.policyId,
  policyVersion: snapshot.policyVersion,
  materializedAt: snapshot.materializedAt,
  ...(snapshot.precedingClosingId ? { precedingClosingId: snapshot.precedingClosingId } : {}),
  sourceReferences: snapshot.sources.map(toSourceReference),
});

function projectStudentRecord(
  snapshot: ClassCycleClosingSnapshot,
  student: StudentCycleClosingRecord,
  options: ProjectionOptions,
  isCurrent: boolean,
): StudentAcademicCycleProjection {
  const context = [student.studentId, snapshot.classId, snapshot.cycleId, student.cycleId];
  const split = splitAttendance(groupFacts(student.facts, context, options), options);
  const scope: ProjectionScopeReference = {
    dimensions: {
      studentId: student.studentId,
      classId: snapshot.classId,
      cycleId: student.cycleId,
    },
  };
  const deliberationKinds = options.deliberationSourceKinds ?? [];

  return {
    projectionSchemaVersion: ACADEMIC_PROJECTION_SCHEMA_VERSION,
    studentId: student.studentId,
    ...(student.studentName ? { studentNameSnapshot: student.studentName } : {}),
    classId: snapshot.classId,
    cycleId: student.cycleId,
    closingSnapshotId: snapshot.id,
    closingVersion: snapshot.version,
    isCurrentClosingVersion: isCurrent,
    institutionalState: snapshot.institutionalState,
    ...(snapshot.cycleStartDate ?? options.cycleStartDate
      ? { cycleStartDate: snapshot.cycleStartDate ?? options.cycleStartDate! }
      : {}),
    ...(snapshot.cycleEndDate ?? options.cycleEndDate
      ? { cycleEndDate: snapshot.cycleEndDate ?? options.cycleEndDate! }
      : {}),
    ...(snapshot.academicYearId ? { academicYearId: snapshot.academicYearId } : {}),
    resolution: {
      ...(student.resolutionSourceTypeId ? { sourceTypeId: student.resolutionSourceTypeId } : {}),
      ...(student.terminalStandingId ? { standingId: student.terminalStandingId } : {}),
      completeness: student.completeness,
      ...(student.reason ? { reason: student.reason } : {}),
    },
    dimensions: split.dimensions,
    attendance: split.attendance,
    facts: split.facts,
    deliberations: student.sources
      .filter((source) => deliberationKinds.includes(source.kind))
      .map(toSourceReference),
    issues: diagnosisIssues(student.diagnoses, scope, `pend-${student.studentId}`, options),
    provenance: provenanceOf(snapshot),
  };
}

/** Projeta a turma/ciclo a partir do snapshot oficial da 12K. */
export function projectClassCycle(
  snapshot: ClassCycleClosingSnapshot,
  options: ProjectionOptions = {},
): ClassAcademicCycleProjection {
  const isCurrent = options.isCurrentClosingVersion ?? true;
  const context = [snapshot.classId, snapshot.cycleId];
  const split = splitAttendance(groupFacts(snapshot.facts, context, options), options);
  const scope: ProjectionScopeReference = {
    dimensions: { classId: snapshot.classId, cycleId: snapshot.cycleId },
  };

  return {
    projectionSchemaVersion: ACADEMIC_PROJECTION_SCHEMA_VERSION,
    closingSnapshotId: snapshot.id,
    closingVersion: snapshot.version,
    ...(snapshot.precedingClosingId ? { precedingClosingId: snapshot.precedingClosingId } : {}),
    isCurrentClosingVersion: isCurrent,
    classId: snapshot.classId,
    cycleId: snapshot.cycleId,
    ...(snapshot.unitId ? { unitId: snapshot.unitId } : {}),
    ...(snapshot.academicYearId ? { academicYearId: snapshot.academicYearId } : {}),
    ...(snapshot.cycleStartDate ?? options.cycleStartDate
      ? { cycleStartDate: snapshot.cycleStartDate ?? options.cycleStartDate! }
      : {}),
    ...(snapshot.cycleEndDate ?? options.cycleEndDate
      ? { cycleEndDate: snapshot.cycleEndDate ?? options.cycleEndDate! }
      : {}),
    institutionalState: snapshot.institutionalState,
    act: {
      actId: snapshot.act.id,
      kindId: snapshot.act.kindId,
      kindLabelSnapshot: snapshot.act.kindLabel,
      declaredAt: snapshot.act.declaredAt,
      declaredByActorId: snapshot.act.declaredBy.actorId,
      declaredByActorNameSnapshot: snapshot.act.declaredBy.actorName,
      ...(snapshot.act.justification ? { justification: snapshot.act.justification } : {}),
      ...(snapshot.act.supersedesClosingId
        ? { supersedesClosingId: snapshot.act.supersedesClosingId }
        : {}),
    },
    diagnosisSummary: {
      statusCounts: snapshot.diagnosis.counts,
      applicableMandatory: snapshot.diagnosis.applicableMandatory,
      satisfiedMandatory: snapshot.diagnosis.satisfiedMandatory,
      closable: snapshot.diagnosis.closable,
    },
    students: snapshot.students.map((student) =>
      projectStudentRecord(snapshot, student, options, isCurrent),
    ),
    dimensions: split.dimensions,
    attendance: split.attendance,
    facts: split.facts,
    issues: diagnosisIssues(
      snapshot.diagnosis.classRequirements,
      scope,
      `pend-${snapshot.classId}`,
      options,
    ),
    provenance: provenanceOf(snapshot),
  };
}

/** Projeta o percurso individual publicado por um encerramento. */
export function projectStudentCycle(
  snapshot: ClassCycleClosingSnapshot,
  studentId: string,
  options: ProjectionOptions = {},
): StudentAcademicCycleProjection | null {
  const student = snapshot.students.find((item) => item.studentId === studentId);
  if (!student) return null;
  return projectStudentRecord(snapshot, student, options, options.isCurrentClosingVersion ?? true);
}

/**
 * Projeta a cadeia completa de encerramentos. A VIGÊNCIA É DERIVADA: a maior
 * versão da cadeia é a vigente; as anteriores permanecem publicadas como
 * históricas, sem alteração de conteúdo.
 */
export function projectClosingChain(
  snapshots: readonly ClassCycleClosingSnapshot[],
  options: ProjectionOptions = {},
): readonly ClassAcademicCycleProjection[] {
  const ordered = snapshots.slice().sort((a, b) => a.version - b.version);
  const currentByScope = new Map<string, number>();
  for (const snapshot of ordered) {
    const key = `${snapshot.classId}|${snapshot.cycleId}`;
    const highest = currentByScope.get(key);
    if (highest === undefined || snapshot.version > highest)
      currentByScope.set(key, snapshot.version);
  }
  return ordered.map((snapshot) =>
    projectClassCycle(snapshot, {
      ...options,
      isCurrentClosingVersion:
        currentByScope.get(`${snapshot.classId}|${snapshot.cycleId}`) === snapshot.version,
    }),
  );
}

// ------------------------------------------------- Helpers de conveniência
// Conveniência para consumidores; a representação canônica permanece aberta.

export const findProjectionFact = (
  facts: readonly ProjectionFact[],
  factId: string,
): ProjectionFact | undefined => facts.find((fact) => fact.factId === factId);

/** `null` quando o fato não existe ou está indisponível. Nunca zero. */
export const numericProjectionFact = (
  facts: readonly ProjectionFact[],
  factId: string,
): number | null => {
  const fact = findProjectionFact(facts, factId);
  if (!fact || fact.value === null) return null;
  return typeof fact.value === "number" ? fact.value : null;
};

export const dimensionsOfKind = (
  dimensions: readonly AcademicDimensionProjection[],
  dimensionKindId: string,
): readonly AcademicDimensionProjection[] =>
  dimensions.filter((dimension) => dimension.dimensionKindId === dimensionKindId);

export const issuesOfType = (
  issues: readonly AcademicProjectionIssue[],
  issueTypeId: string,
): readonly AcademicProjectionIssue[] =>
  issues.filter((issue) => issue.issueTypeId === issueTypeId);
