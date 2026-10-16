/** Lote 15 — adapta `aa_infrequency_at` (0374, Diário + enturmação vigente) às projeções do Lote 3.
 * Denominador = aulas com chamada concluída e marcação do estudante dentro da vigência da enturmação;
 * aula sem marcação fica fora e é contada à parte (ausência de marcação nunca vira falta nem presença). */
import { attendanceAt, type AttendanceResult, type AttendanceRow } from "./attendance-performance";
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export type InfrequencyRow = { school_id: string; class_id: string; student_id: string; enrollment_id: string | null; period_id: string | null; period_start: string; present: number; absent: number; unmarked: number };

export function periodOrder(rows: InfrequencyRow[]): { id: string; start: string; index: number }[] {
  const m = new Map<string, string>();
  for (const r of rows) { const id = r.period_id ?? "sem-periodo"; const s = m.get(id); if (!s || r.period_start < s) m.set(id, r.period_start); }
  return [...m].filter(([id]) => id !== "sem-periodo").sort((a, b) => a[1].localeCompare(b[1])).map(([id, start], i) => ({ id, start, index: i + 1 }));
}

export function toAttendanceRows(rows: InfrequencyRow[]): { rows: AttendanceRow[]; withoutPeriod: number; unmarked: Map<string, number> } {
  const order = new Map(periodOrder(rows).map((p) => [p.id, p.index]));
  const unmarked = new Map<string, number>(); let withoutPeriod = 0; const out: AttendanceRow[] = [];
  for (const r of rows) {
    const k = `${r.enrollment_id ?? r.student_id}|${r.class_id}`;
    if (r.unmarked) unmarked.set(k, (unmarked.get(k) ?? 0) + r.unmarked);
    const p = r.period_id ? order.get(r.period_id) : undefined;
    if (p == null) { withoutPeriod++; continue; }
    const marked = r.present + r.absent;
    out.push({ studentId: r.student_id, enrollmentId: r.enrollment_id ?? r.student_id, schoolId: r.school_id, classId: r.class_id, period: p,
      plannedHours: marked > 0 ? marked : null, attendedHours: marked > 0 ? r.present : null });
  }
  return { rows: out, withoutPeriod, unmarked };
}

/** Período e acumulado são listas separadas; mesmo estudante em turmas diferentes (transferência) fica em linhas separadas, nunca somado. */
export function infrequencyAlerts(rows: InfrequencyRow[], period: number, threshold = 75) {
  const { rows: ar, withoutPeriod, unmarked } = toAttendanceRows(rows);
  const periodo = attendanceAt(ar, period, "periodo", threshold); const acumulado = attendanceAt(ar, period, "acumulado", threshold);
  const multi = new Map<string, Set<string>>();
  for (const r of ar.filter((x) => x.period <= period)) multi.set(r.studentId, (multi.get(r.studentId) ?? new Set()).add(r.classId));
  const transferred = [...multi].filter(([, s]) => s.size > 1).map(([id]) => id);
  return { periodo, acumulado, withoutPeriod, unmarked, transferred };
}

export const countBy = (r: AttendanceResult[]) => ({ alerta: r.filter((x) => x.status === "alerta").length, semAlerta: r.filter((x) => x.status === "sem-alerta").length, naoApurado: r.filter((x) => x.status === "nao-apurado").length });

/** Busca ativa: abrir caso só a partir de alerta (abaixo do limite em Parâmetros; padrão 75%). */
export const canOpenCase = (r: AttendanceResult, threshold = 75) => r.status === "alerta" && r.presencePct != null && r.presencePct < threshold;

export const INFREQ_REPORT: ReportDefinition = {
  id: "aa-infrequencia", version: 1, title: "Infrequência — alertas (presença abaixo de 75%)", description: "Projeção de aa_infrequency_at.",
  source: "aa_infrequency_at", params: [],
  columns: [{ id: "escola", label: "Escola", kind: "text" }, { id: "turma", label: "Turma", kind: "text" }, { id: "estudante", label: "Estudante (código)", kind: "text" },
    { id: "recorte", label: "Recorte", kind: "text" }, { id: "aulas", label: "Aulas marcadas", kind: "number" }, { id: "faltas", label: "Faltas", kind: "number" },
    { id: "presenca", label: "Presença (%)", kind: "number" }],
  formats: ["xlsx", "pdf", "csv"], reproducible: false, syncRowLimit: 5000,
};
export const infreqReportRows = (rs: { mode: string; r: AttendanceResult }[], school: (id: string) => string, cls: (id: string) => string): Record<string, CellValue>[] =>
  rs.filter((x) => x.r.status === "alerta").map(({ mode, r }) => ({ escola: school(r.schoolId), turma: cls(r.classId), estudante: r.studentId.slice(0, 8), recorte: mode,
    aulas: r.planned, faltas: r.absences, presenca: r.presencePct == null ? null : Math.round(r.presencePct * 10) / 10 }));
