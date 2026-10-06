/**
 * Frente BF — "por que pode / por que não pode". Explicação pura sobre a política homologada e as
 * atuações lidas com a sessão; nunca concede, nunca altera regra. O banco continua sendo a autoridade:
 * a decisão real é sempre revalidada pelo writer (`has_school_capability`/`has_network_capability`).
 */
import type { PolicyRule } from "./policy-governance";

export type EngagementRow = Readonly<{ id: string; engagement_kind_id: string; scope_level: string | null; school_id: string | null; valid_from: string; valid_until: string | null }>;
export type ExplainQuery = Readonly<{ capability: string; schoolId: string | null; on: string }>;
export type Explanation = Readonly<{
  allowed: boolean;
  reason: string;
  code: "permitido" | "sem-politica" | "sem-regra" | "sem-atuacao" | "fora-da-vigencia" | "escopo-insuficiente";
  rule: PolicyRule | null; engagement: EngagementRow | null;
}>;

const scopeOf = (r: PolicyRule): string[] => r.scope_dimensions ?? [];
const active = (e: EngagementRow, on: string) => e.valid_from <= on && (e.valid_until == null || on <= e.valid_until);
/** Escopo rede cobre qualquer escola; escopo escola só a própria; nunca se amplia escopo por ausência. */
const covers = (e: EngagementRow, ruleScopes: string[], schoolId: string | null) => {
  if (e.scope_level === "rede" && ruleScopes.includes("network")) return true;
  if (schoolId && e.school_id === schoolId && ruleScopes.some((s) => s === "school" || s === "class")) return true;
  return false;
};

export function explainAccess(policyId: string | null, rules: readonly PolicyRule[], engagements: readonly EngagementRow[], q: ExplainQuery): Explanation {
  const none = { rule: null, engagement: null };
  if (!policyId) return { ...none, allowed: false, code: "sem-politica", reason: "Não há política de capacidades homologada vigente legível por esta sessão." };
  const matching = rules.filter((r) => r.capability_id === q.capability);
  if (!matching.length) return { ...none, allowed: false, code: "sem-regra", reason: `A política vigente não atribui "${q.capability}" a nenhuma atuação (capability sem atribuição).` };
  const kinds = new Set(matching.map((r) => r.engagement_kind_id));
  const mine = engagements.filter((e) => kinds.has(e.engagement_kind_id));
  if (!mine.length) return { ...none, rule: matching[0]!, allowed: false, code: "sem-atuacao", reason: `Sua conta não tem atuação dos tipos que recebem esta capacidade (${[...kinds].join(", ")}).` };
  const live = mine.filter((e) => active(e, q.on));
  if (!live.length) return { rule: matching[0]!, engagement: mine[0]!, allowed: false, code: "fora-da-vigencia", reason: `A atuação existe, mas não está vigente em ${q.on}.` };
  for (const e of live) {
    const r = matching.find((x) => x.engagement_kind_id === e.engagement_kind_id)!;
    if (covers(e, scopeOf(r), q.schoolId)) return { rule: r, engagement: e, allowed: true, code: "permitido", reason: `Regra ${r.engagement_kind_id} → ${r.capability_id} [${scopeOf(r).join(", ")}], atuação vigente desde ${e.valid_from}${e.valid_until ? ` até ${e.valid_until}` : ""}. O banco revalida no momento do ato.` };
  }
  return { rule: matching[0]!, engagement: live[0]!, allowed: false, code: "escopo-insuficiente", reason: q.schoolId ? "A atuação vigente não alcança esta escola." : "A capacidade exige alcance de rede; sua atuação vigente é de escola." };
}

/** Achado de governança: concentração de poderes no Administrador Geral. Só evidência; decisão é institucional. */
export const GOVERNANCE_REVIEW_PENDING = {
  code: "GOVERNANCE_REVIEW_PENDING",
  finding: "O tipo de atuação administrador-geral-do-sigem recebe, em rede, todas as capacidades setoriais da política vigente, inclusive redigir e homologar a própria política.",
  impact: "Uma única conta pode alterar a norma de acesso que a autoriza; não há segregação entre quem redige e quem homologa.",
  decision: "Separar ou manter os poderes é decisão institucional; o sistema não altera a política sozinho.",
} as const;
export const isPolicyPower = (cap: string) => /politica|capabilit|capacidad/i.test(cap);
