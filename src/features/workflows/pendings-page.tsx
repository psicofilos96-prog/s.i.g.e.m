import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate } from "@/lib/academic-date";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { availableTransitions, filterPendings, isOverdue, type Pending, type PendingFilter, type WorkflowEvent } from "./workflow-model";
import { capabilitiesFor, loadPendings, transition } from "./workflow-source";

const VIEWS: { id: PendingFilter["view"]; label: string }[] = [
  { id: "minhas", label: "Minhas pendências" }, { id: "setor", label: "Pendências do setor" }, { id: "historico", label: "Histórico" },
];

export function PendingsPage() {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const [view, setView] = useState<PendingFilter["view"]>("minhas");
  const [key, setKey] = useState<string | null>(null);
  const [overdue, setOverdue] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({ queryKey: ["wf", uid], enabled: !!uid, queryFn: () => loadPendings(uid!) });

  if (a.status === "signed-out") return <EmptyState title="Entre para ver suas pendências" description="Só aparecem processos que sua conta pode ler." />;
  if (a.status === "loading" || q.isLoading) return <SkeletonState label="Carregando" />;
  if (q.isError || q.data == null) return <EmptyState title="Não foi possível carregar" description="Tente novamente em instantes." />;

  const items = filterPendings(q.data.items, { view, workflowKey: key, overdueOn: overdue ? today : null });
  const keys = [...new Set(q.data.items.map((i) => i.workflowKey))];

  return (
    <div className="space-y-6">
      <PageHeader title="Pendências" description="Processos que exigem tramitação. A ação disponível depende da capacidade da sua conta no escopo do processo." />
      <div role="tablist" aria-label="Visão" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => <Button key={v.id} role="tab" aria-selected={view === v.id} variant={view === v.id ? "default" : "outline"} onClick={() => setView(v.id)}>{v.label}</Button>)}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>Processo{" "}<select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={key ?? ""} onChange={(e) => setKey(e.target.value || null)}>
          <option value="">Todos</option>{keys.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-1"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Só com prazo vencido</label>
      </div>
      {q.data.items.length === 0 ? <EmptyState title="Nenhum processo" description="Nenhuma definição de tramitação foi homologada ainda, ou nenhum processo está no seu escopo." />
        : items.length === 0 ? <EmptyState title="Nada nesta visão" description="Altere os filtros ou a visão." />
        : <ul className="space-y-3">{items.map((p) => <Row key={p.instanceId} p={p} today={today} expanded={open === p.instanceId}
            onToggle={() => setOpen(open === p.instanceId ? null : p.instanceId)} events={q.data!.events.get(p.instanceId) ?? []}
            def={[...q.data!.defs.values()].find((d) => d.workflow_key === p.workflowKey && d.title === p.title)?.definition ?? null} />)}</ul>}
    </div>
  );
}

function Row({ p, today, expanded, onToggle, events, def }: { p: Pending; today: string; expanded: boolean; onToggle: () => void; events: WorkflowEvent[];
  def: import("./workflow-model").WorkflowDefinition | null }) {
  const qc = useQueryClient(); const [comment, setComment] = useState(""); const [due, setDue] = useState("");
  const caps = useQuery({ queryKey: ["wf-caps", p.instanceId], enabled: expanded && !!def && p.canAct, queryFn: () => capabilitiesFor(def!, p.schoolId) });
  const m = useMutation({ mutationFn: transition, onSuccess: () => qc.invalidateQueries({ queryKey: ["wf"] }) });
  const actions = def && caps.data ? availableTransitions(def, p.state, caps.data) : [];
  return (
    <li className="rounded-md border p-4">
      <button className="flex w-full min-h-11 flex-wrap items-center justify-between gap-2 text-left" aria-expanded={expanded} onClick={onToggle}>
        <span className="font-medium">{p.title} — {p.subjectRef}</span>
        <span className="text-xs">{p.state}{p.dueOn ? ` · prazo ${formatAcademicDate(p.dueOn)}${isOverdue(p.dueOn, today) ? " (vencido)" : ""}` : " · sem prazo"}</span>
      </button>
      {expanded && <div className="mt-3 space-y-3">
        <ol className="space-y-1 text-xs">{[...events].sort((a, b) => a.seq - b.seq).map((e) => (
          <li key={e.id}>{e.seq}. {e.fromState ? `${e.fromState} → ` : "aberto em "}{e.toState} · {new Date(e.recordedAt).toLocaleString("pt-BR")}{e.comment ? ` — ${e.comment}` : ""}</li>))}</ol>
        {actions.length > 0 && <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs">Comentário<textarea className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <label className="text-xs">Prazo (opcional)<DateInput className="mt-1 block min-h-11" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          {actions.map((t) => <Button key={t.id} variant={t.kind === "cancelamento" ? "outline" : "default"} disabled={m.isPending}
            onClick={() => m.mutate({ instanceId: p.instanceId, transitionId: t.id, expectedSeq: p.seq, comment, dueOn: due || null })}>{t.label ?? t.id}</Button>)}
        </div>}
        {m.error && <p role="alert" className="text-sm text-destructive">{(m.error as Error).message}</p>}
      </div>}
    </li>
  );
}
