/**
 * OP por escola — LOTE 09 (aprendizagem e diagnóstico).
 * Projeção somente leitura sobre fatos oficiais já lidos: resultados docentes (Pauta/`register_assessment_results`),
 * resultados do A&A (programa+edição, `scale_key`), participação (elegível × avaliado), habilidades (Lote 07),
 * frequência (chamada concluída do Diário), intervenções e reavaliações (`aa_intervention_*`).
 * Nunca cria nota, conceito, média nova nem diagnóstico clínico; escalas diferentes nunca se agregam.
 */
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export type Level = "estudante" | "turma" | "escola" | "etapa" | "componente" | "habilidade";
export interface ResultFact {
  studentId: string; classId: string; schoolId: string; stageId: string | null; componentId: string;
  skillItemId: string | null; origin: "docente" | "aa"; programEditionId: string | null;
  scaleKey: string; value: number | string; periodId: string; recordedAt: string;
}
export interface Enrollment { studentId: string; classId: string; schoolId: string; stageId: string | null }
export interface AttendanceFact { studentId: string; classId: string; periodId: string; present: number; marked: number }
export interface InterventionFact { studentId: string; classId: string; skillItemId: string | null; openedAt: string; reassessedAt: string | null; status: "aberta" | "encerrada" }
export interface ComparabilityDecl { a: string; b: string; comparable: boolean } // por scaleKey/edição, registrada; ausente = unknown
export interface Sources { results: boolean; aa: boolean; enrollment: boolean; attendance: boolean; interventions: boolean; readAt: string | null }

const CLINICAL = /\b(CID|laudo|TDAH|TEA|autis|dislex|deficit|d[ée]ficit cognitivo|transtorno|diagn[óo]stico cl[íi]nico|s[íi]ndrome)/i;
/** Nenhum texto produzido pela análise pode carregar rótulo clínico ou nota inventada. */
export function guardLearningText(t: string): string | null {
  if (CLINICAL.test(t)) return "Análise pedagógica não registra diagnóstico clínico; isso é do NEI com governança própria.";
  if (/\b(nota final|m[ée]dia final|aprovad|reprovad|retid)/i.test(t)) return "Análise não cria nota nem decide trajetória.";
  return null;
}

export interface Cell {
  key: string; scaleKey: string; origin: ResultFact["origin"]; programEditionId: string | null;
  eligible: number | null; assessed: number; participation: number | null;
  /** distribuição bruta dos valores lidos, nunca média recalculada entre escalas */
  values: (number | string)[]; attendanceRate: number | null; interventionsOpen: number | null; reassessed: number | null;
}

export function analyzeLearning(input: {
  level: Level; filters: { schoolId: string; classId?: string; componentId?: string; periodId: string; studentId?: string };
  results: ResultFact[]; enrollments: Enrollment[]; attendance: AttendanceFact[]; interventions: InterventionFact[];
  sources: Sources; access: Omit<OpAccessRequest, "action" | "granularity">;
}): { blocked: string | null; cells: Cell[]; limitations: string[] } {
  const { level, filters: f, sources: s } = input;
  if (!s.readAt) return { blocked: "Leitura sem data não vale como análise.", cells: [], limitations: [] };
  const individual = level === "estudante";
  const acc = decideOpAccess({ ...input.access, action: "consultar", granularity: individual ? "individual" : "agregado" });
  if (!acc.ok) return { blocked: acc.reason, cells: [], limitations: [] };
  if (individual && !f.studentId) return { blocked: "Nível estudante exige estudante autorizado.", cells: [], limitations: [] };
  const lim: string[] = [];
  if (!s.results) lim.push("Resultados docentes não lidos.");
  if (!s.aa) lim.push("Resultados do Acompanhamento e Avaliação não lidos.");
  if (!s.enrollment) lim.push("Enturmação não lida: participação sem denominador.");
  if (!s.attendance) lim.push("Frequência não lida.");
  if (!s.interventions) lim.push("Intervenções não lidas.");
  lim.push("Escalas diferentes são exibidas separadas; comparação só por declaração registrada.");
  const inScope = <T extends { classId: string; studentId: string }>(x: T & { schoolId?: string }) =>
    (x.schoolId === undefined || x.schoolId === f.schoolId) && (!f.classId || x.classId === f.classId) && (!f.studentId || x.studentId === f.studentId);
  const res = input.results.filter((r) => inScope(r) && r.periodId === f.periodId && (!f.componentId || r.componentId === f.componentId)
    && ((r.origin === "docente" && s.results) || (r.origin === "aa" && s.aa)));
  const enr = input.enrollments.filter(inScope);
  const keyOf = (r: { classId: string; schoolId: string; stageId: string | null; componentId?: string; skillItemId?: string | null; studentId: string }) =>
    level === "estudante" ? r.studentId : level === "turma" ? r.classId : level === "escola" ? r.schoolId
      : level === "etapa" ? r.stageId ?? "etapa-nao-registrada" : level === "componente" ? r.componentId ?? "" : r.skillItemId ?? "sem-habilidade";
  const groups = new Map<string, ResultFact[]>();
  for (const r of res) { const g = `${keyOf(r)}|${r.scaleKey}|${r.origin}|${r.programEditionId ?? ""}`; groups.set(g, [...(groups.get(g) ?? []), r]); }
  const cells: Cell[] = [...groups.entries()].map(([g, rs]) => {
    const [key, scaleKey] = g.split("|") as [string, string];
    const classIds = new Set(rs.map((r) => r.classId));
    const elig = s.enrollment ? new Set(enr.filter((e) => classIds.has(e.classId)).map((e) => e.studentId)).size : null;
    const assessed = new Set(rs.map((r) => r.studentId)).size;
    const studs = new Set(rs.map((r) => r.studentId));
    const att = input.attendance.filter((a) => studs.has(a.studentId) && classIds.has(a.classId) && a.periodId === f.periodId);
    const marked = att.reduce((t, a) => t + a.marked, 0);
    const iv = input.interventions.filter((i) => studs.has(i.studentId) && classIds.has(i.classId));
    return {
      key, scaleKey, origin: rs[0]!.origin, programEditionId: rs[0]!.programEditionId,
      eligible: elig, assessed, participation: elig ? assessed / elig : null,
      values: rs.map((r) => r.value),
      attendanceRate: s.attendance && marked > 0 ? att.reduce((t, a) => t + a.present, 0) / marked : null,
      interventionsOpen: s.interventions ? iv.filter((i) => i.status === "aberta").length : null,
      reassessed: s.interventions ? iv.filter((i) => i.reassessedAt).length : null,
    };
  });
  return { blocked: null, cells, limitations: lim };
}

/** Evolução: só mesma escala + mesma edição/programa ou comparabilidade declarada; senão "não comparável". */
export function evolution(a: Cell, b: Cell, decls: ComparabilityDecl[]): { comparable: boolean | "desconhecido"; reason: string } {
  if (a.scaleKey === b.scaleKey && a.origin === b.origin) return { comparable: true, reason: "" };
  const d = decls.find((x) => (x.a === a.scaleKey && x.b === b.scaleKey) || (x.a === b.scaleKey && x.b === a.scaleKey));
  if (!d) return { comparable: "desconhecido", reason: "Escalas diferentes sem declaração de comparabilidade." };
  return { comparable: d.comparable, reason: d.comparable ? "" : "Declarado como não comparável." };
}

/** Central: só agregado por escola, sem `values` individuais, contagens 1–4 suprimidas. */
export function centralLearning(cells: Cell[]) {
  const sup = (n: number | null) => n === null ? "não disponível" : n > 0 && n < 5 ? "suprimido" : n;
  return cells.map((c) => ({ key: c.key, scaleKey: c.scaleKey, origin: c.origin, eligible: sup(c.eligible), assessed: sup(c.assessed),
    participation: c.assessed < 5 ? "suprimido" : c.participation }));
}
