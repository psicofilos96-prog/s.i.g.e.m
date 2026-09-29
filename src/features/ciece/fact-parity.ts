/**
 * 14.1C — Equivalência semântica e auditoria inversa.
 *
 * Compara identidade factual, estado, conteúdo, dimensões, tempo e proveniência
 * normativa; ignora identificadores técnicos do registro e metadados de
 * infraestrutura, que podem legitimamente diferir entre laboratório e banco.
 */
import type { CanonicalFact, FactSourceReference } from "./canonical-fact-types";

export function semanticFact(f: CanonicalFact) {
  return {
    factTypeId: f.factTypeId,
    subject: f.subject,
    dimensions: f.dimensions,
    availability: f.availability,
    payload: f.payload,
    temporal: f.temporal,
    normative: {
      domainId: f.provenance.domainId,
      sourceId: f.provenance.sourceId,
      recordVersion: f.provenance.recordVersion,
      ruleOrPolicyId: f.provenance.ruleOrPolicyId ?? null,
      ruleOrPolicyVersion: f.provenance.ruleOrPolicyVersion ?? null,
    },
  };
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

export function semanticallyEquivalent(a: readonly CanonicalFact[], b: readonly CanonicalFact[]): boolean {
  const key = (xs: readonly CanonicalFact[]) => xs.map((f) => stable(semanticFact(f))).sort();
  return stable(key(a)) === stable(key(b));
}

/** Do fato ao registro oficial, à versão e à regra que o produziram. */
export function reverseAudit(f: CanonicalFact): {
  sourceId: string;
  recordId: string;
  recordVersion: number | null;
  rule: { id: string; version?: number } | null;
  upstream: readonly FactSourceReference[];
} {
  return {
    sourceId: f.provenance.sourceId,
    recordId: f.provenance.recordId,
    recordVersion: f.provenance.recordVersion,
    rule: f.provenance.ruleOrPolicyId
      ? { id: f.provenance.ruleOrPolicyId, ...(f.provenance.ruleOrPolicyVersion !== undefined ? { version: f.provenance.ruleOrPolicyVersion } : {}) }
      : null,
    upstream: f.provenance.sources ?? [],
  };
}
