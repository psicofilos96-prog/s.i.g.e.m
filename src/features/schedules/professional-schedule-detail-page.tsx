import { Link } from "@tanstack/react-router";
import { AlertTriangle, Printer } from "lucide-react";
import { DefinitionList, DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { currentLinks } from "@/features/professionals/professionals-data";
import { ScheduleWeekView } from "./schedule-week-view";
import { SCHEDULE_AUTHORIZATION_NOTE, professionalScheduleSummary } from "./schedules-data";

export function ProfessionalScheduleDetailPage({ professionalId }: { professionalId: string }) {
  const summary = professionalScheduleSummary(professionalId); const item = summary.professional;
  if (!item) return <EmptyState title="Profissional não encontrado" description="O identificador não corresponde aos registros fictícios disponíveis." action={<Button asChild variant="outline"><Link to="/horarios/profissionais">Voltar</Link></Button>} />;
  const scheduleGroups = Array.from(new Map(summary.entries.map((entry) => [entry.schedule.id, entry.schedule])).values());
  return <div className="space-y-5 pb-5"><OperationalPageHeader title={item.personName} description={`${item.professionalId} · horário individual demonstrativo`} parent={{ label: "Horários de profissionais", to: "/horarios/profissionais" }} actions={<><Button asChild size="sm" variant="outline"><Link to="/profissionais/$id" params={{ id: item.id }}>Detalhes do profissional</Link></Button><Button asChild size="sm" variant="outline"><Link to="/horarios/profissionais/$profissionalId/impressao" params={{ profissionalId: item.id }}><Printer /> Imprimir</Link></Button></>} />
    <DetailSection title="Identidade profissional mínima" description="Sem CPF completo, endereço, filiação, dados bancários ou médicos."><DefinitionList items={[{ term: "Pessoa", detail: item.personName }, { term: "Identificador SIGEM", detail: <span className="font-mono">{item.professionalId}</span> }, { term: "Situação", detail: item.situation }, { term: "Vínculos atuais", detail: String(currentLinks(item).length) }, { term: "Leitura", detail: "Vínculos e cargas declaradas não foram convertidos automaticamente em blocos de horário." }]} /></DetailSection>
    {summary.conflicts.length ? <StatePanel tone="danger" title="Conflito temporal potencial na rede" description={summary.conflicts.map((conflict) => conflict.explanation).join(" ")} action={<AlertTriangle />} /> : <StatePanel tone="neutral" title="Sem conflito identificado nos dados disponíveis" description="Ausência de alerta não comprova compatibilidade integral; podem faltar informações." />}
    <DetailSection title="Grade individual consolidada" description="Cada bloco mantém sua turma, unidade, atuação e papel pedagógico. Corresponsabilidade e substituição não são equivalentes.">
      {scheduleGroups.length ? <div className="space-y-6">{scheduleGroups.map((schedule) => { const blocks = summary.entries.filter((entry) => entry.schedule.id === schedule.id).map((entry) => entry.block); const klass = getDemonstrationClass(schedule.classId); return <section key={schedule.id}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold"><Link to="/horarios/turmas/$turmaId" params={{ turmaId: schedule.classId }} className="hover:text-primary hover:underline">{klass?.name ?? schedule.classId}</Link></h3><p className="text-xs text-muted-foreground">{getClassUnitName(klass?.unitId ?? "")} · {schedule.label}</p></div><StatusBadge tone="neutral">{blocks.length} bloco(s)</StatusBadge></div><ScheduleWeekView schedule={schedule} blocks={blocks} label={`Horário de ${item.personName} em ${klass?.name}`} /></section>; })}</div> : <EmptyState compact title="Nenhum bloco planejado" description="A existência do profissional, vínculo, lotação, função ou atuação não cria horários automaticamente." />}
    </DetailSection>
    <StatePanel tone="info" title="Autorização futura" description={SCHEDULE_AUTHORIZATION_NOTE} />
  </div>;
}