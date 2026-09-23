import { Link, useNavigate } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getClassUnitName } from "@/features/classes/classes-data";
import { getDemonstrationUnit } from "@/features/units/units-data";
import { ReferenceDateField } from "./lifecycle-widgets";
import { ScheduleWeekView } from "./schedule-week-view";
import {
  INTEGRATION_CALENDAR_NOTE,
  INTEGRATION_SOURCE_NOTE,
  SCHEDULE_INTEGRATION_REFERENCE_DATE,
  conflictsForUnit,
  normalizeReferenceDate,
  referenceSearch,
  unitProjection,
} from "./schedule-integration";
import { scheduleSituationTone } from "./schedules-data";

export function UnitSchedulePage({
  unitId,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
}: {
  unitId: string;
  referenceDate?: string;
}) {
  const navigate = useNavigate();
  const unit = getDemonstrationUnit(unitId);
  if (!unit)
    return (
      <EmptyState
        title="Unidade não encontrada"
        description="O identificador não corresponde às unidades fictícias disponíveis."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios">Voltar</Link>
          </Button>
        }
      />
    );
  const date = normalizeReferenceDate(referenceDate);
  const search = referenceSearch(date);
  const projections = unitProjection(unitId, date);
  const conflicts = conflictsForUnit(unitId, date);
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={unit.currentName}
        description="Jornadas e grades da unidade escolar"
        parent={{ label: "Horários", to: "/horarios" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/unidades/$id" params={{ id: unit.id }}>
                Detalhes da unidade
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/unidades/$unidadeId/impressao"
                params={{ unidadeId: unit.id }}
                search={search}
              >
                <Printer /> Imprimir
              </Link>
            </Button>
          </>
        }
      />
      <ReferenceDateField
        value={date}
        onChange={(value) =>
          void navigate({
            to: "/horarios/unidades/$unidadeId",
            params: { unidadeId: unit.id },
            search: value ? { data: value } : {},
          })
        }
        context={`Quadro da unidade projetado em ${date}. ${INTEGRATION_SOURCE_NOTE}`}
      />
      <DetailSection
        title="Contexto da unidade"
        description="Unidade escolar não é sinônimo de prédio, anexo ou contexto físico."
      >
        <DefinitionList
          items={[
            {
              term: "Identificador",
              detail: <span className="font-mono">{unit.internalIdentifier}</span>,
            },
            { term: "Situação", detail: unit.operationalSituation },
            { term: "Turmas com grade registrada", detail: String(projections.length) },
            {
              term: "Grades vigentes nesta data",
              detail: String(projections.filter((item) => item.effective).length),
            },
            {
              term: "Responsabilidade",
              detail:
                "A responsabilidade pela elaboração varia por unidade e etapa; o responsável não foi presumido.",
            },
          ]}
        />
      </DetailSection>
      {conflicts.length ? (
        <StatePanel
          tone="warning"
          title={`${conflicts.length} conflito(s) potencial(is) relacionado(s)`}
          description={`A detecção considera a identidade da Pessoa em toda a rede, inclusive outras escolas. A unidade não é considerada responsável automaticamente. ${conflicts
            .map((item) => item.explanation)
            .join(" ")}`}
        />
      ) : null}
      <DetailSection
        title="Grades da unidade"
        description="Recortes independentes por turma e período letivo, na versão efetiva da data de referência."
      >
        {projections.length ? (
          <div className="space-y-7">
            {projections.map((projection) => (
              <section key={projection.classId}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      <Link
                        to="/horarios/turmas/$turmaId"
                        params={{ turmaId: projection.classId }}
                        search={search}
                        className="hover:text-primary hover:underline"
                      >
                        {projection.klass?.name ?? projection.classId}
                      </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {projection.periodLabel} ·{" "}
                      {projection.displayed?.version ?? "Sem versão"} · {projection.source}
                    </p>
                  </div>
                  <StatusBadge tone={scheduleSituationTone(projection.situation)}>
                    {projection.situation}
                  </StatusBadge>
                </div>
                {projection.blocks.length ? (
                  <ScheduleWeekView
                    schedule={projection.weekView}
                    label={`Grade de ${projection.klass?.name ?? projection.classId} vigente em ${date}`}
                  />
                ) : (
                  <EmptyState
                    compact
                    title="Sem distribuição nesta data"
                    description="Ausência de grade vigente não é erro; a turma pode ter apenas jornada declarada."
                  />
                )}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            title="Nenhuma grade disponível"
            description="Nenhuma distribuição semanal foi demonstrada para esta unidade."
          />
        )}
      </DetailSection>
      <StatePanel tone="info" title="Calendário escolar" description={INTEGRATION_CALENDAR_NOTE} />
      <p className="text-xs text-muted-foreground">
        Consulta de {getClassUnitName(unitId)} sem edição, publicação ou persistência real.
      </p>
    </div>
  );
}
