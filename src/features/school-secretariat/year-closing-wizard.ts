// SIGEM 2.0 — Lote complementar 06: assistente de encerramento do ano por escola/ano/turma (núcleo puro).
// Orquestra conferências; não calcula nota/frequência/situação (motor = `cycle-closing/`, transição = `year-transition`).
// Bloqueio só por regra normativa vigente configurada; fonte não lida = indeterminado, nunca "ok".

export type StepKey = "calendario" | "matriculas" | "transferencias" | "frequencia" | "avaliacoes" | "conselho" | "resultados" | "escrituracao" | "publicacao";
export const STEPS: StepKey[] = ["calendario", "matriculas", "transferencias", "frequencia", "avaliacoes", "conselho", "resultados", "escrituracao", "publicacao"];

export interface StepReading { key: StepKey; read: boolean; pending: number | null; detail?: string }
export interface ClosingRule { step: StepKey; blocks: boolean; modality: string | null; homologated: boolean; validFrom: string; validTo: string | null }

export function evaluateSteps(readings: StepReading[], rules: ClosingRule[], modality: string, on: string) {
  return STEPS.map((key) => {
    const r = readings.find((x) => x.key === key);
    const rule = rules.find((x) => x.step === key && x.homologated && (x.modality == null || x.modality === modality) && x.validFrom <= on && (x.validTo == null || on <= x.validTo));
    const state = !r || !r.read ? "indeterminado" : r.pending == null ? "indeterminado" : r.pending === 0 ? "conferido" : "pendente";
    const blocking = !!rule?.blocks && state !== "conferido";
    return { key, state, pending: r?.pending ?? null, blocking, rule: rule ? "regra vigente" : "sem regra: informativo" };
  });
}

export type ClosingState = "rascunho" | "conferido" | "homologado" | "retificado" | "reaberto";
export interface ClosingAct { seq: number; state: ClosingState; personId: string; naturalPerson: boolean; at: string; reason?: string }

const NEXT: Record<ClosingState, ClosingState[]> = { rascunho: ["conferido"], conferido: ["homologado", "rascunho"], homologado: ["retificado", "reaberto"], retificado: ["retificado", "reaberto"], reaberto: ["conferido"] };

/** Atos com autoria humana real; homologador ≠ conferente; retificar/reabrir exige motivo; homologar exige nenhum bloqueio. */
export function recordClosingAct(acts: ClosingAct[], act: Omit<ClosingAct, "seq">, expectedSeq: number, steps: ReturnType<typeof evaluateSteps>) {
  const head = acts[acts.length - 1] ?? { seq: 0, state: "rascunho" as ClosingState, personId: "", naturalPerson: true, at: "" };
  if (head.seq !== expectedSeq) return { ok: false as const, code: "closing:stale-base" };
  if (!act.naturalPerson) return { ok: false as const, code: "closing:human-author-required" };
  const from = acts.length ? head.state : "rascunho";
  if (acts.length && !NEXT[from].includes(act.state)) return { ok: false as const, code: "closing:transition-invalid" };
  if (!acts.length && act.state !== "conferido" && act.state !== "rascunho") return { ok: false as const, code: "closing:transition-invalid" };
  if ((act.state === "retificado" || act.state === "reaberto" || (act.state === "rascunho" && acts.length)) && !act.reason?.trim()) return { ok: false as const, code: "closing:reason-required" };
  if (act.state === "homologado") {
    if (steps.some((s) => s.blocking)) return { ok: false as const, code: "closing:blocked-by-rule" };
    const conf = [...acts].reverse().find((a) => a.state === "conferido");
    if (conf?.personId === act.personId) return { ok: false as const, code: "closing:same-person" };
  }
  return { ok: true as const, value: [...acts, { ...act, seq: head.seq + 1 }] };
}

/** Rematrícula: só estudantes com decisão de transição; transferido não é renovado; nunca copia turma nem resultado. */
export function renewalCandidates(students: { id: string; exitedOn: string | null; decision: "renovar" | "nao-renovar" | null }[], closingState: ClosingState | null) {
  if (closingState !== "homologado" && closingState !== "retificado") return { ok: false as const, code: "renewal:year-not-closed" };
  return {
    ok: true as const,
    renew: students.filter((s) => !s.exitedOn && s.decision === "renovar").map((s) => s.id),
    pendingDecision: students.filter((s) => !s.exitedOn && s.decision == null).map((s) => s.id),
    transferred: students.filter((s) => s.exitedOn).map((s) => s.id),
  };
}
