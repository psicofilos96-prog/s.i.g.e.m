import { readEffectiveCapabilitiesShared } from "@/features/authority/capabilities-cache";
import { supabase } from "@/integrations/supabase/client";
import { loadPendings } from "@/features/workflows/workflow-source";
import { projectManual, projectWorkflow, type Priority, type TaskEvent, type TaskView } from "./task-model";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type TaskLoad = { items: TaskView[]; priorities: Priority[]; myEngagements: Set<string>; manualError: boolean; workflowError: boolean };

/** Tudo pela RLS de quem consulta; atuações vigentes perguntadas ao banco. */
export async function loadTasks(userId: string): Promise<TaskLoad> {
  const sb = supabase as any;
  const [t, e, p, caps, wf] = await Promise.all([
    sb.from("operational_tasks").select("*"),
    sb.from("operational_task_events").select("*").order("seq"),
    sb.from("operational_task_priorities").select("id, label, ordinal"),
    readEffectiveCapabilitiesShared(),
    loadPendings(userId),
  ]);
  const priorities: Priority[] = p.data ?? [];
  const pmap = new Map(priorities.map((x) => [x.id, x]));
  const myEngagements = new Set<string>((caps.data ?? []).map((c: any) => c.engagement_id));
  const evs = new Map<string, TaskEvent[]>();
  for (const x of e.data ?? []) evs.set(x.task_id, [...(evs.get(x.task_id) ?? []), { seq: x.seq, kind: x.kind, assigneeEngagement: x.assignee_engagement, status: x.status, comment: x.comment, actor: x.actor, recordedAt: x.recorded_at }]);
  const assignees = [...new Set([...evs.values()].flat().map((x) => x.assigneeEngagement).filter(Boolean))] as string[];
  const active = new Set<string>();
  // NPERF.4: a mesma pergunta (atuação × escola) é feita uma vez só, em paralelo; mesmo resultado.
  const pairs = new Map<string, { a: string; school: string }>();
  for (const row of t.data ?? []) for (const a of assignees) pairs.set(`${a}|${row.school_id}`, { a, school: row.school_id });
  const answers = await Promise.all([...pairs.values()].map(async ({ a, school }) => {
    const r = await sb.rpc("operational_engagement_active", { _engagement: a, _school: school });
    return r.data === true ? a : null;
  }));
  for (const a of answers) if (a) active.add(a);
  const items: TaskView[] = [];
  for (const r of t.data ?? []) {
    const v = projectManual({ id: r.id, schoolId: r.school_id, title: r.title, description: r.description, priorityId: r.priority_id, dueOn: r.due_on, recurrence: r.recurrence, sourceKind: r.source_kind, sourceRef: r.source_ref, createdAt: r.created_at }, evs.get(r.id) ?? [], pmap, active);
    if (v) items.push(v);
  }
  for (const pnd of wf?.items ?? []) items.push(projectWorkflow(pnd));
  return { items, priorities, myEngagements, manualError: !!(t.error || e.error), workflowError: wf === null };
}

export async function recordTaskEvent(a: { taskId: string; kind: "status" | "comentario" | "atribuicao"; expectedSeq: number; status?: string; assignee?: string; comment?: string }) {
  const r = await (supabase as any).rpc("record_operational_task_event", { _task: a.taskId, _kind: a.kind, _expected_seq: a.expectedSeq, _idempotency_key: `${a.taskId}:${a.expectedSeq + 1}:${a.kind}`, _status: a.status ?? null, _assignee: a.assignee ?? null, _comment: a.comment ?? null });
  if (r.error) return { ok: false as const, error: String(r.error.message ?? "").replace(/^.*task:/, "") };
  if (a.kind === "atribuicao") {
    // Notificação pela camada comum; falha não desfaz a atribuição, mas é informada.
    const n = await (supabase as any).rpc("emit_notification_event", { _event_key: `tarefa:${a.taskId}:${a.expectedSeq + 1}`, _kind: "tarefa-atribuida", _school: null, _student: null, _payload: {}, _deep_link: "/tarefas", _expires: null });
    return { ok: true as const, notified: !n.error };
  }
  return { ok: true as const, notified: null };
}
