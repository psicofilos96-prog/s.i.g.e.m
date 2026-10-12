/**
 * Gestão de Pessoas L17 — Simulador isolado de pessoal.
 * Opera só sobre CÓPIA congelada da base lida (impressão digital); nenhuma
 * função grava, e o resultado é marcado `simulacao: true`. Demanda sem carga
 * conhecida e jornada desconhecida permanecem null (nunca zero).
 */

export type SimDemand = Readonly<{ classId: string; componentId: string; lessons: number | null; schoolId: string }>;
export type SimAssignment = Readonly<{ id: string; linkId: string; classId: string; componentId: string; lessons: number; slots: readonly string[] }>;
export type SimLink = Readonly<{ linkId: string; capacityLessons: number | null; onLeave: boolean }>;

export type SimBase = Readonly<{ demands: readonly SimDemand[]; assignments: readonly SimAssignment[]; links: readonly SimLink[] }>;

export type SimChange =
  | Readonly<{ kind: "abrir-turma"; classId: string; schoolId: string; demands: readonly { componentId: string; lessons: number | null }[] }>
  | Readonly<{ kind: "fechar-turma"; classId: string }>
  | Readonly<{ kind: "alterar-matriz"; classId: string; componentId: string; lessons: number | null }>
  | Readonly<{ kind: "alterar-jornada"; linkId: string; capacityLessons: number | null }>
  | Readonly<{ kind: "afastamento"; linkId: string }>
  | Readonly<{ kind: "substituicao"; fromLinkId: string; toLinkId: string }>
  | Readonly<{ kind: "redistribuir"; assignmentId: string; toLinkId: string }>;

export type SimMetrics = Readonly<{
  demand: number | null; covered: number; uncovered: number | null;
  conflicts: readonly string[]; overloaded: readonly string[]; unknownCapacity: readonly string[];
}>;

export const fingerprint = (b: SimBase) => {
  const s = JSON.stringify(b); let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `fp-${(h >>> 0).toString(16)}`;
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function applyChanges(base: SimBase, changes: readonly SimChange[]): { state: SimBase; problems: string[] } {
  const s = clone(base) as { demands: SimDemand[]; assignments: SimAssignment[]; links: SimLink[] };
  const problems: string[] = [];
  const link = (id: string) => s.links.find((l) => l.linkId === id);
  changes.forEach((c, i) => {
    const p = (m: string) => problems.push(`#${i} ${c.kind}: ${m}`);
    switch (c.kind) {
      case "abrir-turma":
        if (s.demands.some((d) => d.classId === c.classId)) return p("turma já existe");
        c.demands.forEach((d) => s.demands.push({ classId: c.classId, schoolId: c.schoolId, ...d }));
        return;
      case "fechar-turma":
        if (!s.demands.some((d) => d.classId === c.classId)) return p("turma inexistente");
        s.demands = s.demands.filter((d) => d.classId !== c.classId);
        s.assignments = s.assignments.filter((a) => a.classId !== c.classId);
        return;
      case "alterar-matriz": {
        const k = s.demands.findIndex((d) => d.classId === c.classId && d.componentId === c.componentId);
        if (k < 0) return p("linha de demanda inexistente");
        s.demands[k] = { ...s.demands[k]!, lessons: c.lessons };
        return;
      }
      case "alterar-jornada": {
        const k = s.links.findIndex((l) => l.linkId === c.linkId);
        if (k < 0) return p("vínculo inexistente");
        s.links[k] = { ...s.links[k]!, capacityLessons: c.capacityLessons };
        return;
      }
      case "afastamento": {
        const k = s.links.findIndex((l) => l.linkId === c.linkId);
        if (k < 0) return p("vínculo inexistente");
        s.links[k] = { ...s.links[k]!, onLeave: true };
        return;
      }
      case "substituicao":
        if (!link(c.fromLinkId) || !link(c.toLinkId)) return p("vínculo inexistente");
        s.assignments = s.assignments.map((a) => (a.linkId === c.fromLinkId ? { ...a, linkId: c.toLinkId } : a));
        return;
      case "redistribuir": {
        const k = s.assignments.findIndex((a) => a.id === c.assignmentId);
        if (k < 0 || !link(c.toLinkId)) return p("atribuição ou vínculo inexistente");
        s.assignments[k] = { ...s.assignments[k]!, linkId: c.toLinkId };
      }
    }
  });
  return { state: s, problems };
}

export function measure(s: SimBase): SimMetrics {
  const onLeave = new Set(s.links.filter((l) => l.onLeave).map((l) => l.linkId));
  const active = s.assignments.filter((a) => !onLeave.has(a.linkId));
  let demand: number | null = 0, uncovered: number | null = 0, covered = 0;
  for (const d of s.demands) {
    const got = active.filter((a) => a.classId === d.classId && a.componentId === d.componentId).reduce((t, a) => t + a.lessons, 0);
    if (d.lessons === null) { demand = null; uncovered = null; covered += got; continue; }
    const c = Math.min(got, d.lessons);
    covered += c;
    if (demand !== null) demand += d.lessons;
    if (uncovered !== null) uncovered += d.lessons - c;
  }
  const conflicts: string[] = [];
  const seen = new Map<string, string>();
  for (const a of active) for (const slot of a.slots) {
    const key = `${a.linkId}|${slot}`; const prev = seen.get(key);
    if (prev) conflicts.push(`${a.linkId}@${slot}:${prev}+${a.id}`); else seen.set(key, a.id);
  }
  const overloaded: string[] = [], unknownCapacity: string[] = [];
  for (const l of s.links) {
    const load = active.filter((a) => a.linkId === l.linkId).reduce((t, a) => t + a.lessons, 0);
    if (load === 0) continue;
    if (l.capacityLessons === null) unknownCapacity.push(l.linkId);
    else if (load > l.capacityLessons) overloaded.push(l.linkId);
  }
  return { demand, covered, uncovered, conflicts, overloaded, unknownCapacity };
}

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

export function simulate(base: SimBase, changes: readonly SimChange[]) {
  const baseFingerprint = fingerprint(base);
  const { state, problems } = applyChanges(base, changes);
  const before = measure(base), after = measure(state);
  return {
    simulacao: true as const, writes: [] as const, baseFingerprint, problems, before, after,
    impact: {
      demand: delta(before.demand, after.demand),
      covered: after.covered - before.covered,
      uncovered: delta(before.uncovered, after.uncovered),
      newConflicts: after.conflicts.filter((c) => !before.conflicts.includes(c)),
      newOverloaded: after.overloaded.filter((c) => !before.overloaded.includes(c)),
    },
  };
}

/** Base real mudou ⇒ cenário desatualizado; nunca rebaseado em silêncio. */
export const isStale = (savedFingerprint: string, currentBase: SimBase) => savedFingerprint !== fingerprint(currentBase);
