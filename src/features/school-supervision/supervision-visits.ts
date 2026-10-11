// Supervisão Escolar — Lote 03: agenda e visitas técnicas (núcleo puro, append-only).
// Gravação real continua por record_school_supervision (pessoa natural, capability); PDF A4 pelo
// report-engine/document-studio. Nenhuma visita é semeada: agenda vazia é estado legítimo.
import { accessLevel, type AssignmentEvent, type Viewer } from "./supervision-access";

export type VisitKind = "ordinaria" | "acompanhamento" | "orientacao" | "verificacao-documental" | "retorno" | "extraordinaria";
export type VisitState = "planejada" | "em-execucao" | "relatorio-em-revisao" | "concluida" | "cancelada";
const NEXT: Record<VisitState, VisitState[]> = {
  planejada: ["em-execucao", "cancelada"],
  "em-execucao": ["relatorio-em-revisao", "cancelada"],
  "relatorio-em-revisao": ["concluida", "em-execucao"],
  concluida: [],
  cancelada: [],
};

export interface ChecklistItem { key: string; label: string; answer: "conforme" | "nao-conforme" | "nao-se-aplica" | null; note: string | null }
export interface Provision { id: string; text: string; responsible: string | null; due: string | null }
export interface ReportVersion { version: number; authorPrincipalId: string; text: string; checklist: ChecklistItem[]; provisions: Provision[]; at: string; reason: string | null }
export interface Visit {
  id: string; schoolId: string; kind: VisitKind; objective: string; start: string; end: string | null;
  participants: string[]; attachments: string[]; returnOfVisitId: string | null; extraordinaryReason: string | null;
  events: { seq: number; state: VisitState; principalId: string; human: boolean; at: string; reason: string | null }[];
  reports: ReportVersion[];
}
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

export const visitState = (v: Visit): VisitState => v.events.at(-1)!.state;
export const attachmentPath = (schoolId: string, visitId: string, file: string) => `supervisao/${schoolId}/${visitId}/${file}`;

export function planVisit(input: Omit<Visit, "events" | "reports">, by: { principalId: string; human: boolean; at: string }, assignments: AssignmentEvent[], viewer: Viewer, existing: Visit[]): Res<Visit> {
  if (!by.human) return { ok: false, code: "human-author-required" };
  const lvl = accessLevel(assignments, viewer, input.schoolId, input.start.slice(0, 10));
  if (lvl === "nenhum" || lvl === "consultar") return { ok: false, code: "no-scope-for-school" };
  if (!input.objective.trim()) return { ok: false, code: "objective-required" };
  if (input.end && input.end <= input.start) return { ok: false, code: "end-before-start" };
  if (input.kind === "extraordinaria" && !input.extraordinaryReason?.trim()) return { ok: false, code: "extraordinary-reason-required" };
  if (input.kind === "retorno") {
    const orig = existing.find((v) => v.id === input.returnOfVisitId);
    if (!orig || orig.schoolId !== input.schoolId || visitState(orig) !== "concluida") return { ok: false, code: "return-needs-concluded-visit" };
  }
  if (input.attachments.some((a) => !a.startsWith(`supervisao/${input.schoolId}/${input.id}/`))) return { ok: false, code: "attachment-outside-private-path" };
  // conflito de horário do mesmo supervisor
  const mine = existing.filter((v) => v.events[0]?.principalId === by.principalId && !["cancelada", "concluida"].includes(visitState(v)));
  const end = input.end ?? input.start;
  if (mine.some((v) => v.start < end && input.start < (v.end ?? v.start) )) return { ok: false, code: "schedule-conflict" };
  return { ok: true, value: { ...input, events: [{ seq: 1, state: "planejada", principalId: by.principalId, human: true, at: by.at, reason: null }], reports: [] } };
}

export function transition(v: Visit, to: VisitState, by: { principalId: string; human: boolean; at: string; reason: string | null }, expectedSeq: number): Res<Visit> {
  const head = v.events.at(-1)!;
  if (head.seq !== expectedSeq) return { ok: false, code: "stale-base" };
  if (!by.human) return { ok: false, code: "human-author-required" };
  if (!NEXT[head.state].includes(to)) return { ok: false, code: "invalid-transition" };
  if ((to === "cancelada" || (head.state === "relatorio-em-revisao" && to === "em-execucao")) && !by.reason?.trim()) return { ok: false, code: "reason-required" };
  if (to === "relatorio-em-revisao" && !v.reports.length) return { ok: false, code: "report-required" };
  if (to === "concluida") {
    const last = v.reports.at(-1)!;
    if (last.authorPrincipalId === by.principalId) return { ok: false, code: "reviewer-must-differ" };
    if (last.checklist.some((c) => c.answer == null)) return { ok: false, code: "checklist-incomplete" };
    if (last.checklist.some((c) => c.answer === "nao-conforme") && !last.provisions.length) return { ok: false, code: "nonconformity-needs-provision" };
  }
  return { ok: true, value: { ...v, events: [...v.events, { seq: head.seq + 1, state: to, principalId: by.principalId, human: true, at: by.at, reason: by.reason }] } };
}

/** Relatório só em execução/revisão; cada salvamento é nova versão; autoria anterior preservada. */
export function saveReport(v: Visit, r: Omit<ReportVersion, "version">, expectedVersion: number, human: boolean): Res<Visit> {
  if (!human) return { ok: false, code: "human-author-required" };
  const st = visitState(v);
  if (st !== "em-execucao" && st !== "relatorio-em-revisao") return { ok: false, code: "report-not-editable" };
  const cur = v.reports.at(-1)?.version ?? 0;
  if (cur !== expectedVersion) return { ok: false, code: "stale-base" };
  if (cur > 0 && !r.reason?.trim()) return { ok: false, code: "reason-required" };
  return { ok: true, value: { ...v, reports: [...v.reports, { ...r, version: cur + 1 }] } };
}

// ---------- Rascunho recuperável (local à sessão, nunca vira registro) ----------
export interface Draft { visitId: string; baseVersion: number; text: string; savedAt: string; ownerPrincipalId: string }
export function recoverDraft(d: Draft | null, v: Visit, viewerPrincipalId: string): { draft: Draft | null; warning: string | null } {
  if (!d || d.visitId !== v.id || d.ownerPrincipalId !== viewerPrincipalId) return { draft: null, warning: null };
  const cur = v.reports.at(-1)?.version ?? 0;
  return cur === d.baseVersion ? { draft: d, warning: null } : { draft: d, warning: "o relatório mudou desde o rascunho: compare antes de salvar" };
}

/** Agenda: só visitas registradas no período; vazio é vazio. */
export function agenda(visits: Visit[], from: string, to: string) {
  return visits.filter((v) => v.start.slice(0, 10) >= from && v.start.slice(0, 10) <= to).sort((a, b) => a.start.localeCompare(b.start)).map((v) => ({ id: v.id, schoolId: v.schoolId, kind: v.kind, start: v.start, state: visitState(v) }));
}

/** Conteúdo do PDF A4: sempre da última versão, com versão e trilha; o render é do report-engine. */
export function reportPrintable(v: Visit) {
  const r = v.reports.at(-1);
  if (!r) return null;
  return { title: `Relatório de visita — ${v.kind}`, version: r.version, author: r.authorPrincipalId, objective: v.objective, participants: v.participants, checklist: r.checklist, provisions: r.provisions, text: r.text, trail: v.events.map((e) => ({ state: e.state, by: e.principalId, at: e.at, reason: e.reason })), draft: visitState(v) !== "concluida" };
}
