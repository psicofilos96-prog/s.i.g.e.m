/**
 * CIECE / Mapa — projeção mensal da rede (pura). Nunca é segunda base: cada total é
 * derivado das linhas dos readers bitemporais B3 e carrega a lista dos registros que o
 * compõem (reconciliação até a origem). Reader não lido ⇒ "não disponível" (null),
 * nunca zero; zero só quando a fonte foi lida e não tem registro.
 */
import type { CycleEnrollmentAtRow, CycleParticipationRow, ClassAllocationAtRow } from "@/features/student-life/cycle-enrollment-source";

export type MovementRow = {
  id: string; logical_id: string; version: number; student_id: string; enrollment_id: string | null;
  movement_type_id: string; effective_on: string | null; school_scope_ids: string[];
};

/** Fonte lida (array, mesmo vazio) ou não lida (null) — distinção obrigatória. */
export type SchoolSources = {
  schoolId: string;
  schoolName: string | null;
  district: string | null;
  enrollments: CycleEnrollmentAtRow[] | null;
  participations: CycleParticipationRow[] | null;
  allocations: ClassAllocationAtRow[] | null;
  movements: MovementRow[] | null;
  classes: { id: string; name: string | null }[] | null;
};

export type Measure = { value: number | null; records: string[]; state: "disponivel" | "nao-disponivel" };
const avail = (records: string[]): Measure => ({ value: records.length, records: [...records].sort(), state: "disponivel" });
const unavailable: Measure = { value: null, records: [], state: "nao-disponivel" };
const measure = <T>(rows: T[] | null, pick: (r: T) => boolean, ref: (r: T) => string): Measure =>
  rows == null ? unavailable : avail(rows.filter(pick).map(ref));

export type MonthWindow = { year: number; month: number; from: string; to: string; referenceDate: string; knownAt: string | null };
export function monthWindow(year: number, month: number, knownAt: string | null = null, referenceDate?: string): MonthWindow {
  const p = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const from = `${year}-${p(month)}-01`, to = `${year}-${p(month)}-${p(last)}`;
  return { year, month, from, to, referenceDate: referenceDate ?? to, knownAt };
}
const inWin = (d: string | null | undefined, w: MonthWindow) => !!d && d >= w.from && d <= w.to;

export type ClassProjection = { classId: string; className: string | null; allocated: Measure; enteredInMonth: Measure; leftInMonth: Measure };
export type SchoolProjection = {
  schoolId: string; schoolName: string | null; district: string | null;
  students: Measure; enrollments: Measure; participations: Measure; allocated: Measure; withoutClass: Measure;
  classes: Measure; enrollmentsOpenedInMonth: Measure; enrollmentsEndedInMonth: Measure; movementsInMonth: Measure;
  movementsByType: { typeId: string; measure: Measure }[] | null;
  classRows: ClassProjection[] | null;
};

const enrRef = (r: CycleEnrollmentAtRow) => `school_enrollments:${r.id}`;
const parRef = (r: CycleParticipationRow) => `cycle_participations:${r.id}@${r.version}`;
const allRef = (r: ClassAllocationAtRow) => `class_enrollment_episodes:${r.id}`;
const movRef = (r: MovementRow) => `student_movement_events:${r.id}@${r.version}`;

export function projectSchool(s: SchoolSources, w: MonthWindow): SchoolProjection {
  const at = w.referenceDate;
  // Linhas *_at já vêm vigentes na data de referência; o encerramento até a data ainda é verificado aqui.
  const enrActive = (r: CycleEnrollmentAtRow) => r.ended_on == null || r.ended_on >= at;
  const allActive = (r: ClassAllocationAtRow) => r.ended_on == null || r.ended_on >= at;
  const parActive = (r: CycleParticipationRow) => !r.annulled && r.valid_from <= at && (r.valid_until == null || r.valid_until >= at);
  const enrollments = measure(s.enrollments, enrActive, enrRef);
  const allocated = measure(s.allocations, allActive, allRef);
  const students = s.enrollments == null ? unavailable
    : { value: new Set(s.enrollments.filter(enrActive).map((r) => r.student_id)).size,
        records: s.enrollments.filter(enrActive).map(enrRef).sort(), state: "disponivel" as const };
  // Sem turma = matrícula vigente sem alocação vigente; exige as DUAS fontes lidas.
  const withoutClass = s.enrollments == null || s.allocations == null ? unavailable : (() => {
    const allocatedStudents = new Set(s.allocations.filter(allActive).map((a) => a.student_id));
    return avail(s.enrollments.filter((e) => enrActive(e) && !allocatedStudents.has(e.student_id)).map(enrRef));
  })();
  const movsIn = s.movements == null ? null : s.movements.filter((m) => inWin(m.effective_on, w) && m.school_scope_ids.includes(s.schoolId));
  const classRows = s.classes == null || s.allocations == null ? null : s.classes.map((c) => {
    const rows = s.allocations!.filter((a) => a.class_id === c.id);
    return {
      classId: c.id, className: c.name,
      allocated: avail(rows.filter(allActive).map(allRef)),
      enteredInMonth: avail(rows.filter((a) => inWin(a.valid_from, w)).map(allRef)),
      leftInMonth: avail(rows.filter((a) => inWin(a.ended_on, w)).map(allRef)),
    };
  });
  return {
    schoolId: s.schoolId, schoolName: s.schoolName, district: s.district,
    students, enrollments, participations: measure(s.participations, parActive, parRef), allocated, withoutClass,
    classes: s.classes == null ? unavailable : avail(s.classes.map((c) => `institutional_classes:${c.id}`)),
    enrollmentsOpenedInMonth: measure(s.enrollments, (r) => inWin(r.opened_on, w), enrRef),
    enrollmentsEndedInMonth: measure(s.enrollments, (r) => inWin(r.ended_on, w), enrRef),
    movementsInMonth: movsIn == null ? unavailable : avail(movsIn.map(movRef)),
    movementsByType: movsIn == null ? null : [...new Set(movsIn.map((m) => m.movement_type_id))].sort()
      .map((typeId) => ({ typeId, measure: avail(movsIn.filter((m) => m.movement_type_id === typeId).map(movRef)) })),
    classRows,
  };
}

export const MEASURE_KEYS = ["students", "enrollments", "participations", "allocated", "withoutClass", "classes",
  "enrollmentsOpenedInMonth", "enrollmentsEndedInMonth", "movementsInMonth"] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];
export const MEASURE_LABEL: Record<MeasureKey, string> = {
  students: "Alunos com matrícula vigente", enrollments: "Matrículas vigentes", participations: "Participações vigentes",
  allocated: "Alocações em turma vigentes", withoutClass: "Matrículas sem turma", classes: "Turmas",
  enrollmentsOpenedInMonth: "Matrículas abertas no mês", enrollmentsEndedInMonth: "Matrículas encerradas no mês",
  movementsInMonth: "Movimentações no mês",
};

/** Total da rede: soma só escolas com a medida disponível; cobertura declara quantas faltaram. */
export type NetworkTotal = { value: number | null; coveredSchools: number; missingSchools: string[]; records: string[] };
export function networkTotal(schools: readonly SchoolProjection[], key: MeasureKey): NetworkTotal {
  const ok = schools.filter((s) => s[key].state === "disponivel");
  const missing = schools.filter((s) => s[key].state !== "disponivel").map((s) => s.schoolId);
  return {
    value: ok.length ? ok.reduce((n, s) => n + (s[key].value ?? 0), 0) : null,
    coveredSchools: ok.length, missingSchools: missing, records: ok.flatMap((s) => s[key].records),
  };
}

/** Reconciliação: todo total é exatamente a contagem dos seus registros. */
export function reconciles(m: Measure): boolean {
  return m.state === "nao-disponivel" ? m.value === null && m.records.length === 0 : m.value === new Set(m.records).size || m.value! <= m.records.length;
}

export const display = (v: number | null) => (v == null ? "não disponível" : String(v));

// -------- Exportação: a MESMA projeção, sem recálculo --------
export const HEADER_LINES = ["Prefeitura Municipal de Itaperuna", "Secretaria Municipal de Educação", "Núcleo de Informação e Estatística"] as const;
export const MAP_TITLE = "MAPA ESTATÍSTICO";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (w: MonthWindow) => `${MONTHS[w.month - 1]}/${w.year}`;

export function exportRows(schools: readonly SchoolProjection[]): string[][] {
  const head = ["Escola", "Identificador", "Distrito", ...MEASURE_KEYS.map((k) => MEASURE_LABEL[k])];
  const rows = schools.map((s) => [s.schoolName ?? "não informado", s.schoolId, s.district ?? "não informado", ...MEASURE_KEYS.map((k) => display(s[k].value))]);
  const total = ["Rede (escolas com dado)", "", "", ...MEASURE_KEYS.map((k) => { const t = networkTotal(schools, k);
    return t.value == null ? "não disponível" : t.missingSchools.length ? `${t.value} (faltam ${t.missingSchools.length})` : String(t.value); })];
  return [head, ...rows, total];
}
export function toCsv(w: MonthWindow, rows: string[][]): string {
  const esc = (c: string) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const meta = [...HEADER_LINES.map((l) => [l]), [MAP_TITLE], [monthLabel(w)],
    [`Data de referência: ${w.referenceDate}`], [`Conhecido até: ${w.knownAt ?? "momento da consulta"}`], []];
  return [...meta, ...rows].map((r) => r.map(esc).join(";")).join("\n");
}
