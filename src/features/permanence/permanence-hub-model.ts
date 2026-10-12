// L23 — modelo puro da tela: contagens distintas, central sem identificação e linha do tempo.
export interface CaseRow { id: string; schoolId: string; studentRef: string; openedAt: string }
export interface TimelineEvent { id: string; at: string; label: string }

export const CASE_LIST_LIMIT = 500;

export function dashboardCounts(rows: readonly CaseRow[]) {
  return {
    cases: new Set(rows.map((r) => r.id)).size,
    students: new Set(rows.map((r) => r.studentRef)).size,
    schools: new Set(rows.map((r) => r.schoolId)).size,
    truncated: rows.length >= CASE_LIST_LIMIT,
  };
}

/** Central mostra só data e escola: identificador do estudante nunca vai à tela. */
export function caseCentralRows(rows: readonly CaseRow[]) {
  return rows.map((r) => ({ id: r.id, opened: r.openedAt.slice(0, 10), school: r.schoolId, row: r }));
}

/** Linha do tempo cronológica; fonte negada (null) marca histórico parcial, nunca vazio. */
export function timelineOf(primary: readonly TimelineEvent[], extra: readonly TimelineEvent[] | null): TimelineEvent[] & { partial?: boolean } {
  const out = [...primary, ...(extra ?? [])].sort((a, b) => a.at.localeCompare(b.at)) as TimelineEvent[] & { partial?: boolean };
  out.partial = extra === null;
  return out;
}
