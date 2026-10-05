/**
 * Frente W — "Meus diários": só regências/substituições da própria pessoa. Aulas previstas (grade) e ministradas
 * (fato registrado) aparecem separadas; chamada só depois da aula registrada; ausência de marcação nunca é falta.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import {
  ATTENDANCE_MARKS, currentLessons, diaryMessage, markAll, readLessons, readMyDiaries, readRoster, recordAttendance, recordLesson, unmarkedCount,
  type LessonRow, type Mark, type MyDiary, type RosterRow,
} from "./diary-w-source";

const today = () => new Date().toLocaleDateString("sv-SE");
const YEAR: Record<string, string> = { operacional: "Ano em operação", "em-preparacao": "Ano em preparação", encerrado: "Ano encerrado", "historico-importado": "Ano histórico" };
const key = (d: MyDiary) => `${d.assignment_id}|${d.substitution_id ?? ""}|${d.engagement_id}`;

export function MyDiariesPage() {
  const [on, setOn] = useState(today());
  const [rows, setRows] = useState<MyDiary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setRows(null); setErr(null);
    readMyDiaries(on, new Date().toISOString()).then((r) => live && setRows(r)).catch((e) => live && setErr(diaryMessage((e as Error).message)));
    return () => { live = false; };
  }, [on]);
  const sel = rows?.find((d) => key(d) === open) ?? null;
  return (
    <div className="space-y-6">
      <PageHeader title="Meus diários" description="Suas regências e substituições vigentes na data. O Diário nunca é aberto por lotação ou cargo." />
      <div className="max-w-xs"><label className="text-sm" htmlFor="data-diario">Data</label><DateInput id="data-diario" value={on} onChange={(e) => setOn(e.target.value)} /></div>
      {err ? <StatePanel tone="danger" title="Não foi possível ler seus diários" description={err} />
        : !rows ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : rows.length === 0 ? <EmptyState title="Nenhuma regência vigente nesta data" description="Só aparecem regências ou substituições suas registradas pela escola." />
        : (
          <ul className="grid gap-2 sm:grid-cols-2">{rows.map((d) => (
            <li key={key(d)}>
              <button className={`w-full rounded-lg border p-3 text-left ${open === key(d) ? "border-primary" : ""}`} onClick={() => setOpen(key(d))}>
                <span className="font-medium">{d.component_label ?? d.item_key ?? "Elemento curricular"}</span>
                <span className="block text-sm">Turma {d.class_id}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{d.role === "titular" ? "Titular" : "Substituição"}</Badge>
                  <Badge variant={d.year_state === "operacional" ? "secondary" : "outline"}>{YEAR[d.year_state ?? ""] ?? "Ano sem estado"}</Badge>
                  {d.assignment_state !== "vigente" && <Badge variant="outline">Regência: {d.assignment_state ?? "indisponível"}</Badge>}
                </span>
              </button>
            </li>))}</ul>)}
      {sel && <DiaryPanel diary={sel} on={on} />}
    </div>
  );
}

function DiaryPanel({ diary, on }: { diary: MyDiary; on: string }) {
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => readLessons(diary.assignment_id).then(setLessons).catch((e) => setMsg(diaryMessage((e as Error).message))), [diary.assignment_id]);
  useEffect(() => { void load(); }, [load]);
  const operational = diary.year_state === "operacional";
  const current = useMemo(() => currentLessons(lessons ?? []).sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)), [lessons]);
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-label="Diário selecionado">
      {!operational && <StatePanel tone="warning" title="Registro de aulas indisponível" description={diaryMessage(`diary:year-not-operational:${diary.year_state ?? ""}`)} />}
      {operational && <LessonForm diary={diary} on={on} onSaved={(m) => { setMsg(m); void load(); }} />}
      <div>
        <h2 className="font-semibold">Aulas ministradas (registradas)</h2>
        <p className="text-xs text-muted-foreground">Aulas previstas pela grade não aparecem aqui até serem registradas por você.</p>
        {!lessons ? <p className="text-sm">Carregando…</p> : current.length === 0 ? <p className="text-sm">Nenhuma aula registrada.</p> : (
          <ul className="divide-y text-sm">{current.map((l) => (
            <li key={l.id} className="py-2"><span className="font-medium">{l.lesson_date}</span> · versão {l.version_number}
              <span className="block">{l.facts.content}</span>
              {operational && <Attendance diary={diary} lesson={l} onSaved={setMsg} />}
            </li>))}</ul>)}
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

function LessonForm({ diary, on, onSaved }: { diary: MyDiary; on: string; onSaved: (m: string) => void }) {
  const [content, setContent] = useState(""); const [obs, setObs] = useState("");
  const save = async () => {
    try {
      await recordLesson({ logical: `aula-${crypto.randomUUID()}`, diary, date: on, base: null, content, observation: obs, blocks: [], references: [], justification: null, changed: [] });
      setContent(""); setObs(""); onSaved("Aula registrada.");
    } catch (e) { onSaved(diaryMessage((e as Error).message)); }
  };
  return (
    <fieldset className="space-y-2"><legend className="font-semibold">Registrar aula ministrada em {on}</legend>
      <textarea aria-label="Conteúdo ministrado" placeholder="Conteúdo ministrado" className="w-full rounded border bg-background p-2 text-sm" value={content} onChange={(e) => setContent(e.target.value)} />
      <textarea aria-label="Observação" placeholder="Observação (opcional)" className="w-full rounded border bg-background p-2 text-sm" value={obs} onChange={(e) => setObs(e.target.value)} />
      <p className="text-xs text-muted-foreground">Sem referência curricular selecionada, a aula fica registrada sem habilidades vinculadas.</p>
      <Button disabled={!content.trim()} onClick={() => void save()}>Registrar aula</Button>
    </fieldset>
  );
}

function Attendance({ diary, lesson, onSaved }: { diary: MyDiary; lesson: LessonRow; onSaved: (m: string) => void }) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [openA, setOpenA] = useState(false);
  useEffect(() => { if (openA && !roster) readRoster(diary, lesson.lesson_date).then(setRoster).catch((e) => onSaved(diaryMessage((e as Error).message))); }, [openA, roster, diary, lesson.lesson_date, onSaved]);
  if (!openA) return <button className="text-xs underline" onClick={() => setOpenA(true)}>Fazer chamada</button>;
  if (!roster) return <p className="text-xs">Carregando alunos da data da aula…</p>;
  const missing = unmarkedCount(roster, marks);
  return (
    <div className="mt-2 space-y-2">
      <ul className="divide-y rounded border">{roster.map((r) => (
        <li key={r.student_id} className="flex items-center justify-between gap-2 p-2">
          <span>{r.display_name}</span>
          <span className="flex gap-1">{ATTENDANCE_MARKS.map((m) => (
            <Button key={m} size="sm" variant={marks[r.student_id] === m ? "default" : "outline"} onClick={() => setMarks({ ...marks, [r.student_id]: m })}>{m}</Button>))}</span>
        </li>))}</ul>
      <p className="text-xs">{missing > 0 ? `${missing} sem marcação — continuam sem marcação, não viram falta.` : "Todos marcados."}</p>
      <div className="flex flex-wrap gap-2">
        {missing > 0 && <Button size="sm" variant="outline" onClick={() => setMarks(markAll(roster, "Presente", marks))}>Marcar pendentes como presentes</Button>}
        <Button size="sm" disabled={Object.keys(marks).length === 0} onClick={() => void recordAttendance(lesson.logical_record_id, null, marks, null)
          .then(() => onSaved("Chamada registrada.")).catch((e) => onSaved(diaryMessage((e as Error).message)))}>Registrar chamada</Button>
      </div>
    </div>
  );
}
