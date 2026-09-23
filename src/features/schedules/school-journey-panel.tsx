import { CalendarClock } from "lucide-react";
import { DetailSection } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { WEEK_DAYS, type SchoolJourney } from "./schedules-data";

export function SchoolJourneyPanel({ journey }: { journey: SchoolJourney | undefined }) {
  return (
    <DetailSection
      title="Jornada escolar"
      description="Estrutura de funcionamento da turma, independente da distribuição da grade semanal."
    >
      {!journey ? (
        <div className="border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground">
          <strong>Informação incompleta.</strong> Nenhuma jornada detalhada foi declarada para esta
          turma.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusBadge tone="info">Turno: {journey.shift}</StatusBadge>
            <StatusBadge tone="neutral">
              Vigência: {journey.effectiveFrom} — {journey.effectiveUntil ?? "em andamento"}
            </StatusBadge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-xs">
              <caption className="sr-only">Funcionamento declarado por dia</caption>
              <thead className="border-b border-border bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Entrada</th>
                  <th className="px-3 py-2">Saída</th>
                  <th className="px-3 py-2">Duração declarada</th>
                  <th className="px-3 py-2">Intervalos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {journey.days.map((day) => (
                  <tr key={day.day}>
                    <td className="px-3 py-2 font-medium">
                      {WEEK_DAYS.find((item) => item.id === day.day)?.label}
                    </td>
                    <td className="px-3 py-2 font-mono text-tabular">{day.start}</td>
                    <td className="px-3 py-2 font-mono text-tabular">{day.end}</td>
                    <td className="px-3 py-2">{day.declaredDuration}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {day.intervals.length
                        ? day.intervals
                            .map((item) => `${item.start}–${item.end} · ${item.label}`)
                            .join("; ")
                        : "Nenhum informado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              <strong className="text-foreground">Origem:</strong> {journey.origin}. {journey.note}
            </p>
          </div>
        </>
      )}
    </DetailSection>
  );
}
