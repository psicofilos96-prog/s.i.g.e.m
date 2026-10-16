/**
 * SIGEM 2.0 A&A Lote 3 — infrequência, busca ativa e rendimento (projeções puras).
 * Nada aqui reprova, encerra caso ou grava; aula prevista vem só da grade/calendário.
 */
export type AttendanceRow = {
  studentId: string; enrollmentId: string; schoolId: string; classId: string; period: number;
  plannedHours: number | null; attendedHours: number | null; // null = sem fonte
};
export type AttendanceResult = {
  studentId: string; enrollmentId: string; schoolId: string; classId: string; upToPeriod: number;
  planned: number | null; attended: number | null; absences: number | null; presencePct: number | null;
  status: "alerta" | "sem-alerta" | "nao-apurado"; reason: string | null;
};

/** Limite estrito: alerta só se presença < 75%; exatamente 75% fica fora. Não é reprovação. */
export const ALERT_THRESHOLD_PCT = 75;

/** `mode`: "periodo" usa só o período; "acumulado" soma 1..período. Período incompleto ⇒ não apurado. */
export function attendanceAt(rows: AttendanceRow[], period: number, mode: "periodo" | "acumulado", threshold: number = ALERT_THRESHOLD_PCT): AttendanceResult[] {
  const key = (r: AttendanceRow) => `${r.enrollmentId}|${r.classId}`;
  const groups = new Map<string, AttendanceRow[]>();
  for (const r of rows) if (mode === "periodo" ? r.period === period : r.period <= period) { const k = key(r); groups.set(k, [...(groups.get(k) ?? []), r]); }
  return [...groups.values()].map((g) => {
    const f = g[0]!;
    const base = { studentId: f.studentId, enrollmentId: f.enrollmentId, schoolId: f.schoolId, classId: f.classId, upToPeriod: period };
    const need = mode === "periodo" ? [period] : Array.from({ length: period }, (_, i) => i + 1);
    const missingPeriod = need.find((p) => !g.some((r) => r.period === p));
    if (missingPeriod) return { ...base, planned: null, attended: null, absences: null, presencePct: null, status: "nao-apurado" as const, reason: `Sem dado do período ${missingPeriod}` };
    if (g.some((r) => r.plannedHours == null || r.attendedHours == null)) return { ...base, planned: null, attended: null, absences: null, presencePct: null, status: "nao-apurado" as const, reason: "Horas previstas ou frequentadas sem fonte" };
    const planned = g.reduce((a, r) => a + (r.plannedHours as number), 0);
    const attended = g.reduce((a, r) => a + (r.attendedHours as number), 0);
    if (planned <= 0) return { ...base, planned, attended, absences: null, presencePct: null, status: "nao-apurado" as const, reason: "Sem horas previstas" };
    if (attended > planned) return { ...base, planned, attended, absences: null, presencePct: null, status: "nao-apurado" as const, reason: "Frequentadas maior que previstas" };
    const pct = (attended / planned) * 100;
    return { ...base, planned, attended, absences: planned - attended, presencePct: pct, status: pct < threshold ? "alerta" as const : "sem-alerta" as const, reason: null };
  });
}

/** Totais históricos declarados (relatório de infrequência 2026, descrito pelo usuário; arquivo não anexado). */
export type DeclaredTotal = { label: string; period: string; mode: "periodo" | "acumulado"; total: number; source: string; audited: false; deduplicated: false };
export const DECLARED_2026: readonly DeclaredTotal[] = [
  { label: "Casos de infrequência", period: "1º PL", mode: "periodo", total: 316, source: "Relatório de infrequência 2026 (descrito, não anexado)", audited: false, deduplicated: false },
  { label: "Casos de infrequência", period: "até 2º PL", mode: "acumulado", total: 269, source: "Relatório de infrequência 2026 (descrito, não anexado)", audited: false, deduplicated: false },
];
/** Comparar totais declarados nunca conclui resolução: bases não deduplicadas e possivelmente distintas. */
export function compareDeclared(a: DeclaredTotal, b: DeclaredTotal) {
  return { difference: b.total - a.total, interpretable: false as const,
    note: "Totais declarados, não auditados nem deduplicados, de recortes diferentes (período × acumulado): a diferença não indica casos resolvidos." };
}

/** Duplicidade em lista importada: mesma matrícula+turma+período mais de uma vez. */
export function duplicates(rows: Pick<AttendanceRow, "enrollmentId" | "classId" | "period">[]) {
  const c = new Map<string, number>();
  for (const r of rows) { const k = `${r.enrollmentId}|${r.classId}|${r.period}`; c.set(k, (c.get(k) ?? 0) + 1); }
  return [...c].filter(([, n]) => n > 1).map(([k, n]) => ({ key: k, count: n }));
}

/** Busca ativa: estado é projeção dos eventos; encerrar exige retorno registrado; nunca automático. */
export type OutreachEvent = { at: string; kind: "contato" | "encaminhamento" | "retorno" | "encerramento"; author: string; guardian?: string | null; destination?: string | null; due?: string | null; note: string };
export function outreachState(ev: OutreachEvent[], today: string) {
  const s = [...ev].sort((a, b) => a.at.localeCompare(b.at));
  const errors: string[] = [];
  s.forEach((e, i) => {
    if (!e.author.trim()) errors.push(`evento ${i + 1}: autor ausente`);
    if (e.kind === "contato" && !e.guardian) errors.push(`evento ${i + 1}: contato sem responsável`);
    if (e.kind === "encaminhamento" && !e.destination) errors.push(`evento ${i + 1}: encaminhamento sem destino`);
    if (e.kind === "encerramento" && !s.slice(0, i).some((x) => x.kind === "retorno")) errors.push(`evento ${i + 1}: encerramento sem retorno`);
  });
  const last = s.at(-1);
  const openDue = s.filter((e) => e.kind === "encaminhamento" && e.due).map((e) => e.due as string).filter((d) => !s.some((x) => x.kind === "retorno" && x.at >= d)).sort()[0] ?? null;
  const state = !last ? "sem-acao" : last.kind === "encerramento" && !errors.length ? "encerrado" : last.kind === "encaminhamento" ? "aguardando-retorno" : "em-acompanhamento";
  return { state, errors, overdue: openDue != null && openDue < today && state !== "encerrado", due: openDue, history: s };
}

/** Rendimento: aprovação/reprovação só de situação oficial com período concluído; 2026 parcial separado. */
export type StandingRow = { studentId: string; year: number; officialStanding: string | null; periodClosed: boolean; grade: number | string | null };
export function performanceSummary(rows: StandingRow[], year: number) {
  const ofYear = rows.filter((r) => r.year === year);
  const official = ofYear.filter((r) => r.periodClosed && r.officialStanding);
  const partial = ofYear.length - official.length;
  const byStanding = new Map<string, number>();
  for (const r of official) byStanding.set(r.officialStanding as string, (byStanding.get(r.officialStanding as string) ?? 0) + 1);
  return { year, nature: partial === 0 && official.length > 0 ? "fechamento" as const : "parcial" as const, official: official.length, partial, byStanding: Object.fromEntries(byStanding) };
}
