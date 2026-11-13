import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { operationalToday } from "@/lib/academic-date";
import { readDiariesSafely } from "./diary-read";
import { useTeacherLabels } from "./teacher-labels";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { type DiarySearch } from "@/features/diary/diary-data";
import { useCloudPeriodFacts } from "@/features/assessment/assessment-period-sources";
import { NewInstrumentPage } from "@/features/assessment/assessment-instrument-pages";
import { AssessmentEntryFieldPage } from "@/features/assessment/assessment-entry-field-page";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { SkeletonState } from "@/components/sigem/guidance";

export function TeacherNotesPage({ search }: { search: DiarySearch }) {
  const authority = useSessionAuthority();
  const on = search.data ?? operationalToday();
  const diaries = useQuery({ queryKey: ["teacher-diaries", authority.status === "signed-in" ? authority.user.id : null, authority.status === "signed-in" ? authority.sessionRevision : null, on], enabled: authority.status === "signed-in" && !!authority.person, retry: false, queryFn: () => readDiariesSafely(on, new Date().toISOString()) });
  const labels = useTeacherLabels((diaries.data ?? []).map((d) => d.class_id), on);
  const list = (diaries.data ?? []).map((d) => ({ id: d.assignment_id, classId: d.class_id, field: d.component_id ?? d.item_key ?? "", yearId: d.academic_year_id, label: `${labels.data?.classes.get(d.class_id) ?? "Turma"} · ${labels.data?.elements.get(d.component_label ?? d.item_key ?? "") ?? d.component_label ?? "Disciplina"}` }));
  const selected = list.find((a) => a.classId === search.turma && (!search.componente || a.field === search.componente)) ?? list[0];
  const navigate = useNavigate();
  if (authority.status !== "signed-in" || !authority.person) return <StatePanel title="Notas indisponíveis" description="Entre com uma conta docente vinculada à sua pessoa." tone="warning" />;
  if (diaries.isError) return <StatePanel title="Não foi possível ler suas turmas" description="Tente abrir Notas novamente." tone="warning" />;
  if (diaries.isPending) return <SkeletonState label="Carregando suas turmas" />;
  return <div className="space-y-5">
    <header><h1 className="font-display text-3xl font-semibold">Notas</h1></header>
    <label className="grid max-w-xl gap-2 text-sm font-medium">Turma e disciplina
      <select className="h-11 rounded-md border border-input bg-background px-3" value={selected?.id ?? ""} onChange={(e) => {
        const a = list.find((item) => item.id === e.target.value);
        if (a) void navigate({ to: "/diario", search: { ...search, aba: "avaliacoes", turma: a.classId, componente: a.field } });
      }}>
        {!selected && <option value="">Nenhuma turma nesta data</option>}
        {list.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
    </label>
    {selected ? <NotesWorkspace key={selected.id} classId={selected.classId} search={{ ...search, data: on, turma: selected.classId, componente: selected.field }} assignmentId={selected.id} yearId={selected.yearId} /> : <EmptyState title="Nenhuma turma disponível nesta data" description="Consulte outra data ou confira sua atribuição com a escola." />}
  </div>;
}

function NotesWorkspace({ classId, search, assignmentId, yearId }: { classId: string; search: DiarySearch; assignmentId: string; yearId: string }) {
  const authority = useSessionAuthority();
  const facts = useCloudPeriodFacts(classId, yearId, authority.status === "signed-in", search.data);
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
          : <EmptyState title={own.length ? "Escolha uma avaliação" : "Nenhuma avaliação neste período"} description="" />}</>}
  </div>;
}