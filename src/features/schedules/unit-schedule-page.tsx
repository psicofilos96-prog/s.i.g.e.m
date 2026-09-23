import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationUnit } from "@/features/units/units-data";
import { ScheduleWeekView } from "./schedule-week-view";
import {
  detectPotentialConflicts,
  scheduleSituation,
  scheduleSituationTone,
  schedulesForUnit,
} from "./schedules-data";

export function UnitSchedulePage({ unitId }: { unitId: string }) {
  const unit = getDemonstrationUnit(unitId);
  if (!unit)
    return (
      <EmptyState
        title="Unidade não encontrada"
        description="O identificador não corresponde às unidades fictícias disponíveis."
      />
    );
  const schedules = schedulesForUnit(unitId);
  const conflicts = detectPotentialConflicts().filter((item) => item.unitIds.includes(unitId));
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
              <Link to="/horarios/unidades/$unidadeId/impressao" params={{ unidadeId: unit.id }}>
                <Printer /> Imprimir
              </Link>
            </Button>
          </>
        }
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
            { term: "Grades disponíveis", detail: String(schedules.length) },
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
          description="A detecção considera outras escolas da rede. A unidade não é considerada responsável automaticamente."
        />
      ) : null}
      <DetailSection
        title="Grades da unidade"
        description="Recortes independentes por turma e período letivo."
      >
        {schedules.length ? (
          <div className="space-y-7">
            {schedules.map((schedule) => {
              const klass = getDemonstrationClass(schedule.classId);
              const situation = scheduleSituation(schedule);
              return (
                <section key={schedule.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        <Link
                          to="/horarios/turmas/$turmaId"
                          params={{ turmaId: schedule.classId }}
                          className="hover:text-primary hover:underline"
                        >
                          {klass?.name ?? schedule.classId}
                        </Link>
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {klass?.academicPeriod.label} · {schedule.label}
                      </p>
                    </div>
                    <StatusBadge tone={scheduleSituationTone(situation)}>{situation}</StatusBadge>
                  </div>
                  <ScheduleWeekView schedule={schedule} />
                </section>
              );
            })}
          </div>
        ) : (
          <EmptyState
            compact
            title="Nenhuma grade disponível"
            description="Nenhuma distribuição semanal foi demonstrada para esta unidade."
          />
        )}
      </DetailSection>
      <p className="text-xs text-muted-foreground">
        Consulta de {getClassUnitName(unitId)} sem edição, publicação ou persistência real.
      </p>
    </div>
  );
}
