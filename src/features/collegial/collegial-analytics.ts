/**
 * Etapa 12J — fatos analíticos atômicos das deliberações (para o futuro CIECE).
 *
 * Aqui NÃO existem indicadores, taxas, gráficos nem relatórios. Produzimos
 * apenas linhas atômicas com IDs estáveis, dimensões, temporalidade,
 * proveniência e versão — o motor analítico do CIECE constrói os indicadores
 * depois, a partir destes fatos.
 */
import type {
  CollegialDeliberation,
  CollegialSession,
  StructuredMinute,
} from "./collegial-types";

export type CollegialAnalyticRow = {
  rowId: string;
  category: "sessao" | "pauta" | "deliberacao" | "ata";
  /** Dimensões abertas: chave → identificador estável. */
  dimensions: Record<string, string | number | boolean | null>;
  at: string;
  provenance: Record<string, string | number | null>;
};

export function collegialAnalyticRows(input: {
  sessions: readonly CollegialSession[];
  deliberations: readonly CollegialDeliberation[];
  minutes: readonly StructuredMinute[];
}): CollegialAnalyticRow[] {
  const rows: CollegialAnalyticRow[] = [];

  for (const session of input.sessions) {
    rows.push({
      rowId: `ses-${session.id}`,
      category: "sessao",
      dimensions: {
        sessionId: session.id,
        bodyId: session.bodyId,
        bodyConfigurationVersion: session.bodyConfigurationVersion,
        natureId: session.natureId,
        unitId: session.scope.unitId ?? null,
        classId: session.scope.classId ?? null,
        cycleId: session.scope.cycleId ?? null,
        academicYearId: session.scope.academicYearId ?? null,
        state: session.state,
        participantsPresent: session.participants.filter((item) => item.present).length,
        participantsAbsent: session.participants.filter((item) => !item.present).length,
        agendaItems: session.agenda.length,
      },
      at: session.scheduledFor,
      provenance: { createdBy: session.createdBy.actorId, createdAt: session.createdBy.at },
    });

    for (const item of session.agenda)
      rows.push({
        rowId: `pau-${session.id}-${item.id}`,
        category: "pauta",
        dimensions: {
          sessionId: session.id,
          agendaItemId: item.id,
          bodyId: session.bodyId,
          subjectKind: item.subject.kind,
          studentId: item.subject.studentId ?? null,
          cycleId: session.scope.cycleId ?? null,
          classId: session.scope.classId ?? null,
          originKind: item.origin.kind,
          originRuleSetId:
            item.origin.kind === "encaminhamento-por-regra" ? item.origin.ruleSetId : null,
          originRuleSetVersion:
            item.origin.kind === "encaminhamento-por-regra" ? item.origin.ruleSetVersion : null,
          originReasonId: item.origin.kind === "provocacao-formal" ? item.origin.reasonId : null,
        },
        at: session.scheduledFor,
        provenance: {
          dossierSnapshotAt: item.dossier?.referenceSnapshotAt ?? null,
          dossierSources: item.dossier?.sources.length ?? 0,
        },
      });
  }

  for (const deliberation of input.deliberations)
    rows.push({
      rowId: `del-${deliberation.id}`,
      category: "deliberacao",
      dimensions: {
        deliberationId: deliberation.id,
        sessionId: deliberation.sessionId,
        agendaItemId: deliberation.agendaItemId,
        bodyId: deliberation.bodyId,
        competenceId: deliberation.competenceId,
        studentId: deliberation.studentId ?? null,
        cycleId: deliberation.cycleId ?? null,
        scopeKey: deliberation.scopeKey ?? null,
        /** Camada 1 preservada: resultado calculado antes da deliberação. */
        computedStandingId: deliberation.dossier.computed?.standingId ?? null,
        computedOperationalState: deliberation.dossier.computed?.operationalState ?? null,
        /** Camada 3: situação resultante da decisão, quando houver. */
        resultingStandingId: deliberation.decision.standingId ?? null,
        outcomeId: deliberation.decision.outcomeId,
        decisionMethodId: deliberation.decisionMethodId ?? null,
        votesRecorded: deliberation.votes?.length ?? 0,
      },
      at: deliberation.at,
      provenance: {
        actorId: deliberation.actor.actorId,
        ruleSetId: deliberation.dossier.computed?.ruleSetId ?? null,
        ruleSetVersion: deliberation.dossier.computed?.ruleSetVersion ?? null,
        dossierSnapshotAt: deliberation.dossier.referenceSnapshotAt,
        dossierSources: deliberation.dossier.sources.length,
      },
    });

  for (const minute of input.minutes)
    rows.push({
      rowId: `ata-${minute.id}`,
      category: "ata",
      dimensions: {
        minuteId: minute.id,
        sessionId: minute.sessionId,
        version: minute.version,
        precedingMinuteId: minute.precedingMinuteId ?? null,
        bodyId: minute.bodyId,
        natureId: minute.natureId,
        quorumPolicyId: minute.quorum.policyId ?? null,
        quorumSatisfied: minute.quorum.satisfied,
        deliberations: minute.deliberations.length,
        statements: minute.statements.length,
        signatures: minute.signatures.length,
        rectified: Boolean(minute.rectification),
      },
      at: minute.closedAt,
      provenance: {
        closedBy: minute.closedBy.actorId,
        supersedesMinuteId: minute.rectification?.supersedesMinuteId ?? null,
      },
    });

  return rows;
}
