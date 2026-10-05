/**
 * Quadro docente: demanda (grade) × cobertura (regência vigente) × disponibilidade (só se houver fonte).
 * Projeção pura, calculada na hora; nada é gravado e nenhuma decisão funcional é tomada.
 * Ausência de fonte ⇒ null (nunca zero). Déficit/excedência só existem com todas as parcelas.
 */
export const STAFFING_FORMULA = {
  id: "quadro-docente", version: 1,
  demand: "Σ minutos semanais dos blocos utilizáveis da grade vigente (class_schedule_at), por turma × componente; aulas = nº de blocos.",
  coverage: "minutos dos blocos cujo responsável na grade tem regência vigente (teaching_assignments_at) do mesmo componente na turma.",
  uncovered: "demanda − cobertura, por turma × componente; exige grade E regência lidas.",
  balance: "disponibilidade − minutos atribuídos, por pessoa; só existe com disponibilidade fornecida para a pessoa.",
} as const;

export type Block = Readonly<{ blockKey: string; componentId: string | null; minutes: number; engagementIds: readonly string[]; usable: boolean }>;
export type Assignment = Readonly<{ assignmentId: string; componentId: string | null; engagementId: string; personId: string | null; vigente: boolean }>;
export type ClassInput = Readonly<{ classId: string; label: string | null; blocks: readonly Block[] | null; assignments: readonly Assignment[] | null }>;

export type Ref = Readonly<{ kind: "bloco" | "regencia" | "turma"; id: string }>;
export type CellResult = Readonly<{
  classId: string; componentId: string | null;
  lessons: number; demandMinutes: number;
  coveredMinutes: number | null; uncoveredMinutes: number | null;
  reasons: readonly string[]; refs: readonly Ref[];
}>;
export type ClassResult = Readonly<{ classId: string; label: string | null; state: "ok" | "sem-grade" | "grade-ilegivel" | "regencia-ilegivel"; cells: readonly CellResult[] }>;

export function projectClass(c: ClassInput): ClassResult {
  if (c.blocks == null) return { classId: c.classId, label: c.label, state: "grade-ilegivel", cells: [] };
  const usable = c.blocks.filter((b) => b.usable);
  if (usable.length === 0) return { classId: c.classId, label: c.label, state: "sem-grade", cells: [] };
  const byComp = new Map<string | null, Block[]>();
  for (const b of usable) byComp.set(b.componentId, [...(byComp.get(b.componentId) ?? []), b]);
  const cells: CellResult[] = [...byComp].map(([componentId, blocks]) => {
    const demandMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
    const reasons: string[] = []; const refs: Ref[] = blocks.map((b) => ({ kind: "bloco", id: b.blockKey }));
    if (componentId == null) reasons.push("Bloco sem componente declarado na grade.");
    if (c.assignments == null) return { classId: c.classId, componentId, lessons: blocks.length, demandMinutes, coveredMinutes: null, uncoveredMinutes: null, reasons: [...reasons, "Regências não puderam ser lidas."], refs };
    const regs = c.assignments.filter((a) => a.componentId != null && a.componentId === componentId);
    const active = new Set(regs.filter((a) => a.vigente).map((a) => a.engagementId));
    regs.forEach((a) => refs.push({ kind: "regencia", id: a.assignmentId }));
    if (regs.some((a) => !a.vigente)) reasons.push("Há regência deste componente com atuação não vigente (afastamento/encerramento).");
    let covered = 0;
    for (const b of blocks) {
      if (b.engagementIds.some((e) => active.has(e))) covered += b.minutes;
      else if (b.engagementIds.length === 0) reasons.push(`Bloco ${b.blockKey} sem responsável na grade.`);
      else reasons.push(`Bloco ${b.blockKey}: responsável da grade sem regência vigente deste componente.`);
    }
    return { classId: c.classId, componentId, lessons: blocks.length, demandMinutes, coveredMinutes: covered, uncoveredMinutes: demandMinutes - covered, reasons, refs };
  });
  return { classId: c.classId, label: c.label, state: c.assignments == null ? "regencia-ilegivel" : "ok", cells };
}

export type PersonLoad = Readonly<{ personId: string; engagementIds: readonly string[]; assignedMinutes: number; availableMinutes: number | null; balanceMinutes: number | null; refs: readonly Ref[] }>;

/** Atribuição por pessoa (dois vínculos/atuações da mesma pessoa somam numa pessoa só). */
export function personLoads(classes: readonly ClassInput[], availability: ReadonlyMap<string, number> | null): PersonLoad[] {
  const m = new Map<string, { eng: Set<string>; min: number; refs: Ref[] }>();
  for (const c of classes) {
    if (!c.blocks || !c.assignments) continue;
    const regByEng = new Map<string, Assignment[]>();
    c.assignments.filter((a) => a.vigente && a.personId).forEach((a) => regByEng.set(a.engagementId, [...(regByEng.get(a.engagementId) ?? []), a]));
    for (const b of c.blocks.filter((x) => x.usable)) for (const e of b.engagementIds) {
      const a = regByEng.get(e)?.find((x) => x.componentId === b.componentId); if (!a) continue;
      const p = m.get(a.personId!) ?? { eng: new Set(), min: 0, refs: [] };
      p.eng.add(e); p.min += b.minutes; p.refs.push({ kind: "bloco", id: b.blockKey }); m.set(a.personId!, p);
    }
  }
  return [...m].map(([personId, p]) => {
    const av = availability?.get(personId) ?? null;
    return { personId, engagementIds: [...p.eng], assignedMinutes: p.min, availableMinutes: av, balanceMinutes: av == null ? null : av - p.min, refs: p.refs };
  });
}

export type Totals = Readonly<{
  classes: number; unreadable: number; lessons: number | null; demandMinutes: number | null; uncoveredMinutes: number | null; complete: boolean;
}>;

/** Totais da rede/escola: só fecham se TODAS as turmas forem legíveis; caso contrário, null + parcial. */
export function totals(results: readonly ClassResult[]): Totals {
  const unreadable = results.filter((r) => r.state === "grade-ilegivel").length;
  const regUnread = results.some((r) => r.state === "regencia-ilegivel");
  const cells = results.flatMap((r) => r.cells);
  const complete = unreadable === 0;
  const sum = (f: (c: CellResult) => number) => cells.reduce((s, c) => s + f(c), 0);
  return { classes: results.length, unreadable, complete,
    lessons: complete ? sum((c) => c.lessons) : null, demandMinutes: complete ? sum((c) => c.demandMinutes) : null,
    uncoveredMinutes: complete && !regUnread ? sum((c) => c.uncoveredMinutes ?? 0) : null };
}

/** Reconciliação: demanda = cobertura + descoberto em cada célula com regência lida. */
export const reconciles = (r: readonly ClassResult[]) => r.flatMap((x) => x.cells).every((c) => c.coveredMinutes == null || c.coveredMinutes + (c.uncoveredMinutes ?? 0) === c.demandMinutes);

/** Cenário: só com parâmetros explícitos; nunca contrata, remove ou decide. */
export type Scenario = Readonly<{ minutesPerTeacher: number }>;
export function scenarioTeachersNeeded(uncoveredMinutes: number | null, s: Scenario | null): number | null {
  if (uncoveredMinutes == null || !s || !(s.minutesPerTeacher > 0)) return null;
  return Math.ceil(uncoveredMinutes / s.minutesPerTeacher);
}
