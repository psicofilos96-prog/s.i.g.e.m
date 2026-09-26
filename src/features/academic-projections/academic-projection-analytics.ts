/**
 * Etapa 12L — ADAPTADOR tabular da projeção canônica (para o futuro CIECE).
 *
 * Hierarquia arquitetural obrigatória:
 *   projeção acadêmica rica (contrato primário) → adaptador tabular (derivado)
 *
 * O formato tabular nunca limita o modelo canônico: o Gerador Universal de
 * Relatórios trabalhará com fatos, dimensões e relacionamentos mais ricos do que
 * uma tabela única. Nenhuma taxa, índice ou indicador é calculado aqui.
 */
import type {
  ClassAcademicCycleProjection,
  ProjectionFact,
  StudentAcademicCycleProjection,
} from "./academic-projection-types";

export type ProjectionAnalyticRow = {
  rowId: string;
  category: string;
  dimensions: Record<string, string | number | boolean | null>;
  at: string;
  provenance: Record<string, string | number | boolean | null>;
};

/** Achata apenas o TRANSPORTE tabular; `null` continua `null`, nunca zero. */
const flatValue = (
  value: ProjectionFact["value"],
): string | number | boolean | null =>
  value === null ? null : Array.isArray(value) ? value.join(" ") : (value as string | number | boolean);

const sourceIds = (projection: ClassAcademicCycleProjection | StudentAcademicCycleProjection) =>
  projection.provenance.sourceReferences
    .map((source) => `${source.kind}:${source.id}${source.version !== undefined ? `@v${source.version}` : ""}`)
    .join(" ");

/** Linhas atômicas derivadas exclusivamente das projeções canônicas. */
export function projectToAnalyticRows(
  projections: readonly ClassAcademicCycleProjection[],
): ProjectionAnalyticRow[] {
  const rows: ProjectionAnalyticRow[] = [];

  for (const projection of projections) {
    rows.push({
      rowId: `fat-turma-${projection.closingSnapshotId}`,
      category: "encerramento-turma",
      dimensions: {
        closingId: projection.closingSnapshotId,
        version: projection.closingVersion,
        precedingClosingId: projection.precedingClosingId ?? null,
        isCurrentClosingVersion: projection.isCurrentClosingVersion,
        classId: projection.classId,
        cycleId: projection.cycleId,
        unitId: projection.unitId ?? null,
        academicYearId: projection.academicYearId ?? null,
        cycleStartDate: projection.cycleStartDate ?? null,
        cycleEndDate: projection.cycleEndDate ?? null,
        institutionalState: projection.institutionalState,
        actKindId: projection.act.kindId,
        students: projection.students.length,
        applicableMandatory: projection.diagnosisSummary.applicableMandatory,
        satisfiedMandatory: projection.diagnosisSummary.satisfiedMandatory,
        openIssues: projection.issues.length,
        rectified: Boolean(projection.act.supersedesClosingId),
      },
      at: projection.act.declaredAt,
      provenance: {
        projectionSchemaVersion: projection.projectionSchemaVersion,
        policyId: projection.provenance.policyId,
        policyVersion: projection.provenance.policyVersion,
        declaredBy: projection.act.declaredByActorId,
        materializedAt: projection.provenance.materializedAt,
        sources: projection.provenance.sourceReferences.length,
        sourceIds: sourceIds(projection),
      },
    });

    for (const student of projection.students) {
      rows.push({
        rowId: `fat-percurso-${projection.closingSnapshotId}-${student.studentId}`,
        category: "encerramento-percurso",
        dimensions: {
          closingId: projection.closingSnapshotId,
          version: student.closingVersion,
          isCurrentClosingVersion: student.isCurrentClosingVersion,
          classId: student.classId,
          cycleId: student.cycleId,
          studentId: student.studentId,
          unitId: projection.unitId ?? null,
          institutionalState: student.institutionalState,
          resolutionSourceTypeId: student.resolution.sourceTypeId ?? null,
          terminalStandingId: student.resolution.standingId ?? null,
          completeness: student.resolution.completeness,
          deliberated: student.deliberations.length > 0,
          openIssues: student.issues.length,
          dimensionCount: student.dimensions.length,
          attendanceDimensionCount: student.attendance.dimensions.length,
          rectified: Boolean(projection.act.supersedesClosingId),
        },
        at: projection.act.declaredAt,
        provenance: {
          projectionSchemaVersion: student.projectionSchemaVersion,
          policyId: student.provenance.policyId,
          policyVersion: student.provenance.policyVersion,
          sources: student.provenance.sourceReferences.length,
          sourceIds: sourceIds(student),
          facts: student.facts.length,
          materializedAt: student.provenance.materializedAt,
        },
      });

      // Uma linha por dimensão e por fato: dimensionalidade preservada.
      for (const dimension of [...student.dimensions, ...student.attendance.dimensions])
        for (const fact of dimension.facts)
          rows.push({
            rowId: `fat-dimensao-${projection.closingSnapshotId}-${student.studentId}-${dimension.dimensionKindId}-${dimension.dimensionId}-${fact.factId}`,
            category: "fato-dimensional",
            dimensions: {
              closingId: projection.closingSnapshotId,
              version: student.closingVersion,
              classId: student.classId,
              cycleId: student.cycleId,
              studentId: student.studentId,
              dimensionKindId: dimension.dimensionKindId,
              dimensionId: dimension.dimensionId,
              parentDimensionId: dimension.parentDimensionId ?? null,
              factId: fact.factId,
              value: flatValue(fact.value),
              unit: fact.unit ?? null,
              unavailableReason: fact.unavailableReason ?? null,
            },
            at: projection.act.declaredAt,
            provenance: {
              projectionSchemaVersion: student.projectionSchemaVersion,
              policyId: student.provenance.policyId,
              policyVersion: student.provenance.policyVersion,
              algorithm: fact.provenance.algorithm,
              materializedAt: fact.provenance.materializedAt,
            },
          });

      for (const issue of student.issues)
        rows.push({
          rowId: `fat-pendencia-${projection.closingSnapshotId}-${issue.issueId}`,
          category: "pendencia",
          dimensions: {
            closingId: projection.closingSnapshotId,
            classId: student.classId,
            cycleId: student.cycleId,
            studentId: student.studentId,
            issueId: issue.issueId,
            issueTypeId: issue.issueTypeId,
            status: issue.status,
            sourceKind: issue.sourceReference?.kind ?? null,
            sourceId: issue.sourceReference?.id ?? null,
          },
          at: projection.act.declaredAt,
          provenance: {
            projectionSchemaVersion: student.projectionSchemaVersion,
            policyId: student.provenance.policyId,
            policyVersion: student.provenance.policyVersion,
            materializedAt: student.provenance.materializedAt,
          },
        });
    }
  }

  return rows;
}
