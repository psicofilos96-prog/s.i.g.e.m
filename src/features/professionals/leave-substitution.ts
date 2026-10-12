/**
 * Gestão de Pessoas L08 — Afastamentos e fluxo de substituição.
 * Afastamento: tipo ADMINISTRATIVO (catálogo aberto), período, impacto operacional
 * declarado, documento por referência e histórico append-only. Nenhum campo clínico
 * (CID, diagnóstico, laudo em texto) é aceito ou projetado fora do DP.
 * Substituição: ledger com etapas fixas do processo; cada etapa tem autor humano,
 * e validação/formalização exigem pessoa ≠ proponente.
 */

export type LeaveVersion = Readonly<{
  leaveId: string; version: number; personId: string; linkLogicalId: string;
  adminType: string; validFrom: string; validUntil: string | null;
  operationalImpact: "total" | "parcial" | "sem-impacto" | null;
  documentRef: string | null; reason: string | null;
  freeText: string | null; authorUserId: string | null; technical: boolean; recordedAt: string;
}>;

export type LeaveRefusal = "sem-autor" | "executor-tecnico" | "sem-documento" | "intervalo-invalido" | "conteudo-clinico" | "versao-inesperada" | "sem-motivo" | "impacto-nao-declarado";

const CLINICAL = /\b(cid[\s-]?\d*|[a-tv-z]\d{2}(\.\d)?|diagn[oó]stic|laudo|patologia|doen[cç]a|transtorno|depress|c[aâ]ncer|hiv|gestante|gravidez)\b/i;

export const hasClinicalContent = (s: string | null) => !!s && CLINICAL.test(s);

export function checkLeave(v: LeaveVersion, history: readonly LeaveVersion[]): LeaveRefusal | null {
  if (v.technical) return "executor-tecnico";
  if (!v.authorUserId) return "sem-autor";
  if (!v.documentRef?.trim()) return "sem-documento";
  if (v.validUntil && v.validUntil < v.validFrom) return "intervalo-invalido";
  if (!v.operationalImpact) return "impacto-nao-declarado";
  if ([v.adminType, v.reason, v.freeText].some(hasClinicalContent)) return "conteudo-clinico";
  const last = history.filter((h) => h.leaveId === v.leaveId).reduce((m, h) => Math.max(m, h.version), 0);
  if (v.version !== last + 1) return "versao-inesperada";
  if (v.version > 1 && !v.reason?.trim()) return "sem-motivo";
  return null;
}

/** Projeção para fora do DP (escola, quadro): só tipo, período e impacto — nunca documento nem texto. */
export function leaveForSchool(v: LeaveVersion) {
  return { leaveId: v.leaveId, linkLogicalId: v.linkLogicalId, adminType: v.adminType, validFrom: v.validFrom, validUntil: v.validUntil, operationalImpact: v.operationalImpact };
}

// ---------------- Substituição ----------------

export const SUBSTITUTION_STAGES = ["necessidade", "protocolo", "conferencia", "proposta", "validacao", "formalizacao", "vigencia", "encerramento"] as const;
export type Stage = (typeof SUBSTITUTION_STAGES)[number];

export type SubstitutionEvent = Readonly<{
  processId: string; seq: number; stage: Stage | "devolucao" | "cancelamento";
  authorUserId: string | null; authorPersonId: string | null; technical: boolean;
  capabilityExercised: string | null;
  proposedPersonId?: string | null; actRef?: string | null; validFrom?: string | null; validUntil?: string | null;
  reason?: string | null; leaveId?: string | null; recordedAt: string;
}>;

export type SubstitutionRefusal =
  | "sem-autor" | "executor-tecnico" | "seq-inesperado" | "etapa-fora-de-ordem" | "processo-encerrado"
  | "sem-capacidade" | "sem-proposto" | "validador-e-proponente" | "sem-ato" | "sem-vigencia" | "sem-motivo" | "sem-afastamento-ou-motivo";

/** Capacidade exigida por etapa vem de configuração; etapa sem capacidade configurada ⇒ recusa. */
export type StageCapabilities = Readonly<Partial<Record<Stage, string>>>;

export function currentStage(events: readonly SubstitutionEvent[]): Stage | "cancelado" | null {
  const es = [...events].sort((a, b) => a.seq - b.seq);
  let s: Stage | "cancelado" | null = null;
  for (const e of es) {
    if (e.stage === "cancelamento") s = "cancelado";
    else if (e.stage === "devolucao") s = "conferencia";
    else s = e.stage;
  }
  return s;
}

export function checkSubstitution(e: SubstitutionEvent, history: readonly SubstitutionEvent[], caps: StageCapabilities): SubstitutionRefusal | null {
  if (e.technical) return "executor-tecnico";
  if (!e.authorUserId) return "sem-autor";
  const hs = history.filter((h) => h.processId === e.processId);
  const last = hs.reduce((m, h) => Math.max(m, h.seq), 0);
  if (e.seq !== last + 1) return "seq-inesperado";
  const cur = currentStage(hs);
  if (cur === "cancelado" || cur === "encerramento") return "processo-encerrado";
  if (e.stage === "cancelamento" || e.stage === "devolucao") return e.reason?.trim() ? null : "sem-motivo";
  const expected = cur === null ? 0 : SUBSTITUTION_STAGES.indexOf(cur) + 1;
  if (SUBSTITUTION_STAGES.indexOf(e.stage) !== expected) return "etapa-fora-de-ordem";
  const need = caps[e.stage];
  if (!need || e.capabilityExercised !== need) return "sem-capacidade";
  if (e.stage === "necessidade" && !e.leaveId && !e.reason?.trim()) return "sem-afastamento-ou-motivo";
  if (e.stage === "proposta" && !e.proposedPersonId) return "sem-proposto";
  if (e.stage === "validacao" || e.stage === "formalizacao") {
    const proposer = [...hs].reverse().find((h) => h.stage === "proposta");
    if (proposer && proposer.authorPersonId && proposer.authorPersonId === e.authorPersonId) return "validador-e-proponente";
  }
  if (e.stage === "formalizacao" && !e.actRef?.trim()) return "sem-ato";
  if (e.stage === "vigencia" && !e.validFrom) return "sem-vigencia";
  if (e.stage === "encerramento" && !e.reason?.trim()) return "sem-motivo";
  return null;
}

/** Substituto só passa a contar como compromisso após "vigencia" e até "encerramento". */
export function activeSubstitute(events: readonly SubstitutionEvent[], day: string): string | null {
  const es = [...events].sort((a, b) => a.seq - b.seq);
  if (!es.some((e) => e.stage === "vigencia") || currentStage(es) === "cancelado") return null;
  const v = [...es].reverse().find((e) => e.stage === "vigencia")!;
  const end = es.find((e) => e.stage === "encerramento");
  const until = end?.validUntil ?? v.validUntil ?? null;
  if (!v.validFrom || v.validFrom > day || (until && until < day)) return null;
  return [...es].reverse().find((e) => e.stage === "proposta")?.proposedPersonId ?? null;
}
