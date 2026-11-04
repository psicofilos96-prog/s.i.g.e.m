/** Acompanhamento institucional das unidades: projeções sem regra administrativa implícita. */
export type FollowupVisit = {
  id: string; logical_id: string; version: number; school_id: string; visit_date: string;
  diagnosis: string; strengths: string; weaknesses: string; summary: string | null;
  /** Texto declarado, separado do autor identificado por auth.uid(). */
  participants_note?: string | null; purpose_note?: string | null;
  correction_reason: string | null; supersedes_id: string | null;
  can_correct?: boolean; created_at: string; author_name: string | null;
};
export type FollowupAction = {
  id: string; school_id: string; visit_logical_id: string;
  description: string; responsible_label: string | null; due_on: string | null;
  created_at: string; author_name: string | null;
};
export type FollowupUpdate = {
  id: string; action_id: string; visit_logical_id: string | null;
  occurred_on: string; situation: string; done_text: string | null;
  not_done_text: string | null; results: string | null; referrals: string | null;
  created_at: string; author_name: string | null;
};
export type SchoolSnapshot = {
  visits: FollowupVisit[]; visit_history: FollowupVisit[];
  actions: FollowupAction[]; updates: FollowupUpdate[];
};

/** Vinculações sempre usam visitas vigentes: retificações preservam o logical_id. */
export function followupVisitByLogicalId(
  visits: readonly FollowupVisit[], logicalId: string | null,
): FollowupVisit | null {
  return logicalId ? visits.find((v) => v.logical_id === logicalId) ?? null : null;
}

/** Só oferece visitas da mesma unidade, até a data da evolução e não anteriores à origem. */
export function availableFollowupVisits(
  snapshot: SchoolSnapshot, action: FollowupAction | undefined, day: string,
): FollowupVisit[] {
  if (!action || !day) return [];
  const origin = followupVisitByLogicalId(snapshot.visits, action.visit_logical_id);
  if (!origin || origin.school_id !== action.school_id) return [];
  return snapshot.visits.filter((v) =>
    v.school_id === action.school_id && v.visit_date >= origin.visit_date && v.visit_date <= day
  ).sort((a, b) => b.visit_date.localeCompare(a.visit_date) || a.id.localeCompare(b.id));
}
export type NetworkRow = {
  school_id: string; school_name: string; inep?: string | null; visits: number; actions: number;
  completed: number; overdue: number; last_visit: string | null;
};
/** Apenas medidas não declaradas concluídas, vindas do leitor de escopo do banco. */
export type NetworkPendingAction = {
  action_id: string; school_id: string; school_name: string; inep: string | null;
  description: string; responsible_label: string | null; due_on: string | null;
  situation: string; last_update_on: string | null; created_at: string;
};
export type PendingView = "todas" | "vencidas" | "sem prazo" | "sem atualização"
  | "em andamento" | "prevista" | "não realizada" | "suspensa";
export function filterNetworkPending(
  rows: readonly NetworkPendingAction[], view: PendingView, search: string, today: string,
): NetworkPendingAction[] {
  const term = normalizeText(search.trim());
  return rows.filter((row) => {
    if (view === "vencidas" && (!row.due_on || row.due_on >= today)) return false;
    if (view === "sem prazo" && row.due_on !== null) return false;
    if (!["todas", "vencidas", "sem prazo"].includes(view) && row.situation !== view) return false;
    if (term && !normalizeText([
      row.school_name, row.inep ?? "", row.description, row.responsible_label ?? "",
      row.situation, row.due_on ?? "",
    ].join(" ")).includes(term)) return false;
    return true;
  }).sort((a, b) => (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31")
    || a.school_name.localeCompare(b.school_name, "pt-BR") || a.action_id.localeCompare(b.action_id));
}

/** Validação de plano no navegador, espelhada pelo escritor SQL.
 * Uma linha totalmente vazia é opcional; uma parcialmente preenchida não pode sumir.
 */
export type FollowupActionDraft = { description: string; responsible: string; due: string };
export function validateFollowupActionDrafts(
  actions: readonly FollowupActionDraft[], visitDate: string,
): string | null {
  for (const action of actions) {
    if (!action.description.trim()) {
      if (action.responsible.trim() || action.due) {
        return "Uma medida possui responsável ou prazo, mas está sem descrição. Descreva o que precisa ser feito ou limpe essa medida.";
      }
      continue;
    }
    if (action.due && action.due < visitDate) {
      return "O prazo da medida não pode ser anterior à data da visita.";
    }
  }
  return null;
}

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
/** Filtro de medidas de uma unidade; não acrescenta dados de outra escola. */
export type ActionView = "todas" | "prazo vencido" | "sem prazo" | (typeof SITUATIONS)[number]["value"] | typeof NO_UPDATE;

export function filterSchoolActions(
  actions: readonly FollowupAction[],
  updates: readonly FollowupUpdate[],
  view: ActionView,
  term: string,
  today: string,
): FollowupAction[] {
  const q = normalizeText(term.trim());
  return actions.filter((action) => {
    if (view === "prazo vencido" && !isOverdue(action, updates, today)) return false;
    if (view === "sem prazo" && action.due_on !== null) return false;
    if (view !== "todas" && view !== "prazo vencido" && view !== "sem prazo"
      && currentSituation(action, updates) !== view) return false;
    if (q && !normalizeText(
      [action.description, action.responsible_label ?? "", action.due_on ?? ""].join(" "),
    ).includes(q)) return false;
    return true;
  }).sort((a, b) =>
    // Mais urgente primeiro; o prazo ausente fica no final sem valor fabricado.
    (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31")
    || a.description.localeCompare(b.description, "pt-BR") || a.id.localeCompare(b.id));
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
/** Visões descritivas, não categorias de qualidade escolar nem ranking. */
export type NetworkView = "todas" | "visitadas" | "sem visita" | "com prazo vencido";

export function filterNetworkRows(rows: readonly NetworkRow[], term: string, view: NetworkView): NetworkRow[] {
  const matched = searchableNetwork(rows, term);
  return matched.filter((row) => {
    if (view === "visitadas") return row.visits > 0;
    if (view === "sem visita") return row.visits === 0;
    if (view === "com prazo vencido") return row.overdue > 0;
    return true;
  });
}

export function searchableNetwork(rows: readonly NetworkRow[], term: string): NetworkRow[] {
  const q = normalizeText(term.trim());
  return rows.filter((r) => normalizeText(r.school_name + " " + r.school_id + " " + (r.inep ?? "")).includes(q));
}

/** Evita trocar a medida e descartar uma evolução em edição sem aviso. */
export function isEvolutionDraftDirty(draft: {
  day: string; initialDay: string; situation: string; linkedVisitId: string;
  done: string; notDone: string; results: string; referrals: string;
}): boolean {
  return draft.day !== draft.initialDay
    || draft.situation !== SITUATIONS[0].value
    || Boolean(draft.linkedVisitId)
    || [draft.done, draft.notDone, draft.results, draft.referrals]
      .some((value) => value.trim().length > 0);
}

/** Reconhece texto efetivo no formulário de medida, sem confundir linha vazia com rascunho. */
export function isFollowupActionDraftDirty(draft: Readonly<FollowupActionDraft>): boolean {
  return Boolean(draft.description.trim() || draft.responsible.trim() || draft.due);
}

/** Evita perder diagnósticos e planos da visita ao navegar entre escolas.
 *  Uma retificação aberta é um contexto de edição, mesmo antes de alterar o texto.
 */
export function isFollowupVisitDraftDirty(draft: {
  day: string; initialDay: string; correctionBase: string | null;
  diagnosis: string; strengths: string; weaknesses: string; summary: string;
  participants: string; purpose: string; correctionReason: string;
  actions: readonly FollowupActionDraft[];
}): boolean {
  return draft.correctionBase !== null
    || draft.day !== draft.initialDay
    || [draft.diagnosis, draft.strengths, draft.weaknesses, draft.summary,
      draft.participants, draft.purpose, draft.correctionReason]
      .some((value) => value.trim().length > 0)
    || draft.actions.some(isFollowupActionDraftDirty);
}
