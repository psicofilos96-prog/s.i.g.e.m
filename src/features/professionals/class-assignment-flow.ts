/**
 * Gestão de Pessoas L11 — Atribuição docente com fluxo e verificações.
 * Ledger append-only: proposta→análise→validação→formalização→vigência→encerramento
 * (devolução volta à análise; cancelamento é final). Cada etapa: autor humano,
 * capacidade configurada por etapa; validação e formalização por pessoa ≠ proponente.
 * As verificações (oferta, habilitação, jornada, exercício, sobreposição) são
 * calculadas na proposta e REFEITAS na validação; aprovação nunca é presumida.
 */

export const ASSIGNMENT_STAGES = ["proposta", "analise", "validacao", "formalizacao", "vigencia", "encerramento"] as const;
export type AStage = (typeof ASSIGNMENT_STAGES)[number];

export type AssignmentDraft = Readonly<{
  linkLogicalId: string; personId: string; schoolId: string; classId: string; componentId: string;
  classHours: number; blockIds: readonly string[]; validFrom: string; validUntil: string | null;
}>;

export type AEvent = Readonly<{
  assignmentId: string; seq: number; stage: AStage | "devolucao" | "cancelamento";
  draft?: AssignmentDraft; actRef?: string | null; reason?: string | null;
  authorUserId: string | null; authorPersonId: string | null; technical: boolean; capabilityExercised: string | null; recordedAt: string;
}>;

/** Fatos lidos para as verificações (projeções L04/L06/L07/L09/L10). */
export type CheckContext = Readonly<{
  offerBlocks: (classId: string, componentId: string) => readonly string[] | null; // null = grade não lida
  uncoveredHours: (classId: string, componentId: string) => number | null;
  qualified: (personId: string, componentId: string, day: string) => boolean | null; // null = sem fonte
  freeMinutes: (linkLogicalId: string, day: string) => number | null;
  minutesPerClassHour: (classId: string) => number | null;
  exercisingAt: (linkLogicalId: string, schoolId: string, day: string) => boolean | null;
  personBusyBlocks: (personId: string, day: string, exceptAssignmentId: string) => readonly string[];
}>;

export type CheckIssue =
  | "fora-da-oferta" | "grade-nao-lida" | "excede-descobertas" | "descobertas-indeterminadas"
  | "sem-habilitacao" | "habilitacao-sem-fonte" | "excede-jornada" | "jornada-indeterminada"
  | "sem-exercicio-na-escola" | "exercicio-sem-fonte" | "sobreposicao-de-horario" | "quantidade-difere-dos-blocos" | "intervalo-invalido";

export function verify(id: string, d: AssignmentDraft, c: CheckContext): CheckIssue[] {
  const out: CheckIssue[] = [];
  const day = d.validFrom;
  if (d.validUntil && d.validUntil < d.validFrom) out.push("intervalo-invalido");
  if (d.classHours !== d.blockIds.length) out.push("quantidade-difere-dos-blocos");
  const ob = c.offerBlocks(d.classId, d.componentId);
  if (ob === null) out.push("grade-nao-lida"); else if (d.blockIds.some((b) => !ob.includes(b))) out.push("fora-da-oferta");
  const un = c.uncoveredHours(d.classId, d.componentId);
  if (un === null) out.push("descobertas-indeterminadas"); else if (d.classHours > un) out.push("excede-descobertas");
  const q = c.qualified(d.personId, d.componentId, day);
  if (q === null) out.push("habilitacao-sem-fonte"); else if (!q) out.push("sem-habilitacao");
  const free = c.freeMinutes(d.linkLogicalId, day), mpc = c.minutesPerClassHour(d.classId);
  if (free === null || mpc === null) out.push("jornada-indeterminada"); else if (d.classHours * mpc > free) out.push("excede-jornada");
  const ex = c.exercisingAt(d.linkLogicalId, d.schoolId, day);
  if (ex === null) out.push("exercicio-sem-fonte"); else if (!ex) out.push("sem-exercicio-na-escola");
  const busy = new Set(c.personBusyBlocks(d.personId, day, id));
  if (d.blockIds.some((b) => busy.has(b))) out.push("sobreposicao-de-horario");
  return out;
}

export type StageCaps = Readonly<Partial<Record<AStage, string>>>;
export type ARefusal = "sem-autor" | "executor-tecnico" | "seq-inesperado" | "etapa-fora-de-ordem" | "encerrada" | "sem-capacidade" | "sem-motivo" | "sem-rascunho" | "validador-e-proponente" | "sem-ato" | "verificacao-pendente";

export function stageOf(es: readonly AEvent[]): AStage | "cancelada" | null {
  let s: AStage | "cancelada" | null = null;
  for (const e of [...es].sort((a, b) => a.seq - b.seq)) s = e.stage === "cancelamento" ? "cancelada" : e.stage === "devolucao" ? "analise" : e.stage;
  return s;
}

export const draftOf = (es: readonly AEvent[]) => [...es].sort((a, b) => b.seq - a.seq).find((e) => e.draft)?.draft ?? null;

export function checkAssignmentEvent(e: AEvent, history: readonly AEvent[], caps: StageCaps, ctx: CheckContext): { refusal: ARefusal | null; issues: CheckIssue[] } {
  const r = (refusal: ARefusal | null, issues: CheckIssue[] = []) => ({ refusal, issues });
  if (e.technical) return r("executor-tecnico");
  if (!e.authorUserId) return r("sem-autor");
  const hs = history.filter((h) => h.assignmentId === e.assignmentId);
  if (e.seq !== hs.reduce((m, h) => Math.max(m, h.seq), 0) + 1) return r("seq-inesperado");
  const cur = stageOf(hs);
  if (cur === "cancelada" || cur === "encerramento") return r("encerrada");
  if (e.stage === "devolucao" || e.stage === "cancelamento") return r(e.reason?.trim() ? null : "sem-motivo");
  const expected = cur === null ? 0 : ASSIGNMENT_STAGES.indexOf(cur) + 1;
  if (ASSIGNMENT_STAGES.indexOf(e.stage) !== expected) return r("etapa-fora-de-ordem");
  if (!caps[e.stage] || caps[e.stage] !== e.capabilityExercised) return r("sem-capacidade");
  const draft = e.stage === "proposta" ? e.draft ?? null : draftOf(hs);
  if (!draft) return r("sem-rascunho");
  if (e.stage === "validacao" || e.stage === "formalizacao") {
    const prop = hs.find((h) => h.stage === "proposta");
    if (prop?.authorPersonId && prop.authorPersonId === e.authorPersonId) return r("validador-e-proponente");
  }
  if (e.stage === "proposta" || e.stage === "validacao") {
    const issues = verify(e.assignmentId, draft, ctx);
    if (e.stage === "validacao" && issues.length) return r("verificacao-pendente", issues);
    return r(null, issues); // proposta pode nascer com pendências, visíveis
  }
  if (e.stage === "formalizacao" && !e.actRef?.trim()) return r("sem-ato");
  if (e.stage === "encerramento" && !e.reason?.trim()) return r("sem-motivo");
  return r(null);
}

/** Só a atribuição em "vigencia" (não encerrada) ocupa horário e cobre aulas. */
export function isEffective(es: readonly AEvent[], day: string): boolean {
  const d = draftOf(es);
  return stageOf(es) === "vigencia" && !!d && d.validFrom <= day && (d.validUntil === null || d.validUntil >= day);
}

/** Histórico legível: etapa, autor e data de cada evento (nada sobrescrito). */
export const historyOf = (es: readonly AEvent[]) =>
  [...es].sort((a, b) => a.seq - b.seq).map((e) => ({ seq: e.seq, stage: e.stage, authorUserId: e.authorUserId, at: e.recordedAt, actRef: e.actRef ?? null, reason: e.reason ?? null }));
