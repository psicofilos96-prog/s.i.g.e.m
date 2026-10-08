// Central de tarefas — núcleo puro. Manuais = fatos gravados (eventos append-only); derivadas = projeção do
// estado REAL do workflow (somem quando o processo encerra). Prazo só se declarado; nenhum SLA presumido.
import type { Pending } from "@/features/workflows/workflow-model";

export type TaskStatus = "aberta" | "em-andamento" | "concluida" | "cancelada";
/** NSTATE.2 — transições que a tela oferece por estado canônico; terminal não oferece nada. */
export const TASK_ACTIONS_FROM: Readonly<Record<TaskStatus, readonly { to: TaskStatus; label: string }[]>> = {
  aberta: [{ to: "em-andamento", label: "Iniciar" }, { to: "concluida", label: "Concluir" }],
  "em-andamento": [{ to: "concluida", label: "Concluir" }],
  concluida: [], cancelada: [],
};
export const taskActions = (s: string) => (TASK_ACTIONS_FROM as Record<string, readonly { to: TaskStatus; label: string }[]>)[s] ?? [];
export type TaskEvent = { seq: number; kind: "atribuicao" | "status" | "comentario"; assigneeEngagement: string | null; status: TaskStatus | null; comment: string | null; actor: string; recordedAt: string };
export type ManualTaskRow = { id: string; schoolId: string; title: string; description: string | null; priorityId: string | null; dueOn: string | null; recurrence: unknown; sourceKind: string | null; sourceRef: string | null; createdAt: string };
export type Priority = { id: string; label: string; ordinal: number };

export type TaskView = {
  key: string;
  origin: "manual" | "workflow";
  id: string;
  schoolId: string | null;
  title: string;
  status: TaskStatus | string;
  open: boolean;
  dueOn: string | null;
  priority: Priority | null;
  /** Atuação responsável; null = sem responsável. */
  assignee: string | null;
  /** Responsável cuja atuação não está mais vigente ⇒ tarefa órfã, exige reatribuição. */
  orphan: boolean;
  source: { kind: string; ref: string } | null;
  recurrence: string | null;
  seq: number;
  comments: { text: string; actor: string; at: string }[];
  history: TaskEvent[];
  canAct: boolean;
};

export function projectManual(row: ManualTaskRow, events: TaskEvent[], priorities: Map<string, Priority>, activeEngagements: ReadonlySet<string>): TaskView | null {
  const evs = [...events].sort((a, b) => a.seq - b.seq);
  // Cadeia quebrada (sem abertura, buraco de seq) nunca vira estado.
  if (!evs.length || evs.some((e, i) => e.seq !== i + 1) || evs[0]!.kind !== "status") return null;
  const status = [...evs].reverse().find((e) => e.kind === "status")!.status!;
  const assignee = [...evs].reverse().find((e) => e.kind === "atribuicao")?.assigneeEngagement ?? null;
  const open = status === "aberta" || status === "em-andamento";
  return {
    key: `manual:${row.id}`, origin: "manual", id: row.id, schoolId: row.schoolId, title: row.title, status, open,
    dueOn: row.dueOn, priority: row.priorityId ? priorities.get(row.priorityId) ?? null : null,
    assignee, orphan: open && (assignee === null || !activeEngagements.has(assignee)),
    source: row.sourceKind && row.sourceRef ? { kind: row.sourceKind, ref: row.sourceRef } : null,
    recurrence: describeRecurrence(row.recurrence),
    seq: evs.length,
    comments: evs.filter((e) => e.kind === "comentario").map((e) => ({ text: e.comment ?? "", actor: e.actor, at: e.recordedAt })),
    history: evs, canAct: open,
  };
}

/** Recorrência só existe se configurada explicitamente (objeto com `regra`); nada é inferido. */
export function describeRecurrence(r: unknown): string | null {
  if (!r || typeof r !== "object" || !("regra" in r)) return null;
  const regra = (r as { regra: unknown }).regra;
  return typeof regra === "string" && regra.trim() ? regra.trim().slice(0, 120) : null;
}

/** Derivadas: espelho do workflow. Concluir é transição real no processo, nunca clique na tarefa. */
export function projectWorkflow(p: Pending): TaskView {
  return {
    key: `workflow:${p.instanceId}`, origin: "workflow", id: p.instanceId, schoolId: p.schoolId, title: `${p.title} — ${p.subjectRef}`,
    status: p.state, open: !p.terminal, dueOn: p.dueOn, priority: null, assignee: null, orphan: false,
    source: { kind: "workflow", ref: p.instanceId }, recurrence: null, seq: p.seq, comments: [], history: [], canAct: p.canAct,
  };
}

export type TaskFilter = { view: "minhas" | "setor" | "concluidas"; myEngagements: ReadonlySet<string> };

export function filterTasks(items: TaskView[], f: TaskFilter): TaskView[] {
  return items.filter((t) => f.view === "concluidas" ? !t.open
    : !t.open ? false
    : f.view === "minhas" ? (t.origin === "workflow" ? t.canAct : t.assignee !== null && f.myEngagements.has(t.assignee) && !t.orphan)
    : true);
}

/** Ordenação: prioridade configurada (se houver), depois prazo declarado; ausente nunca vira "hoje". */
export function sortTasks(items: TaskView[]): TaskView[] {
  return [...items].sort((a, b) =>
    (a.priority?.ordinal ?? Infinity) - (b.priority?.ordinal ?? Infinity) ||
    (a.dueOn ?? "9999") .localeCompare(b.dueOn ?? "9999") || a.title.localeCompare(b.title));
}

/** Agenda operacional: só tarefas abertas COM prazo declarado, agrupadas por data. Não é o Calendário Escolar. */
export function operationalAgenda(items: TaskView[]): { date: string; tasks: TaskView[] }[] {
  const by = new Map<string, TaskView[]>();
  for (const t of items) if (t.open && t.dueOn) by.set(t.dueOn, [...(by.get(t.dueOn) ?? []), t]);
  return [...by.keys()].sort().map((date) => ({ date, tasks: by.get(date)! }));
}

export const dedupeKey = (schoolId: string, sourceKind: string | null, sourceRef: string | null, title: string, nonce: string) =>
  sourceKind && sourceRef ? `fonte:${sourceKind}:${sourceRef}:${schoolId}` : `manual:${schoolId}:${nonce}:${title.slice(0, 40)}`;
