/**
 * PERFIL MEDIADOR — LOTE 04 Central de Acompanhamento (núcleo puro).
 * Estudante só se designação vigente (`inclusion_my_mediation`); orientação só de
 * `inclusion_records_at` vigente e marcada `share_with_mediation`, sem corpo clínico.
 * Registro de apoio: categoria só de catálogo homologado; sem writer canônico do
 * mediador, o envio é BLOQUEADO por extenso (rascunho fica só na aba, sem nome).
 */
export interface InclusionRecordRow {
  id: string; logical_id: string; version: number; supersedes_id: string | null; event_kind: string;
  record_type: string; student_id: string; body: string | null; educational_purpose: string | null;
  valid_from: string | null; valid_to: string | null; share_with_mediation: boolean; recorded_at: string;
}
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|transtorno|medica[cç]|psiqui|neurol)/i;

/** Orientação operacional vigente na data: cabeça de cada cadeia, partilhada com mediação, não anulada. */
export function currentGuidance(rows: InclusionRecordRow[], studentId: string, date: string) {
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  return rows
    .filter((r) => r.student_id === studentId && !superseded.has(r.id) && r.share_with_mediation && r.event_kind !== "anulacao")
    .filter((r) => (!r.valid_from || r.valid_from <= date) && (!r.valid_to || date <= r.valid_to))
    .map((r) => ({ id: r.logical_id, version: r.version, type: r.record_type,
      text: r.body && CLINICAL.test(r.body) ? null : r.body, withheld: !!r.body && CLINICAL.test(r.body), since: r.valid_from }))
    .sort((a, b) => ((a.since ?? "") < (b.since ?? "") ? 1 : -1));
}

export type SupportKind = "apoio" | "acessibilidade" | "barreira";
export interface CatalogValue { id: string; version: number; label: string; kind: SupportKind }
export interface SupportDraft { kind: SupportKind; categoryId: string | null; note: string; context: string | null; at: string }

export function validateSupport(d: SupportDraft, catalog: CatalogValue[] | null): string[] {
  const r: string[] = [];
  if (catalog === null) r.push("Catálogo de categorias de apoio não homologado: registro indisponível.");
  else if (!d.categoryId || !catalog.some((c) => c.id === d.categoryId && c.kind === d.kind)) r.push("Escolha uma categoria do catálogo.");
  if (d.note.length > 500) r.push("Observação com mais de 500 caracteres.");
  if (CLINICAL.test(d.note)) r.push("Registro objetivo: sem diagnóstico, CID ou termo clínico.");
  return r;
}

/** Sem writer canônico do mediador o envio nunca é simulado. */
export function submitAvailability(writer: string | null, competences: string[], operation: string): { ok: boolean; reason: string } {
  if (!writer) return { ok: false, reason: "Ainda não existe gravação oficial do registro do mediador: o rascunho fica só neste aparelho até a decisão." };
  if (!competences.includes(operation)) return { ok: false, reason: "Sua função não inclui esta operação." };
  return { ok: true, reason: "" };
}

export const DRAFT_KEY = (accountId: string, studentId: string) => `sigem.mediator.support-draft.v1:${accountId}:${studentId}`;

export const QUICK_TABS = [
  { id: "contexto", label: "Contexto" }, { id: "orientacao", label: "Orientação" },
  { id: "registrar", label: "Registrar" }, { id: "historico", label: "Histórico" },
] as const;
