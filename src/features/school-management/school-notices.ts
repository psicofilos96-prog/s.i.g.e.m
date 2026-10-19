// Direção L13 — Avisos da Direção (mural da escola): regras puras.
// Aviso publicado nunca é editado nem apagado; só retirado com motivo. Expirado ou retirado não aparece como ativo.

export const NOTICE_AUDIENCES = [
  { id: "escola", label: "Toda a escola" },
  { id: "turma", label: "Uma turma" },
  { id: "familias", label: "Famílias" },
  { id: "servidores", label: "Servidores" },
] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number]["id"];

export type NoticeRow = {
  id: string; title: string; body: string; audience: string; class_id: string | null;
  image_path: string | null; expires_on: string | null; published_at: string;
  withdrawn: boolean; withdrawal_reason: string | null;
};

export type NoticeDraft = {
  title: string; body: string; audience: NoticeAudience; classId: string | null; expiresOn: string | null;
};

/** Problemas do rascunho antes do envio; lista vazia = pode publicar. */
export function noticeProblems(d: NoticeDraft, today: string): string[] {
  const p: string[] = [];
  if (d.title.trim().length < 3) p.push("Informe um título com pelo menos 3 letras.");
  if (d.body.trim().length < 3) p.push("Escreva o texto do aviso.");
  if (d.audience === "turma" && !d.classId) p.push("Escolha a turma do aviso.");
  if (d.audience !== "turma" && d.classId) p.push("Turma só vale para aviso de uma turma.");
  if (d.expiresOn && d.expiresOn < today) p.push("A validade não pode estar no passado.");
  return p;
}

/** Avisos visíveis no mural: não retirados e dentro da validade (sem validade = sempre vale). */
export function activeNotices(rows: NoticeRow[] | null, today: string): NoticeRow[] | null {
  if (!rows) return null;
  return rows.filter((r) => !r.withdrawn && (!r.expires_on || r.expires_on >= today));
}

export function audienceLabel(id: string): string {
  return NOTICE_AUDIENCES.find((a) => a.id === id)?.label ?? id;
}

export const NOTICE_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
export const NOTICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Valida a imagem opcional do aviso; null = pode enviar. */
export function noticeImageProblem(f: { type: string; size: number }): string | null {
  if (!NOTICE_IMAGE_MIME.includes(f.type)) return "A imagem precisa ser JPG, PNG ou WEBP.";
  if (f.size > NOTICE_IMAGE_MAX_BYTES) return "A imagem passa de 5 MB.";
  return null;
}
