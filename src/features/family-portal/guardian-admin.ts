/**
 * AC.2 — gestão de autorizações de responsável pela equipe. Lógica pura: o banco decide capacidade,
 * identidade e conta (record_guardian_authorization_v3); aqui só se projeta a cadeia e se validam campos.
 * Nunca há conta exposta, parentesco inferido ou ato automático.
 */
import { FAMILY_SECTIONS, type FamilySection } from "./family-portal";

export type ChainRow = Readonly<{
  id: string; logical_id: string; version: number; event_kind: "constituicao" | "substituicao" | "revogacao";
  guardian_person_id: string | null; guardian_name: string | null; relation_scheme_id: string | null; relation_value_id: string | null;
  sections: readonly string[]; valid_from: string; valid_until: string | null; reason: string | null; recorded_at: string; is_head: boolean;
}>;

export type AuthorizationView = Readonly<{
  logicalId: string; head: ChainRow; history: readonly ChainRow[];
  state: "vigente" | "futura" | "expirada" | "revogada"; legacy: boolean;
}>;

/** Agrupa a cadeia por autorização lógica; o estado é derivado da cabeça na data consultada, nunca persistido. */
export function projectAuthorizations(rows: readonly ChainRow[], on: string): AuthorizationView[] {
  const by = new Map<string, ChainRow[]>();
  for (const r of rows) by.set(r.logical_id, [...(by.get(r.logical_id) ?? []), r]);
  return [...by.values()].flatMap((h) => {
    const sorted = [...h].sort((a, b) => a.version - b.version);
    const heads = sorted.filter((r) => r.is_head);
    if (heads.length !== 1) return [];
    const head = heads[0]!;
    const state: AuthorizationView["state"] = head.event_kind === "revogacao" ? "revogada"
      : head.valid_from > on ? "futura" : head.valid_until != null && head.valid_until < on ? "expirada" : "vigente";
    return [{ logicalId: head.logical_id, head, history: sorted, state, legacy: head.guardian_person_id == null }];
  }).sort((a, b) => (a.state === b.state ? (a.head.guardian_name ?? "").localeCompare(b.head.guardian_name ?? "") : a.state === "vigente" ? -1 : 1));
}

export type GrantDraft = { sections: FamilySection[]; validFrom: string; validUntil: string; reason: string };

export function validateDraft(d: GrantDraft, kind: "constituicao" | "substituicao" | "revogacao"): string[] {
  const e: string[] = [];
  if (kind === "revogacao") { if (!d.reason.trim()) e.push("Informe o motivo da revogação."); return e; }
  if (d.sections.length === 0) e.push("Escolha ao menos uma seção.");
  if (d.sections.some((s) => !FAMILY_SECTIONS.includes(s))) e.push("Seção desconhecida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.validFrom)) e.push("Informe o início da vigência.");
  if (d.validUntil && d.validUntil < d.validFrom) e.push("O fim da vigência não pode ser anterior ao início.");
  return e;
}

const MESSAGES: Record<string, string> = {
  "capability:manter-autorizacao-de-responsavel": "Sua atuação não permite gerir autorizações de responsável nesta escola.",
  "lookup:capability-missing": "Sua atuação não permite esta busca nesta escola.",
  "lookup:rate-limited": "Muitas buscas em pouco tempo. Aguarde alguns minutos.",
  "session:person-required": "Sua conta não está ligada a uma pessoa. Procure a administração.",
  "family:natural-person-required": "Somente uma pessoa natural pode registrar a autorização.",
  "family:guardian-invalid": "Você não pode registrar autorização para si mesmo.",
  "family:guardian-person-invalid": "Responsável não identificado como pessoa natural.",
  "family:guardian-account-missing": "O responsável ainda não tem conta de acesso ligada. A administração de contas precisa criar o vínculo antes.",
  "family:guardian-account-ambiguous": "O responsável tem mais de uma conta ligada; a administração precisa resolver antes.",
  "family:account-person-mismatch": "A conta do responsável está ligada a outra pessoa.",
  "family:student-not-in-school": "O educando não tem matrícula nesta escola.",
  "family:relation-not-homologated": "Parentesco não homologado.",
  "family:sections-required": "Escolha ao menos uma seção.",
  "family:base-superseded": "Esta autorização foi alterada por outra pessoa. Recarregue antes de continuar.",
  "family:already-revoked": "Autorização já revogada; para nova autorização, registre uma concessão nova.",
  "family:legacy-requires-v2": "Autorização antiga sem pessoa responsável identificada; não pode ser alterada por aqui.",
};
export function adminMessage(raw: string): string {
  const k = Object.keys(MESSAGES).find((m) => raw.includes(m));
  return k ? MESSAGES[k]! : "Não foi possível concluir. Nada foi gravado.";
}
