import { neutralize } from "@/features/reports/report-engine";
/**
 * Inclusão — modelo puro. Nenhuma taxonomia médica, CID, categoria de deficiência ou critério de elegibilidade:
 * tipos de registro são estrutura; categorias vêm de catálogos homologados (vazios até decisão).
 * Nada aqui infere condição a partir de AEE, mediação, turma ou texto.
 */

export const RECORD_TYPES = [
  { id: "necessidade-de-apoio", label: "Necessidade de apoio educacional", catalog: "categoria-de-apoio-educacional" },
  { id: "participacao-aee", label: "Participação no AEE", catalog: "modalidade-de-participacao-aee" },
  { id: "atendimento-aee", label: "Atendimento AEE (registro pedagógico)", catalog: null },
  { id: "plano-educacional", label: "Plano educacional / estratégias", catalog: null },
  { id: "relatorio-pedagogico", label: "Relatório pedagógico", catalog: null },
] as const;
export type RecordType = (typeof RECORD_TYPES)[number]["id"];

export type InclusionRecord = Readonly<{
  id: string; logical_id: string; version: number; supersedes_id: string | null; event_kind: "registro" | "retificacao" | "encerramento";
  record_type: RecordType; school_id: string; student_id: string; category_scheme_id: string | null; category_value_id: string | null;
  educational_purpose: string; body: string; valid_from: string; valid_to: string | null; share_with_mediation: boolean;
  reason: string | null; author_user_id: string; author_person_id: string | null; recorded_at: string;
}>;

export type Mediation = Readonly<{
  id: string; logical_id: string; version: number; event_kind: string; school_id: string; student_id: string; class_id: string | null;
  mediator_engagement_id: string; valid_from: string; valid_to: string | null;
}>;

export const isActiveOn = (x: { valid_from: string; valid_to: string | null; event_kind: string }, on: string) =>
  x.event_kind !== "encerramento" && x.valid_from <= on && (x.valid_to === null || x.valid_to >= on);

/**
 * Exportação minimizada: só tipo, período, finalidade e texto pedagógico de registros vigentes.
 * Saem: autoria, motivos de correção, categorias, anexos (sempre), e qualquer registro encerrado.
 */
export function minimizedExport(rs: readonly InclusionRecord[], on: string) {
  return rs.filter((r) => isActiveOn(r, on)).map((r) => ({
    tipo: RECORD_TYPES.find((t) => t.id === r.record_type)?.label ?? r.record_type,
    desde: r.valid_from, ate: r.valid_to, finalidade: r.educational_purpose, registro: r.body,
  }));
}

export function toCsv(rows: readonly Record<string, string | null>[]) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const q = (v: string | null) => `"${neutralize(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(";"), ...rows.map((r) => keys.map((k) => q(r[k] ?? null)).join(";"))].join("\n");
}

/** Aviso (não bloqueio): registro pedagógico não é lugar de diagnóstico. Documento clínico vai como anexo segregado. */
const CLINICAL = /\b(cid[- ]?\d|cid\b|diagn[oó]stic|laudo|medica[cç][aã]o|posologia|mg\b)/i;
export const clinicalWarning = (t: string) => CLINICAL.test(t)
  ? "Não registre diagnóstico, CID, laudo ou medicação neste texto. Se houver documento clínico, anexe-o como clínico: ele fica separado e com acesso restrito."
  : null;

export function inclusionMessage(raw: string): string {
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (raw.includes("capability:consultar-documento-sensivel-inclusao")) return "Sua atuação não tem permissão para documentos sensíveis desta escola.";
  if (raw.includes("capability:")) return "Sua atuação não tem permissão para esta ação nesta escola. O acesso não vem do cargo.";
  if (raw.includes("student-not-in-school")) return "Este estudante não tem matrícula nesta escola.";
  if (raw.includes("mediator-not-in-school")) return "A atuação do mediador não pertence a esta escola.";
  if (raw.includes("class-not-in-school")) return "A turma não pertence a esta escola.";
  if (raw.includes("category-not-homologated")) return "Escolha uma categoria aprovada no catálogo.";
  if (raw.includes("base-superseded")) return "Este registro já foi atualizado por outra pessoa. Recarregue.";
  if (raw.includes("already-closed")) return "Este registro já foi encerrado.";
  if (raw.includes("valid-to-required")) return "Informe a data de encerramento.";
  if (raw.includes("purpose-required")) return "Informe a finalidade do acesso.";
  if (raw.includes("file-size")) return "O arquivo deve ter até 10 MB.";
  if (raw.includes("storage-failed")) return "Não foi possível guardar ou abrir o arquivo. Tente novamente.";
  if (raw.includes("check constraint")) return "Preencha finalidade, texto e motivo (em correções).";
  return "Não foi possível concluir. Tente novamente.";
}
