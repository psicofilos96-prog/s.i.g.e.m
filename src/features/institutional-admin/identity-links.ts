// LOTE 9 — associação conta↔pessoa por identidade comprovada, com revisão por segunda conta.
// Lê e grava só pela sessão: propose_identity_link / decide_identity_link (DEFINER, capability
// manter-contas-institucionais). Atuação escolar continua só por record_engagement.
import { supabase } from "@/integrations/supabase/client";

export const EVIDENCE_KINDS = {
  "identificador-oficial-conferido": "Identificador oficial conferido",
  "documento-conferido-presencialmente": "Documento conferido presencialmente",
  "matricula-funcional-conferida": "Matrícula funcional conferida",
} as const;
export type EvidenceKind = keyof typeof EVIDENCE_KINDS;

export type ReviewRow = {
  id: string; target_user_id: string; person_id: string; school_id: string | null;
  evidence_kind: string; evidence_note: string; proposed_by: string; proposed_at: string;
};
export type DecisionRow = { review_id: string; decision: "aprovado" | "recusado"; reason: string; decided_by: string; decided_at: string };
export type ReviewState = "pendente" | "aprovado" | "recusado";
export type ReviewItem = ReviewRow & { state: ReviewState; decision: DecisionRow | null };

/** Projeção pura: estado é derivado da decisão (uma por revisão), nunca campo gravado. */
export function projectReviews(reviews: ReviewRow[], decisions: DecisionRow[]): ReviewItem[] {
  const byId = new Map(decisions.map((d) => [d.review_id, d]));
  return reviews
    .map((r) => { const d = byId.get(r.id) ?? null; return { ...r, decision: d, state: (d?.decision ?? "pendente") as ReviewState }; })
    .sort((a, b) => b.proposed_at.localeCompare(a.proposed_at));
}

/** Validação de tela (o banco revalida tudo). Nome sozinho nunca é evidência. */
export function proposalProblem(p: { targetUserId: string; personId: string; evidenceKind: string; evidenceNote: string }, me: string | null): string | null {
  if (!p.targetUserId) return "Escolha a conta.";
  if (!p.personId) return "Escolha a pessoa.";
  if (me && p.targetUserId === me) return "Você não pode associar a própria conta.";
  if (!(p.evidenceKind in EVIDENCE_KINDS)) return "Escolha o tipo de evidência.";
  if (p.evidenceNote.trim().length < 15) return "Descreva a evidência conferida (mínimo 15 caracteres).";
  return null;
}

export function canDecide(item: ReviewItem, me: string | null): boolean {
  return item.state === "pendente" && !!me && item.proposed_by !== me && item.target_user_id !== me;
}

export async function loadReviews(): Promise<ReviewItem[]> {
  const [r, d] = await Promise.all([
    supabase.from("identity_link_reviews").select("*").order("proposed_at", { ascending: false }).limit(500),
    supabase.from("identity_link_review_decisions").select("*").limit(500),
  ]);
  if (r.error) throw r.error;
  if (d.error) throw d.error;
  return projectReviews((r.data ?? []) as ReviewRow[], (d.data ?? []) as DecisionRow[]);
}

export async function loadAccounts() {
  const { data, error } = await supabase.rpc("admin_account_overview");
  if (error) throw error;
  return (data ?? []) as { user_id: string; person_id: string | null; login: string }[];
}

/** Só pessoas com identificador registrado podem ser associadas. */
export async function loadIdentifiedPersons() {
  const { data, error } = await supabase.from("institutional_person_identifiers").select("person_id, identifier_kind, institutional_persons(display_name)").limit(1000);
  if (error) throw error;
  const map = new Map<string, { id: string; name: string; kinds: string[] }>();
  for (const row of (data ?? []) as { person_id: string; identifier_kind: string; institutional_persons: { display_name: string } | null }[]) {
    const e = map.get(row.person_id) ?? { id: row.person_id, name: row.institutional_persons?.display_name ?? "Pessoa sem nome", kinds: [] };
    e.kinds.push(row.identifier_kind);
    map.set(row.person_id, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function proposeLink(p: { targetUserId: string; personId: string; schoolId: string | null; evidenceKind: EvidenceKind; evidenceNote: string }) {
  const { data, error } = await supabase.rpc("propose_identity_link", {
    _target_user: p.targetUserId, _person: p.personId, _school: p.schoolId ?? undefined, _evidence_kind: p.evidenceKind, _evidence_note: p.evidenceNote.trim(),
  } as never);
  if (error) throw error;
  return data as string;
}

export async function decideLink(reviewId: string, decision: "aprovado" | "recusado", reason: string) {
  const { error } = await supabase.rpc("decide_identity_link", { _review: reviewId, _decision: decision, _reason: reason.trim() });
  if (error) throw error;
}
