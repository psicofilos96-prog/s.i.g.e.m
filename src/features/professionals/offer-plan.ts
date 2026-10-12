/**
 * Gestão de Pessoas L09 — Planejamento da oferta para atribuição de aulas.
 * Projeção pura sobre leituras canônicas já feitas (class_at, matriz vigente da
 * turma, calendário aplicável, class_schedule_at, regra de duração L06).
 * Guarda só IDs + proveniência; nenhum nome/cadastro acadêmico é copiado.
 * Fonte não lida ⇒ lacuna "nao-lida" (≠ ausência confirmada) e nunca zero.
 */

export type Read<T> = Readonly<{ status: "ok"; value: T; source: string; knownAt: string } | { status: "nao-lida"; source: string; reason: string }>;

export type ClassRef = Readonly<{ classId: string; schoolId: string; academicYearId: string; positionKey: string | null }>;
export type MatrixItem = Readonly<{ matrixVersionId: string; itemId: string; componentId: string; weeklyClassHours: number | null; durationContext: string | null }>;
export type ScheduleBlock = Readonly<{ blockId: string; componentId: string | null }>;
export type CalendarRef = Readonly<{ calendarVersionId: string; periodFrom: string; periodUntil: string }>;

export type OfferInput = Readonly<{
  cls: ClassRef;
  matrix: Read<readonly MatrixItem[]>; // matriz vigente resolvida para a turma (única)
  calendar: Read<CalendarRef | null>;
  schedule: Read<readonly ScheduleBlock[]>;
  durationMinutes: (context: string) => number | null; // regra L06 homologada
}>;

export type Gap =
  | "matriz-nao-lida" | "sem-matriz-vigente" | "carga-nao-configurada" | "duracao-sem-regra"
  | "calendario-nao-lido" | "sem-calendario-aplicavel" | "grade-nao-lida" | "blocos-a-menos" | "blocos-a-mais" | "bloco-sem-componente";

export type OfferLine = Readonly<{
  classId: string; schoolId: string; componentId: string;
  provenance: Readonly<{ matrixVersionId: string; itemId: string; calendarVersionId: string | null; scheduleBlockIds: readonly string[] }>;
  period: Readonly<{ from: string; until: string }> | null;
  weeklyClassHours: number | null;
  weeklyMinutes: number | null;
  scheduledBlocks: number | null;
  gaps: readonly Gap[];
}>;

export type OfferPlan = Readonly<{ classId: string; lines: readonly OfferLine[]; classGaps: readonly Gap[]; sources: readonly string[] }>;

export function planOffer(i: OfferInput): OfferPlan {
  const classGaps: Gap[] = [];
  const sources = [i.matrix.source, i.calendar.source, i.schedule.source];
  if (i.matrix.status === "nao-lida") return { classId: i.cls.classId, lines: [], classGaps: ["matriz-nao-lida"], sources };
  if (i.matrix.value.length === 0) return { classId: i.cls.classId, lines: [], classGaps: ["sem-matriz-vigente"], sources };

  let cal: CalendarRef | null = null;
  if (i.calendar.status === "nao-lida") classGaps.push("calendario-nao-lido");
  else if (!i.calendar.value) classGaps.push("sem-calendario-aplicavel");
  else cal = i.calendar.value;

  const blocks = i.schedule.status === "ok" ? i.schedule.value : null;
  if (!blocks) classGaps.push("grade-nao-lida");
  else if (blocks.some((b) => !b.componentId)) classGaps.push("bloco-sem-componente");

  const lines = i.matrix.value.map((m): OfferLine => {
    const gaps: Gap[] = [];
    if (m.weeklyClassHours === null) gaps.push("carga-nao-configurada");
    const dur = m.durationContext ? i.durationMinutes(m.durationContext) : null;
    if (m.weeklyClassHours !== null && dur === null) gaps.push("duracao-sem-regra");
    const mine = blocks?.filter((b) => b.componentId === m.componentId) ?? null;
    if (mine && m.weeklyClassHours !== null) {
      if (mine.length < m.weeklyClassHours) gaps.push("blocos-a-menos");
      if (mine.length > m.weeklyClassHours) gaps.push("blocos-a-mais");
    }
    return {
      classId: i.cls.classId, schoolId: i.cls.schoolId, componentId: m.componentId,
      provenance: { matrixVersionId: m.matrixVersionId, itemId: m.itemId, calendarVersionId: cal?.calendarVersionId ?? null, scheduleBlockIds: mine?.map((b) => b.blockId) ?? [] },
      period: cal ? { from: cal.periodFrom, until: cal.periodUntil } : null,
      weeklyClassHours: m.weeklyClassHours,
      weeklyMinutes: m.weeklyClassHours !== null && dur !== null ? m.weeklyClassHours * dur : null,
      scheduledBlocks: mine ? mine.length : null,
      gaps,
    };
  });
  return { classId: i.cls.classId, lines, classGaps, sources };
}

/** Consolida por escola: total só fecha se nenhuma linha tiver carga/duração indeterminada. */
export function schoolTotals(plans: readonly OfferPlan[]) {
  const by = new Map<string, { minutes: number | null; lines: number; gaps: number }>();
  for (const p of plans) for (const l of p.lines) {
    const t = by.get(l.schoolId) ?? { minutes: 0, lines: 0, gaps: 0 };
    t.lines++; t.gaps += l.gaps.length;
    t.minutes = t.minutes === null || l.weeklyMinutes === null ? null : t.minutes + l.weeklyMinutes;
    by.set(l.schoolId, t);
  }
  for (const p of plans) if (p.lines.length === 0 || p.classGaps.length) {
    const sid = p.lines[0]?.schoolId;
    if (sid && by.has(sid)) by.get(sid)!.gaps += p.classGaps.length;
  }
  return by;
}
