/**
 * Gestão de Pessoas L04 — Lotação administrativa × Exercício profissional.
 * Lotação = onde o vínculo está administrativamente lotado (ato do DP).
 * Exercício = onde a pessoa efetivamente atua, por unidade e período.
 * São fatos distintos, append-only; um nunca é deduzido do outro.
 * Múltiplas escolas só com autorização configurada (`MultiSchoolPolicy`);
 * sem política ⇒ uma escola por vínculo (falha fechada).
 */

export type Interval = Readonly<{ validFrom: string; validUntil: string | null }>;

export type Placement = Readonly<Interval & {
  id: string; linkLogicalId: string; personId: string; schoolId: string;
  actRef: string | null; reason: string | null; authorUserId: string | null; technical: boolean; recordedAt: string;
}>;

export type Exercise = Readonly<Interval & {
  id: string; linkLogicalId: string; personId: string; schoolId: string; functionLabel: string | null;
  weeklyHours: number | null; authorUserId: string | null; technical: boolean; recordedAt: string;
}>;

/** Política configurada: máximo de escolas simultâneas por vínculo; null = sem decisão. */
export type MultiSchoolPolicy = Readonly<{ maxSchoolsPerLink: number | null; homologated: boolean }>;

export const overlaps = (a: Interval, b: Interval) =>
  a.validFrom <= (b.validUntil ?? "9999-12-31") && b.validFrom <= (a.validUntil ?? "9999-12-31");
const covers = (outer: Interval, inner: Interval) =>
  outer.validFrom <= inner.validFrom && (outer.validUntil === null || (inner.validUntil !== null && inner.validUntil <= outer.validUntil));
const activeOn = (i: Interval, d: string) => i.validFrom <= d && (i.validUntil === null || i.validUntil >= d);

export function maxSchools(policy: MultiSchoolPolicy | null): number {
  return policy?.homologated && policy.maxSchoolsPerLink && policy.maxSchoolsPerLink > 0 ? policy.maxSchoolsPerLink : 1;
}

export type PlacementRefusal =
  | "sem-autor" | "executor-tecnico" | "sem-ato" | "intervalo-invalido"
  | "mesma-escola-sobreposta" | "excede-escolas-autorizadas";

export function checkPlacement(p: Placement, existing: readonly Placement[], policy: MultiSchoolPolicy | null): PlacementRefusal | null {
  if (p.technical) return "executor-tecnico";
  if (!p.authorUserId) return "sem-autor";
  if (!p.actRef?.trim()) return "sem-ato";
  if (p.validUntil && p.validUntil < p.validFrom) return "intervalo-invalido";
  const same = existing.filter((e) => e.linkLogicalId === p.linkLogicalId && e.id !== p.id && overlaps(e, p));
  if (same.some((e) => e.schoolId === p.schoolId)) return "mesma-escola-sobreposta";
  // pico de escolas simultâneas em qualquer ponto inicial da janela
  const points = [p.validFrom, ...same.map((e) => e.validFrom).filter((d) => activeOn(p, d))];
  const limit = maxSchools(policy);
  for (const d of points) {
    const schools = new Set([p.schoolId, ...same.filter((e) => activeOn(e, d)).map((e) => e.schoolId)]);
    if (schools.size > limit) return "excede-escolas-autorizadas";
  }
  return null;
}

export type ExerciseRefusal = "sem-autor" | "executor-tecnico" | "intervalo-invalido" | "jornada-invalida" | "sobreposto-na-mesma-escola";

/** Exercício NÃO exige lotação na mesma escola (são fatos distintos), mas a divergência é sinalizada. */
export function checkExercise(x: Exercise, existing: readonly Exercise[]): ExerciseRefusal | null {
  if (x.technical) return "executor-tecnico";
  if (!x.authorUserId) return "sem-autor";
  if (x.validUntil && x.validUntil < x.validFrom) return "intervalo-invalido";
  if (x.weeklyHours !== null && !(x.weeklyHours > 0 && x.weeklyHours <= 168)) return "jornada-invalida";
  if (existing.some((e) => e.id !== x.id && e.linkLogicalId === x.linkLogicalId && e.schoolId === x.schoolId && overlaps(e, x)))
    return "sobreposto-na-mesma-escola";
  return null;
}

export type Divergence = Readonly<{ kind: "exercicio-sem-lotacao-na-escola" | "lotacao-sem-exercicio"; schoolId: string; linkLogicalId: string }>;

/** Divergências na data: só sinalizadas para revisão humana; nada é corrigido. */
export function divergencesOn(day: string, placements: readonly Placement[], exercises: readonly Exercise[]): Divergence[] {
  const out: Divergence[] = [];
  const P = placements.filter((p) => activeOn(p, day)), X = exercises.filter((x) => activeOn(x, day));
  for (const x of X) if (!P.some((p) => p.linkLogicalId === x.linkLogicalId && p.schoolId === x.schoolId && covers(p, { validFrom: day, validUntil: day })))
    out.push({ kind: "exercicio-sem-lotacao-na-escola", schoolId: x.schoolId, linkLogicalId: x.linkLogicalId });
  for (const p of P) if (!X.some((x) => x.linkLogicalId === p.linkLogicalId && x.schoolId === p.schoolId))
    out.push({ kind: "lotacao-sem-exercicio", schoolId: p.schoolId, linkLogicalId: p.linkLogicalId });
  return out;
}

/** Quadro na data e conhecido até knownAt; sem registro ⇒ ausência, nunca zero. */
export function pictureOn(personId: string, day: string, knownAt: string, placements: readonly Placement[], exercises: readonly Exercise[]) {
  const P = placements.filter((p) => p.personId === personId && p.recordedAt <= knownAt && activeOn(p, day));
  const X = exercises.filter((x) => x.personId === personId && x.recordedAt <= knownAt && activeOn(x, day));
  return {
    placementSchools: P.length ? [...new Set(P.map((p) => p.schoolId))].sort() : null,
    exerciseSchools: X.length ? [...new Set(X.map((x) => x.schoolId))].sort() : null,
  };
}

export type Movement = Readonly<{ date: string; linkLogicalId: string; from: string | null; to: string | null; actRef: string | null; reason: string | null }>;

/** Histórico de movimentações derivado das lotações (nunca persistido em duplicidade). */
export function movementHistory(linkLogicalId: string, placements: readonly Placement[]): Movement[] {
  const ps = placements.filter((p) => p.linkLogicalId === linkLogicalId).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const out: Movement[] = [];
  ps.forEach((p, i) => {
    const prev = ps[i - 1];
    const prevEnded = prev && prev.validUntil !== null && prev.validUntil < p.validFrom;
    out.push({ date: p.validFrom, linkLogicalId, from: prev && prevEnded ? prev.schoolId : null, to: p.schoolId, actRef: p.actRef, reason: p.reason });
    if (p.validUntil && i === ps.length - 1)
      out.push({ date: p.validUntil, linkLogicalId, from: p.schoolId, to: null, actRef: p.actRef, reason: "fim da lotação" });
  });
  return out;
}
