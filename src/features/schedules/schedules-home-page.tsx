import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  UserRound,
} from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { demonstrationUnits } from "@/features/units/units-data";
import { demonstrationProfessionals } from "@/features/professionals/professionals-data";
import { demonstrationClasses } from "@/features/classes/classes-data";
import {
  SCHEDULE_AUTHORIZATION_NOTE,
  SCHEDULE_CONCEPT_NOTE,
  detectPotentialConflicts,
  scheduleVersions,
  schoolJourneys,
} from "./schedules-data";

export function SchedulesHomePage() {
  const conflicts = detectPotentialConflicts();
  const published = scheduleVersions.filter((item) => item.state === "Publicada").length;
  const pending = demonstrationClasses.length - published;
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title="Horários escolares"
        description="Consulta integrada de jornadas, grades semanais e horários individuais — sem editor ou publicação real."
      />
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores demonstrativos"
      >
        {[
          ["Turmas com jornada detalhada", schoolJourneys.length, CalendarRange],
          ["Grades publicadas", published, CalendarDays],
          ["Pendências de grade", pending, AlertTriangle],
          ["Conflitos potenciais", conflicts.length, AlertTriangle],
        ].map(([label, value, Icon]) => {
          const CardIcon = Icon as typeof CalendarRange;
          return (
            <article key={String(label)} className="border border-border bg-card p-4 shadow-panel">
              <CardIcon className="size-4 text-primary" />
              <p className="mt-3 font-mono text-2xl font-semibold text-tabular">{String(value)}</p>
              <p className="text-xs text-muted-foreground">{String(label)}</p>
            </article>
          );
        })}
      </div>
      <section>
        <h2 className="text-sm font-semibold">Consultas operacionais</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Escolha o recorte sem perder os identificadores compartilhados.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <article className="border border-border bg-card p-4">
            <GraduationCap className="size-5 text-primary" />
            <h3 className="mt-3 font-semibold">Grades por turma</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {demonstrationClasses.length} turmas, incluindo EI, EF, EJA e organizações multietapa.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/horarios/turmas">Consultar turmas</Link>
            </Button>
          </article>
          <article className="border border-border bg-card p-4">
            <UserRound className="size-5 text-primary" />
            <h3 className="mt-3 font-semibold">Horários individuais</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {demonstrationProfessionals.length} profissionais; horários não são inferidos do cargo
              ou da carga.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/horarios/profissionais">Consultar profissionais</Link>
            </Button>
          </article>
          <article className="border border-border bg-card p-4">
            <Building2 className="size-5 text-primary" />
            <h3 className="mt-3 font-semibold">Visão por unidade</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {demonstrationUnits.length} unidades escolares e seus contextos próprios.
            </p>
            <Button asChild size="sm" className="mt-4" variant="outline">
              <Link to="/horarios/turmas">Selecionar unidade</Link>
            </Button>
          </article>
        </div>
      </section>
      <StatePanel
        tone="warning"
        title="Conflitos são potenciais"
        description="Sobreposições consideram a mesma Pessoa em todas as unidades e vínculos disponíveis. Exigem validação e não presumem infração."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <StatePanel
          tone="info"
          title="Conceitos independentes"
          description={SCHEDULE_CONCEPT_NOTE}
        />
        <StatePanel
          tone="neutral"
          title="Autorização futura"
          description={SCHEDULE_AUTHORIZATION_NOTE}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge tone="neutral">Calendário escolar</StatusBadge> será integrado como fonte
        independente; não foi transformado em jornada ou grade.
      </div>
    </div>
  );
}
