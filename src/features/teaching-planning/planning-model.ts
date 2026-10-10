/**
 * Planejamento docente — modelo puro.
 * Blocos são livres (título + texto, tipo opcional do catálogo): o motor não conhece "objetivo", "metodologia" etc.
 * Nível (período, sequência, aula…) é identificador aberto; o motor não conhece bimestre/trimestre.
 * Referências curriculares guardam só IDs; o texto oficial é lido da camada canônica e nunca copiado nem editado.
 */
export type PlanStatus = "rascunho" | "publicado" | "arquivado";
export type PlanBlock = { kindValueId: string | null; heading: string; body: string };
/** Ref normalizada pelo banco (0150): matriz guarda matrix_version_id; Y guarda edition_id; position_key = posição curricular explícita (multietapa). */
export type CurricularRef =
  | { kind: "matrix-item"; item_key: string; matrix_version_id?: string; position_key?: string }
  | { kind: "reference-item"; item_id: string; edition_id?: string; position_key?: string };

export type PlanVersion = Readonly<{
  id: string; plan_id: string; version: number; supersedes_id: string | null;
  assignment_id: string; class_id: string; school_id: string; matrix_version_id: string;
  level_value_id: string | null; covers_from: string | null; covers_until: string | null;
  period_id?: string | null; target_date?: string | null;
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
  const opt = (k: string, x: unknown) => (typeof x === "string" && x ? { [k]: x } : {});
  return v.flatMap((r: any): CurricularRef[] => r?.kind === "matrix-item" && typeof r.item_key === "string"
      ? [{ kind: "matrix-item" as const, item_key: r.item_key, ...opt("matrix_version_id", r.matrix_version_id), ...opt("position_key", r.position_key) }]
    : r?.kind === "reference-item" && typeof r.item_id === "string"
      ? [{ kind: "reference-item" as const, item_id: r.item_id, ...opt("edition_id", r.edition_id), ...opt("position_key", r.position_key) }] : []);
}

/** Filtros da tela do professor: turma, elemento (item_key da matriz), período oficial; vazio = sem filtro. */
export type PlanFilter = { classId?: string; itemKey?: string; periodId?: string };
export const filterPlans = (heads: readonly PlanVersion[], f: PlanFilter) => heads.filter((p) =>
  (!f.classId || p.class_id === f.classId) && (!f.periodId || p.period_id === f.periodId)
  && (!f.itemKey || parseRefs(p.curricular_refs).some((r) => r.kind === "matrix-item" && r.item_key === f.itemKey)));

/** Data-alvo do fato: início do plano ou a data escolhida pelo professor — nunca o relógio de hoje por padrão silencioso. */
export const planTargetDate = (coversFrom: string | null, chosen: string) => coversFrom || chosen;

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
  "plan:natural-person-required": "Só uma pessoa natural vinculada à sua conta pode planejar.",
  "plan:year-not-plannable": "O ano letivo desta turma não está em preparação nem em operação.",
  "plan:period-not-of-year": "O período escolhido não pertence ao ano letivo da turma.",
  "plan:interval-outside-period": "As datas do plano saem do período oficial escolhido.",
  "plan:invalid-interval": "A data final é anterior à inicial.",
  "plan:matrix-item-not-of-assignment": "Esse elemento curricular não é o da sua atribuição.",
  "plan:copy-only-own-structure": "Só é possível copiar a estrutura de um plano seu.",
  "plan:target-date-required": "Informe a data de início do plano.",
  "plan:target-date-outside-plan": "A data de referência precisa estar dentro do intervalo do plano.",
  "plan:interval-outside-assignment": "As datas do plano saem da vigência da sua atribuição.",
  "plan:class-period-organization-missing": "A turma não tem organização de períodos vigente nessa data; planeje sem período oficial.",
  "plan:class-period-organization-ambiguous": "A turma tem mais de uma organização de períodos vigente; a escola precisa corrigir antes.",
  "plan:period-not-of-class-organization": "O período escolhido não pertence à organização vigente da turma.",
  "plan:matrix-version-mismatch": "O elemento curricular é de outra versão da matriz.",
  "plan:reference-edition-mismatch": "A habilidade escolhida é de outra edição da base curricular.",
  "plan:position-not-in-class": "A posição curricular escolhida não existe nesta turma na data do plano.",
  "plan:link-exists": "Esta aula já está ligada a este planejamento.",
};
export const planMessage = (raw: string) => {
  const k = Object.keys(MESSAGES).find((m) => raw.includes(m));
  return k ? MESSAGES[k]! : "Não foi possível concluir. Tente novamente.";
};
export const STATUS_LABEL: Record<PlanStatus, string> = { rascunho: "Rascunho (só você vê)", publicado: "Compartilhado", arquivado: "Arquivado" };

/** LOTE 8 — planejamento semanal com datas livres: um bloco por dia do intervalo escolhido (máx. 31), sem duplicar dias já presentes. */
const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DAY_FIELDS = "Objetivos:\nHabilidades (BNCC):\nAtividades:\nRecursos:\nAvaliação:";
export function dailyBlocks(from: string, until: string, existing: readonly PlanBlock[], includeWeekends = false): PlanBlock[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || until < from) return [...existing];
  const have = new Set(existing.map((b) => b.heading));
  const out = [...existing];
  const d = new Date(`${from}T12:00:00Z`), end = new Date(`${until}T12:00:00Z`);
  for (let n = 0; d <= end && n < 31; n++, d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay(); if (!includeWeekends && (w === 0 || w === 6)) continue;
    const iso = d.toISOString().slice(0, 10); const h = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} (${DOW[w]})`;
    if (!have.has(h)) out.push({ kindValueId: null, heading: h, body: DAY_FIELDS });
  }
  return out.filter((b) => b.heading.trim() || b.body.trim());
}
