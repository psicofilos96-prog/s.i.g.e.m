/**
 * OP por escola — LOTE 04: escolas, turmas e panorama.
 * Projeção pura sobre vínculos oficiais já lidos (alocação, atribuição, turma, oferta, planos, aulas,
 * chamadas, resultados, intervenções). Contagem por PESSOA distinta, na data; nunca por vínculo.
 * Etapa/modalidade só da oferta lida; ausente ⇒ não filtra por suposição (fica fora do filtro).
 */
import { aggregateForCentral } from "./op-designations";

export interface ClassRef { classId: string; schoolId: string; stage: string | null; modality: string | null }
export interface Allocation { studentId: string; classId: string; from: string; to: string | null }
export interface Assignment { personId: string; classId: string; componentId: string; from: string; to: string | null }
export interface Dated { classId: string; componentId: string | null; date: string }
export interface Intervention { studentId: string; classId: string; from: string; to: string | null }

export interface PanoramaSources {
  classes: ClassRef[] | null; allocations: Allocation[] | null; assignments: Assignment[] | null;
  plans: Dated[] | null; lessons: Dated[] | null; attendanceCalls: Dated[] | null;
  results: Dated[] | null; projects: Dated[] | null; interventions: Intervention[] | null;
}
export interface PanoramaFilter {
  schoolId?: string; stage?: string; modality?: string; classId?: string; componentId?: string;
  period: { from: string; to: string }; date: string;
}

const liveOn = (x: { from: string; to: string | null }, d: string) => x.from <= d && (x.to === null || d <= x.to);
const overlaps = (x: { from: string; to: string | null }, p: { from: string; to: string }) => x.from <= p.to && (x.to === null || x.to >= p.from);
const inPeriod = (d: string, p: { from: string; to: string }) => d >= p.from && d <= p.to;

export type Value = number | null; // null = fonte não lida
export interface Panorama {
  classes: Value; students: Value; teachers: Value; plans: Value; lessons: Value; attendanceCalls: Value;
  results: Value; projects: Value; interventions: Value; multipleAllocations: Value; unknownOffer: Value;
}

export function selectClasses(classes: ClassRef[], f: PanoramaFilter): ClassRef[] {
  return classes.filter((c) => (!f.schoolId || c.schoolId === f.schoolId) && (!f.classId || c.classId === f.classId)
    && (!f.stage || c.stage === f.stage) && (!f.modality || c.modality === f.modality));
}

export function buildPanorama(s: PanoramaSources, f: PanoramaFilter): Panorama {
  if (!s.classes) return { classes: null, students: null, teachers: null, plans: null, lessons: null, attendanceCalls: null, results: null, projects: null, interventions: null, multipleAllocations: null, unknownOffer: null };
  const cls = selectClasses(s.classes, f); const ids = new Set(cls.map((c) => c.classId));
  const comp = (x: { componentId: string | null }) => !f.componentId || x.componentId === f.componentId;
  const dated = (rows: Dated[] | null) => rows === null ? null : rows.filter((r) => ids.has(r.classId) && comp(r) && inPeriod(r.date, f.period)).length;

  let students: Value = null; let multiple: Value = null;
  if (s.allocations) {
    const live = s.allocations.filter((a) => ids.has(a.classId) && liveOn(a, f.date));
    const per = new Map<string, number>();
    for (const a of live) per.set(a.studentId, (per.get(a.studentId) ?? 0) + 1);
    students = per.size; multiple = [...per.values()].filter((n) => n > 1).length;
  }
  const teachers = s.assignments === null ? null
    : new Set(s.assignments.filter((a) => ids.has(a.classId) && comp(a) && overlaps(a, f.period)).map((a) => a.personId)).size;
  const interventions = s.interventions === null ? null
    : new Set(s.interventions.filter((i) => ids.has(i.classId) && overlaps(i, f.period)).map((i) => i.studentId)).size;
  const unknownOffer = (f.stage || f.modality)
    ? s.classes.filter((c) => (!f.schoolId || c.schoolId === f.schoolId) && ((f.stage && c.stage === null) || (f.modality && c.modality === null))).length
    : 0;

  return { classes: cls.length, students, teachers, plans: dated(s.plans), lessons: dated(s.lessons), attendanceCalls: dated(s.attendanceCalls),
    results: dated(s.results), projects: dated(s.projects), interventions, multipleAllocations: multiple, unknownOffer };
}

/** Panorama da coordenação central: só agregados por escola, supressão 1–4, não lido ≠ zero. */
export function centralPanorama(s: PanoramaSources, schoolIds: string[], f: Omit<PanoramaFilter, "schoolId" | "classId">) {
  return schoolIds.map((schoolId) => {
    const p = buildPanorama(s, { ...f, schoolId });
    return { schoolId, values: aggregateForCentral(p as unknown as Record<string, number | null>) };
  });
}

/** Histórico da turma: eventos ordenados por data dentro do período (sem nome de estudante). */
export function classHistory(s: PanoramaSources, classId: string, period: { from: string; to: string }) {
  const tag = (kind: string, rows: Dated[] | null) => (rows ?? []).filter((r) => r.classId === classId && inPeriod(r.date, period)).map((r) => ({ kind, date: r.date, componentId: r.componentId }));
  const out = [...tag("plano", s.plans), ...tag("aula", s.lessons), ...tag("chamada", s.attendanceCalls), ...tag("resultado", s.results), ...tag("projeto", s.projects)];
  const notRead = (["plans", "lessons", "attendanceCalls", "results", "projects"] as const).filter((k) => s[k] === null);
  return { events: out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)), notRead };
}
