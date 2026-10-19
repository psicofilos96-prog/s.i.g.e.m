import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { useDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { readDiaryWithDeadline } from "./diary-read";
import { supportByClass } from "./teaching-support";

const supportFlags = z.array(z.object({
  class_id: z.string().min(1), student_id: z.string().min(1), has_active_mediation: z.boolean(),
}));

/** Só com sessão institucional; sem laboratório. Falha de leitura = nada afirmado. */
export function TeachingSupportNotice({ date, classes }: { date: string; classes: readonly { classId: string; className: string }[] }) {
  const authority = useSessionAuthority();
  const mode = useDiaryPersistenceMode();
  const ready = authority.status === "signed-in" && Boolean(authority.person) && mode === "cloud" && classes.length > 0;
  const query = useQuery({
    queryKey: ["teacher-mediation", authority.status === "signed-in" ? authority.user.id : null,
      authority.status === "signed-in" ? authority.sessionRevision : null, mode, date, classes],
    enabled: ready, retry: false, staleTime: 60_000,
    queryFn: () => readDiaryWithDeadline(async () => {
      const rpc = supabase.rpc as unknown as (f: "inclusion_teaching_support_flags", a: { _on: string }) => Promise<{ data: unknown; error: unknown }>;
      const { data, error } = await rpc("inclusion_teaching_support_flags", { _on: date });
      if (error) throw error;
      const flags = parseBoundary(supportFlags, data, "teacher-mediation");
      const names = new Map(rosterStudents().map((s) => [s.id, s.personName]));
      return supportByClass(flags, classes, (id) => names.get(id) ?? null);
    }),
  });
  if (!ready) return null;
  if (query.isError) return <section aria-label="Mediação vigente" className="space-y-2 text-sm">
    <p role="alert">Não foi possível consultar a mediação vigente nas suas turmas.</p>
    <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button>
  </section>;
  if (query.isPending || query.isFetching) return <p role="status" className="text-sm text-muted-foreground">Consultando mediação vigente…</p>;
  const rows = query.data;
  if (!rows?.length) return null;
  return (
    <section aria-labelledby="apoio-inclusivo" className="border-t border-border pt-4 text-sm">
      <h2 id="apoio-inclusivo" className="font-semibold">Mediação vigente nas suas turmas</h2>
      <ul className="mt-2 space-y-1">{rows.map((r) => <li key={r.classId}><span className="font-medium">{r.className}:</span> {r.students.join(", ")}</li>)}</ul>
    </section>
  );
}
