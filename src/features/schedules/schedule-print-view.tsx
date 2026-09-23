import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { getDemonstrationUnit } from "@/features/units/units-data";
import { ScheduleWeekView } from "./schedule-week-view";
import { SCHEDULE_DEMONSTRATION_NOTE, SCHEDULE_REFERENCE_DATE, getScheduleForClass, scheduleBlocksForProfessional, schedulesForUnit } from "./schedules-data";

type PrintScope = { kind: "class"; id: string } | { kind: "professional"; id: string } | { kind: "unit"; id: string };

export function SchedulePrintView({ scope }: { scope: PrintScope }) {
  const classItem = scope.kind === "class" ? getDemonstrationClass(scope.id) : undefined;
  const professional = scope.kind === "professional" ? getDemonstrationProfessional(scope.id) : undefined;
  const unit = scope.kind === "unit" ? getDemonstrationUnit(scope.id) : undefined;
  const schedules = scope.kind === "class" ? [getScheduleForClass(scope.id)].filter((item) => Boolean(item)) : scope.kind === "unit" ? schedulesForUnit(scope.id) : Array.from(new Map(scheduleBlocksForProfessional(scope.id).map((entry) => [entry.schedule.id, entry.schedule])).values());
  const title = classItem?.name ?? professional?.personName ?? unit?.currentName ?? "Consulta não encontrada";
  const back = scope.kind === "class" ? `/horarios/turmas/${scope.id}` : scope.kind === "professional" ? `/horarios/profissionais/${scope.id}` : `/horarios/unidades/${scope.id}`;
  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-muted-foreground">Pré-visualização A4 demonstrativa. Não é documento oficial publicado.</p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline"><a href={back}>Voltar</a></Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer /> Imprimir</Button>
        </div>
      </div>
      <article className="mx-auto max-w-[1120px] border border-border bg-card p-6 shadow-panel print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs uppercase text-muted-foreground">Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</p>
          <p className="text-xs uppercase text-muted-foreground">{brand.displayName}</p>
          <h1 className="mt-3 text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">Consulta de horários · referência {SCHEDULE_REFERENCE_DATE}</p>
          <p className="mt-2 font-semibold uppercase text-warning-foreground">Documento demonstrativo — não oficial</p>
        </header>
        <div className="mt-4 space-y-6">
          {schedules.map((schedule) => schedule ? (
            <section key={schedule.id}>
              <h2 className="mb-2 text-sm font-semibold">{getDemonstrationClass(schedule.classId)?.name ?? schedule.classId}</h2>
              <p className="mb-3 text-xs text-muted-foreground">{getClassUnitName(getDemonstrationClass(schedule.classId)?.unitId ?? "")} · {schedule.label} · {schedule.state}</p>
              <ScheduleWeekView schedule={schedule} />
            </section>
          ) : null)}
        </div>
        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">{SCHEDULE_DEMONSTRATION_NOTE}</footer>
      </article>
    </div>
  );
}