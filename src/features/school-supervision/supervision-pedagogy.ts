/**
 * Lote 06 Supervisão — oferta/matrículas, calendário e pedagogia (visão de supervisão).
 * Projeção pura sobre leituras canônicas já feitas com a sessão: só escolas visíveis,
 * nada grava, nada altera calendário nem documento pedagógico; ausência ≠ zero.
 * A Supervisão verifica EXISTÊNCIA e ANDAMENTO; conteúdo segue com OP e docentes.
 */
export type Cell = { state: "registrado"; value: number } | { state: "nao-registrado" | "sem-permissao"; value: null; reason: string };
const val = (n: number | null | undefined, denied = false): Cell =>
  denied ? { state: "sem-permissao", value: null, reason: "leitura negada" }
  : n == null ? { state: "nao-registrado", value: null, reason: "fonte sem registro" } : { state: "registrado", value: n };

// ---------- Oferta, matrículas, turmas, turnos, docentes, ocupação ----------
export interface ClassRow {
  schoolId: string; classId: string; stage: string | null; modality: string | null; shift: string | null;
  capacity: number | null; activeAllocations: number | null; teachersAssigned: number | null; componentsRequired: number | null;
}
export function offerOverview(rows: ClassRow[], schools: string[], groupBy: "stage" | "modality" | "shift") {
  const allowed = new Set(schools);
  const groups = new Map<string, ClassRow[]>();
  for (const r of rows.filter((x) => allowed.has(x.schoolId))) {
    const k = r[groupBy] ?? "não declarado";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups].map(([key, list]) => {
    const sum = (f: (r: ClassRow) => number | null) => list.some((r) => f(r) == null) ? null : list.reduce((a, r) => a + f(r)!, 0);
    const enrolled = sum((r) => r.activeAllocations), cap = sum((r) => r.capacity);
    return {
      key, classes: list.length, enrolled: val(enrolled), capacity: val(cap),
      occupancy: enrolled != null && cap ? enrolled / cap : null,
      teachingGaps: list.filter((r) => r.teachersAssigned != null && r.componentsRequired != null && r.teachersAssigned < r.componentsRequired).map((r) => r.classId),
      teachingUnknown: list.filter((r) => r.teachersAssigned == null || r.componentsRequired == null).map((r) => r.classId),
    };
  });
}

/** Histórico por data de referência: só fotografias lidas; data sem leitura fica explícita. */
export function enrollmentHistory(points: { on: string; total: number | null }[]) {
  return [...points].sort((a, b) => a.on.localeCompare(b.on)).map((p) => ({ on: p.on, total: val(p.total) }));
}

// ---------- Calendário ----------
export interface CalendarDay { date: string; planned: boolean | null; held: boolean | null; suspended: boolean; replacementOf: string | null }
export function calendarFollowUp(applicable: string[] | null, days: CalendarDay[], today: string) {
  if (applicable === null) return { blocked: "calendário não lido" as const };
  if (applicable.length !== 1) return { blocked: applicable.length ? "mais de um calendário aplicável" as const : "sem calendário aplicável" as const };
  const past = days.filter((d) => d.date <= today);
  const indeterminate = days.filter((d) => d.planned === null).map((d) => d.date);
  const planned = indeterminate.length ? null : days.filter((d) => d.planned).length;
  const held = past.some((d) => d.planned && d.held === null) ? null : past.filter((d) => d.planned && d.held).length;
  const suspended = days.filter((d) => d.suspended).map((d) => d.date);
  const replaced = new Set(days.map((d) => d.replacementOf).filter(Boolean) as string[]);
  return {
    calendarId: applicable[0]!, planned: val(planned), held: val(held), indeterminate,
    suspensionsWithoutReplacement: suspended.filter((s) => !replaced.has(s)),
    divergences: past.filter((d) => d.planned === false && d.held === true).map((d) => d.date),
    changeRoute: "Supervisão: construir-calendario-da-rede (ato próprio, nunca por esta visão)",
  };
}

// ---------- Pedagogia: existência e andamento ----------
export type PedKind = "ppp" | "planejamento" | "organizacao-curricular" | "conselho" | "intervencao";
export const PED_OWNER: Record<PedKind, string> = {
  ppp: "Direção/comunidade escolar", planejamento: "docente autor", "organizacao-curricular": "gestão pedagógica da rede",
  conselho: "colegiado (ata)", intervencao: "Orientação Pedagógica",
};
export interface PedFact { schoolId: string; kind: PedKind; status: "inexistente" | "rascunho" | "em-andamento" | "concluido" | null; updatedAt: string | null; deadline: string | null }
export function pedagogyFollowUp(facts: PedFact[], schools: string[], today: string) {
  const allowed = new Set(schools);
  return facts.filter((f) => allowed.has(f.schoolId)).map((f) => ({
    ...f, owner: PED_OWNER[f.kind],
    reading: f.status === null ? "não verificável" : f.status,
    overdue: f.deadline != null && f.status !== null && f.status !== "concluido" && f.deadline < today,
    action: "registrar orientação/visita (record_school_supervision); conteúdo permanece com o autor",
    editable: false as const,
  }));
}
