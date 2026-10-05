/**
 * Central de autorização — lógica pura (diff, validação prévia, linguagem humana).
 * O banco é a autoridade: estas verificações só antecipam o que os RPCs recusam.
 */
export type PolicyRule = { engagement_kind_id: string; capability_id: string; scope_dimensions: string[] };
export type PolicyVersion = {
  id: string; logical_policy_id: string; version: number; status: string;
  supersedes_version_id: string | null; valid_from: string | null; valid_until: string | null;
  homologation_origin: string | null; homologated_at: string | null; homologated_by: string | null;
  created_at: string; created_by: string | null;
};

export const ADMINISTRATIVE_CAPABILITIES = [
  "manter-pessoas-institucionais", "manter-contas-institucionais", "manter-atuacoes-institucionais",
  "registrar-politica-de-capacidades", "homologar-politica-de-capacidades",
] as const;

export const ruleKey = (r: PolicyRule) => `${r.engagement_kind_id}|${r.capability_id}|${[...r.scope_dimensions].sort().join(",")}`;

export type PolicyDiff = { added: PolicyRule[]; removed: PolicyRule[]; unchanged: number };
export function diffPolicies(base: readonly PolicyRule[], next: readonly PolicyRule[]): PolicyDiff {
  const b = new Map(base.map((r) => [ruleKey(r), r])); const n = new Map(next.map((r) => [ruleKey(r), r]));
  return {
    added: [...n].filter(([k]) => !b.has(k)).map(([, r]) => r),
    removed: [...b].filter(([k]) => !n.has(k)).map(([, r]) => r),
    unchanged: [...n.keys()].filter((k) => b.has(k)).length,
  };
}

/** Versão vigente numa data: homologada, iniciada e não sucedida por outra homologada já iniciada. */
export function effectiveVersion(versions: readonly PolicyVersion[], on: string): PolicyVersion | null {
  const live = versions.filter((v) => v.status === "homologated" && v.valid_from !== null && v.valid_from <= on && (v.valid_until === null || v.valid_until >= on));
  const superseded = new Set(live.filter((v) => v.supersedes_version_id).map((v) => v.supersedes_version_id));
  const heads = live.filter((v) => !superseded.has(v.id));
  return heads.length === 1 ? heads[0] : null;
}

export const headVersion = (versions: readonly PolicyVersion[], logical: string) =>
  versions.filter((v) => v.logical_policy_id === logical).sort((a, b) => b.version - a.version)[0] ?? null;

export type DraftIssue = { kind: "empty" | "wildcard" | "duplicate" | "blank" | "admin-removed"; detail: string };
export function validateDraft(rules: readonly PolicyRule[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (rules.length === 0) issues.push({ kind: "empty", detail: "A versão precisa de ao menos uma regra." });
  const seen = new Set<string>();
  for (const r of rules) {
    if (!r.engagement_kind_id.trim() || !r.capability_id.trim()) issues.push({ kind: "blank", detail: "Regra sem tipo de atuação ou sem capacidade." });
    if (/[*%]/.test(r.engagement_kind_id + r.capability_id)) issues.push({ kind: "wildcard", detail: `Curinga não é permitido: ${r.engagement_kind_id} → ${r.capability_id}` });
    const k = ruleKey(r);
    if (seen.has(k)) issues.push({ kind: "duplicate", detail: `Regra repetida: ${r.engagement_kind_id} → ${r.capability_id}` });
    seen.add(k);
  }
  for (const cap of ADMINISTRATIVE_CAPABILITIES)
    if (!rules.some((r) => r.capability_id === cap && r.scope_dimensions.includes("network")))
      issues.push({ kind: "admin-removed", detail: `Nenhuma regra de rede concede “${cap}”: a rede ficaria sem administração.` });
  return issues;
}

const MESSAGES: [RegExp, string][] = [
  [/policy:stale-head/, "Outra pessoa registrou uma versão mais nova desta política. Recarregue e parta da versão atual."],
  [/policy:not-draft/, "Esta versão não é mais rascunho: ela já foi efetivada."],
  [/policy:wildcard-forbidden/, "Curingas não são permitidos: cada capacidade precisa ser nomeada."],
  [/policy:would-remove-administration:?(.*)/, "Efetivar deixaria a rede sem atuação vigente com: $1."],
  [/policy:general-admin-coverage-incomplete/, "O Administrador Geral não teria regra explícita para todas as capacidades setoriais."],
  [/policy:valid-from-required/, "Informe a data de início da vigência."],
  [/policy:rules-required/, "A versão precisa de ao menos uma regra."],
  [/policy:invalid-rule/, "Há regra sem tipo de atuação ou sem capacidade."],
  [/capability:([a-z-]+)/, "A sua atuação não tem a capacidade “$1” nesta política vigente."],
];
export function humanizePolicyError(message: string): string {
  for (const [re, text] of MESSAGES) { const m = message.match(re); if (m) return text.replace("$1", m[1] || "capacidades administrativas"); }
  return "Não foi possível concluir a operação. Nenhuma alteração foi gravada.";
}

/** Atuação vigente na data (fechada por fim registrado ou valid_until). */
export function engagementActive(e: { valid_from: string; valid_until: string | null }, endedOn: string | null, on: string) {
  const end = [e.valid_until, endedOn].filter(Boolean).sort()[0] ?? null;
  return e.valid_from <= on && (end === null || end >= on);
}
