import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Printer } from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getClassOffer, getDemonstrationClass } from "@/features/classes/classes-data";
import { ReferenceDateField } from "./lifecycle-widgets";
import { ScheduleWeekView } from "./schedule-week-view";
import { SchoolJourneyPanel } from "./school-journey-panel";
import {
  LIFECYCLE_REFERENCE_NOTE,
  lifecycleStateTone,
  referenceContextLabel,
  versionsForClass,
} from "./schedule-lifecycle";
import {
  INTEGRATION_CALENDAR_NOTE,
  INTEGRATION_HISTORY_NOTE,
  INTEGRATION_IDENTITY_NOTE,
  INTEGRATION_SOURCE_NOTE,
  SCHEDULE_INTEGRATION_REFERENCE_DATE,
  classProjection,
  conflictsForClass,
  coresponsibilityBlocksOf,
  pendingRectifications,
  referenceSearch,
} from "./schedule-integration";
import { SCHEDULE_DEMONSTRATION_NOTE, scheduleSituationTone } from "./schedules-data";

export function ClassScheduleDetailPage({
  classId,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
}: {
  classId: string;
  referenceDate?: string;
}) {
  const navigate = useNavigate();
  const klass = getDemonstrationClass(classId);
  if (!klass)
    return (
      <EmptyState
        title="Turma não encontrada"
        description="O identificador não corresponde às turmas fictícias disponíveis."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas">Voltar</Link>
          </Button>
        }
      />
    );
  const projection = classProjection(classId, referenceDate);
  const date = projection.referenceDate;
  const search = referenceSearch(date);
  const offer = getClassOffer(klass.offerId);
  const conflicts = conflictsForClass(classId, date);
  const coresponsibility = coresponsibilityBlocksOf(projection.blocks);
  const pending = pendingRectifications(classId, date);
  const displayedState = projection.displayed?.state ?? "Não iniciada";
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={klass.name}
        description={`${klass.code} · jornada e grade semanal demonstrativas`}
        parent={{ label: "Horários de turmas", to: "/horarios/turmas" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/turmas/$id" params={{ id: klass.id }}>
                Detalhes da turma
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/turmas/$turmaId/versoes"
                params={{ turmaId: klass.id }}
                search={search}
              >
                Versões
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId/alteracoes" params={{ turmaId: klass.id }}>
                Alterações
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId/revisar" params={{ turmaId: klass.id }}>
                Revisar
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/turmas/$turmaId/impressao"
                params={{ turmaId: klass.id }}
                search={search}
              >
                <Printer /> Imprimir
              </Link>
            </Button>
            {projection.readOnly ? null : projection.displayed ? (
              <Button asChild size="sm">
                <Link to="/horarios/turmas/$turmaId/editar" params={{ turmaId: klass.id }}>
                  Editar grade demonstrativa
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/horarios/turmas/$turmaId/nova" params={{ turmaId: klass.id }}>
                  Preparar primeira grade
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <StatusBadge tone={lifecycleStateTone(displayedState)}>{displayedState}</StatusBadge>
        <StatusBadge tone={scheduleSituationTone(projection.situation)}>
          {projection.situation}
        </StatusBadge>
        <StatusBadge tone="neutral">Período letivo: {projection.periodLabel}</StatusBadge>
        <StatusBadge tone="neutral">{projection.source}</StatusBadge>
      </div>
      <ReferenceDateField
        value={date}
        onChange={(value) =>
          void navigate({
            to: "/horarios/turmas/$turmaId",
            params: { turmaId: klass.id },
            search: value ? { data: value } : {},
          })
        }
        context={referenceContextLabel(classId, date)}
      />
      <DetailSection title="Contexto acadêmico" description={INTEGRATION_IDENTITY_NOTE}>
        <DefinitionList
          items={[
            {
              term: "Unidade",
              detail: (
                <Link
                  to="/horarios/unidades/$unidadeId"
                  params={{ unidadeId: klass.unitId }}
                  search={search}
                  className="text-primary hover:underline"
                >
                  {projection.unitName}
                </Link>
              ),
            },
            {
              term: "Oferta",
              detail: offer ? `${offer.stage} · ${offer.organization}` : "Não informada",
            },
            { term: "Organização", detail: klass.academicOrganization },
            {
              term: "Matriz aplicável registrada",
              detail: `${projection.matrixContextLabel ?? "Não informada"} · ${projection.matrixContextPeriod ?? "sem registro de aplicabilidade"}`,
            },
            { term: "Agrupamentos", detail: klass.groupings.map((item) => item.label).join("; ") },
            { term: "Turno", detail: klass.shift },
            { term: "Jornada declarada na turma", detail: klass.journey },
          ]}
        />
      </DetailSection>
      <StatePanel
        tone="info"
        title="Versão efetiva na data de referência"
        description={`${referenceContextLabel(classId, date)} ${LIFECYCLE_REFERENCE_NOTE} ${INTEGRATION_SOURCE_NOTE}`}
      />
      {projection.readOnly ? (
        <StatePanel
          tone="warning"
          title="Versão somente leitura"
          description={INTEGRATION_HISTORY_NOTE}
        />
      ) : null}
      {pending.length ? (
        <StatePanel
          tone="warning"
          title={`${pending.length} retificação(ões) com efeito futuro`}
          description={pending
            .map((item) => `${item.kind} com efeito a partir de ${item.effectFrom}.`)
            .join(" ")}
        />
      ) : null}
      {projection.future.length ? (
        <StatePanel
          tone="info"
          title="Versão com vigência futura"
          description={projection.future
            .map(
              (item) =>
                `${item.version} (${item.state}) prevista para ${item.effectiveFrom}; não é apresentada como vigente hoje.`,
            )
            .join(" ")}
        />
      ) : null}
      <SchoolJourneyPanel journey={projection.journey} />
      <DetailSection
        title="Grade semanal"
        description={`${projection.displayed?.version ?? "Sem versão"} · ${displayedState}. ${projection.source}; nenhum bloco foi gerado a partir da jornada.`}
      >
        {projection.blocks.length ? (
          <ScheduleWeekView schedule={projection.weekView} label="Grade semanal planejada" />
        ) : (
          <EmptyState
            compact
            icon={CalendarDays}
            title="Grade semanal não iniciada"
            description="A turma possui contexto acadêmico, mas nenhuma distribuição semanal está vigente nesta data de referência. Ausência de grade não é erro."
          />
        )}
      </DetailSection>
      {coresponsibility.length ? (
        <StatePanel
          tone="info"
          title={`${coresponsibility.length} bloco(s) com corresponsabilidade`}
          description="Mais de uma Pessoa no mesmo bloco é situação legítima e não constitui conflito temporal."
        />
      ) : null}
      {conflicts.length ? (
        <StatePanel
          tone="danger"
          title="Conflito temporal potencial"
          description={conflicts.map((item) => item.explanation).join(" ")}
        />
      ) : null}
      {projection.displayed ? (
        <DetailSection
          title="Versões e alterações"
          description="Alterações simples poderão ser rastreadas sem nova versão principal; mudanças importantes deverão gerar versão. Os critérios dependem de decisão institucional."
        >
          <AuditTimeline
            label="Histórico demonstrativo da grade"
            items={[...pendingHistory(classId, date)]}
            emptyMessage="Nenhuma versão foi iniciada."
          />
        </DetailSection>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <StatePanel
          tone="info"
          title="Calendário e aula ministrada"
          description={INTEGRATION_CALENDAR_NOTE}
        />
        <StatePanel
          tone="warning"
          title="Somente consulta"
          description="A publicação oficial, a autorização efetiva e a distribuição automática não fazem parte desta etapa."
        />
      </div>
      <p className="text-xs text-muted-foreground">{SCHEDULE_DEMONSTRATION_NOTE}</p>
    </div>
  );
}

/** Linha do tempo derivada das versões e retificações registradas da turma. */
function pendingHistory(classId: string, date: string) {
  const records = versionsForClass(classId);
  const versions = records.map((item) => ({
    id: item.id,
    title: `${item.version} · ${item.state}`,
    description: `${item.nature}. Vigência desde ${item.effectiveFrom}${item.effectiveUntil ? ` até ${item.effectiveUntil}` : ""}. Operação ${item.operationReference}.`,
    timestamp: item.publishedOn ?? item.preparedOn ?? item.effectiveFrom,
  }));
  const rectifications = records.flatMap((record) =>
    record.rectifications.map((item) => ({
      id: item.id,
      title: `Retificação de ${record.version} · ${item.kind}`,
      description: `${item.justification} Efeito a partir de ${item.effectFrom}${item.effectFrom > date ? " (ainda não em efeito nesta data de referência)" : ""}. A versão principal foi preservada.`,
      timestamp: item.effectFrom,
    })),
  );
  return [...versions, ...rectifications].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
