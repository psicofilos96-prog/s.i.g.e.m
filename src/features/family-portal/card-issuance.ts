/**
 * NFAM.1 — projeções puras da carteirinha emitida (cadeia `student_card_issuances`).
 * Estado vem só da cadeia (última versão manda) e da validade; nada é inferido.
 */
import { governError } from "@/lib/observability/governed-errors";
import { cardVerifyPath } from "./card-public-code";
import type { StudentCard } from "./student-card";

export type IssuedCard = Readonly<{ public_id: string; version: number; status: "valida" | "expirada"; academic_year: string; valid_until: string; student_name: string; school_name: string; class_label: string | null }>;
export type CardChainRow = Readonly<{ public_id: string; version: number; kind: "emissao" | "reemissao" | "cancelamento"; student_id: string; academic_year: string; valid_until: string; student_name: string; class_label: string | null; reason: string | null; recorded_at: string }>;
export type CardState = "valida" | "expirada" | "cancelada";
export type CardChainView = Readonly<{ publicId: string; studentId: string; head: CardChainRow; state: CardState; history: readonly CardChainRow[] }>;

export function cardState(head: Pick<CardChainRow, "kind" | "valid_until">, today: string): CardState {
  if (head.kind === "cancelamento") return "cancelada";
  return head.valid_until < today ? "expirada" : "valida";
}

/** Agrupa a cadeia por carteirinha; histórico em ordem de versão, nunca reescrito. */
export function projectCardChain(rows: readonly CardChainRow[], today: string): CardChainView[] {
  const by = new Map<string, CardChainRow[]>();
  for (const r of rows) by.set(r.public_id, [...(by.get(r.public_id) ?? []), r]);
  return [...by].map(([publicId, list]) => {
    const history = [...list].sort((a, b) => a.version - b.version);
    const head = history.at(-1)!;
    return { publicId, studentId: head.student_id, head, state: cardState(head, today), history };
  }).sort((a, b) => a.head.student_name.localeCompare(b.head.student_name, "pt-BR") || a.publicId.localeCompare(b.publicId));
}

/** URL de verificação só com origem https; sem origem segura, sem QR. */
export function verifyUrlFor(origin: string, publicId: string, version: number): string | null {
  return /^https:\/\//.test(origin) ? `${origin.replace(/\/$/, "")}${cardVerifyPath(publicId, version)}` : null;
}

/** Sobrepõe à projeção da família os campos da emissão oficial (fonte canônica). */
export function withIssuance(card: StudentCard, issued: IssuedCard | null, origin: string): StudentCard {
  if (!issued) return card;
  return { ...card, name: issued.student_name, school: issued.school_name, className: issued.class_label, year: issued.academic_year,
    code: `${issued.public_id}.${issued.version}`, verifyUrl: verifyUrlFor(origin, issued.public_id, issued.version) };
}

export const CARD_STATE_LABEL: Record<CardState, string> = { valida: "Válida", expirada: "Expirada", cancelada: "Cancelada" };
export const CARD_KIND_LABEL = { emissao: "Emissão", reemissao: "Reemissão", cancelamento: "Cancelamento" } as const;

export type CardDraft = { kind: "emissao" | "reemissao" | "cancelamento"; validUntil: string; reason: string; year: string };
/** Validação de tela (o banco revalida tudo). Reemissão/cancelamento exigem motivo; emissão exige ano e validade coerentes. */
export function validateCardDraft(d: CardDraft): string | null {
  if (d.kind === "emissao") {
    if (!/^\d{4}$/.test(d.year)) return "Informe o ano letivo com quatro dígitos.";
    if (!d.validUntil) return "Informe a data de validade.";
    if (d.validUntil < `${d.year}-01-01`) return "A validade não pode ser anterior ao início do ano letivo.";
    return null;
  }
  return d.reason.trim() ? null : "Informe o motivo.";
}

export function cardMessage(raw: string): string {
  if (raw.includes("card:capability-missing")) return "Sua atuação não tem a permissão de emitir carteirinhas nesta escola. Ela ainda não foi atribuída por nenhuma política homologada.";
  if (raw.includes("card:no-enrollment-at-school")) return "O estudante não tem matrícula registrada nesta escola.";
  if (raw.includes("card:head-changed")) return "A carteirinha foi alterada por outra pessoa. Recarregue antes de continuar.";
  if (raw.includes("card:already-cancelled")) return "Esta carteirinha já foi cancelada.";
  if (raw.includes("card:validity-invalid")) return "A validade não pode ser anterior ao início do ano letivo.";
  if (raw.includes("lookup:capability-missing")) return "Sua atuação não pode localizar estudantes nesta escola.";
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  return governError(raw).userMessage;
}
