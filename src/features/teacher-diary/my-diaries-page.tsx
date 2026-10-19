import { operationalToday } from "@/lib/academic-date";
/**
 * Frente W — "Meus diários": só regências/substituições da própria pessoa. Aulas previstas (grade) e ministradas
 * (fato registrado) aparecem separadas; chamada só depois da aula registrada; ausência de marcação nunca é falta.
 * Correção sempre parte da versão vigente e declara apenas o que mudou; a regra de correção vem do banco.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { useDiarySave } from "./use-diary-save";
import { readDiariesSafely, readSlotsSafely, readLessonsSafely, readRosterSafely, readDiaryWithDeadline } from "./diary-read";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { ReferencePicker } from "@/features/curricular-reference/reference-picker";
import { readCatalog } from "@/features/curricular-reference/reference-source";
import type { Catalog } from "@/features/curricular-reference/reference-engine";
import {
  ATTENDANCE_MARKS, changedAspects, currentMarks, diaryMessage, markAll,
  recordAttendance, recordLesson, unmarkedCount, type LessonRow, type Mark, type MyDiary, type SlotRow,
} from "./diary-w-source";

const today = () => operationalToday();
const YEAR: Record<string, string> = { operacional: "Ano em operação", "em-preparacao": "Ano em preparação", encerrado: "Ano encerrado", "historico-importado": "Ano histórico" };
const key = (d: MyDiary) => `${d.assignment_id}|${d.substitution_id ?? ""}|${d.engagement_id}`;

export function MyDiariesPage() {
  const authority = useSessionAuthority();
  if (authority.status === "loading") return authority.error
    ? <StatePanel tone="danger" title="Não foi possível conferir seu acesso" description="Tente abrir o Diário novamente." />
    : <SkeletonState label="Conferindo seu acesso" />;
  if (authority.status !== "signed-in") return <EmptyState title="Entre para usar o Diário" description="Use sua conta institucional." />;
  if (!authority.person) return <StatePanel tone="warning" title="Diário indisponível" description="Sua conta precisa estar vinculada a uma pessoa cadastrada." />;
  return <DiariesWorkspace key={`${authority.user.id}#${authority.sessionRevision}`} scope={[authority.user.id, authority.sessionRevision]} />;
}

function ReadFailure({ title, retry }: { title: string; retry: () => void }) {
  return <div role="alert" className="space-y-2"><StatePanel tone="danger" title={title} description="A consulta não foi concluída. Tente novamente." /><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
}

function DiariesWorkspace({ scope }: { scope: readonly (string | number)[] }) {
  const [on, setOn] = useState(today());
  const [open, setOpen] = useState<string | null>(null);
  const diariesQuery = useQuery({ queryKey: ["teacher-diaries", ...scope, on], queryFn: () => readDiariesSafely(on, new Date().toISOString()), retry: false });
  const catalogQuery = useQuery({ queryKey: ["teacher-diary-catalog", ...scope], queryFn: () => readDiaryWithDeadline(readCatalog), retry: false });
  const rows = diariesQuery.isError ? null : diariesQuery.data ?? null;
  const catalog = catalogQuery.isError ? null : catalogQuery.data ?? null;
  const sel = rows?.find((d) => key(d) === open) ?? null;
  return (
    <div className="space-y-6">
      <PageHeader title="Meus diários" description="Suas regências e substituições vigentes na data. O Diário nunca é aberto por lotação ou cargo." />
      <div className="max-w-xs"><label className="text-sm" htmlFor="data-diario">Data</label><DateInput id="data-diario" value={on} onChange={(e) => setOn(e.target.value)} /></div>
      {diariesQuery.isError ? <ReadFailure title="Não foi possível ler seus diários" retry={() => void diariesQuery.refetch()} />
        : !rows ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <EmptyState title="Nenhuma regência vigente nesta data" description="Só aparecem regências ou substituições suas registradas pela escola." />
        : (
          <ul className="grid gap-2 sm:grid-cols-2">{rows.map((d) => (
            <li key={key(d)}>
              <Button variant="outline" className={`h-auto w-full flex-col items-start whitespace-normal p-3 text-left ${open === key(d) ? "border-primary" : ""}`} onClick={() => setOpen(key(d))}>
                <span className="font-medium">{d.component_label ?? d.item_key ?? "Elemento curricular"}</span>
                <span className="block text-sm">Turma {d.class_id}</span>
                <span className="block text-xs text-muted-foreground">De {d.effective_from}{d.effective_until ? ` até ${d.effective_until}` : " sem término registrado"}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{d.role === "titular" ? "Titular" : "Substituição"}</Badge>
                  <Badge variant={d.year_state === "operacional" ? "secondary" : "outline"}>{YEAR[d.year_state ?? ""] ?? "Ano sem estado"}</Badge>
                  {d.assignment_state !== "vigente" && <Badge variant="outline">Regência: {d.assignment_state ?? "indisponível"}</Badge>}
                </span>
              </Button>
            </li>))}</ul>)}
      {catalogQuery.isError && <ReadFailure title="Não foi possível ler as referências curriculares" retry={() => void catalogQuery.refetch()} />}
      {sel && <DiaryPanel key={`${key(sel)}|${on}`} diary={sel} on={on} catalog={catalog} scope={scope} />}
    </div>
  );
}

function DiaryPanel({ diary, on, catalog, scope }: { diary: MyDiary; on: string; catalog: Catalog | null; scope: readonly (string | number)[] }) {
  const lessonsQuery = useQuery({ queryKey: ["teacher-diary-lessons", ...scope, key(diary)], queryFn: () => readLessonsSafely(diary), retry: false });
  const slotsQuery = useQuery({ queryKey: ["teacher-diary-slots", ...scope, key(diary), on], queryFn: () => readSlotsSafely(diary, on), retry: false });
  const lessons = lessonsQuery.isError ? null : lessonsQuery.data ?? null;
  const slots = slotsQuery.isError ? null : slotsQuery.data ?? null;
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [savedRevision, setSavedRevision] = useState(0);
  const operational = diary.year_state === "operacional";
  const readOnly = diary.year_state === "encerrado" || diary.year_state === "historico-importado";
  const ordered = useMemo(() => [...(lessons ?? [])].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)), [lessons]);
  const saved = (m: string) => { setMsg(m); setEditing(null); setSavedRevision((revision) => revision + 1); void lessonsQuery.refetch(); };
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-label="Diário selecionado">
      <div>
        <h2 className="font-semibold">Aulas previstas em {on} (grade)</h2>
        <p className="text-xs text-muted-foreground">Previsão não é aula dada: nada vira ministrado sem o seu registro.</p>
        {slotsQuery.isError ? <ReadFailure title="Não foi possível ler os horários" retry={() => void slotsQuery.refetch()} /> : !slots ? <SkeletonState label="Carregando" />
          : slots.length === 0 ? <p className="text-sm">Nenhum horário da grade para este elemento nesta data.</p>
          : <ul className="text-sm">{slots.map((s) => <li key={s.block_id}>{s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)} {s.block_state !== "utilizavel" && <Badge variant="outline">indisponível: {s.block_state}</Badge>}</li>)}</ul>}
      </div>
      {readOnly && <StatePanel tone="info" title="Somente leitura" description={diaryMessage(`diary:year-not-operational:${diary.year_state ?? ""}`)} />}
      {!operational && !readOnly && <StatePanel tone="warning" title="Registro de aulas indisponível" description={diaryMessage(`diary:year-not-operational:${diary.year_state ?? ""}`)} />}
      {operational && !editing && <LessonForm key={`new-lesson-${savedRevision}`} diary={diary} on={on} slots={slots ?? []} catalog={catalog} onSaved={saved} />}
      {operational && editing && <LessonForm key={editing.lesson_version_id} diary={diary} on={editing.lesson_date} slots={slots ?? []} catalog={catalog} base={editing} onSaved={saved} onCancel={() => setEditing(null)} />}
      <div>
        <h2 className="font-semibold">Aulas ministradas (registradas)</h2>
        {lessonsQuery.isError ? <ReadFailure title="Não foi possível ler as aulas registradas" retry={() => void lessonsQuery.refetch()} /> : !lessons ? <SkeletonState label="Carregando" /> : ordered.length === 0 ? <p className="text-sm">Nenhuma aula registrada.</p> : (
          <ul className="divide-y text-sm">{ordered.map((l) => (
            <li key={l.lesson_version_id} className="space-y-1 py-2">
              <span className="font-medium">{l.lesson_date}</span> · versão {l.version_number}
              {l.recorded_as === "substituto" && <Badge variant="outline" className="ml-1">Substituição</Badge>}
              <span className="block">{l.facts.content}</span>
              {l.facts.observation && <span className="block text-xs text-muted-foreground">{l.facts.observation}</span>}
              <span className="block text-xs text-muted-foreground">Referências curriculares: {l.reference_item_ids.length || "nenhuma"}
                {l.attendance_version_number ? ` · chamada versão ${l.attendance_version_number}` : " · sem chamada"}</span>
              {operational && <span className="flex gap-2"><Button size="sm" variant="link" onClick={() => setEditing(l)}>Corrigir aula</Button></span>}
              {operational && <Attendance key={`${l.lesson_version_id}|${l.attendance_version_id ?? "none"}`} diary={diary} lesson={l} onSaved={saved} scope={scope} />}
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
  const saving = useDiarySave(() => onSaved(base ? "Correção registrada como nova versão." : "Aula registrada."));
  const usable = slots.filter((s) => s.block_state === "utilizavel");
  const changed = base ? changedAspects(base, { content, observation: obs, blocks, references: refs }) : [];
  const save = () => {
    const payload = { logical: base?.logical_record_id ?? `aula-${crypto.randomUUID()}`, diary, date: on, base: base?.lesson_version_id ?? null,
      content, observation: obs, blocks: [...blocks], references: [...refs], justification: base ? just || null : null, changed: [...changed] };
    void saving.submit(() => recordLesson(payload));
  };
  return (
    <div className="space-y-2"><fieldset disabled={saving.locked} className="space-y-2 rounded border p-3"><legend className="font-semibold">{base ? `Corrigir aula de ${on} (versão ${base.version_number})` : `Registrar aula ministrada em ${on}`}</legend>
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
        <Button disabled={!content.trim() || (base && changed.length === 0)} onClick={save}>{saving.status === "sending" ? "Enviando…" : base ? "Registrar correção" : "Registrar aula"}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
      </div>
    </fieldset>
    {saving.message && <p role="alert" className="text-sm">{saving.message}</p>}
    {saving.status === "unknown" && <Button variant="outline" onClick={save}>Conferir envio novamente</Button>}
    </div>
  );
}

function Attendance({ diary, lesson, onSaved, scope }: { diary: MyDiary; lesson: LessonRow; onSaved: (m: string) => void; scope: readonly (string | number)[] }) {
  const saved = currentMarks(lesson);
  const [marks, setMarks] = useState<Record<string, Mark>>(saved);
  const [just, setJust] = useState("");
  const [openA, setOpenA] = useState(false);
  const saving = useDiarySave(() => onSaved(lesson.attendance_version_id ? "Correção da chamada registrada como nova versão." : "Chamada registrada."));
  const isCorrection = !!lesson.attendance_version_id;
  const rosterQuery = useQuery({ queryKey: ["teacher-diary-roster", ...scope, key(diary), lesson.lesson_date, lesson.attendance_version_id], queryFn: () => readRosterSafely(diary, lesson.lesson_date), enabled: openA, retry: false });
  if (!openA) return <Button size="sm" variant="link" onClick={() => setOpenA(true)}>{isCorrection ? "Corrigir chamada" : "Fazer chamada"}</Button>;
  if (rosterQuery.isError) return <ReadFailure title="Não foi possível ler os alunos da aula" retry={() => void rosterQuery.refetch()} />;
  const roster = rosterQuery.data;
  if (!roster) return <SkeletonState label="Carregando alunos da data da aula" />;
  // Correção usa a fotografia da chamada original, nunca a turma de hoje.
  const eligible = lesson.eligible_student_ids;
  const list = isCorrection && eligible ? roster.filter((r) => eligible.includes(r.student_id)) : roster;
  const missing = unmarkedCount(list, marks);
  const changed = Object.keys(marks).some((k) => marks[k] !== saved[k]);
  const save = () => {
    const snapshot = { ...marks }; const reason = isCorrection ? just || null : null;
    void saving.submit(() => recordAttendance(lesson.logical_record_id, lesson.attendance_version_id, snapshot, reason));
  };
  return (
    <div className="mt-2 space-y-2">
      <fieldset disabled={saving.locked} className="space-y-2">
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
        <Button size="sm" disabled={Object.keys(marks).length === 0 || (isCorrection && !changed)} onClick={save}>{saving.status === "sending" ? "Enviando…" : isCorrection ? "Registrar correção" : "Registrar chamada"}</Button>
      </div>
      </fieldset>
      {saving.message && <p role="alert" className="text-sm">{saving.message}</p>}
      {saving.status === "unknown" && <Button variant="outline" onClick={save}>Conferir envio novamente</Button>}
    </div>
  );
}
