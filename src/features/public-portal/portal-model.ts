/** Tipos publicáveis: fechados de propósito — é fronteira de segurança, não norma. */
export const PUBLISHABLE_KINDS = ["calendario-escolar", "comunicado", "informacao-institucional"] as const;
export type PublishableKind = (typeof PUBLISHABLE_KINDS)[number];
export type PublicationState = "rascunho" | "publicado" | "revogado";

export const KIND_LABEL: Record<PublishableKind, string> = {
  "calendario-escolar": "Calendário escolar",
  comunicado: "Comunicado",
  "informacao-institucional": "Informação institucional",
};

export type PublicItem = { slug: string; kind: PublishableKind; title: string; summary: string | null; published_at: string; version: number };
export type PublicDetail =
  | ({ status: "publicado"; body: string } & PublicItem)
  | { status: "indisponivel" };

/** Campos que a resposta pública pode conter. Qualquer outro é descartado. */
const DETAIL_FIELDS = ["status", "slug", "kind", "title", "summary", "body", "published_at", "version"] as const;

/**
 * Normaliza a resposta pública: fail-closed. Qualquer coisa que não seja
 * explicitamente "publicado" com tipo publicável vira "indisponível" — o mesmo
 * para inexistente, rascunho e revogado, para não permitir enumeração.
 */
export function toPublicDetail(raw: unknown): PublicDetail {
  if (!raw || typeof raw !== "object") return { status: "indisponivel" };
  const r = raw as Record<string, unknown>;
  if (r.status !== "publicado" || !PUBLISHABLE_KINDS.includes(r.kind as PublishableKind)) return { status: "indisponivel" };
  const out: Record<string, unknown> = {};
  for (const k of DETAIL_FIELDS) out[k] = r[k] ?? null;
  return out as PublicDetail;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isValidSlug = (s: string) => s.length >= 3 && s.length <= 120 && SLUG_RE.test(s);
