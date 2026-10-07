import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel, EmptyState } from "@/components/sigem/patterns";
import { filterOversight, OVERSIGHT_STATE_LABEL, projectDiaryOversight, summarizeByClass, type RecordedFact } from "./diary-oversight";
import { expandSchedule, type ScheduleBlock } from "./schedule-expansion";

type Lesson = { class_id: string | null; component_id: string | null; lesson_date: string | null; logical_record_id: string | null; attendance_version: number | null };
type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

/** Fiscalização: aula prevista (grade publicada) × registro. Somente leitura, sem ranking. */
export function DiaryOversightSection({ lessons, from, to }: { lessons: Lesson[]; from: string; to: string }) {
  const classes = useMemo(() => [...new Set(lessons.map((l) => l.class_id).filter(Boolean))] as string[], [lessons]);
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [cls, setCls] = useState(""); const [teacher, setTeacher] = useState("");
  useEffect(() => {
    let live = true; setBlocks(null);
    Promise.all(classes.map((c) => rpc("class_schedule_at", { _class_id: c, _on: to, _known_at: new Date().toISOString() })))
      .then((rs) => live && setBlocks(rs.flatMap((r) => (r.error ? [] : (r.data as ScheduleBlock[]) ?? []))));
    return () => { live = false; };
  }, [classes, to]);
  const rows = useMemo(() => {
    if (!blocks) return null;
    const facts: RecordedFact[] = lessons.filter((l) => l.class_id && l.lesson_date && l.component_id)
      .map((l) => ({ classId: l.class_id!, date: l.lesson_date!, slotId: l.component_id!, recordId: l.logical_record_id ?? "", concluded: true }));
    const att = lessons.filter((l) => l.attendance_version).map((l) => ({ classId: l.class_id!, date: l.lesson_date!, slotId: l.component_id!, recordId: l.logical_record_id ?? "", concluded: true }));
    return projectDiaryOversight(expandSchedule(blocks, from, to), facts, att, to);
  }, [blocks, lessons, from, to]);
  if (classes.length === 0) return null;
  if (!rows) return <p className="text-sm text-muted-foreground">Carregando a grade…</p>;
  if (rows.length === 0) return <StatePanel tone="info" title="Sem grade publicada no período" description="Sem grade, nenhuma aula é prevista — e nada é tratado como faltante." />;
  const teachers = [...new Set(rows.map((r) => r.teacherEngagementId).filter(Boolean))] as string[];
  const shown = filterOversight(rows, { ...(cls ? { classId: cls } : {}), ...(teacher ? { teacherEngagementId: teacher } : {}) });
  return (
    <section aria-labelledby="fisc" className="space-y-3">
      <h2 id="fisc" className="font-semibold">Aulas previstas pela grade</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>Turma <select className="rounded border bg-background p-1" value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Todas</option>{classes.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Professor <select className="rounded border bg-background p-1" value={teacher} onChange={(e) => setTeacher(e.target.value)}><option value="">Todos</option>{teachers.map((t, i) => <option key={t} value={t}>Professor {i + 1}</option>)}</select></label>
      </div>
      <table className="w-full text-sm">
        <caption className="text-left font-medium">Resumo por turma (contagens, sem taxa nem ranking)</caption>
        <thead><tr className="text-left"><th>Turma</th><th>Aulas previstas</th><th>Sem registro de aula</th><th>Sem chamada</th></tr></thead>
        <tbody>{[...summarizeByClass(shown)].map(([c, s]) => (
          <tr key={c} className="border-t"><td>{c}</td><td>{s.expected}</td><td>{s.lessonMissing}</td><td>{s.attendanceMissing}</td></tr>))}</tbody>
      </table>
      {shown.length === 0 ? <EmptyState title="Nada neste recorte" description="Ajuste os filtros." /> : (
        <table className="w-full text-sm">
          <caption className="sr-only">Situação factual de cada aula prevista</caption>
          <thead><tr className="text-left"><th>Data</th><th>Turma</th><th>Componente</th><th>Aula</th><th>Chamada</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={`${r.classId}|${r.date}|${r.slotId}`} className="border-t">
              <td>{r.date}</td><td>{r.classId}</td><td>{r.slotId}</td>
              <td>{OVERSIGHT_STATE_LABEL[r.lesson]}</td><td>{OVERSIGHT_STATE_LABEL[r.attendance]}</td>
            </tr>))}</tbody>
        </table>)}
      <p className="text-xs text-muted-foreground">"Não registrada" é só ausência de registro — não prova falta nem é avaliação do professor.</p>
    </section>
  );
}
