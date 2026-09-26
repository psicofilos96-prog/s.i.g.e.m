/**
 * Etapa 12K — fatos analíticos atômicos do encerramento (para o futuro CIECE).
 *
 * Proveniência, não interpretação (ajuste 8): IDs de política e versões, IDs de
 * fontes, origem da resolução, versão do encerramento, datas, dimensão quando
 * aplicável, indicador de deliberação, indicador de retificação e estado de
 * completude. NENHUMA taxa de aprovação, reprovação ou abandono é calculada
 * aqui — indicadores são construídos depois, pelo motor analítico do CIECE.
 */
import type { ClassCycleClosingSnapshot } from "./cycle-closing-types";

export type ClosingAnalyticRow = {
  rowId: string;
  category: "encerramento-turma" | "encerramento-percurso";
  dimensions: Record<string, string | number | boolean | null>;
  at: string;
  provenance: Record<string, string | number | boolean | null>;
};

export function closingAnalyticRows(
  snapshots: readonly ClassCycleClosingSnapshot[],
): ClosingAnalyticRow[] {
  const rows: ClosingAnalyticRow[] = [];

  for (const snapshot of snapshots) {
    rows.push({
      rowId: `fat-turma-${snapshot.id}`,
      category: "encerramento-turma",
      dimensions: {
        closingId: snapshot.id,
        version: snapshot.version,
        precedingClosingId: snapshot.precedingClosingId ?? null,
        classId: snapshot.classId,
        cycleId: snapshot.cycleId,
        unitId: snapshot.unitId ?? null,
        academicYearId: snapshot.academicYearId ?? null,
        institutionalState: snapshot.institutionalState,
        actKindId: snapshot.act.kindId,
        students: snapshot.students.length,
        applicableMandatory: snapshot.diagnosis.applicableMandatory,
        satisfiedMandatory: snapshot.diagnosis.satisfiedMandatory,
        rectified: Boolean(snapshot.act.supersedesClosingId),
      },
      at: snapshot.act.declaredAt,
      provenance: {
        policyId: snapshot.policyId,
        policyVersion: snapshot.policyVersion,
        declaredBy: snapshot.act.declaredBy.actorId,
        materializedAt: snapshot.materializedAt,
        sources: snapshot.sources.length,
        sourceIds: snapshot.sources.map((source) => `${source.kind}:${source.id}`).join(" "),
      },
    });

    for (const student of snapshot.students)
      rows.push({
        rowId: `fat-percurso-${snapshot.id}-${student.studentId}`,
        category: "encerramento-percurso",
        dimensions: {
          closingId: snapshot.id,
          version: snapshot.version,
          classId: snapshot.classId,
          cycleId: student.cycleId,
          studentId: student.studentId,
          unitId: snapshot.unitId ?? null,
          institutionalState: snapshot.institutionalState,
          resolutionSourceTypeId: student.resolutionSourceTypeId ?? null,
          terminalStandingId: student.terminalStandingId ?? null,
          completeness: student.completeness,
          deliberated: student.sources.some((source) => source.kind === "deliberacao"),
          rectified: Boolean(snapshot.act.supersedesClosingId),
        },
        at: snapshot.act.declaredAt,
        provenance: {
          policyId: snapshot.policyId,
          policyVersion: snapshot.policyVersion,
          sources: student.sources.length,
          sourceIds: student.sources
            .map(
              (source) =>
                `${source.kind}:${source.id}${source.version !== undefined ? `@v${source.version}` : ""}`,
            )
            .join(" "),
          facts: student.facts.length,
          materializedAt: snapshot.materializedAt,
        },
      });
  }

  return rows;
}
