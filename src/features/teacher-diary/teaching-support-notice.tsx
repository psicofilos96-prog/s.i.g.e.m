import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDiaryCloud } from "@/features/diary/diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { supportByClass, type SupportClass, type SupportFlag } from "./teaching-support";

/** Só com sessão institucional; sem laboratório. Falha de leitura = nada afirmado. */
export function TeachingSupportNotice({ date, classes }: { date: string; classes: readonly { classId: string; className: string }[] }) {
  const [rows, setRows] = useState<SupportClass[] | null>(null);
  const key = classes.map((c) => c.classId).join(",");
  useEffect(() => {
    if (!isDiaryCloud()) { setRows(null); return; }
    let live = true;
    void (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: SupportFlag[] | null; error: unknown }>)("inclusion_teaching_support_flags", { _on: date })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { setRows(null); return; }
        const names = new Map(rosterStudents().map((s) => [s.id, s.personName]));
        setRows(supportByClass(data ?? [], classes, (id) => names.get(id) ?? null));
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, key]);
  if (!rows || rows.length === 0) return null;
  return (
    <section aria-labelledby="apoio-inclusivo" className="rounded-lg border bg-card p-4 text-sm">
      <h2 id="apoio-inclusivo" className="font-semibold">Mediação vigente nas suas turmas</h2>
      <ul className="mt-2 space-y-1">{rows.map((r) => <li key={r.classId}><span className="font-medium">{r.className}:</span> {r.students.join(", ")}</li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">Indica só que há mediação registrada na data. Planos e registros de inclusão ficam com a equipe de Inclusão.</p>
    </section>
  );
}
