/**
 * Frente W — "Meus diários": só regências/substituições da própria pessoa. Aulas previstas (grade) e ministradas
 * (fato registrado) aparecem separadas; chamada só depois da aula registrada; ausência de marcação nunca é falta.
 * Correção sempre parte da versão vigente e declara apenas o que mudou; a regra de correção vem do banco.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { ReferencePicker } from "@/features/curricular-reference/reference-picker";
import { readCatalog } from "@/features/curricular-reference/reference-source";
import type { Catalog } from "@/features/curricular-reference/reference-engine";
import {
  ATTENDANCE_MARKS, changedAspects, currentMarks, diaryMessage, markAll, readLessons, readMyDiaries, readRoster, readSlots,
  recordAttendance, recordLesson, unmarkedCount, type LessonRow, type Mark, type MyDiary, type RosterRow, type SlotRow,
} from "./diary-w-source";

const today = () => new Date().toLocaleDateString("sv-SE");
const YEAR: Record<string, string> = { operacional: "Ano em operação", "em-preparacao": "Ano em preparação", encerrado: "Ano encerrado", "historico-importado": "Ano histórico" };
const key = (d: MyDiary) => `${d.assignment_id}|${d.substitution_id ?? ""}|${d.engagement_id}`;

export function MyDiariesPage() {
  const [on, setOn] = useState(today());
  const [rows, setRows] = useState<MyDiary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => { readCatalog().then(setCatalog).catch(() => setCatalog(null)); }, []);
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
        : !rows ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <EmptyState title="Nenhuma regência vigente nesta data" description="Só aparecem regências ou substituições suas registradas pela escola." />
        : (
          <ul className="grid gap-2 sm:grid-cols-2">{rows.map((d) => (
            <li key={key(d)}>
              <button className={`w-full rounded-lg border p-3 text-left ${open === key(d) ? "border-primary" : ""}`} onClick={() => setOpen(key(d))}>
                <span className="font-medium">{d.component_label ?? d.item_key ?? "Elemento curricular"}</span>
                <span className="block text-sm">Turma {d.class_id}</span>
                <span className="block text-xs text-muted-foreground">De {d.effective_from}{d.effective_until ? ` até ${d.effective_until}` : " sem término registrado"}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{d.role === "titular" ? "Titular" : "Substituição"}</Badge>
                  <Badge variant={d.year_state === "operacional" ? "secondary" : "outline"}>{YEAR[d.year_state ?? ""] ?? "Ano sem estado"}</Badge>
                  {d.assignment_state !== "vigente" && <Badge variant="outline">Regência: {d.assignment_state ?? "indisponível"}</Badge>}
                </span>
              </button>
            </li>))}</ul>)}
      {sel && <DiaryPanel key={key(sel)} diary={sel} on={on} catalog={catalog} />}
    </div>
  );
}

function DiaryPanel({ diary, on, catalog }: { diary: MyDiary; on: string; catalog: Catalog | null }) {
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [slots, setSlots] = useState<SlotRow[] | null>(null);
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const load = useCallback(() => readLessons(diary).then(setLessons).catch((e) => setMsg(diaryMessage((e as Error).message))), [diary]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSlots(null); setSlotErr(null); readSlots(diary, on).then(setSlots).catch((e) => setSlotErr(diaryMessage((e as Error).message))); }, [diary, on]);
  const operational = diary.year_state === "operacional";
  const readOnly = diary.year_state === "encerrado" || diary.year_state === "historico-importado";
  const ordered = useMemo(() => [...(lessons ?? [])].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)), [lessons]);
  const saved = (m: string) => { setMsg(m); setEditing(null); void load(); };
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-label="Diário selecionado">
      <div>
        <h2 className="font-semibold">Aulas previstas em {on} (grade)</h2>
        <p className="text-xs text-muted-foreground">Previsão não é aula dada: nada vira ministrado sem o seu registro.</p>
        {slotErr ? <p className="text-sm">{slotErr}</p> : !slots ? <SkeletonState label="Carregando" />
          : slots.length === 0 ? <p className="text-sm">Nenhum horário da grade para este elemento nesta data.</p>
          : <ul className="text-sm">{slots.map((s) => <li key={s.block_id}>{s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)} {s.block_state !== "utilizavel" && <Badge variant="outline">indisponível: {s.block_state}</Badge>}</li>)}</ul>}
      </div>
      {readOnly && <StatePanel tone="info" title="Somente leitura" description={diaryMessage(`diary:year-not-operational:${diary.year_state ?? ""}`)} />}
      {!operational && !readOnly && <StatePanel tone="warning" title="Registro de aulas indisponível" description={diaryMessage(`diary:year-not-operational:${diary.year_state ?? ""}`)} />}
      {operational && !editing && <LessonForm diary={diary} on={on} slots={slots ?? []} catalog={catalog} onSaved={saved} />}
      {operational && editing && <LessonForm diary={diary} on={editing.lesson_date} slots={slots ?? []} catalog={catalog} base={editing} onSaved={saved} onCancel={() => setEditing(null)} />}
      <div>
        <h2 className="font-semibold">Aulas ministradas (registradas)</h2>
        {!lessons ? <SkeletonState label="Carregando" /> : ordered.length === 0 ? <p className="text-sm">Nenhuma aula registrada.</p> : (
          <ul className="divide-y text-sm">{ordered.map((l) => (
            <li key={l.lesson_version_id} className="space-y-1 py-2">
              <span className="font-medium">{l.lesson_date}</span> · versão {l.version_number}
              {l.recorded_as === "substituto" && <Badge variant="outline" className="ml-1">Substituição</Badge>}
              <span className="block">{l.facts.content}</span>
              {l.facts.observation && <span className="block text-xs text-muted-foreground">{l.facts.observation}</span>}
              <span className="block text-xs text-muted-foreground">Referências curriculares: {l.reference_item_ids.length || "nenhuma"}
                {l.attendance_version_number ? ` · chamada versão ${l.attendance_version_number}` : " · sem chamada"}</span>
              {operational && <span className="flex gap-2"><button className="text-xs underline" onClick={() => setEditing(l)}>Corrigir aula</button></span>}
              {operational && <Attendance diary={diary} lesson={l} onSaved={saved} />}
            </li>))}</ul>)}
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

function LessonForm({ diary, on, slots, catalog, base, onSaved, onCancel }: { diary: MyDiary; on: string; slots: SlotRow[]; catalog: Catalog | null;
  base?: LessonRow; onSaved: (m: string) => void; onCancel?: () => void }) {
  const [content, setContent] = useState(base?.facts.content ?? ""); const [obs, setObs] = useState(base?.facts.observation ?? "");
  const [blocks, setBlocks] = useState<string[]>(base?.schedule_block_ids ?? []);
  const [refs, setRefs] = useState<string[]>(base?.reference_item_ids ?? []);
  const [just, setJust] = useState("");
  const usable = slots.filter((s) => s.block_state === "utilizavel");
  const changed = base ? changedAspects(base, { content, observation: obs, blocks, references: refs }) : [];
  const save = async () => {
    try {
      await recordLesson({ logical: base?.logical_record_id ?? `aula-${crypto.randomUUID()}`, diary, date: on, base: base?.lesson_version_id ?? null,
        content, observation: obs, blocks, references: refs, justification: base ? just || null : null, changed });
      onSaved(base ? "Correção registrada como nova versão." : "Aula registrada.");
    } catch (e) { onSaved(diaryMessage((e as Error).message)); }
  };
  return (
    <fieldset className="space-y-2 rounded border p-3"><legend className="font-semibold">{base ? `Corrigir aula de ${on} (versão ${base.version_number})` : `Registrar aula ministrada em ${on}`}</legend>
      {!base && usable.length > 0 && <div className="text-sm"><span className="block">Horários da grade em que a aula ocorreu (opcional)</span>
        {usable.map((s) => <label key={s.block_id} className="mr-3"><input type="checkbox" checked={blocks.includes(s.block_id)}
          onChange={() => setBlocks(blocks.includes(s.block_id) ? blocks.filter((b) => b !== s.block_id) : [...blocks, s.block_id])} /> {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}</label>)}</div>}
      <textarea aria-label="Conteúdo ministrado" placeholder="Conteúdo ministrado" className="w-full rounded border bg-background p-2 text-sm" value={content} onChange={(e) => setContent(e.target.value)} />
      <textarea aria-label="Observação" placeholder="Observação (opcional)" className="w-full rounded border bg-background p-2 text-sm" value={obs} onChange={(e) => setObs(e.target.value)} />
      {catalog ? <ReferencePicker catalog={catalog} selected={refs} onChange={setRefs} label="Habilidades e descritores (opcional)" />
        : <p className="text-xs text-muted-foreground">Sem referência curricular selecionada, a aula fica registrada sem habilidades vinculadas.</p>}
      {base && <>
        <p className="text-xs">{changed.length ? `Alterações: ${changed.join(", ")}` : "Nada foi alterado ainda."}</p>
        <textarea aria-label="Justificativa da correção" placeholder="Justificativa (exigida se a regra vigente pedir)" className="w-full rounded border bg-background p-2 text-sm" value={just} onChange={(e) => setJust(e.target.value)} />
      </>}
      <div className="flex gap-2">
        <Button disabled={!content.trim() || (base && changed.length === 0)} onClick={() => void save()}>{base ? "Registrar correção" : "Registrar aula"}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
      </div>
    </fieldset>
  );
}

function Attendance({ diary, lesson, onSaved }: { diary: MyDiary; lesson: LessonRow; onSaved: (m: string) => void }) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const saved = currentMarks(lesson);
  const [marks, setMarks] = useState<Record<string, Mark>>(saved);
  const [just, setJust] = useState("");
  const [openA, setOpenA] = useState(false);
  const isCorrection = !!lesson.attendance_version_id;
  useEffect(() => { if (openA && !roster) readRoster(diary, lesson.lesson_date).then(setRoster).catch((e) => onSaved(diaryMessage((e as Error).message))); }, [openA, roster, diary, lesson.lesson_date, onSaved]);
  if (!openA) return <button className="text-xs underline" onClick={() => setOpenA(true)}>{isCorrection ? "Corrigir chamada" : "Fazer chamada"}</button>;
  if (!roster) return <SkeletonState label="Carregando alunos da data da aula" />;
  // Correção: a lista é a da chamada original (fotografia da data), nunca a turma de hoje.
  const list = isCorrection && lesson.eligible_student_ids ? roster.filter((r) => lesson.eligible_student_ids!.includes(r.student_id)) : roster;
  const missing = unmarkedCount(list, marks);
  const changed = Object.keys(marks).some((k) => marks[k] !== saved[k]);
  return (
    <div className="mt-2 space-y-2">
      <ul className="divide-y rounded border">{list.map((r) => (
        <li key={r.student_id} className="flex items-center justify-between gap-2 p-2">
          <span>{r.display_name}</span>
          <span className="flex gap-1">{ATTENDANCE_MARKS.map((m) => (
            <Button key={m} size="sm" variant={marks[r.student_id] === m ? "default" : "outline"} onClick={() => setMarks({ ...marks, [r.student_id]: m })}>{m}</Button>))}</span>
        </li>))}</ul>
      <p className="text-xs">{missing > 0 ? `${missing} sem marcação — continuam sem marcação, não viram falta.` : "Todos marcados."}</p>
      {isCorrection && <textarea aria-label="Justificativa da correção da chamada" placeholder="Justificativa (exigida se a regra vigente pedir)" className="w-full rounded border bg-background p-2 text-sm" value={just} onChange={(e) => setJust(e.target.value)} />}
      <div className="flex flex-wrap gap-2">
        {missing > 0 && <Button size="sm" variant="outline" onClick={() => setMarks(markAll(list, "Presente", marks))}>Marcar pendentes como presentes</Button>}
        <Button size="sm" disabled={Object.keys(marks).length === 0 || (isCorrection && !changed)} onClick={() => void recordAttendance(lesson.logical_record_id, lesson.attendance_version_id, marks, isCorrection ? just || null : null)
          .then(() => onSaved(isCorrection ? "Correção da chamada registrada como nova versão." : "Chamada registrada.")).catch((e) => onSaved(diaryMessage((e as Error).message)))}>{isCorrection ? "Registrar correção" : "Registrar chamada"}</Button>
      </div>
    </div>
  );
}
