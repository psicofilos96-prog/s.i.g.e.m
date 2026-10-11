// SIGEM 2.0 — Direção, Lote 04: frequência, permanência e busca ativa (núcleo puro).
// Frequência só de registros oficiais do Diário (chamadas concluídas, autoria docente preservada);
// denominador só aulas com chamada dentro da vigência da matrícula; sem marcação ≠ falta; evasão nunca inferida.

export interface OfficialMark { studentId: string; classId: string; date: string; lessonId: string; mark: "presente" | "ausente"; authorEngagementId: string }
export interface EnrollmentWindow { studentId: string; from: string | null; to: string | null }
export interface InfrequencyParams { version: string; homologated: boolean; minRate: number; recurringAbsences: number; windowDays: number }

const inWin = (d: string, w: EnrollmentWindow) => w.from != null && w.from <= d && (w.to == null || d <= w.to);

/** Frequência do estudante no período: fora da vigência não conta; sem início declarado ⇒ indeterminado; sem aula ⇒ sem denominador. */
export function studentRate(marks: OfficialMark[], w: EnrollmentWindow, period: { from: string; to: string }) {
  if (w.from == null) return { state: "indeterminado" as const, reason: "início da matrícula não declarado" };
  const m = marks.filter((x) => x.studentId === w.studentId && x.date >= period.from && x.date <= period.to && inWin(x.date, w));
  if (!m.length) return { state: "sem-denominador" as const, reason: "nenhuma chamada oficial na vigência" };
  const present = m.filter((x) => x.mark === "presente").length;
  return { state: "apurado" as const, present, total: m.length, rate: present / m.length, authors: [...new Set(m.map((x) => x.authorEngagementId))] };
}

/** Série por turma: por dia, só chamadas lançadas; dia sem chamada fica ausente da série (não zero). */
export function classSeries(marks: OfficialMark[], classId: string) {
  const by: Record<string, { p: number; t: number }> = {};
  for (const x of marks.filter((m) => m.classId === classId)) { const d = (by[x.date] ??= { p: 0, t: 0 }); d.t++; if (x.mark === "presente") d.p++; }
  return Object.entries(by).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, rate: v.p / v.t, total: v.t }));
}

/** Alerta só com parâmetro homologado; nunca rotula evasão. */
export function infrequencyAlert(marks: OfficialMark[], w: EnrollmentWindow, period: { from: string; to: string }, params: InfrequencyParams | null) {
  if (!params?.homologated) return { alert: false, reason: "parâmetro de infrequência não homologado" };
  const r = studentRate(marks, w, period);
  if (r.state !== "apurado") return { alert: false, reason: r.reason };
  const absences = marks.filter((x) => x.studentId === w.studentId && x.mark === "ausente" && inWin(x.date, w) && x.date >= period.from && x.date <= period.to).length;
  const hits = [r.rate < params.minRate && "taxa-abaixo", absences >= params.recurringAbsences && "faltas-recorrentes"].filter(Boolean) as string[];
  return { alert: hits.length > 0, reasons: hits, evidence: { rate: r.rate, absences, total: r.total, paramsVersion: params.version } };
}

// ── Procedimento de infrequência / busca ativa ──
export const STEPS = ["alerta", "encaminhamento", "contato", "providencia", "monitoramento", "encerramento"] as const;
export type Step = (typeof STEPS)[number];
export interface ProcEvent { step: Step; by: string; isNaturalPerson: boolean; on: string; sector?: "secretaria" | "orientacao" | "familia"; note?: string; contactChannel?: string; contactConfirmed?: boolean }
export interface Procedure { id: string; schoolId: string; studentId: string; processVersion: string | null; events: ProcEvent[] }

/** Avança só na ordem do processo municipal registrado; autor humano; contato registra canal sem afirmar êxito; encerramento exige justificativa. */
export function advance(p: Procedure, ev: ProcEvent, actorSchoolId: string) {
  if (!p.processVersion) return { ok: false as const, code: "busca:processo-municipal-nao-registrado" };
  if (actorSchoolId !== p.schoolId) return { ok: false as const, code: "busca:fora-da-escola" };
  if (!ev.isNaturalPerson) return { ok: false as const, code: "busca:autor-humano-obrigatorio" };
  const last = p.events.at(-1)?.step;
  if (last === "encerramento") return { ok: false as const, code: "busca:encerrado" };
  const nextIdx = last ? STEPS.indexOf(last) + 1 : 0;
  const ok = STEPS[nextIdx] === ev.step || (last === "monitoramento" && ev.step === "contato") || (ev.step === "encerramento" && !!last);
  if (!ok) return { ok: false as const, code: "busca:etapa-fora-de-ordem" };
  if (ev.step === "encaminhamento" && !ev.sector) return { ok: false as const, code: "busca:setor-obrigatorio" };
  if (ev.step === "contato" && !ev.contactChannel) return { ok: false as const, code: "busca:canal-obrigatorio" };
  if (ev.step === "encerramento" && !ev.note?.trim()) return { ok: false as const, code: "busca:justificativa-obrigatoria" };
  return { ok: true as const, procedure: { ...p, events: [...p.events, { ...ev, contactConfirmed: ev.contactConfirmed ?? false }] } };
}
