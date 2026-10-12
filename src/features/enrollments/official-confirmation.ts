/**
 * Rede/Matrículas/Vagas L12 — Confirmação oficial.
 * Cadeia append-only vaga→comunicação→conferência→confirmação→matrícula→enturmação→ocupação.
 * Matrícula e enturmação NÃO são criadas aqui: o fluxo devolve plano ao writer canônico (B3) e só avança
 * com a referência do fato gravado. Ocupação é derivada (L05 lê enturmação), não gravada.
 * Documento só bloqueia se a política homologada o declarar bloqueante; demais viram pendência sem bloqueio.
 */
export const STEPS = ["vaga", "comunicacao", "conferencia", "confirmacao", "matricula", "enturmacao", "ocupacao"] as const;
export type Step = (typeof STEPS)[number];

export interface ConfirmationEvent { caseId: string; seq: number; step: Step; personId: string; at: string; idempotencyKey: string; ref: string; note: string }
export interface ConfActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }
export interface ConfPolicy {
  capabilityByStep: Partial<Record<Step, string>>;
  /** documentos cuja falta bloqueia a confirmação; null = política não homologada */
  blockingDocuments: readonly string[] | null;
}
export interface ConfContext {
  reservationActive: boolean | null;          // L10
  communicationStatus: "enviado" | "entregue" | "lido" | "sem-provedor" | null; // L08
  documentsPresent: readonly string[];
  guardianManifestation: boolean | null;      // L08
  existingActiveEnrollmentRef: string | null | undefined; // undefined = não lido
}
export type ConfOutcome =
  | { ok: true; event: ConfirmationEvent; replay: boolean; canonicalPlan?: { writer: string; payload: Record<string, string> } }
  | { ok: false; reason: string };

export const nextStep = (ev: readonly ConfirmationEvent[]): Step | null => STEPS[ev.length] ?? null;

export function advance(events: readonly ConfirmationEvent[], input: {
  caseId: string; step: Step; expectedSeq: number; idempotencyKey: string; ref: string; note: string; at: string;
  studentRef: string; schoolId: string; classId?: string;
}, ctx: ConfContext, actor: ConfActor, pol: ConfPolicy): ConfOutcome {
  const prior = events.find((e) => e.idempotencyKey === input.idempotencyKey);
  if (prior) return prior.step === input.step ? { ok: true, event: prior, replay: true } : { ok: false, reason: "Chave idempotente já usada." };
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não confirma." };
  const cap = pol.capabilityByStep[input.step];
  if (!cap || !actor.capabilities.includes(cap)) return { ok: false, reason: "Competência da etapa não configurada ou ausente." };
  if (events.length !== input.expectedSeq) return { ok: false, reason: "Caso mudou: releia." };
  if (nextStep(events) !== input.step) return { ok: false, reason: `Etapa fora de ordem; esperado ${nextStep(events) ?? "nenhuma"}.` };
  let canonicalPlan: { writer: string; payload: Record<string, string> } | undefined;
  switch (input.step) {
    case "vaga": if (ctx.reservationActive !== true) return { ok: false, reason: "Reserva ativa não comprovada." }; break;
    case "comunicacao": if (ctx.communicationStatus === null) return { ok: false, reason: "Comunicação não lida." };
      if (ctx.communicationStatus === "sem-provedor" && !input.note.trim()) return { ok: false, reason: "Sem provedor: registre o contato presencial realizado." }; break;
    case "conferencia": {
      if (pol.blockingDocuments === null) return { ok: false, reason: "Política documental não homologada." };
      const missing = pol.blockingDocuments.filter((d) => !ctx.documentsPresent.includes(d));
      if (missing.length) return { ok: false, reason: `Faltam documentos bloqueantes: ${missing.join(", ")}.` };
      break;
    }
    case "confirmacao": {
      if (ctx.guardianManifestation !== true) return { ok: false, reason: "Manifestação do responsável não registrada." };
      const conf = events.find((e) => e.step === "conferencia");
      if (conf?.personId === actor.personId) return { ok: false, reason: "Confirmador deve ser distinto do conferente." };
      if (ctx.reservationActive !== true) return { ok: false, reason: "Reserva venceu ou foi cancelada." };
      break;
    }
    case "matricula":
      if (ctx.existingActiveEnrollmentRef === undefined) return { ok: false, reason: "Matrículas existentes não lidas." };
      if (ctx.existingActiveEnrollmentRef) return { ok: false, reason: `Estudante já tem matrícula ativa (${ctx.existingActiveEnrollmentRef}): duplicidade.` };
      if (!input.ref.startsWith("fato:")) return { ok: false, reason: "Exige referência do fato gravado pelo writer canônico." };
      break;
    case "enturmacao":
      if (!input.classId) return { ok: false, reason: "Turma obrigatória." };
      if (!input.ref.startsWith("fato:")) return { ok: false, reason: "Exige referência da enturmação gravada." };
      break;
    case "ocupacao": if (!input.ref.startsWith("leitura:")) return { ok: false, reason: "Ocupação é derivada: cite a leitura do quadro L05." }; break;
  }
  if (input.step === "confirmacao") canonicalPlan = { writer: "record_enrollment (B3)", payload: { studentRef: input.studentRef, schoolId: input.schoolId, caseId: input.caseId } };
  if (input.step === "matricula" && input.classId) canonicalPlan = { writer: "record_class_allocation (B3)", payload: { studentRef: input.studentRef, classId: input.classId } };
  const event: ConfirmationEvent = { caseId: input.caseId, seq: events.length + 1, step: input.step, personId: actor.personId, at: input.at, idempotencyKey: input.idempotencyKey, ref: input.ref, note: input.note.trim() };
  return { ok: true, event, replay: false, canonicalPlan };
}

/** Pendências documentais não bloqueantes (para exibir, nunca para travar). */
export function nonBlockingPending(required: readonly string[], blocking: readonly string[], present: readonly string[]) {
  return required.filter((d) => !blocking.includes(d) && !present.includes(d));
}
