// AG — Censo Escolar: tipos e projeções puras sobre os readers do banco.
// Nada aqui calcula fato nem regra oficial; ausência é desconhecida, nunca zero.

export const EDUCACENSO_LAYOUT_STATUS = "EDUCACENSO_LAYOUT — BLOCKED_BY_OFFICIAL_SOURCE";

export const STAGES = ["preparacao", "validacao", "pendencias", "conferencia", "snapshot"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  preparacao: "Preparação", validacao: "Validação", pendencias: "Pendências", conferencia: "Conferência", snapshot: "Fotografia fechada",
};
export function nextStage(current: Stage | undefined): Stage | null {
  const i = current ? STAGES.indexOf(current) : -1;
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1]! : null;
}

export interface Measure { value: number | null; reason: string | null; proven?: number; unknown?: number }
export interface SnapshotContent {
  schema: string; academic_year_id: string; reference_date: string; rule_set: string;
  schools: { school_id: string; active: boolean; measures: Record<string, Measure> }[];
  findings: { rule: string; rule_version: number; school_id: string; count: number }[];
  domains_unavailable: { domain: string; reason: string }[];
}
export interface CycleView {
  id: string; academic_year_id: string; nature: "observado-importado" | "nativo"; reference_date: string; created_at: string;
  events: { seq: number; stage: Stage; snapshot_id: string | null; fingerprint: string | null; reason: string; created_at: string }[];
  snapshots: { id: string; version: number; supersedes_id: string | null; fingerprint: string; reason: string | null; created_at: string; current: boolean; conferences: number }[];
  imports: { id: string; origin: string; edition_layout: string; parser: string; source_sha256: string; accepted: number; rejections: { row: number; reason: string }[]; created_at: string }[];
}
export interface CompareRow { school_id: string; measure: string; sigem_value: number | null; sigem_reason: string | null; source_value: number | null; category: string }

export const MEASURE_LABEL: Record<string, string> = {
  vinculos_ativos: "Vínculos ativos", turmas: "Turmas", enturmacoes_vigentes: "Enturmações vigentes",
  posicoes_curriculares: "Posições curriculares", lotacoes_profissionais: "Lotações profissionais",
};
const REASON: Record<string, string> = {
  "inicio-efetivo-nao-declarado": "há vínculos sem início efetivo declarado",
  "vinculos-sem-inicio-efetivo": "vínculos sem início efetivo; enturmação não pode ser provada",
  "sem-enturmacao-vigente": "sem enturmação vigente",
};
export const reasonLabel = (r: string | null) => (r ? REASON[r] ?? r : "");
export function measureText(m: Measure | undefined): string {
  if (!m) return "não disponível";
  if (m.value === null) return `desconhecido (${reasonLabel(m.reason)}${m.proven !== undefined ? `; ${m.proven} comprovados, ${m.unknown} sem início` : ""})`;
  return String(m.value);
}

export const RULE_LABEL: Record<string, string> = {
  "vinculo-sem-inicio-efetivo": "Vínculo sem início efetivo declarado",
  "vinculo-ambiguo-no-ano": "Estudante com mais de um vínculo ativo na escola",
  "enturmacao-antes-do-vinculo": "Enturmação anterior ao início do vínculo",
  "enturmacao-com-vinculo-encerrado": "Enturmação vigente com vínculo encerrado",
  "enturmacao-em-turma-de-outra-escola-ou-ano": "Enturmação em turma inexistente, de outra escola ou de outro ano",
  "enturmacao-simultanea": "Mais de uma enturmação vigente no mesmo vínculo",
  "vinculo-em-escola-sem-cadastro-vigente": "Vínculo em escola sem cadastro ativo vigente",
};
export const ruleLabel = (r: string) => RULE_LABEL[r] ?? r;

export const CATEGORY_LABEL: Record<string, string> = {
  igual: "Igual", divergente: "Divergente", "ausente-no-sigem": "Ausente no SIGEM", "ausente-na-fonte": "Ausente na fonte", "nao-comparavel": "Não comparável",
};
export function summarizeCompare(rows: CompareRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.category] = (out[r.category] ?? 0) + 1;
  return out;
}

/** Cobertura: quantas medidas da fotografia são conhecidas (valor provado) × desconhecidas. */
export function coverage(c: SnapshotContent): { known: number; unknown: number } {
  let known = 0, unknown = 0;
  for (const s of c.schools) for (const m of Object.values(s.measures)) (m.value === null ? unknown++ : known++);
  return { known, unknown };
}

const MSG: [RegExp, string][] = [
  [/session-required/, "Entre com sua conta institucional."],
  [/not-authorized|not-found/, "Sem permissão ou registro não encontrado."],
  [/natural-person-required/, "O ato exige conta ligada a uma pessoa natural."],
  [/stale/, "Outra pessoa alterou o ciclo. Recarregue e tente de novo."],
  [/snapshot-outdated/, "Os fatos mudaram depois desta fotografia. Gere uma nova versão e confira de novo."],
  [/snapshot-unchanged/, "Os fatos não mudaram; não há nova versão a gerar."],
  [/fingerprint-mismatch/, "A impressão digital não corresponde à fotografia."],
  [/segregation-required/, "Quem gerou ou conferiu a fotografia não pode praticar este ato."],
  [/conference-required/, "A fotografia vigente ainda não foi conferida."],
  [/snapshot-required/, "Gere a fotografia antes desta etapa."],
  [/transition-invalid/, "Etapa fora de ordem."],
  [/homologation-rule-missing/, "Não há regra ou competência homologada para homologar o Censo."],
  [/cycle-closed/, "A fotografia do ciclo já foi fechada."],
  [/cycle-exists/, "Já existe ciclo para este ano."],
  [/reference-outside-year/, "A data de referência está fora do ano letivo."],
  [/official-layout-not-homologated/, "Layout oficial do Educacenso ainda não homologado; arquivo recusado."],
  [/parser-not-registered/, "Formato de arquivo não registrado."],
  [/reason-required|arguments-required/, "Preencha os campos obrigatórios e o motivo."],
];
export const censusMessage = (raw: string) => MSG.find(([r]) => r.test(raw))?.[1] ?? "Não foi possível concluir. Nada foi gravado.";
