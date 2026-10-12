// L11–L14, L17–L19 — revisão, assinatura, verificação, prazos, arquivo, digitalização e acesso.
// Toda escrita é função do banco (0392/0393); aqui só projeções puras e chamadas.
import { supabase } from "@/integrations/supabase/client";

/* L11/L12 */
export interface Review { verdict: "aprovado" | "devolvido"; reviewerPerson: string }
export interface Signature { signerPerson: string; signatureLevel: "simples" | "avancada" | "qualificada"; qualifiedEvidenceRef: string | null }

export function versionStage(authorPerson: string, reviews: readonly Review[], signatures: readonly Signature[]) {
  const valid = reviews.filter((r) => r.reviewerPerson !== authorPerson);
  if (valid.some((r) => r.verdict === "devolvido")) return "devolvido" as const;
  if (signatures.length) return "assinado" as const;
  if (valid.some((r) => r.verdict === "aprovado")) return "aprovado" as const;
  return "em-revisao" as const;
}

/** Rótulo honesto: qualificada só com evidência ICP-Brasil registrada; padrão é simples. */
export function signatureLabel(s: Signature): string {
  if (s.signatureLevel !== "simples" && s.qualifiedEvidenceRef) return s.signatureLevel === "qualificada" ? "Assinatura qualificada (ICP-Brasil)" : "Assinatura avançada";
  return "Assinatura eletrônica simples (autenticação no SIGEM)";
}

/* L13 */
export const VERIFICATION_CODE = /^[0-9a-f]{24}$/;
export interface ActVerification { status: "valido" | "indisponivel"; act_kind: string | null; case_number: string | null; version: number | null; signed_content_sha256: string | null; signature_level: string | null; signed_at: string | null }
export async function verifyActSignature(code: string): Promise<ActVerification> {
  const none: ActVerification = { status: "indisponivel", act_kind: null, case_number: null, version: null, signed_content_sha256: null, signature_level: null, signed_at: null };
  if (!VERIFICATION_CODE.test(code)) return none;
  const { data, error } = await supabase.rpc("verify_admin_act_signature", { _code: code });
  if (error) throw new Error("verify-failed");
  const row = (Array.isArray(data) ? data[0] : data) as ActVerification | undefined;
  return row?.status === "valido" ? row : none;
}

/* L14 — prazo só por regra aprovada; dias úteis exigem calendário lido */
export interface DeadlineRule { ruleKey: string; version: number; classificationCode: string; days: number; dayKind: "corridos" | "uteis"; status: "rascunho" | "aprovada" | "revogada"; decisionRef: string | null }
export function applicableDeadlineRule(rules: readonly DeadlineRule[], classificationCode: string): DeadlineRule | null | "ambigua" {
  const heads = new Map<string, DeadlineRule>();
  for (const r of rules) if (!heads.has(r.ruleKey) || heads.get(r.ruleKey)!.version < r.version) heads.set(r.ruleKey, r);
  const hits = [...heads.values()].filter((r) => r.status === "aprovada" && r.decisionRef && r.classificationCode === classificationCode);
  return hits.length > 1 ? "ambigua" : hits[0] ?? null;
}
export function dueDate(start: string, rule: DeadlineRule, schoolDays: readonly string[] | null): string | null {
  if (rule.dayKind === "corridos") {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + rule.days); return d.toISOString().slice(0, 10);
  }
  if (!schoolDays) return null;
  const after = [...schoolDays].filter((d) => d > start).sort();
  return after[rule.days - 1] ?? null;
}

/* L17 — nunca descarte automático */
export type ArchivalEvent = "classificado" | "arquivado_corrente" | "transferido_intermediario" | "recolhido_permanente" | "eliminacao_proposta" | "eliminacao_autorizada";
export function archivalPhase(events: readonly { eventType: ArchivalEvent; authorPerson: string }[]) {
  let phase = "sem-classificacao"; let proposer: string | null = null; let eliminable = false;
  for (const e of events) {
    if (e.eventType === "eliminacao_proposta") { proposer = e.authorPerson; phase = "eliminacao-proposta"; }
    else if (e.eventType === "eliminacao_autorizada") { eliminable = !!proposer && proposer !== e.authorPerson; phase = "eliminacao-autorizada"; }
    else phase = e.eventType;
  }
  // Mesmo autorizada, a eliminação física nunca é executada pelo sistema.
  return { phase, eliminable, automaticDisposal: false as const };
}

/* L18 */
export function digitizationState(d: { digitizedBy: string }, c: { result: "conforme" | "divergente"; conferredBy: string } | null) {
  if (!c) return "aguardando-conferencia" as const;
  if (c.conferredBy === d.digitizedBy) return "conferencia-invalida" as const;
  return c.result === "conforme" ? ("conferida" as const) : ("divergente" as const);
}

/* L19 */
export interface AccessGrant { scope: "leitura" | "leitura_anexos_sensiveis"; validUntil: string; revoked: boolean }
export function grantAllows(g: AccessGrant, need: AccessGrant["scope"], today: string): boolean {
  if (g.revoked || g.validUntil < today) return false;
  return g.scope === need || (need === "leitura" && g.scope === "leitura_anexos_sensiveis");
}

const REFUSALS: Record<string, string> = {
  "review:self-review": "Quem redigiu não revisa a própria versão.",
  "review:forbidden": "Sem a capacidade 'revisar-atos-processuais'.",
  "review:already-reviewed": "Você já revisou esta versão.",
  "sign:not-approved": "Só versão aprovada e não devolvida pode ser assinada.",
  "sign:not-current-version": "Só a versão vigente pode ser assinada.",
  "sign:forbidden": "Sem a competência da espécie do ato para assinar.",
  "sign:already-signed": "Você já assinou esta versão.",
  "archive:same-person": "Quem propôs a eliminação não a autoriza.",
  "archive:no-retention-rule": "Proposta de eliminação exige regra de temporalidade.",
  "archive:decision-required": "Recolhimento e autorização de eliminação exigem decisão registrada.",
  "digitize:same-person": "Quem digitalizou não confere a própria digitalização.",
  "digitize:provenance-required": "Informe descrição do original e quem o guarda.",
  "grant:self-grant": "Ninguém concede acesso a si mesmo.",
  "grant:forbidden": "Sem a capacidade 'conceder-acesso-processos'.",
  "deadline:decision-required": "Regra aprovada exige decisão registrada.",
};
export function explainLifecycleError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Operação recusada; nada foi gravado.";
}
