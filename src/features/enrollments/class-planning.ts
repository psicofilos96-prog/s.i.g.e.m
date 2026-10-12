/**
 * Rede/Matrículas/Vagas L04 — Planejamento de turmas.
 * Proposta (abertura | ampliação | reorganização | encerramento) é ledger append-only:
 * rascunho → submetida → analisada → deferida | indeferida | devolvida(→rascunho) → efetivada.
 * Evidências (demanda, capacidade autorizada, pessoal, matriz, oferta) são conferidas na
 * submissão e REFEITAS na decisão. Efetivar não cria turma: devolve um PLANO para o writer
 * canônico da turma (`secretariat_create_class` etc.) e só registra a referência ao fato gravado,
 * porque turma acadêmica tem fonte única. Nada é apagado; encerrar não remove histórico.
 */
export type ProposalKind = "abertura" | "ampliacao" | "reorganizacao" | "encerramento";
export type ProposalState = "rascunho" | "submetida" | "analisada" | "deferida" | "indeferida" | "efetivada";
export type ProposalAction = "criar" | "submeter" | "analisar" | "devolver" | "deferir" | "indeferir" | "efetivar";

export interface ClassProposal {
  proposalId: string; kind: ProposalKind; schoolId: string; offerId: string; shiftId: string;
  /** turma canônica existente (obrigatória salvo abertura) */ classId: string | null;
  requestedCapacity: number | null; justification: string;
}
/** Fatos já lidos pelos readers canônicos; null = fonte não lida (≠ ausência). */
export interface PlanningEvidence {
  demand: number | null;            // pedidos de vaga/fila na oferta
  authorizedCapacity: number | null; // L03 vigente para o ambiente/turno
  currentEnrolled: number | null;    // enturmados vigentes na turma (ampliação/encerramento/reorganização)
  offerAccepts: boolean | null;      // L02: oferta publicada/funcionamento na data
  matrixHomologated: boolean | null; // matriz vigente homologada para a oferta
  uncoveredTeacherNeed: boolean | null; // L10: pacotes descobertos que a turma criaria sem cobertura
  destinationClassIds?: readonly string[]; // reorganização/encerramento: destino dos estudantes
}
export interface ProposalEvent { proposalId: string; seq: number; action: ProposalAction; to: ProposalState; actorPersonId: string; reason: string; actRef: string | null; at: string; evidence?: PlanningEvidence; appliedFactRef?: string }
export interface PlanActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] | "rede" }
export type PlanningCompetence = Partial<Record<ProposalAction, string>>;

const FLOW: Record<ProposalAction, { from: (ProposalState | null)[]; to: ProposalState }> = {
  criar: { from: [null], to: "rascunho" }, submeter: { from: ["rascunho"], to: "submetida" },
  analisar: { from: ["submetida"], to: "analisada" }, devolver: { from: ["analisada"], to: "rascunho" },
  deferir: { from: ["analisada"], to: "deferida" }, indeferir: { from: ["analisada"], to: "indeferida" },
  efetivar: { from: ["deferida"], to: "efetivada" },
};

/** Verificações por tipo. Pendência = texto por extenso; nunca presume dado ausente. */
export function evidenceIssues(p: ClassProposal, e: PlanningEvidence): string[] {
  const out: string[] = [];
  const need = (v: unknown, what: string) => { if (v === null || v === undefined) out.push(`${what} não lido(a).`); };
  need(e.offerAccepts, "Situação da oferta");
  if (e.offerAccepts === false && p.kind !== "encerramento") out.push("Oferta não publicada/em funcionamento na data.");
  if (p.kind !== "abertura" && !p.classId) out.push("Turma canônica de referência obrigatória.");
  if (p.kind === "abertura" && p.classId) out.push("Abertura não referencia turma existente.");
  if (p.kind === "abertura" || p.kind === "ampliacao") {
    need(e.demand, "Demanda"); need(e.authorizedCapacity, "Capacidade autorizada"); need(e.matrixHomologated, "Matriz"); need(e.uncoveredTeacherNeed, "Necessidade docente");
    if (e.matrixHomologated === false) out.push("Matriz vigente não homologada para a oferta.");
    if (p.requestedCapacity === null) out.push("Capacidade solicitada não informada.");
    else if (e.authorizedCapacity !== null && p.requestedCapacity > e.authorizedCapacity) out.push(`Solicitada (${p.requestedCapacity}) excede a autorizada (${e.authorizedCapacity}).`);
    if (e.demand === 0) out.push("Sem demanda registrada.");
    if (e.uncoveredTeacherNeed === true) out.push("Turma ficaria sem professor: pacotes descobertos (registrar ciência na decisão).");
  }
  if (p.kind === "ampliacao") { need(e.currentEnrolled, "Enturmados"); if (p.requestedCapacity !== null && e.currentEnrolled !== null && p.requestedCapacity <= e.currentEnrolled) out.push("Ampliação não amplia."); }
  if (p.kind === "encerramento" || p.kind === "reorganizacao") {
    need(e.currentEnrolled, "Enturmados");
    if ((e.currentEnrolled ?? 0) > 0 && !(e.destinationClassIds?.length)) out.push("Há estudantes enturmados sem destino declarado.");
  }
  return out;
}
/** Pendência que só pode ser aceita com ciência explícita na decisão. */
const ACKNOWLEDGEABLE = /^Turma ficaria sem professor/;

export const proposalState = (ev: readonly ProposalEvent[]) => ev.at(-1)?.to ?? null;

export type Result = { ok: true; event: ProposalEvent } | { ok: false; reason: string; issues?: string[] };

export function applyProposalAction(
  p: ClassProposal, events: readonly ProposalEvent[], action: ProposalAction, actor: PlanActor,
  input: { reason: string; at: string; expectedSeq: number; actRef?: string | null | undefined; evidence?: PlanningEvidence; acknowledgeUncovered?: boolean; appliedFactRef?: string },
  competence: PlanningCompetence,
): Result {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não decide." };
  const cap = competence[action];
  if (!cap) return { ok: false, reason: `Competência para "${action}" não configurada.` };
  if (!actor.capabilities.includes(cap)) return { ok: false, reason: `Falta a capacidade ${cap}.` };
  if (actor.schoolIds !== "rede" && !actor.schoolIds.includes(p.schoolId)) return { ok: false, reason: "Fora do escopo da escola." };
  const last = events.at(-1)?.seq ?? 0;
  if (input.expectedSeq !== last) return { ok: false, reason: "Base desatualizada." };
  const state = proposalState(events);
  if (!FLOW[action].from.includes(state)) return { ok: false, reason: `"${action}" não admitida em ${state ?? "inexistente"}.` };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (action === "criar" && !p.justification.trim()) return { ok: false, reason: "Justificativa obrigatória." };
  if (action === "submeter" || action === "deferir") {
    if (!input.evidence) return { ok: false, reason: "Evidências não lidas." };
    const issues = evidenceIssues(p, input.evidence).filter((i) => !(action === "deferir" && input.acknowledgeUncovered && ACKNOWLEDGEABLE.test(i)));
    const blocking = action === "submeter" ? issues.filter((i) => !ACKNOWLEDGEABLE.test(i)) : issues;
    if (blocking.length) return { ok: false, reason: "Pendências impedem.", issues: blocking };
  }
  if (action === "deferir" || action === "indeferir") {
    if (!input.actRef?.trim()) return { ok: false, reason: "Decisão exige ato." };
    const authors = events.filter((e) => e.action === "criar" || e.action === "submeter").map((e) => e.actorPersonId);
    if (authors.includes(actor.personId)) return { ok: false, reason: "Quem propôs não decide." };
  }
  if (action === "efetivar" && !input.appliedFactRef?.trim()) return { ok: false, reason: "Efetivação exige referência ao fato gravado pelo writer canônico da turma." };
  return { ok: true, event: {
    proposalId: p.proposalId, seq: last + 1, action, to: FLOW[action].to, actorPersonId: actor.personId, reason: input.reason.trim(),
    actRef: input.actRef?.trim() || null, at: input.at,
    ...(input.evidence ? { evidence: input.evidence } : {}), ...(input.appliedFactRef ? { appliedFactRef: input.appliedFactRef } : {}),
  } };
}

/** Plano para o writer canônico — só depois de deferida. Não grava nada. */
export type CanonicalPlan =
  | { writer: "secretariat_create_class"; schoolId: string; offerId: string; shiftId: string; capacity: number }
  | { writer: "record_class_capacity"; classId: string; capacity: number }
  | { writer: "move_allocations_then_inactivate_class"; classId: string; destinationClassIds: readonly string[]; inactivate: boolean };

export function canonicalPlan(p: ClassProposal, events: readonly ProposalEvent[]): CanonicalPlan | null {
  if (proposalState(events) !== "deferida") return null;
  const ev = [...events].reverse().find((e) => e.action === "deferir")?.evidence;
  switch (p.kind) {
    case "abertura": return p.requestedCapacity === null ? null : { writer: "secretariat_create_class", schoolId: p.schoolId, offerId: p.offerId, shiftId: p.shiftId, capacity: p.requestedCapacity };
    case "ampliacao": return p.classId && p.requestedCapacity !== null ? { writer: "record_class_capacity", classId: p.classId, capacity: p.requestedCapacity } : null;
    case "reorganizacao": case "encerramento":
      return p.classId ? { writer: "move_allocations_then_inactivate_class", classId: p.classId, destinationClassIds: ev?.destinationClassIds ?? [], inactivate: p.kind === "encerramento" } : null;
  }
}
