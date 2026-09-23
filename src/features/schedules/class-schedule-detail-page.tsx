import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Printer } from "lucide-react";
import { AuditTimeline, DefinitionList, DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getClassOffer, getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { ScheduleWeekView } from "./schedule-week-view";
import { SchoolJourneyPanel } from "./school-journey-panel";
import { SCHEDULE_CONCEPT_NOTE, SCHEDULE_DEMONSTRATION_NOTE, detectPotentialConflicts, getJourneyForClass, getScheduleForClass, scheduleSituation, scheduleSituationTone, scheduleStateTone } from "./schedules-data";

export function ClassScheduleDetailPage({ classId }: { classId: string }) {
  const klass = getDemonstrationClass(classId); const journey = getJourneyForClass(classId); const schedule = getScheduleForClass(classId);
  if (!klass) return <EmptyState title="Turma não encontrada" description="O identificador não corresponde às turmas fictícias disponíveis." action={<Button asChild variant="outline"><Link to="/horarios/turmas">Voltar</Link></Button>} />;
  const offer = getClassOffer(klass.offerId); const conflicts = detectPotentialConflicts().filter((item) => item.classIds.includes(classId)); const situation = scheduleSituation(schedule);
  return <div className="space-y-5 pb-5"><OperationalPageHeader title={klass.name} description={`${klass.code} · jornada e grade semanal demonstrativas`} parent={{ label: "Horários de turmas", to: "/horarios/turmas" }} actions={<><Button asChild size="sm" variant="outline"><Link to="/turmas/$id" params={{ id: klass.id }}>Detalhes da turma</Link></Button><Button asChild size="sm" variant="outline"><Link to="/horarios/turmas/$turmaId/impressao" params={{ turmaId: klass.id }}><Printer /> Imprimir</Link></Button></>} />
    <div className="flex flex-wrap gap-2 border-b border-border pb-3"><StatusBadge tone={scheduleStateTone(schedule?.state ?? "Não iniciada")}>{schedule?.state ?? "Não iniciada"}</StatusBadge><StatusBadge tone={scheduleSituationTone(situation)}>{situation}</StatusBadge><StatusBadge tone="neutral">Período letivo: {klass.academicPeriod.label}</StatusBadge></div>
    <DetailSection title="Contexto acadêmico" description="A grade mantém as referências existentes; nenhum componente ou profissional foi inferido da jornada."><DefinitionList items={[{ term: "Unidade", detail: <Link to="/horarios/unidades/$unidadeId" params={{ unidadeId: klass.unitId }} className="text-primary hover:underline">{getClassUnitName(klass.unitId)}</Link> }, { term: "Oferta", detail: offer ? `${offer.stage} · ${offer.organization}` : "Não informada" }, { term: "Organização", detail: klass.academicOrganization }, { term: "Agrupamentos", detail: klass.groupings.map((item) => item.label).join("; ") }, { term: "Turno", detail: klass.shift }, { term: "Jornada declarada na turma", detail: klass.journey }]} /></DetailSection>
    <SchoolJourneyPanel journey={journey} />
    <DetailSection title="Grade semanal" description={`${schedule?.label ?? "Sem versão"} · ${schedule?.state ?? "Não iniciada"}. Os blocos possuem durações variáveis e não registram aulas ministradas.`}>{schedule ? <ScheduleWeekView schedule={schedule} /> : <EmptyState compact icon={CalendarDays} title="Grade não disponível" description="A jornada não contém uma distribuição semanal neste exemplo." />}</DetailSection>
    {conflicts.length ? <StatePanel tone="danger" title="Conflito temporal potencial" description={conflicts.map((item) => item.explanation).join(" ")} /> : null}
    {schedule ? <DetailSection title="Versões e alterações" description="Alterações simples poderão ser rastreadas sem nova versão principal; mudanças importantes deverão gerar versão. Os critérios dependem de decisão institucional."><AuditTimeline label="Histórico demonstrativo da grade" items={schedule.history.map((item) => ({ id: item.id, title: item.title, description: item.note, timestamp: item.date }))} emptyMessage="Nenhuma versão foi iniciada." /></DetailSection> : null}
    <div className="grid gap-3 md:grid-cols-2"><StatePanel tone="info" title="Calendário e aula ministrada" description={SCHEDULE_CONCEPT_NOTE} /><StatePanel tone="warning" title="Somente consulta" description="O editor, a publicação real e a distribuição automática não fazem parte desta etapa." /></div>
    <p className="text-xs text-muted-foreground">{SCHEDULE_DEMONSTRATION_NOTE}</p>
  </div>;
}