/**
 * Família L04–L10 — painel, vida escolar, frequência, resultados, EI, atividades, calendário.
 * Projeções puras sobre fatos oficiais já lidos e já autorizados (decideFamilyAccess).
 * Nada é publicado pela Família; sem ato de publicação, o fato não aparece.
 */
import type { FamilySection } from "./family-portal";

// ---------- L04 painel e múltiplos estudantes ----------
export interface StudentCard { studentId: string; label: string; school: string | null; className: string | null; sections: readonly FamilySection[] }
export function dashboardCards(cards: readonly StudentCard[], selected: string | null) {
  const current = cards.find((c) => c.studentId === selected) ?? (cards.length === 1 ? cards[0]! : null);
  return { cards, current, needsChoice: current === null && cards.length > 1, empty: cards.length === 0 };
}
/** Troca de contexto nunca mistura dados de dois estudantes na mesma tela. */
export const contextKey = (studentId: string, section: FamilySection) => `${studentId}:${section}`;

// ---------- L05 vida escolar ----------
export interface SchoolLifeFact { kind: "matricula" | "enturmacao" | "transferencia" | "encerramento"; on: string; school: string; source: string }
export function schoolLife(facts: readonly SchoolLifeFact[] | null) {
  if (facts === null) return { state: "nao-lido" as const, items: [] };
  return { state: facts.length ? ("ok" as const) : ("sem-registro" as const), items: [...facts].filter((f) => f.source).sort((a, b) => b.on.localeCompare(a.on)) };
}

// ---------- L06 frequência e justificativa ----------
export type AttendanceMark = "presente" | "ausente" | "justificada" | null;
export interface AttendanceDay { date: string; lessonsPlanned: number | null; mark: AttendanceMark; published: boolean }
export function familyAttendance(days: readonly AttendanceDay[]) {
  const pub = days.filter((d) => d.published);
  return {
    days: pub.map((d) => ({ date: d.date, label: d.lessonsPlanned === null ? "sem grade" : d.mark === null ? "chamada não registrada" : d.mark })),
    absences: pub.some((d) => d.mark !== null) ? pub.filter((d) => d.mark === "ausente").length : null, // sem registro ≠ zero
    hidden: days.length - pub.length,
  };
}
export interface Justification { studentId: string; date: string; text: string; attachmentRef: string | null }
/** Justificativa é encaminhada à escola; nunca altera a frequência (só a escola decide). */
export function validateJustification(j: Justification, today: string): string[] {
  const e: string[] = [];
  if (j.date > today) e.push("Não é possível justificar ausência futura.");
  if (!j.text.trim() || j.text.length > 1000) e.push("Descreva a justificativa (até 1000 caracteres).");
  if (/\b(cid|diagn[óo]stico|laudo)\b/i.test(j.text) && !j.attachmentRef) e.push("Informação de saúde deve ir como anexo restrito, não no texto.");
  return e;
}
export const justificationEffect = () => ({ changesAttendance: false, routedTo: "secretaria-da-escola" as const });

// ---------- L07 resultados EF/EJA ----------
export interface ResultFact { component: string; period: string; value: string | null; scale: string; publishedAt: string | null }
export const publishedResults = (r: readonly ResultFact[]) => r.filter((x) => x.publishedAt !== null).map((x) => ({ ...x, value: x.value ?? "não lançado" }));

// ---------- L08 Educação Infantil ----------
export interface DescriptiveReport { period: string; text: string; publishedAt: string | null; homologated: boolean }
/** EI nunca recebe nota nem conceito numérico; só parecer homologado e publicado. */
export function eiReports(r: readonly DescriptiveReport[]) {
  return r.filter((x) => x.publishedAt && x.homologated).map((x) => ({ period: x.period, text: x.text }));
}
export const isNumericGrade = (s: string) => /^\s*\d+([.,]\d+)?\s*$/.test(s);

// ---------- L09 atividades ----------
export interface Activity { title: string; due: string | null; visibleToFamily: boolean; classId: string }
export const familyActivities = (a: readonly Activity[], classId: string) => a.filter((x) => x.visibleToFamily && x.classId === classId);

// ---------- L10 calendário ----------
export interface CalendarDay { date: string; kind: string; homologated: boolean }
export function familyCalendar(days: readonly CalendarDay[] | null) {
  if (days === null) return { state: "nao-lido" as const, days: [] };
  const h = days.filter((d) => d.homologated);
  return { state: h.length ? ("ok" as const) : ("sem-calendario-homologado" as const), days: h };
}
