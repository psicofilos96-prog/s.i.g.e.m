/**
 * Lote 05 Supervisão — Auditor de Regularidade da Rede + painel de conferência de escrituração.
 * Projeção pura: reaproveita `regularityAudit` da Secretaria (mesma regra, sem cópia) e soma
 * verificações de rede. Todo alerta é INDÍCIO para análise humana (nunca "irregular"), carrega
 * fonte e setor/writer competente, e nada corrige (`autoFix: false`). Escolas só pelo acesso
 * vigente (`accessLevel`); `null` = não verificável, nunca achado nem zero.
 */
import { regularityAudit, type RegularityInput } from "@/features/school-secretariat/secretariat-l8-l12";
import { accessLevel, type AssignmentEvent, type Viewer } from "./supervision-access";

export interface Indication {
  schoolId: string; subject: string; code: string; label: string;
  source: string; competent: string; nature: "indicio"; autoFix: false;
}
const I = (schoolId: string, subject: string, code: string, label: string, source: string, competent: string): Indication =>
  ({ schoolId, subject, code, label, source, competent, nature: "indicio", autoFix: false });

export interface EnrollmentSpan { studentId: string; enrollmentId: string; schoolId: string; start: string | null; end: string | null }
export interface ClassInfo { classId: string; schoolId: string; hasMatrix: boolean | null; hasTeacherForAll: boolean | null; hasSchedule: boolean | null }
export interface PendingResult { classId: string; schoolId: string; periodClosed: boolean | null; resultsMissing: number | null }
export interface CalendarApplicability { schoolId: string; applicableIds: string[] | null }
export interface MovementFact { studentId: string; schoolId: string; enrollmentId: string; date: string | null; enrollmentStart: string | null; enrollmentEnd: string | null }

export interface NetworkInput {
  secretariatRows: RegularityInput[]; spans: EnrollmentSpan[]; classes: ClassInfo[];
  results: PendingResult[]; calendars: CalendarApplicability[]; movements: MovementFact[];
}

const overlaps = (a: EnrollmentSpan, b: EnrollmentSpan) =>
  !!a.start && !!b.start && a.start <= (b.end ?? "9999-12-31") && b.start <= (a.end ?? "9999-12-31");

export function visibleSchools(events: AssignmentEvent[], v: Viewer, schools: string[], on: string) {
  return schools.filter((s) => accessLevel(events, v, s, on) !== "nenhum");
}

export function networkRegularity(input: NetworkInput, schools: string[]) {
  const allowed = new Set(schools);
  const indications: Indication[] = [];
  const unverifiable: { schoolId: string; subject: string; check: string }[] = [];
  const nv = (schoolId: string, subject: string, check: string) => unverifiable.push({ schoolId, subject, check });

  for (const s of schools) {
    const r = regularityAudit(input.secretariatRows, s);
    for (const f of r.findings) indications.push(I(s, f.studentId, f.code, f.label, f.source, f.fixedBy));
    for (const u of r.unverifiable) nv(s, u.studentId, u.check);
  }
  // matrículas incompatíveis: vigências sobrepostas do mesmo estudante (inclusive entre escolas)
  const byStudent = new Map<string, EnrollmentSpan[]>();
  for (const sp of input.spans) byStudent.set(sp.studentId, [...(byStudent.get(sp.studentId) ?? []), sp]);
  for (const [stu, list] of byStudent) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      if (!a.start || !b.start) { if (allowed.has(a.schoolId)) nv(a.schoolId, stu, "vigencia-matricula"); continue; }
      if (overlaps(a, b)) for (const sc of new Set([a.schoolId, b.schoolId])) if (allowed.has(sc))
        indications.push(I(sc, stu, "matriculas-sobrepostas", "possível matrícula incompatível (vigências sobrepostas)", "matrícula", "Secretaria Escolar (movimentação)"));
    }
  }
  for (const c of input.classes.filter((x) => allowed.has(x.schoolId))) {
    const checks: [boolean | null, string, string, string][] = [
      [c.hasMatrix, "turma-sem-matriz", "turma sem matriz associada", "manter-matrizes-curriculares"],
      [c.hasTeacherForAll, "turma-sem-docente", "componente sem docente atribuído", "manter-atribuicao-docente"],
      [c.hasSchedule, "turma-sem-grade", "turma sem grade de horário", "Direção / horários"],
    ];
    for (const [v, code, label, comp] of checks) { if (v === null) nv(c.schoolId, c.classId, code); else if (!v) indications.push(I(c.schoolId, c.classId, code, label, "turma", comp)); }
  }
  for (const r of input.results.filter((x) => allowed.has(x.schoolId))) {
    if (r.periodClosed === null || r.resultsMissing === null) { nv(r.schoolId, r.classId, "resultados"); continue; }
    if (r.periodClosed && r.resultsMissing > 0)
      indications.push(I(r.schoolId, r.classId, "resultados-pendentes", `${r.resultsMissing} resultado(s) sem registro após fechamento`, "Pauta/fechamento", "docente regente (register_assessment_results)"));
  }
  for (const c of input.calendars.filter((x) => allowed.has(x.schoolId))) {
    if (c.applicableIds === null) { nv(c.schoolId, c.schoolId, "calendario"); continue; }
    if (c.applicableIds.length !== 1)
      indications.push(I(c.schoolId, c.schoolId, c.applicableIds.length ? "calendarios-divergentes" : "sem-calendario",
        c.applicableIds.length ? "mais de um calendário aplicável" : "nenhum calendário aplicável", "calendário", "Supervisão (construir-calendario-da-rede)"));
  }
  for (const m of input.movements.filter((x) => allowed.has(x.schoolId))) {
    if (!m.date || !m.enrollmentStart) { nv(m.schoolId, m.studentId, "data-movimentacao"); continue; }
    if (m.date < m.enrollmentStart || (m.enrollmentEnd && m.date > m.enrollmentEnd))
      indications.push(I(m.schoolId, m.studentId, "movimentacao-fora-da-vigencia", "movimentação fora da vigência da matrícula", "movimentação", "Secretaria Escolar (retificação)"));
  }
  return { indications, unverifiable, disclaimer: "Indícios para análise humana; não declaram irregularidade." };
}

// ---------- Painel de conferência de escrituração ----------
export const BOOK_KINDS = ["livro-matricula", "historico", "ficha", "ata", "resultado", "transferencia", "arquivo"] as const;
export type BookKind = (typeof BOOK_KINDS)[number];
export interface ConferenceEvent { seq: number; schoolId: string; kind: BookKind; itemRef: string; principalId: string; isHuman: boolean; level: string; outcome: "conforme" | "indicio" | "nao-conferido"; note: string | null }
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

/** Conferência só registra o olhar do supervisor (ledger); nunca altera o item conferido. */
export function recordConference(log: ConferenceEvent[], ev: Omit<ConferenceEvent, "seq">, expectedSeq: number): Res<ConferenceEvent[]> {
  if (!ev.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (ev.level !== "conferir" && ev.level !== "coordenar") return { ok: false, code: "sem-competencia" };
  if (log.length !== expectedSeq) return { ok: false, code: "base-alterada" };
  if (ev.outcome === "indicio" && !ev.note?.trim()) return { ok: false, code: "indicio-sem-descricao" };
  return { ok: true, value: [...log, { ...ev, seq: log.length }] };
}

export function conferencePanel(log: ConferenceEvent[], schoolId: string, items: { kind: BookKind; itemRef: string }[]) {
  return BOOK_KINDS.map((kind) => {
    const mine = items.filter((i) => i.kind === kind);
    const rows = mine.map((i) => {
      const last = [...log].reverse().find((e) => e.schoolId === schoolId && e.kind === kind && e.itemRef === i.itemRef);
      return { itemRef: i.itemRef, state: last?.outcome ?? "nao-conferido", by: last?.principalId ?? null };
    });
    return { kind, total: mine.length, rows, pending: rows.filter((r) => r.state === "nao-conferido").length };
  });
}
