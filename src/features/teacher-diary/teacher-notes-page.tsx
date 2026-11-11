import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { diaryContext, DEFAULT_DIARY_PROFESSIONAL_ID, type DiarySearch } from "@/features/diary/diary-data";
import { teachingClass } from "@/features/diary/institutional-teaching";
import { useCloudPeriodFacts } from "@/features/assessment/assessment-period-sources";
import { NewInstrumentPage } from "@/features/assessment/assessment-instrument-pages";
import { AssessmentEntryFieldPage } from "@/features/assessment/assessment-entry-field-page";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { SkeletonState } from "@/components/sigem/guidance";

export function TeacherNotesPage({ search }: { search: DiarySearch }) {
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const selected = context.assignments.find((a) => a.classId === search.turma && (!search.componente || a.field === search.componente)) ?? context.assignments[0];
  const navigate = useNavigate();
  return <div className="space-y-5">
    <header><h1 className="font-display text-3xl font-semibold">Notas</h1></header>
    <label className="grid max-w-xl gap-2 text-sm font-medium">Turma e disciplina
      <select className="h-11 rounded-md border border-input bg-background px-3" value={selected?.record.id ?? ""} onChange={(e) => {
        const a = context.assignments.find((item) => item.record.id === e.target.value);
        if (a) void navigate({ to: "/diario", search: { ...search, aba: "avaliacoes", turma: a.classId, componente: a.field, unidade: a.unitId } });
      }}>
        {!selected && <option value="">Nenhuma turma nesta data</option>}
        {context.assignments.map((a) => <option key={a.record.id} value={a.record.id}>{a.className} · {a.field} · {a.unitName}</option>)}
      </select>
    </label>
    {selected ? <NotesWorkspace key={selected.record.id} classId={selected.classId} search={{ ...search, turma: selected.classId, componente: selected.field }} assignmentId={selected.record.id} /> : <EmptyState title="Nenhuma turma disponível nesta data" description="Consulte outra data ou confira sua atribuição com a escola." />}
  </div>;
}

function NotesWorkspace({ classId, search, assignmentId }: { classId: string; search: DiarySearch; assignmentId: string }) {
  const authority = useSessionAuthority();
  const facts = useCloudPeriodFacts(classId, teachingClass(classId)?.academicYearId, authority.status === "signed-in", search.data);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const own = facts.instruments.filter((i) => i.pedagogicalAssignmentId === assignmentId && (!period || i.periodId === period));
  const instrument = own.find((i) => i.id === selected);
  if (facts.error) return <div className="space-y-2"><StatePanel tone="warning" title="Não foi possível abrir as avaliações" description="Tente novamente. Nenhuma nota foi alterada." /><Button variant="outline" onClick={() => void facts.refresh()}>Tentar novamente</Button></div>;
  if (!facts.ready) return <SkeletonState label="Carregando avaliações" />;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Período<select className="h-11 rounded-md border border-input bg-background px-3" value={period} onChange={(e) => { setPeriod(e.target.value); setSelected(null); }}><option value="">Todos os períodos</option>{facts.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <Button onClick={() => { setCreating(true); setSelected(null); }}><Plus />Nova avaliação</Button>
    </div>
    {creating ? <section className="space-y-3" aria-label="Nova avaliação"><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><NewInstrumentPage classId={classId} search={search} onCreated={(id) => { setCreating(false); setSelected(id); void facts.refresh(); }} /></section>
      : <><div className="flex flex-wrap gap-2">{own.map((i) => <Button key={i.id} variant={i.id === instrument?.id ? "default" : "outline"} onClick={() => setSelected(i.id)}>{i.title}</Button>)}</div>
        {instrument ? <AssessmentEntryFieldPage key={instrument.id} classId={classId} instrumentId={instrument.id} search={search} />
          : <EmptyState title={own.length ? "Escolha uma avaliação" : "Nenhuma avaliação neste período"} />}</>}
  </div>;
}