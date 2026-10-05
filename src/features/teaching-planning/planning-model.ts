/**
 * Planejamento docente — modelo puro.
 * Blocos são livres (título + texto, tipo opcional do catálogo): o motor não conhece "objetivo", "metodologia" etc.
 * Nível (período, sequência, aula…) é identificador aberto; o motor não conhece bimestre/trimestre.
 * Referências curriculares guardam só IDs; o texto oficial é lido da camada canônica e nunca copiado nem editado.
 */
export type PlanStatus = "rascunho" | "publicado" | "arquivado";
export type PlanBlock = { kindValueId: string | null; heading: string; body: string };
export type CurricularRef = { kind: "matrix-item"; item_key: string } | { kind: "reference-item"; item_id: string };

export type PlanVersion = Readonly<{
  id: string; plan_id: string; version: number; supersedes_id: string | null;
  assignment_id: string; class_id: string; school_id: string; matrix_version_id: string;
  level_value_id: string | null; covers_from: string | null; covers_until: string | null;
  title: string; blocks: unknown; curricular_refs: unknown; status: PlanStatus;
  copied_from_version_id: string | null; change_reason: string | null; author_user_id: string; recorded_at: string;
}>;

/** Cabeça de cada plano = versão sem sucessora entre as visíveis. */
export function planHeads(rows: readonly PlanVersion[]): PlanVersion[] {
  const sup = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  return rows.filter((r) => !sup.has(r.id)).sort((a, b) => (a.covers_from ?? "9999").localeCompare(b.covers_from ?? "9999") || a.title.localeCompare(b.title));
}
export const planHistory = (rows: readonly PlanVersion[], planId: string) => rows.filter((r) => r.plan_id === planId).sort((a, b) => b.version - a.version);

export function parseBlocks(v: unknown): PlanBlock[] {
  if (!Array.isArray(v)) return [];
  return v.filter((b) => b && typeof b === "object").map((b: any) => ({ kindValueId: typeof b.kindValueId === "string" ? b.kindValueId : null, heading: String(b.heading ?? ""), body: String(b.body ?? "") }));
}
export function parseRefs(v: unknown): CurricularRef[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((r: any): CurricularRef[] => r?.kind === "matrix-item" && typeof r.item_key === "string" ? [{ kind: "matrix-item" as const, item_key: r.item_key }]
    : r?.kind === "reference-item" && typeof r.item_id === "string" ? [{ kind: "reference-item" as const, item_id: r.item_id }] : []);
}

/** Cópia: nova instância, mesmo conteúdo, sem herdar identidade; proveniência via copied_from. Sempre nasce rascunho. */
export function copyDraft(src: PlanVersion, targetAssignmentId: string, applicableItemKeys: readonly string[]) {
  const refs = parseRefs(src.curricular_refs).filter((r) => r.kind === "reference-item" || applicableItemKeys.includes(r.item_key));
  const dropped = parseRefs(src.curricular_refs).length - refs.length;
  return { assignmentId: targetAssignmentId, title: `${src.title} (cópia)`, blocks: parseBlocks(src.blocks), refs, status: "rascunho" as const, copiedFrom: src.id, levelValueId: src.level_value_id, coversFrom: src.covers_from, coversUntil: src.covers_until, droppedRefs: dropped };
}

/** Agenda: planos com período coberto que inclui a data. Sem datas ⇒ fora da agenda (não é presumido). */
export const plansOn = (heads: readonly PlanVersion[], day: string) =>
  heads.filter((p) => p.covers_from && p.covers_from <= day && (p.covers_until ?? p.covers_from) >= day);

const MESSAGES: Record<string, string> = {
  "plan:no-session": "Entre novamente para continuar.",
  "plan:assignment-not-current": "Esta regência não está vigente para você hoje. Planos anteriores continuam disponíveis para leitura e cópia.",
  "plan:stale-head": "Este planejamento foi alterado em outra janela. Recarregue para ver a versão mais recente antes de salvar.",
  "plan:not-author": "Só quem escreveu o planejamento pode alterá-lo.",
  "plan:matrix-item-not-applicable": "Um elemento curricular escolhido não pertence à matriz desta regência.",
  "plan:reference-item-unknown": "Uma habilidade escolhida não existe mais na base curricular.",
  "plan:copy-source-not-readable": "Você não tem acesso ao planejamento de origem.",
  "plan:assignment-immutable": "Um planejamento não muda de regência; faça uma cópia.",
  "plan:lesson-not-own-assignment": "A aula precisa ser sua e da mesma regência do planejamento.",
  "plan:attachment-path": "Anexo inválido.",
  "plan:invalid-blocks": "Há blocos grandes demais ou inválidos.",
};
export const planMessage = (raw: string) => {
  const k = Object.keys(MESSAGES).find((m) => raw.includes(m));
  return k ? MESSAGES[k]! : "Não foi possível concluir. Tente novamente.";
};
export const STATUS_LABEL: Record<PlanStatus, string> = { rascunho: "Rascunho (só você vê)", publicado: "Compartilhado", arquivado: "Arquivado" };
