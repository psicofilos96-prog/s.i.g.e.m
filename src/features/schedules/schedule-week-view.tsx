import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Coffee, GraduationCap, Shapes } from "lucide-react";
import { StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import {
  WEEK_DAYS,
  blockContexts,
  type ScheduleBlock,
  type ScheduleVersion,
} from "./schedules-data";

function blockIcon(kind: ScheduleBlock["kind"]) {
  if (kind === "Intervalo") return Coffee;
  if (kind === "Aula") return GraduationCap;
  return Shapes;
}

export function ScheduleWeekView({
  schedule,
  blocks = schedule.blocks,
  label = "Grade semanal planejada",
}: {
  schedule: ScheduleVersion;
  blocks?: ScheduleBlock[];
  label?: string;
}) {
  const activeDays = WEEK_DAYS.filter((day) => blocks.some((item) => item.day === day.id));
  if (!blocks.length) {
    return (
      <div className="border border-dashed border-border p-6 text-center">
        <p className="text-sm font-semibold">Grade semanal não iniciada</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A turma possui contexto acadêmico, mas ainda não há blocos planejados.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-border bg-card" aria-label={label}>
      <div
        className="grid min-w-[760px] divide-x divide-border"
        style={{ gridTemplateColumns: `repeat(${activeDays.length}, minmax(9.5rem, 1fr))` }}
      >
        {activeDays.map((day) => (
          <section key={day.id} aria-labelledby={`schedule-day-${day.id}`}>
            <header className="sticky top-0 z-10 border-b border-border bg-muted px-3 py-2">
              <h3
                id={`schedule-day-${day.id}`}
                className="text-xs font-semibold uppercase text-muted-foreground"
              >
                {day.label}
              </h3>
            </header>
            <div className="min-h-64 space-y-2 p-2">
              {blocks
                .filter((item) => item.day === day.id)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((item) => {
                  const Icon = blockIcon(item.kind);
                  const contexts = blockContexts(item);
                  return (
                    <article
                      key={item.id}
                      className={cn(
                        "border-l-4 border-primary bg-muted/40 p-2.5",
                        item.kind === "Intervalo" && "border-warning bg-warning/10",
                        item.status === "Requer revisão" && "border-destructive bg-destructive/5",
                        item.status === "Sem distribuição" && "border-muted-foreground bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-tabular">
                          {item.start}–{item.end}
                        </span>
                        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-snug">{item.label}</p>
                      <p className="mt-1 text-micro text-muted-foreground">{item.kind}</p>
                      {contexts.map((entry) =>
                        entry ? (
                          <p
                            key={entry.assignment.id}
                            className="mt-1 text-micro leading-snug"
                          >
                            <Link
                              to="/horarios/profissionais/$profissionalId"
                              params={{ profissionalId: entry.assignment.professionalId }}
                              className="font-medium text-primary hover:underline"
                            >
                              {entry.context.professional?.personName ??
                                "Profissional não identificado"}
                            </Link>
                            <span className="text-muted-foreground">
                              {" "}
                              · {entry.assignment.role}
                            </span>
                          </p>
                        ) : null,
                      )}
                      {item.status !== "Planejado" ? (
                        <div className="mt-2">
                          <StatusBadge
                            tone={item.status === "Requer revisão" ? "warning" : "neutral"}
                          >
                            {item.status}
                          </StatusBadge>
                        </div>
                      ) : null}
                      {item.note ? (
                        <p className="mt-2 flex gap-1 text-micro leading-snug text-muted-foreground">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />{" "}
                          {item.note}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
