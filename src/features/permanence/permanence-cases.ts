/**
 * L06 Permanência — casos e sinalização fora da escola (migration 0396).
 * Caso = o canônico do AA (`aa_outreach_cases` + `aa_outreach_events`); L06 só
 * acrescenta identificador BA-ano-seq, prioridade de catálogo (append-only, justificada)
 * e projeções. Estado é derivado dos eventos, nunca campo gravado.
 * Sinalização fora da escola NÃO cria estudante nem matrícula: só HMAC + iniciais +
 * ano de nascimento; "matriculado" exige referência a participação real gravada pelo B3.
 */
export interface CaseRow { id: string; schoolId: string; studentId: string; enrollmentId: string | null; responsibleLabel: string | null; openedAt: string }
export interface CaseEvent { caseId: string; seq: number; kind: "contato" | "encaminhamento" | "retorno" | "resolucao" | "responsavel"; dueDate: string | null; recordedAt: string }
export interface PriorityEvent { caseId: string; seq: number; priorityCode: string; justification: string }
export interface Priority { code: string; label: string; rank: number }
export interface EnrollmentWindow { from: string; to: string | null }

export type CaseState = "aberto" | "em-contato" | "encaminhado" | "aguardando-retorno-vencido" | "resolvido";
export interface CaseView {
  id: string; number: string | null; studentId: string; schoolId: string;
  enrollment: { id: string; window: EnrollmentWindow | null; activeOnOpening: boolean | null } | null;
  responsible: string | null; priority: Priority | null; priorityUnknown: boolean;
  state: CaseState; history: CaseEvent[];
}

const ordered = <T extends { seq: number }>(xs: readonly T[]) => {
  const s = [...xs].sort((a, b) => a.seq - b.seq);
  s.forEach((e, i) => { if (e.seq !== i + 1) throw new Error("permanence-cases:broken-chain"); });
  return s;
};

export function projectCase(c: CaseRow, events: readonly CaseEvent[], priorities: readonly PriorityEvent[], catalog: readonly Priority[],
  number: string | null, window: EnrollmentWindow | null, today: string): CaseView {
  const h = ordered(events.filter((e) => e.caseId === c.id));
  const pr = ordered(priorities.filter((p) => p.caseId === c.id)).at(-1);
  const prio = pr ? catalog.find((x) => x.code === pr.priorityCode) ?? null : null;
  const kinds = h.map((e) => e.kind);
  const last = h.at(-1);
  let state: CaseState = "aberto";
  if (kinds.includes("resolucao")) state = "resolvido";
  else if (last?.kind === "encaminhamento") state = last.dueDate !== null && today > last.dueDate ? "aguardando-retorno-vencido" : "encaminhado";
  else if (kinds.includes("contato") || kinds.includes("retorno")) state = "em-contato";
  const opened = c.openedAt.slice(0, 10);
  return {
    id: c.id, number, studentId: c.studentId, schoolId: c.schoolId,
    enrollment: c.enrollmentId ? { id: c.enrollmentId, window,
      activeOnOpening: window === null ? null : window.from <= opened && (window.to === null || opened <= window.to) } : null,
    responsible: c.responsibleLabel, priority: prio, priorityUnknown: !!pr && !prio, state, history: h,
  };
}

/** Ordenação só por prioridade de catálogo; sem prioridade vai ao fim, empate por abertura (nunca por nome). */
export function sortCases(vs: readonly CaseView[], openedAt: ReadonlyMap<string, string>): CaseView[] {
  return [...vs].sort((a, b) => (a.priority?.rank ?? Infinity) - (b.priority?.rank ?? Infinity)
    || (openedAt.get(a.id) ?? "").localeCompare(openedAt.get(b.id) ?? "") || a.id.localeCompare(b.id));
}

// ---------- Sinalização fora da escola ----------
export interface SignalDraft { territorySchoolId: string; identityKey: string; initials: string | null; birthYear: number | null; sourceKind: string; freeText?: string }
const FORBIDDEN_FIELDS = /cpf|nome|endere|telefone|cid|laudo|diagn/i;

export async function hmacHex(secret: string, value: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value.normalize("NFKC").trim().toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Recusa qualquer campo identificador em claro; o banco só recebe HMAC/iniciais/ano. */
export function validateSignal(d: SignalDraft, extraFields: readonly string[] = []): string | null {
  if (extraFields.some((f) => FORBIDDEN_FIELDS.test(f))) return "Campo identificador ou sensível não é aceito.";
  if (d.freeText && d.freeText.trim()) return "Texto livre não é aceito na sinalização.";
  if (d.initials !== null && !/^[A-Z]{1,4}$/.test(d.initials)) return "Iniciais inválidas.";
  if (d.birthYear !== null && (d.birthYear < 1990 || d.birthYear > 2100)) return "Ano de nascimento inválido.";
  if (d.identityKey.trim().length < 3) return "Chave de identificação ausente.";
  if (d.sourceKind.trim().length < 3) return "Origem da sinalização ausente.";
  return null;
}

export type SignalEventKind = "verificacao" | "encaminhado-matricula" | "matriculado" | "descartado";
export interface SignalEvent { signalId: string; seq: number; kind: SignalEventKind; enrollmentRef: string | null }
export function projectSignal(signalId: string, evs: readonly SignalEvent[]) {
  const h = ordered(evs.filter((e) => e.signalId === signalId));
  const last = h.at(-1)?.kind ?? null;
  const closed = last === "matriculado" || last === "descartado";
  return { state: last ?? "recebida", closed, isStudent: false as const, enrollmentRef: h.find((e) => e.kind === "matriculado")?.enrollmentRef ?? null,
    actions: closed ? [] : (["verificacao", "encaminhado-matricula", "matriculado", "descartado"] as SignalEventKind[]), seq: h.length };
}

export const CASE_ERRORS: Record<string, string> = {
  "permcase:no-person": "Sessão sem pessoa institucional.",
  "permcase:unavailable": "Caso ou sinalização indisponível.",
  "permcase:forbidden": "Sem capacidade para esta ação.",
  "permcase:stale-base": "Houve mudança desde a leitura; recarregue.",
  "permcase:priority-unknown": "Prioridade fora do catálogo configurado.",
  "permcase:priority-exists": "Prioridade já cadastrada.",
  "permcase:justification-required": "Justifique a prioridade.",
  "permcase:key-conflict": "Chave já usada.",
  "permcase:invalid-signal": "Sinalização inválida.",
  "permcase:closed": "Sinalização encerrada.",
  "permcase:enrollment-not-found": "Matrícula não encontrada: registre-a antes pela Secretaria.",
  "permcase:invalid-event": "Evento inválido (descarte exige justificativa).",
};
