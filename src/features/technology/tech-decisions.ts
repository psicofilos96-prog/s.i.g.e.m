/**
 * Lote corretivo 13 — as 7 decisões institucionais que bloqueiam relatórios de Tecnologia (`TECH_REPORTS.dependency`).
 * Cada decisão é proposta e aprovada por writers versionados (pessoa ≠ autor revalidada no banco); 4 reusam os ledgers
 * de 0480/0483/0486/0493 e 3 usam `tech_parameter_versions` (0500). Nada é semeado nem auto-homologado: a tela
 * só propõe; aprovar é ato separado de outra pessoa com capability própria.
 */
import type { ActionField, OperationAction, OperationStage } from "@/features/enrollments/enrollment-operations";
import { TECH_STAGES } from "./tech-operations";
import { TECH_REPORTS } from "./tech-reports";

const action = (id: string): OperationAction => {
  for (const s of TECH_STAGES) { const a = s.actions.find((x) => x.id === id); if (a) return a; }
  throw new Error(`tech-decisions: ação ${id} ausente`);
};
const t = (arg: string, label: string, hint?: string): ActionField => ({ arg, label, kind: "text", ...(hint ? { hint } : {}) });

export type ParameterKey = "vida-util-de-equipamento" | "limiar-de-supressao-do-mapa" | "minimo-de-respostas-do-autosservico";
const PARAM_UNIT: Record<ParameterKey, string> = { "vida-util-de-equipamento": "meses", "limiar-de-supressao-do-mapa": "escolas", "minimo-de-respostas-do-autosservico": "respostas" };

const paramStage = (dependency: string, key: ParameterKey, title: string, summary: string): TechDecision => ({
  dependency, title, ledger: "tech_parameter_versions",
  stage: {
    id: dependency, title, summary,
    reads: [
      { label: "Versões propostas", table: "tech_parameter_versions", columns: ["id", "parameter_key", "version", "value_int", "unit", "source", "created_at"], order: "created_at", eq: { parameter_key: key } },
      { label: "Aprovações", table: "tech_parameter_approvals", columns: ["parameter_version_id", "decision", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: `propor-${key}`, label: "Propor versão", rpc: "record_tech_parameter", keyArg: "_key", fixed: { _parameter: key }, fields: [
        { arg: "_expected", label: "Versão esperada (última lida)", kind: "int", hint: "0 quando ainda não há versão" },
        { arg: "_value", label: `Valor (${PARAM_UNIT[key]})`, kind: "int" },
        { ...t("_scope_note", "Alcance (opcional)"), optional: true }, t("_source", "Fonte normativa ou decisão"), { ...t("_reason", "Justificativa (obrigatória a partir da v2)"), optional: true },
      ] },
      { id: `aprovar-${key}`, label: "Aprovar versão (outra pessoa)", rpc: "approve_tech_parameter", fields: [{ arg: "_version", label: "Versão", kind: "uuid" }, t("_decision", "Decisão")] },
    ],
  },
});

export interface TechDecision { dependency: string; title: string; ledger: string; stage: OperationStage }

export const TECH_DECISIONS: readonly TechDecision[] = [
  { dependency: "politica-sla-aprovada", title: "Política de SLA", ledger: "tech_sla_policy_versions", stage: {
    id: "politica-sla-aprovada", title: "Política de SLA", summary: "Matriz impacto × urgência, prazos e alertas. Vale só a última versão aprovada por pessoa ≠ autor.",
    reads: [
      { label: "Versões", table: "tech_sla_policy_versions", columns: ["id", "version", "source", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_sla_policy_approvals", columns: ["policy_version_id", "decision", "created_at"], order: "created_at" },
    ], actions: [action("politica"), action("aprovar")] } },
  { dependency: "regra-de-recorrencia-aprovada", title: "Regra de recorrência", ledger: "tech_recurrence_rule_versions", stage: {
    id: "regra-de-recorrencia-aprovada", title: "Regra de recorrência", summary: "Janela em dias e mínimo de incidentes para candidato a problema.",
    reads: [
      { label: "Versões", table: "tech_recurrence_rule_versions", columns: ["id", "version", "window_days", "min_incidents", "source", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_recurrence_rule_approvals", columns: ["rule_version_id", "decision", "created_at"], order: "created_at" },
    ], actions: [action("recorrencia"), action("aprovar-recorrencia")] } },
  { dependency: "categoria-tecnologica-aprovada", title: "Categorias patrimoniais de tecnologia", ledger: "tech_equipment_category_marks", stage: {
    id: "categoria-tecnologica-aprovada", title: "Categorias patrimoniais de tecnologia", summary: "Quais categorias do patrimônio contam como equipamento de tecnologia.",
    reads: [
      { label: "Marcas", table: "tech_equipment_category_marks", columns: ["id", "seq", "category_key", "action", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_equipment_category_mark_approvals", columns: ["mark_id", "decision", "created_at"], order: "created_at" },
    ], actions: [action("marcar"), action("aprovar-marca")] } },
  paramStage("regra-de-vida-util-aprovada", "vida-util-de-equipamento", "Vida útil de equipamento", "Prazo em meses a partir do qual o equipamento é sinalizado como em fim de vida."),
  paramStage("limiar-de-supressao-aprovado", "limiar-de-supressao-do-mapa", "Limiar de supressão do mapa", "Número mínimo de escolas por agrupamento para exibir o mapa de conectividade."),
  paramStage("minimo-de-respostas-declarado", "minimo-de-respostas-do-autosservico", "Mínimo de respostas do autosserviço", "Número mínimo de retornos para exibir taxa de resolução do conhecimento técnico."),
  { dependency: "rubrica-aprovada", title: "Rubrica de recursos pedagógicos", ledger: "tech_pedagogical_rubric_versions", stage: {
    id: "rubrica-aprovada", title: "Rubrica de recursos pedagógicos", summary: "Critérios e escala para avaliar recursos pedagógicos digitais.",
    reads: [
      { label: "Versões", table: "tech_pedagogical_rubric_versions", columns: ["id", "version", "scale_max", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_pedagogical_rubric_approvals", columns: ["rubric_version_id", "created_at"], order: "created_at" },
    ], actions: [action("rubrica"), action("aprovar-rubrica")] } },
];

export const TECH_DECISION_STAGES: readonly OperationStage[] = TECH_DECISIONS.map((d) => d.stage);

/** Dependências declaradas nos relatórios que ainda não têm decisão registrável. */
export function uncoveredDependencies(): string[] {
  const covered = new Set(TECH_DECISIONS.map((d) => d.dependency));
  return [...new Set(TECH_REPORTS.flatMap((r) => (r.dependency ? [r.dependency] : [])))].filter((d) => !covered.has(d));
}
