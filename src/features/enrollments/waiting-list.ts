/**
 * Rede/Matrículas/Vagas L11 — Listas de espera.
 * Fila = (processo, oferta, região) com ordem vinda SÓ de proposta aprovada do motor L09 (ordem institucional
 * validada: aprovador, ato, hash). Sem ordem aprovada ⇒ fila sem posições (nunca ordem de chegada presumida).
 * Reclassificação = nova versão append-only com justificativa, autor humano ≠ quem aprovou a versão anterior
 * quando a política exigir, e ato. Consulta familiar devolve só a posição do próprio protocolo, sem nomes/refs de terceiros.
 */
export interface QueueKey { processId: string; offerId: string; regionId: string }
export interface QueueVersion {
  queueKey: QueueKey; version: number; order: readonly string[]; // protocolos na ordem
  sourceProposalHash: string; approvedBy: string; actRef: string; reason: string; at: string; validFrom: string;
}
export interface QueueActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }
export interface QueuePolicy { reclassifyCapability: string | null }

export const keyOf = (k: QueueKey) => `${k.processId}|${k.offerId}|${k.regionId}`;

export function currentVersion(versions: readonly QueueVersion[], key: QueueKey, on: string, knownAt: string): QueueVersion | null {
  const v = versions.filter((x) => keyOf(x.queueKey) === keyOf(key) && x.validFrom <= on && x.at <= knownAt);
  return v.sort((a, b) => a.version - b.version).at(-1) ?? null;
}

export type QueueResult = { ok: true; version: QueueVersion } | { ok: false; reason: string };

/** Constitui (expectedVersion 0) ou reclassifica a fila a partir de proposta aprovada L09. */
export function recordQueueVersion(versions: readonly QueueVersion[], input: {
  key: QueueKey; expectedVersion: number; approvedProposal: { hash: string; approvedBy: string; actRef: string; order: readonly string[] } | null;
  reason: string; at: string; validFrom: string;
}, actor: QueueActor, pol: QueuePolicy): QueueResult {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não ordena fila." };
  if (!pol.reclassifyCapability || !actor.capabilities.includes(pol.reclassifyCapability)) return { ok: false, reason: "Competência não configurada ou ausente." };
  const p = input.approvedProposal;
  if (!p || !p.hash || !p.actRef || !p.approvedBy) return { ok: false, reason: "Ordem só de proposta aprovada (hash, ato, aprovador)." };
  if (p.approvedBy !== actor.personId) return { ok: false, reason: "Quem registra deve ser o aprovador da ordem." };
  if (new Set(p.order).size !== p.order.length) return { ok: false, reason: "Protocolo repetido na ordem." };
  const mine = versions.filter((x) => keyOf(x.queueKey) === keyOf(input.key));
  const last = mine.sort((a, b) => a.version - b.version).at(-1);
  if ((last?.version ?? 0) !== input.expectedVersion) return { ok: false, reason: "Fila mudou: releia antes de reclassificar." };
  if (last && !input.reason.trim()) return { ok: false, reason: "Reclassificação exige justificativa." };
  if (last && last.sourceProposalHash === p.hash) return { ok: false, reason: "Mesma proposta já aplicada." };
  return { ok: true, version: { queueKey: input.key, version: input.expectedVersion + 1, order: [...p.order], sourceProposalHash: p.hash, approvedBy: p.approvedBy, actRef: p.actRef, reason: input.reason.trim(), at: input.at, validFrom: input.validFrom } };
}

/** Histórico de posição de um protocolo (para auditoria interna). */
export function positionHistory(versions: readonly QueueVersion[], key: QueueKey, protocol: string) {
  return versions.filter((x) => keyOf(x.queueKey) === keyOf(key)).sort((a, b) => a.version - b.version)
    .map((v) => ({ version: v.version, position: v.order.indexOf(protocol) + 1 || null, reason: v.reason, actRef: v.actRef, at: v.at }));
}

/** Consulta familiar: só a própria situação. Nunca retorna ordem, outros protocolos ou nomes. */
export function familyView(versions: readonly QueueVersion[], key: QueueKey, protocol: string, on: string, knownAt: string) {
  const v = currentVersion(versions, key, on, knownAt);
  if (!v) return { situacao: "sem-ordem-publicada" as const };
  const i = v.order.indexOf(protocol);
  if (i < 0) return { situacao: "nao-consta" as const };
  return { situacao: "em-espera" as const, posicao: i + 1, totalNaFila: v.order.length, atualizadoEm: v.at };
}
