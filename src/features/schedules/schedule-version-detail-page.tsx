import { Link } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  AuditTimeline,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  FutureCapabilitiesPanel,
  OperationalStatesPanel,
  ScheduleBlocksView,
  VersionIdentity,
} from "./lifecycle-widgets";
import {
  LIFECYCLE_REFERENCE_DATE,
  effectiveVersionFor,
  getVersionRecord,
  lifecycleStateTone,
  networkConflicts,
} from "./schedule-lifecycle";

/** Detalhe da versão — /horarios/turmas/$turmaId/versoes/$versaoId. */
export function ScheduleVersionDetailPage({
  classId,
  versionId,
  referenceDate = LIFECYCLE_REFERENCE_DATE,
}: {
  classId: string;
  versionId: string;
  referenceDate?: string;
}) {
  const klass = getDemonstrationClass(classId);
  const record = getVersionRecord(versionId);
  const effective = effectiveVersionFor(classId, referenceDate);

  if (!klass || !record || record.classId !== classId)
    return (
      <EmptyState
        title="Versão não encontrada"
        description="O identificador não corresponde às versões demonstrativas desta turma."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
              Voltar ao histórico
            </Link>
          </Button>
        }
      />
    );

  const readOnly =
    record.state === "Histórica" || record.state === "Substituída" || record.state === "Publicada";
  const conflicts = networkConflicts(classId, record.blocks, referenceDate);

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`${record.version} — ${klass.name}`}
        description="Grade exatamente como representada nesta versão demonstrativa; nada é reconstruído com dados atuais."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/turmas/$turmaId/versoes/$versaoId/comparar"
                params={{ turmaId: classId, versaoId: record.id }}
              >
                Comparar versões
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId"
                params={{ turmaId: classId, tipo: "versao", referenciaId: record.id }}
              >
                Imprimir versão
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <StatusBadge tone={lifecycleStateTone(record.state)}>{record.state}</StatusBadge>
        {readOnly ? <StatusBadge tone="neutral">Somente leitura</StatusBadge> : null}
        {effective?.id === record.id ? (
          <StatusBadge tone="success">Efetiva em {LIFECYCLE_REFERENCE_DATE}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Não efetiva em {LIFECYCLE_REFERENCE_DATE}</StatusBadge>
        )}
      </div>
      {record.incompleteFields?.length ? (
        <StatePanel
          tone="warning"
          title="Dados históricos incompletos"
          description={record.incompleteFields.join(" ")}
        />
      ) : null}
      <DetailSection title="Identificação">
        <VersionIdentity record={record} />
      </DetailSection>
      <DetailSection
        title="Grade da versão"
        description="Retrato próprio da versão; alterações posteriores não são aplicadas retroativamente."
      >
        <ScheduleBlocksView record={record} label={`Grade da ${record.version}`} />
      </DetailSection>
      {record.rectifications.length ? (
        <DetailSection
          title="Retificações desta versão"
          description="A identificação da versão principal é preservada e o conteúdo anterior não é apagado."
        >
          <AuditTimeline
            label="Retificações da versão"
            items={record.rectifications.map((item) => ({
              id: item.id,
              title: `${item.kind} · ${item.operationReference}`,
              description: `${item.justification} Antes: ${formatAcademicDate(item.before.start)}–${formatAcademicDate(item.before.end)}. Depois: ${formatAcademicDate(item.after.start)}–${formatAcademicDate(item.after.end)}.`,
              meta: item.author,
              timestamp: `Efeito desde ${formatAcademicDate(item.effectFrom)}`,
            }))}
          />
        </DetailSection>
      ) : null}
      {record.supersededBy ? (
        <StatePanel
          tone="info"
          title="Versão substituída"
          description={`Substituída por ${getVersionRecord(record.supersededBy)?.version ?? record.supersededBy}, preservada integralmente nesta consulta.`}
        />
      ) : null}
      {conflicts.length ? (
        <StatePanel
          tone="warning"
          title="Conflitos temporais potenciais nesta versão"
          description={conflicts.map((item) => item.detail).join(" ")}
        />
      ) : null}
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
