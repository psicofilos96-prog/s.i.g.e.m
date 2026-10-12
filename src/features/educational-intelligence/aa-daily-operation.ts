// LOTE 19 A&A — Operação cotidiana: projeção pura "o que fazer hoje" sobre leituras reais
// (intervenções, eventos, lotes de importação, resultados externos). Leitura falha nunca vira zero.
import type { InterventionView } from "./interventions";

export type Read<T> = { ok: true; rows: T[]; truncated: boolean } | { ok: false; reason: string };
export type Task = { id: string; tab: string; title: string; detail: string; tone: "warning" | "info" };
export type Count = { label: string; value: number | null; note: string | null };

export function countOf<T>(r: Read<T>, label: string): Count {
  if (!r.ok) return { label, value: null, note: `Leitura indisponível: ${r.reason}` };
  return { label, value: r.rows.length, note: r.truncated ? "Primeiras 1000 linhas; total pode ser maior." : null };
}

export function dailyTasks(views: InterventionView[] | null, imports: Read<{ id: string; recorded_at: string }>, today: string): Task[] {
  const t: Task[] = [];
  for (const v of views ?? []) {
    if (v.stage === "encerrado") continue;
    if (v.overdue.length) t.push({ id: `atraso:${v.current.logical_id}`, tab: "intervencoes", tone: "warning", title: "Intervenção com prazo vencido", detail: `${v.current.objective} — ${v.overdue.join("; ")}` });
    if (v.stage === "aguardando-reavaliacao") t.push({ id: `reav:${v.current.logical_id}`, tab: "intervencoes", tone: "info", title: "Reavaliação pendente", detail: v.current.objective });
    if (v.issues.length) t.push({ id: `inc:${v.current.logical_id}`, tab: "intervencoes", tone: "warning", title: "Plano incompleto", detail: v.issues.join("; ") });
  }
  if (imports.ok) {
    const recent = imports.rows.filter((r) => r.recorded_at.slice(0, 10) === today).length;
    if (recent) t.push({ id: "import:hoje", tab: "importacao", tone: "info", title: "Importações de hoje para conferir", detail: `${recent} lote(s) registrado(s) hoje` });
  }
  return t.sort((a, b) => (a.tone === b.tone ? a.title.localeCompare(b.title, "pt-BR") : a.tone === "warning" ? -1 : 1));
}

// Rascunho local do plano: nunca guarda estudante nominal (público só por escopo/referência opaca).
export type PlanDraft = { objective: string; skills: string; strategies: string; responsibles: string; due: string };
export const DRAFT_KEY = "sigem.aa.plan-draft.v1";
export function parseDraft(raw: string | null): PlanDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<PlanDraft>;
    const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 2000) : "");
    return { objective: s(d.objective), skills: s(d.skills), strategies: s(d.strategies), responsibles: s(d.responsibles), due: s(d.due) };
  } catch { return null; }
}
export function draftIssues(d: PlanDraft): string[] {
  const e: string[] = [];
  if (d.objective.trim().length < 10) e.push("Descreva o objetivo (mínimo 10 caracteres).");
  if (!d.skills.trim()) e.push("Indique ao menos uma habilidade.");
  if (!d.strategies.trim()) e.push("Indique ao menos uma estratégia.");
  if (!d.responsibles.trim()) e.push("Indique o responsável.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.due)) e.push("Informe o prazo.");
  return e;
}
