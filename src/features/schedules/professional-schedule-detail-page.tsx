import { Link, useNavigate } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import { AlertTriangle, Printer } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { currentLinks } from "@/features/professionals/professionals-data";
import { ReferenceDateField } from "./lifecycle-widgets";
import { ScheduleWeekView } from "./schedule-week-view";
import {
  INTEGRATION_IDENTITY_NOTE,
  INTEGRATION_SOURCE_NOTE,
  SCHEDULE_INTEGRATION_REFERENCE_DATE,
  personProjection,
  professionalsOfPerson,
  referenceSearch,
} from "./schedule-integration";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { SCHEDULE_AUTHORIZATION_NOTE } from "./schedules-data";

export function ProfessionalScheduleDetailPage({
  professionalId,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
}: {
  professionalId: string;
  referenceDate?: string;
}) {
  const navigate = useNavigate();
  const item = getDemonstrationProfessional(professionalId);
  if (!item)
    return (
      <EmptyState
        title="Profissional não encontrado"
        description="O identificador não corresponde aos registros fictícios disponíveis."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/profissionais">Voltar</Link>
          </Button>
        }
      />
    );
  const projection = personProjection(professionalId, referenceDate);
  const date = projection.referenceDate;
  const search = referenceSearch(date);
  const personProfessionals = professionalsOfPerson(item.personId);
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={item.personName}
        description={`${item.professionalId} · horário individual demonstrativo`}
        parent={{ label: "Horários de profissionais", to: "/horarios/profissionais" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id" params={{ id: item.id }}>
                Detalhes do profissional
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: item.id }}>
                Atuações pedagógicas
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/profissionais/$profissionalId/impressao"
                params={{ profissionalId: item.id }}
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
            to: "/horarios/profissionais/$profissionalId",
            params: { profissionalId: item.id },
            search: value ? { data: value } : {},
          })
        }
        context={`Blocos projetados a partir das atuações vigentes em ${formatAcademicDate(date)}. ${INTEGRATION_SOURCE_NOTE}`}
      />
      <DetailSection
        title="Identidade profissional mínima"
        description="Sem CPF completo, endereço, filiação, dados bancários ou médicos."
      >
        <DefinitionList
          items={[
            { term: "Pessoa", detail: item.personName },
            {
              term: "Identificador SIGEM",
              detail: <span className="font-mono">{item.professionalId}</span>,
            },
            { term: "Situação", detail: item.situation },
            { term: "Vínculos atuais", detail: String(currentLinks(item).length) },
            {
              term: "Vínculos presentes nos blocos",
              detail: projection.linkIds.length
                ? projection.linkIds.join(", ")
                : "Nenhum bloco projetado nesta data",
            },
            {
              term: "Registros de Profissional da mesma Pessoa",
              detail: personProfessionals.map((entry) => entry.professionalId).join(", "),
            },
            {
              term: "Unidades com blocos",
              detail: projection.unitIds.length
                ? String(projection.unitIds.length)
                : "Nenhuma nesta data",
            },
            {
              term: "Leitura",
              detail:
                "Vínculos, lotações, funções e cargas declaradas não foram convertidos automaticamente em blocos de horário.",
            },
          ]}
        />
      </DetailSection>
      {projection.conflicts.length ? (
        <StatePanel
          tone="danger"
          title="Conflito temporal potencial na rede"
          description={projection.conflicts.map((conflict) => conflict.explanation).join(" ")}
          action={<AlertTriangle />}
        />
      ) : (
        <StatePanel
          tone="neutral"
          title="Sem conflito identificado nos dados disponíveis"
          description="Ausência de alerta não comprova compatibilidade integral; podem faltar informações. A detecção considera a identidade da Pessoa em toda a rede."
        />
      )}
      {projection.outOfVigency.length ? (
        <StatePanel
          tone="warning"
          title={`${projection.outOfVigency.length} bloco(s) de atuação fora da vigência nesta data`}
          description={projection.outOfVigency
            .map(
              (entry) =>
                `${entry.className}: atuação ${entry.assignment.id} (${entry.assignment.role}) vigente de ${entry.assignment.start}${entry.assignment.end ? ` até ${entry.assignment.end}` : ""}; não é projetada como aula em ${date}.`,
            )
            .join(" ")}
        />
      ) : null}
      <DetailSection
        title="Grade individual consolidada"
        description={`Cada bloco mantém turma, unidade, versão, atuação e vínculo funcional. ${INTEGRATION_IDENTITY_NOTE}`}
      >
        {projection.groups.length ? (
          <div className="space-y-6">
            {projection.groups.map((group) => (
              <section key={group.classId}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      <Link
                        to="/horarios/turmas/$turmaId"
                        params={{ turmaId: group.classId }}
                        search={search}
                        className="hover:text-primary hover:underline"
                      >
                        {group.className}
                      </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {group.unitName} · {group.versionLabel} · vínculo(s){" "}
                      {group.linkIds.join(", ")}
                    </p>
                  </div>
                  <StatusBadge tone="neutral">{group.blocks.length} bloco(s)</StatusBadge>
                </div>
                <ScheduleWeekView
                  schedule={group.weekView}
                  blocks={group.blocks}
                  label={`Horário de ${item.personName} em ${group.className}`}
                />
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            title="Nenhum bloco planejado"
            description="A existência do profissional, vínculo, lotação, função ou atuação não cria horários automaticamente."
          />
        )}
      </DetailSection>
      <StatePanel
        tone="info"
        title="Autorização futura"
        description={SCHEDULE_AUTHORIZATION_NOTE}
      />
    </div>
  );
}
