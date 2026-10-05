import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAcademicDate } from "@/lib/academic-date";
import { ASSIGNMENT_STATE_TEXT, humanAssignmentError, readTeachingAssignments } from "./teaching-assignment-source";

/** Painel somente leitura. Sem botão de atribuir: a competência ainda não foi definida. */
export function TeachingAssignmentPanel({ classId, validOn }: { classId: string; validOn: string }) {
  const [knownAt] = useState(() => new Date().toISOString());
  const q = useQuery({ queryKey: ["teaching-assignments", classId, validOn, knownAt], queryFn: () => readTeachingAssignments(classId, validOn, knownAt) });
  return (
    <section aria-labelledby="ta-title" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 id="ta-title" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" />Atribuição docente</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando atribuições…</p>
        : q.error ? <p role="alert" className="text-sm text-destructive">{humanAssignmentError(q.error)}</p>
        : !q.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma atribuição docente registrada para esta turma na data. O registro ainda não está disponível:
            a competência para atribuir docentes não foi definida.
          </p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {q.data.map((a) => (
              <li key={a.assignmentId} className="rounded border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.elementLabel ?? "Elemento sem rótulo declarado"}</span>
                  <Badge variant={a.state === "vigente" ? "secondary" : "destructive"}>{ASSIGNMENT_STATE_TEXT[a.state]}</Badge>
                  {a.coAssignedCount > 0 ? <Badge variant="outline">Com outras {a.coAssignedCount} atuação(ões) no mesmo elemento</Badge> : null}
                </div>
                <p className="text-muted-foreground">
                  {formatAcademicDate(a.from)} – {a.until ? formatAcademicDate(a.until) : "sem término"} · versão {a.version}
                  {a.sourceRef ? ` · fonte: ${a.sourceRef}` : " · decisão interna (sem documento-fonte)"}
                </p>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
