/** Acompanhamento institucional das unidades: projeções sem regra administrativa implícita. */
export type FollowupVisit = {
  id: string; logical_id: string; version: number; school_id: string; visit_date: string;
  diagnosis: string; strengths: string; weaknesses: string; summary: string | null;
  created_at: string; author_name: string | null;
};
export type FollowupAction = {
  id: string; school_id: string; visit_logical_id: string;
  description: string; responsible_label: string | null; due_on: string | null;
  created_at: string;
};
export type FollowupUpdate = {
  id: string; action_id: string; visit_logical_id: string | null;
  occurred_on: string; situation: string; done_text: string | null;
  not_done_text: string | null; results: string | null; referrals: string | null;
  created_at: string;
};
export type SchoolSnapshot = {
  visits: FollowupVisit[]; actions: FollowupAction[]; updates: FollowupUpdate[];
};
export type NetworkRow = {
  school_id: string; school_name: string; visits: number; actions: number;
  completed: number; overdue: number; last_visit: string | null;
};
/** Sem atualização registrada não se conclui que houve omissão: é dado ainda não informado. */
export const NO_UPDATE = "sem atualização";
export const SITUATIONS = [
  { value: "prevista", label: "Prevista" },
  { value: "em andamento", label: "Em andamento" },
  { value: "concluída", label: "Concluída (declarada)" },
  { value: "não realizada", label: "Não realizada (declarada)" },
  { value: "suspensa", label: "Suspensa" },
] as const;

export function currentUpdate(action: FollowupAction, updates: readonly FollowupUpdate[]): FollowupUpdate | null {
  return [...updates].filter((u) => u.action_id === action.id)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0] ?? null;
}
export function currentSituation(action: FollowupAction, updates: readonly FollowupUpdate[]): string {
  return currentUpdate(action, updates)?.situation ?? NO_UPDATE;
}
export function isOverdue(action: FollowupAction, updates: readonly FollowupUpdate[], today: string): boolean {
  if (!action.due_on || action.due_on >= today) return false;
  return currentSituation(action, updates) !== "concluída";
}
export function schoolIndicators(snapshot: SchoolSnapshot, today: string) {
  const visits = snapshot.visits.length;
  const actions = snapshot.actions.length;
  const completed = snapshot.actions.filter((a) => currentSituation(a, snapshot.updates) === "concluída").length;
  const overdue = snapshot.actions.filter((a) => isOverdue(a, snapshot.updates, today)).length;
  const noDueDate = snapshot.actions.filter((a) => !a.due_on).length;
  const withoutUpdate = snapshot.actions.filter((a) => currentSituation(a, snapshot.updates) === NO_UPDATE).length;
  return { visits, actions, completed, overdue, noDueDate, withoutUpdate };
}
export function networkIndicators(rows: readonly NetworkRow[]) {
  return rows.reduce((a, r) => ({
    schools: a.schools + 1, visitedSchools: a.visitedSchools + (r.visits > 0 ? 1 : 0),
    visits: a.visits + r.visits, actions: a.actions + r.actions,
    completed: a.completed + r.completed, overdue: a.overdue + r.overdue,
  }), { schools: 0, visitedSchools: 0, visits: 0, actions: 0, completed: 0, overdue: 0 });
}
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
export function searchableNetwork(rows: readonly NetworkRow[], term: string): NetworkRow[] {
  const q = normalizeText(term.trim());
  return rows.filter((r) => normalizeText(r.school_name + " " + r.school_id).includes(q));
}
