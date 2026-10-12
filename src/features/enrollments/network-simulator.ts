/**
 * Rede — L22 Simulador isolado de oferta (abrir/fechar turma, turno, capacidade, redistribuição).
 * Opera sobre CÓPIA da base com impressão digital; devolve `simulacao: true`, `writes: []`.
 * Base real mudou ⇒ "desatualizado" (nunca rebaseado em silêncio). Impactos: vagas por célula,
 * aulas semanais pela matriz homologada (nunca nº de professores), salas por escola×turno (salas
 * declaradas; não informado ⇒ null) e transporte só como contagem de estudantes deslocados por escola.
 */
export interface SimClass { classId: string; schoolId: string; shift: string; positionKey: string; capacity: number | null; occupants: number | null }
export interface SimBase { classes: readonly SimClass[]; roomsBySchoolShift: Readonly<Record<string, number | null>>; lessonsByPosition: Readonly<Record<string, number | null>> }
export type Change =
  | { kind: "abrir"; cls: SimClass }
  | { kind: "fechar"; classId: string; moveTo: string | null }
  | { kind: "turno"; classId: string; shift: string }
  | { kind: "capacidade"; classId: string; capacity: number }
  | { kind: "redistribuir"; fromClassId: string; toClassId: string; students: number };

const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);
export const fingerprint = (b: SimBase) => { const s = canon(b); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

function apply(base: SimBase, changes: readonly Change[]) {
  const cls = base.classes.map((c) => ({ ...c }));
  const errors: string[] = []; const moved = new Map<string, number>(); // escola destino → estudantes recebidos de outra escola
  const get = (id: string) => cls.find((c) => c.classId === id);
  const move = (from: SimClass, to: SimClass, n: number) => {
    if (from.occupants === null || to.occupants === null) { errors.push(`Ocupação não lida em ${from.classId}/${to.classId}.`); return; }
    if (n > from.occupants) { errors.push(`${from.classId} não tem ${n} estudantes.`); return; }
    from.occupants -= n; to.occupants += n;
    if (from.schoolId !== to.schoolId) moved.set(to.schoolId, (moved.get(to.schoolId) ?? 0) + n);
  };
  for (const ch of changes) {
    if (ch.kind === "abrir") { if (get(ch.cls.classId)) errors.push(`Turma ${ch.cls.classId} já existe.`); else cls.push({ ...ch.cls }); continue; }
    const id = ch.kind === "redistribuir" ? ch.fromClassId : ch.classId; const c = get(id);
    if (!c) { errors.push(`Turma ${id} inexistente na base.`); continue; }
    if (ch.kind === "turno") c.shift = ch.shift;
    if (ch.kind === "capacidade") c.capacity = ch.capacity;
    if (ch.kind === "redistribuir") { const t = get(ch.toClassId); if (!t) errors.push(`Turma ${ch.toClassId} inexistente.`); else move(c, t, ch.students); }
    if (ch.kind === "fechar") {
      if (c.occupants && !ch.moveTo) { errors.push(`Fechar ${c.classId} exige destino para ${c.occupants} estudante(s).`); continue; }
      if (ch.moveTo) { const t = get(ch.moveTo); if (!t) { errors.push(`Destino ${ch.moveTo} inexistente.`); continue; } move(c, t, c.occupants ?? 0); }
      cls.splice(cls.indexOf(c), 1);
    }
  }
  return { cls, errors, moved };
}

function project(cls: readonly SimClass[], base: SimBase) {
  const vacancies = cls.map((c) => ({ classId: c.classId, available: c.capacity === null || c.occupants === null ? null : c.capacity - c.occupants, overCapacity: c.capacity !== null && c.occupants !== null && c.occupants > c.capacity }));
  const lessons = cls.some((c) => (base.lessonsByPosition[c.positionKey] ?? null) === null) ? null : cls.reduce((a, c) => a + base.lessonsByPosition[c.positionKey]!, 0);
  const keys = [...new Set(cls.map((c) => `${c.schoolId}|${c.shift}`))].sort();
  const rooms = keys.map((k) => { const declared = base.roomsBySchoolShift[k] ?? null; const used = cls.filter((c) => `${c.schoolId}|${c.shift}` === k).length; return { key: k, classes: used, rooms: declared, deficit: declared === null ? null : Math.max(0, used - declared) }; });
  return { vacancies, weeklyLessons: lessons, rooms };
}

export function simulate(base: SimBase, baseFingerprint: string, currentFingerprint: string, changes: readonly Change[]) {
  const before = project(base.classes, base);
  const { cls, errors, moved } = apply(base, changes);
  const after = project(cls, base);
  return {
    simulacao: true as const, writes: [] as const, stale: baseFingerprint !== currentFingerprint, baseFingerprint, errors,
    before, after,
    deltaWeeklyLessons: before.weeklyLessons === null || after.weeklyLessons === null ? null : after.weeklyLessons - before.weeklyLessons,
    transport: [...moved].sort(([a], [b]) => a.localeCompare(b)).map(([schoolId, students]) => ({ schoolId, studentsArriving: students })),
  };
}
