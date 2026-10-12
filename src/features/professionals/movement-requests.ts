/**
 * Gestão de Pessoas L15 — Movimentações funcionais e solicitações das escolas.
 * Movimentação (lotação/exercício/designação/atribuição) = ledger append-only
 * solicitação→análise→validação→ato→aplicação. "Aplicação" só REFERENCIA o
 * registro gravado pelo writer canônico do fato (L04/L05/L11); este ledger nunca
 * grava o fato. Retificação = nova versão encadeada da movimentação aplicada.
 * Solicitação da escola (professor, mediador, substituição, divergência) tem
 * protocolo determinístico e idempotente e só vira movimentação por decisão do DP.
 */

export const MOVEMENT_STAGES = ["solicitacao", "analise", "validacao", "ato", "aplicacao"] as const;
export type MStage = (typeof MOVEMENT_STAGES)[number];
export type MovementKind = "lotacao" | "exercicio" | "designacao" | "atribuicao";

export type MEvent = Readonly<{
  movementId: string; version: number; seq: number; kind: MovementKind;
  stage: MStage | "devolucao" | "indeferimento" | "retificacao";
  payloadHash: string | null; actRef?: string | null; appliedFactRef?: string | null; reason?: string | null;
  authorUserId: string | null; authorPersonId: string | null; technical: boolean; capabilityExercised: string | null; recordedAt: string;
}>;

export type MCaps = Readonly<Partial<Record<`${MovementKind}:${MStage}`, string>>>;
export type MRefusal = "sem-autor" | "executor-tecnico" | "seq-inesperado" | "etapa-fora-de-ordem" | "finalizada" | "sem-capacidade" | "sem-motivo" | "sem-ato" | "sem-fato-aplicado" | "validador-e-solicitante" | "retificacao-sem-aplicacao" | "conteudo-alterado";

export function movementStage(es: readonly MEvent[]): MStage | "indeferida" | null {
  let s: MStage | "indeferida" | null = null;
  for (const e of [...es].sort((a, b) => a.seq - b.seq)) {
    if (e.stage === "indeferimento") s = "indeferida";
    else if (e.stage === "devolucao") s = "solicitacao";
    else if (e.stage === "retificacao") s = "analise"; // nova versão percorre o fluxo de novo
    else s = e.stage;
  }
  return s;
}

export function checkMovement(e: MEvent, history: readonly MEvent[], caps: MCaps): MRefusal | null {
  if (e.technical) return "executor-tecnico";
  if (!e.authorUserId) return "sem-autor";
  const hs = history.filter((h) => h.movementId === e.movementId);
  if (e.seq !== hs.reduce((m, h) => Math.max(m, h.seq), 0) + 1) return "seq-inesperado";
  const cur = movementStage(hs);
  if (cur === "indeferida") return "finalizada";
  if (e.stage === "retificacao") {
    if (cur !== "aplicacao") return "retificacao-sem-aplicacao";
    if (!e.reason?.trim()) return "sem-motivo";
    const lastV = hs.reduce((m, h) => Math.max(m, h.version), 0);
    return e.version === lastV + 1 ? null : "seq-inesperado";
  }
  if (cur === "aplicacao") return "finalizada";
  if (e.stage === "devolucao" || e.stage === "indeferimento") return e.reason?.trim() ? null : "sem-motivo";
  const expected = cur === null ? 0 : MOVEMENT_STAGES.indexOf(cur) + 1;
  if (MOVEMENT_STAGES.indexOf(e.stage) !== expected) return "etapa-fora-de-ordem";
  const need = caps[`${e.kind}:${e.stage}`];
  if (!need || need !== e.capabilityExercised) return "sem-capacidade";
  const first = hs.find((h) => h.stage === "solicitacao" && h.version === e.version);
  if (e.stage !== "solicitacao" && first && first.payloadHash !== e.payloadHash) return "conteudo-alterado";
  if ((e.stage === "validacao" || e.stage === "ato") && first?.authorPersonId && first.authorPersonId === e.authorPersonId) return "validador-e-solicitante";
  if (e.stage === "ato" && !e.actRef?.trim()) return "sem-ato";
  if (e.stage === "aplicacao" && !e.appliedFactRef?.trim()) return "sem-fato-aplicado";
  return null;
}

/** Histórico imutável: todas as versões e eventos, na ordem; vigente = última versão aplicada. */
export function movementHistory(es: readonly MEvent[]) {
  const sorted = [...es].sort((a, b) => a.seq - b.seq);
  const applied = sorted.filter((e) => e.stage === "aplicacao");
  return { events: sorted.map((e) => ({ seq: e.seq, version: e.version, stage: e.stage, at: e.recordedAt, actRef: e.actRef ?? null, appliedFactRef: e.appliedFactRef ?? null })), currentApplied: applied[applied.length - 1] ?? null };
}

// ---------------- Solicitações das escolas ----------------

export type SchoolRequestKind = "professor" | "mediador" | "substituicao" | "divergencia";
export type SchoolRequest = Readonly<{
  schoolId: string; kind: SchoolRequestKind; subjectRef: string; // turma/componente/estudante(por ID)/registro divergente
  justification: string; requestedByUserId: string | null; technical: boolean; idempotencyKey: string; createdAt: string;
}>;

export type SRRefusal = "sem-autor" | "executor-tecnico" | "sem-justificativa" | "conteudo-sensivel" | "sem-referencia";
const SENSITIVE = /\b(cpf|\d{3}\.\d{3}\.\d{3}-\d{2}|cid|laudo|diagn[oó]stic)/i;

export function checkSchoolRequest(r: SchoolRequest): SRRefusal | null {
  if (r.technical) return "executor-tecnico";
  if (!r.requestedByUserId) return "sem-autor";
  if (!r.subjectRef.trim()) return "sem-referencia";
  if (r.justification.trim().length < 10) return "sem-justificativa";
  if (SENSITIVE.test(r.justification)) return "conteudo-sensivel";
  return null;
}

/** Protocolo determinístico: mesma chave ⇒ mesmo protocolo (reenvio não duplica). */
export function protocolOf(r: SchoolRequest): string {
  let h = 2166136261;
  for (const ch of `${r.schoolId}|${r.kind}|${r.idempotencyKey}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `GP-${r.createdAt.slice(0, 4)}-${(h >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

/** Que movimentação a solicitação pode originar (decisão continua do DP). */
export const REQUEST_TO_MOVEMENT: Readonly<Record<SchoolRequestKind, MovementKind | "processo-de-substituicao" | "revisao-de-dado">> = {
  professor: "atribuicao", mediador: "designacao", substituicao: "processo-de-substituicao", divergencia: "revisao-de-dado",
};

export function dedupeRequests(rs: readonly SchoolRequest[]): SchoolRequest[] {
  const seen = new Set<string>();
  return rs.filter((r) => { const p = protocolOf(r); if (seen.has(p)) return false; seen.add(p); return true; });
}
