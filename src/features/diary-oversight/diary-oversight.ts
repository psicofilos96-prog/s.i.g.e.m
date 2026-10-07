/**
 * N7.2-B — fiscalização do Diário pela OP: projeção pura e somente leitura.
 * Aula prevista vem só da grade canônica (bloco previsto por turma/data); sem grade ⇒ nada previsto
 * (nunca "faltante"). Só fatos objetivos: registrado ou não registrado; nenhuma nota, juízo ou alteração.
 */
export type ExpectedLesson = Readonly<{ classId: string; date: string; slotId: string; teacherEngagementId: string | null }>;
export type RecordedFact = Readonly<{ classId: string; date: string; slotId: string; recordId: string; concluded: boolean }>;
export type OversightRow = Readonly<{
  classId: string; date: string; slotId: string; teacherEngagementId: string | null;
  lesson: "registrada" | "em-elaboracao" | "nao-registrada"; attendance: "registrada" | "em-elaboracao" | "nao-registrada";
  lessonRecordId: string | null; attendanceRecordId: string | null;
}>;

const key = (f: { classId: string; date: string; slotId: string }) => `${f.classId}|${f.date}|${f.slotId}`;
const state = (f: RecordedFact | undefined) => (!f ? "nao-registrada" : f.concluded ? "registrada" : "em-elaboracao") as OversightRow["lesson"];

export function projectDiaryOversight(expected: readonly ExpectedLesson[], lessons: readonly RecordedFact[], attendance: readonly RecordedFact[], upTo: string): OversightRow[] {
  const L = new Map(lessons.map((f) => [key(f), f])); const A = new Map(attendance.map((f) => [key(f), f]));
  return expected.filter((e) => e.date <= upTo)
    .map((e) => { const l = L.get(key(e)); const a = A.get(key(e));
      return { ...e, lesson: state(l), attendance: state(a), lessonRecordId: l?.recordId ?? null, attendanceRecordId: a?.recordId ?? null }; })
    .sort((x, y) => x.classId.localeCompare(y.classId) || x.date.localeCompare(y.date) || x.slotId.localeCompare(y.slotId));
}

/** Resumo por turma: contagens de fatos, sem taxa nem ranking (indicadores são do CIECE). */
export function summarizeByClass(rows: readonly OversightRow[]) {
  const m = new Map<string, { expected: number; lessonMissing: number; attendanceMissing: number }>();
  for (const r of rows) { const s = m.get(r.classId) ?? { expected: 0, lessonMissing: 0, attendanceMissing: 0 };
    s.expected++; if (r.lesson === "nao-registrada") s.lessonMissing++; if (r.attendance === "nao-registrada") s.attendanceMissing++; m.set(r.classId, s); }
  return m;
}

/** N7.2.1 — filtros da tela (turma, professor, período). Só recorta; nunca reordena por "pior". */
export type OversightFilter = Readonly<{ classId?: string; teacherEngagementId?: string; from?: string; to?: string }>;
export function filterOversight(rows: readonly OversightRow[], f: OversightFilter): OversightRow[] {
  return rows.filter((r) => (!f.classId || r.classId === f.classId)
    && (!f.teacherEngagementId || r.teacherEngagementId === f.teacherEngagementId)
    && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to));
}
export const OVERSIGHT_STATE_LABEL: Record<OversightRow["lesson"], string> = {
  registrada: "Registrada", "em-elaboracao": "Em elaboração", "nao-registrada": "Não registrada",
};
