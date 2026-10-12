/**
 * Docente LOTE 05 — Frequência rápida e temporal (núcleo puro).
 *
 * - Lista da chamada = alunos com alocação vigente NA DATA da aula (fim inclusivo);
 *   transferido depois continua nas chamadas anteriores e não entra nas seguintes.
 * - Marcação só entre as categorias autorizadas pela configuração; ausência de
 *   marcação é "Não registrada" e nunca vira presença.
 * - Envio é tudo-ou-nada, com chave de idempotência determinística e versão base
 *   esperada (concorrência otimista). Rascunho guarda só ids e marcas, nunca nomes.
 */
export type RosterAllocation = { studentId: string; classId: string; start: string; end?: string | null };

export function rosterOnDate(allocs: readonly RosterAllocation[], classId: string, date: string): string[] {
  const ids = allocs
    .filter((a) => a.classId === classId && a.start <= date && (!a.end || a.end >= date))
    .map((a) => a.studentId);
  return [...new Set(ids)].sort();
}

export const NOT_RECORDED = "Não registrada";

export type AttendanceSubmission = {
  idempotencyKey: string;
  slotKey: string;
  expectedBaseVersion: number | null;
  marks: { studentId: string; mark: string }[];
};

export type SubmissionResult =
  | { ok: true; submission: AttendanceSubmission }
  | { ok: false; reasons: string[] };

/** Monta o envio atômico; qualquer problema recusa tudo. */
export function buildAttendanceSubmission(input: {
  slotKey: string;
  roster: readonly string[];
  draft: Readonly<Record<string, string | undefined>>;
  authorizedMarks: readonly string[];
  expectedBaseVersion: number | null;
}): SubmissionResult {
  const reasons: string[] = [];
  if (input.authorizedMarks.length === 0) reasons.push("Nenhuma categoria de marcação autorizada.");
  const rosterSet = new Set(input.roster);
  for (const id of Object.keys(input.draft)) {
    if (!rosterSet.has(id)) reasons.push(`Estudante ${id} não está enturmado na data.`);
  }
  const missing = input.roster.filter((id) => !input.draft[id]);
  if (missing.length) reasons.push(`Faltam ${missing.length} marcação(ões); nenhuma é presumida.`);
  for (const id of input.roster) {
    const m = input.draft[id];
    if (m && !input.authorizedMarks.includes(m)) reasons.push(`Marcação "${m}" não autorizada.`);
  }
  if (reasons.length) return { ok: false, reasons };
  const marks = input.roster.map((studentId) => ({ studentId, mark: input.draft[studentId]! }));
  const payload = `${input.slotKey}|${input.expectedBaseVersion ?? "nova"}|${marks.map((m) => `${m.studentId}=${m.mark}`).join(",")}`;
  return {
    ok: true,
    submission: { idempotencyKey: `att:${fnv1a(payload)}`, slotKey: input.slotKey, expectedBaseVersion: input.expectedBaseVersion, marks },
  };
}

/** Concorrência: só aceita se a base esperada for a versão vigente. */
export function acceptsBase(expected: number | null, current: number | null): boolean {
  return expected === current;
}

/** Visão de marcação de um estudante: sem marca ⇒ "Não registrada". */
export function markView(draft: Readonly<Record<string, string | undefined>>, studentId: string): string {
  return draft[studentId] ?? NOT_RECORDED;
}

// --- rascunho recuperável (sessionStorage; só ids e marcas) ---
const DRAFT_PREFIX = "sigem.diary.attendance-draft.v1:";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveDraft(store: Store, slotKey: string, draft: Record<string, string | undefined>): void {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft)) if (v) clean[k] = v;
  store.setItem(DRAFT_PREFIX + slotKey, JSON.stringify(clean));
}

/** Recupera só marcas de alunos ainda enturmados na data e categorias autorizadas. */
export function loadDraft(store: Store, slotKey: string, roster: readonly string[], authorized: readonly string[]): Record<string, string> {
  try {
    const raw = JSON.parse(store.getItem(DRAFT_PREFIX + slotKey) ?? "{}") as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const id of roster) {
      const v = raw[id];
      if (typeof v === "string" && authorized.includes(v)) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function clearDraft(store: Store, slotKey: string): void {
  store.removeItem(DRAFT_PREFIX + slotKey);
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
