/** A&A Lote 7 — importação confiável: projeção pura do staging (0370). Nunca grava resultado canônico; nunca converte acertos em TRI. */
export type MeasureKind = "acertos-locais" | "proficiencia-tri";
export type ImportBatch = { id: string; adapter_key: string; adapter_version: number; file_name: string; sha256: string; sheet: string;
  program_key: string; edition_year: number; cycle: string | null; round: string | null; school_label: string | null;
  measure_kind: MeasureKind; formula_note: string | null; executor_label: string; recorded_at: string };
export type ImportRow = { id: string; batch_id: string; row_no: number; class_label: string | null; student_name: string | null;
  match_state: "exato-inep" | "exato-matricula" | "revisao-nome" | "sem-correspondencia" | "duplicado" | "sem-dado";
  candidate_student_ids: string[]; matched_student_id: string | null; payload: { answers?: (string | null)[]; descriptors?: string[]; total_local?: unknown } };
export type ReviewEvent = { row_id: string; seq: number; decision: "vincular" | "rejeitar"; student_id: string | null; reason: string; recorded_at: string };
export type BatchEvent = { batch_id: string; seq: number; event: "preparado" | "confirmado" | "revertido"; reason: string | null; recorded_at: string };

export type BatchView = { batch: ImportBatch; state: BatchEvent["event"] | "sem-evento"; seq: number; counts: Record<ImportRow["match_state"], number>;
  pendingReview: number; linked: number; rejected: number; canConfirm: boolean; blockers: string[] };

export function rowResolution(row: ImportRow, reviews: ReviewEvent[]): { student: string | null; status: "vinculado" | "rejeitado" | "pendente" | "fora" } {
  if (row.match_state === "exato-inep" || row.match_state === "exato-matricula") return { student: row.matched_student_id, status: "vinculado" };
  if (row.match_state !== "revisao-nome" && row.match_state !== "sem-correspondencia") return { student: null, status: "fora" };
  const last = reviews.filter((r) => r.row_id === row.id).sort((a, b) => a.seq - b.seq).at(-1);
  if (!last) return { student: null, status: "pendente" };
  return last.decision === "vincular" ? { student: last.student_id, status: "vinculado" } : { student: null, status: "rejeitado" };
}

export function projectBatches(batches: ImportBatch[], rows: ImportRow[], reviews: ReviewEvent[], events: BatchEvent[]): BatchView[] {
  return batches.map((batch) => {
    const ev = events.filter((e) => e.batch_id === batch.id).sort((a, b) => a.seq - b.seq);
    const rs = rows.filter((r) => r.batch_id === batch.id);
    const counts = { "exato-inep": 0, "exato-matricula": 0, "revisao-nome": 0, "sem-correspondencia": 0, duplicado: 0, "sem-dado": 0 } as BatchView["counts"];
    let pendingReview = 0, linked = 0, rejected = 0;
    for (const r of rs) { counts[r.match_state]++; const s = rowResolution(r, reviews).status; if (s === "pendente") pendingReview++; if (s === "vinculado") linked++; if (s === "rejeitado") rejected++; }
    const state = ev.at(-1)?.event ?? "sem-evento";
    const blockers: string[] = [];
    if (state !== "preparado") blockers.push(state === "sem-evento" ? "Lote sem preparação registrada." : `Lote já ${state}.`);
    if (pendingReview > 0) blockers.push(`${pendingReview} linha(s) aguardam revisão humana de identidade.`);
    if (!batch.school_label) blockers.push("Escola não identificada na planilha.");
    return { batch, state, seq: ev.at(-1)?.seq ?? 0, counts, pendingReview, linked, rejected, canConfirm: blockers.length === 0, blockers };
  });
}

/** Duas medidas só se agregam se forem do mesmo tipo e da mesma fórmula; acertos locais e TRI nunca. */
export function comparableMeasures(a: Pick<ImportBatch, "measure_kind" | "formula_note" | "program_key">, b: Pick<ImportBatch, "measure_kind" | "formula_note" | "program_key">): { ok: boolean; reason?: string } {
  if (a.measure_kind !== b.measure_kind) return { ok: false, reason: "Acertos locais e proficiência TRI são escalas diferentes e nunca se convertem." };
  if (a.program_key !== b.program_key) return { ok: false, reason: "Programas diferentes." };
  if ((a.formula_note ?? "") !== (b.formula_note ?? "")) return { ok: false, reason: "Fórmula própria do instrumento difere entre os lotes." };
  return { ok: true };
}

/** Acertos locais de uma linha: só conta respostas presentes contra gabarito declarado; sem gabarito não há número. */
export function localHits(answers: (string | null)[], key: (string | null)[] | null): { hits: number | null; answered: number; reason?: string } {
  const answered = answers.filter((x) => x != null && x !== "").length;
  if (!key || key.length !== answers.length || key.some((k) => !k)) return { hits: null, answered, reason: "Gabarito não declarado para todas as questões." };
  return { hits: answers.reduce((n, x, i) => n + (x != null && x.trim().toUpperCase() === key[i]!.trim().toUpperCase() ? 1 : 0), 0), answered };
}
