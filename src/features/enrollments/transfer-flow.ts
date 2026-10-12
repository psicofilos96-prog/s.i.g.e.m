/**
 * Rede/Matrículas/Vagas L14 — Transferências entre escolas, turmas e turnos.
 * Ledger append-only pedido→verificação→análise→autorização→efetivação (indeferimento/desistência terminais).
 * Verificação segura a vaga por reserva L10 (referência obrigatória); a alteração acadêmica é UM plano
 * atômico ao writer canônico (encerrar origem na véspera + abrir destino). Falha na efetivação não
 * libera a reserva nem toca a origem: o caso fica em "autorizada" para nova tentativa idempotente.
 */
export type TransferKind = "escola" | "turma" | "turno";
export type TStage = "pedido" | "verificacao" | "analise" | "autorizacao" | "efetivacao" | "indeferido" | "desistencia";
const ORDER: TStage[] = ["pedido", "verificacao", "analise", "autorizacao", "efetivacao"];

export interface TransferEvent { caseId: string; seq: number; stage: TStage; personId: string; at: string; idempotencyKey: string; ref: string; reason: string }
export interface TransferCase { caseId: string; kind: TransferKind; participationId: string; originAllocationId: string; originSchoolId: string; destSchoolId: string; destClassId: string; effectiveOn: string }
export interface TActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }
export interface TPolicy { capabilityByStage: Partial<Record<TStage, string>> }
export interface TContext { reservationRef: string | null; reservationActive: boolean | null; originStillActive: boolean | null }

export const stageOf = (ev: readonly TransferEvent[]): TStage | null => ev.at(-1)?.stage ?? null;
const isTerminal = (s: TStage | null) => s === "efetivacao" || s === "indeferido" || s === "desistencia";

export function validateCase(c: TransferCase): string | null {
  if (c.kind === "escola" && c.originSchoolId === c.destSchoolId) return "Transferência de escola exige escola de destino diferente.";
  if (c.kind !== "escola" && c.originSchoolId !== c.destSchoolId) return "Troca de turma/turno é dentro da mesma escola.";
  return null;
}

export type TOutcome = { ok: true; event: TransferEvent; replay: boolean; plan?: TransferPlan } | { ok: false; reason: string };
export interface TransferPlan { atomic: true; steps: [{ writer: "end_class_allocation"; allocationId: string; endOn: string }, { writer: "record_class_allocation"; participationId: string; classId: string; from: string }]; keepsReservation: string }

const dayBefore = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export function transferStep(c: TransferCase, events: readonly TransferEvent[], input: { stage: TStage; expectedSeq: number; idempotencyKey: string; ref: string; reason: string; at: string }, ctx: TContext, actor: TActor, pol: TPolicy): TOutcome {
  const prior = events.find((e) => e.idempotencyKey === input.idempotencyKey);
  if (prior) return prior.stage === input.stage ? { ok: true, event: prior, replay: true } : { ok: false, reason: "Chave idempotente já usada." };
  const bad = validateCase(c); if (bad) return { ok: false, reason: bad };
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não transfere." };
  const cap = pol.capabilityByStage[input.stage];
  if (!cap || !actor.capabilities.includes(cap)) return { ok: false, reason: "Competência da etapa não configurada ou ausente." };
  if (events.length !== input.expectedSeq) return { ok: false, reason: "Caso mudou: releia." };
  const cur = stageOf(events);
  if (isTerminal(cur)) return { ok: false, reason: "Caso encerrado." };
  if (input.stage === "indeferido" || input.stage === "desistencia") {
    if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
    if (input.stage === "indeferido" && cur !== "analise") return { ok: false, reason: "Indeferimento só na análise." };
  } else {
    const expected = ORDER[cur === null ? 0 : ORDER.indexOf(cur) + 1];
    if (input.stage !== expected) return { ok: false, reason: `Etapa fora de ordem; esperado ${expected}.` };
  }
  let plan: TransferPlan | undefined;
  if (input.stage === "verificacao") {
    if (!ctx.reservationRef || ctx.reservationActive !== true) return { ok: false, reason: "Vaga no destino não reservada (L10)." };
  }
  if (input.stage === "autorizacao") {
    const analyst = events.find((e) => e.stage === "analise")?.personId;
    if (analyst === actor.personId) return { ok: false, reason: "Autorizador deve ser distinto do analista." };
    if (!input.ref.trim()) return { ok: false, reason: "Autorização exige ato." };
    if (ctx.reservationActive !== true) return { ok: false, reason: "Reserva venceu: refaça a verificação." };
  }
  if (input.stage === "efetivacao") {
    if (ctx.originStillActive !== true) return { ok: false, reason: "Origem não vigente ou não lida." };
    if (!input.ref.startsWith("fato:")) return { ok: false, reason: "Efetivação exige referência do fato gravado pelo writer canônico." };
  }
  if (input.stage === "autorizacao") plan = { atomic: true, keepsReservation: ctx.reservationRef!, steps: [
    { writer: "end_class_allocation", allocationId: c.originAllocationId, endOn: dayBefore(c.effectiveOn) },
    { writer: "record_class_allocation", participationId: c.participationId, classId: c.destClassId, from: c.effectiveOn },
  ] };
  const event: TransferEvent = { caseId: c.caseId, seq: events.length + 1, stage: input.stage, personId: actor.personId, at: input.at, idempotencyKey: input.idempotencyKey, ref: input.ref.trim(), reason: input.reason.trim() };
  return plan ? { ok: true, event, replay: false, plan } : { ok: true, event, replay: false };
}

/** Resultado do writer: só sucesso completo efetiva; falha mantém reserva e origem. */
export function applyWriterResult(result: { ok: true; factRef: string } | { ok: false; error: string }) {
  return result.ok ? { effectiveRef: `fato:${result.factRef}`, releaseReservation: false, convertReservation: true }
    : { effectiveRef: null, releaseReservation: false, convertReservation: false, retry: true, error: result.error };
}
