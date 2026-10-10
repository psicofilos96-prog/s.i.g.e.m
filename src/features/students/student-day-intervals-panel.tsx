import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { SkeletonState } from "@/components/sigem/guidance";
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import { groupByStudent, readDayIntervals, type DayInterval } from "./student-day-intervals";

function IntervalList({ items }: { items: readonly DayInterval[] }) {
  return (
    <ul className="grid gap-0.5 text-sm">
      {items.map((i) => <li key={i.id}><span className="inline-block w-20 text-muted-foreground">{i.weekdayLabel}</span>{i.start}–{i.end}</li>)}
    </ul>
  );
}

function Provenance({ i }: { i: DayInterval }) {
  return <p className="mt-1 text-xs text-muted-foreground">Fonte: {i.source ?? "planilha de jornadas 2026"} · texto declarado: “{i.literal ?? "não informado"}” · normalização {i.parser} · observado em {formatAcademicDate(civilDateOf(i.knownAt))}</p>;
}

const NOTE = "Jornada declarada do estudante na fonte 2026. Não é a grade oficial da turma nem a carga horária de professor.";

export function StudentDayIntervalsPanel({ studentId }: { studentId: string }) {
  const q = useQuery({ queryKey: ["day-intervals", "student", studentId], queryFn: ({ signal }) => readDayIntervals({ studentId }, signal) });
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" />Jornada declarada · 2026</h2>
      <p className="mb-3 text-xs text-muted-foreground">{NOTE}</p>
      {q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a jornada declarada.</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Sem jornada declarada visível para este estudante.</p>
        : <><IntervalList items={q.data} /><Provenance i={q.data[0]!} /></>}
    </section>
  );
}

export function ClassDayIntervalsPanel({ classId }: { classId: string }) {
  const q = useQuery({ queryKey: ["day-intervals", "class", classId], queryFn: ({ signal }) => readDayIntervals({ classId }, signal) });
  const groups = q.data ? [...groupByStudent(q.data)].sort(([, a], [, b]) => (a[0]?.studentName ?? "\uffff").localeCompare(b[0]?.studentName ?? "\uffff", "pt-BR", { sensitivity: "base" })) : [];
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" />Jornada declarada dos estudantes · 2026</h2>
      <p className="mb-3 text-xs text-muted-foreground">{NOTE}</p>
      {q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a jornada declarada.</p>
        : !groups.length ? <p className="text-sm text-muted-foreground">Sem jornada declarada visível para esta turma.</p>
        : (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map(([sid, items]) => (
              <div key={sid} className="rounded border p-2">
                <p className="mb-1 text-sm font-medium">{items[0]?.studentName ?? "Nome não visível no seu acesso"} · {items.length} intervalo(s)</p>
                <IntervalList items={items} /><Provenance i={items[0]!} />
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
