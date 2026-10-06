/** BM.1 — catálogo de datasets e capabilities do setor Acompanhamento e Avaliação (sem concessão). */
import type { Dataset } from "./semantic-layer";

export const RESULTADOS_AVALIATIVOS: Dataset = {
  id: "resultados-avaliativos", version: 1, label: "Resultados avaliativos",
  source: "inst_assessment_results_at + performance_metrics_at (0075)", grain: "estudante × item × aplicação",
  dimensions: [
    { id: "program_id", label: "Programa" }, { id: "edition_id", label: "Edição" },
    { id: "school_id", label: "Escola" }, { id: "class_id", label: "Turma" }, { id: "item_id", label: "Item" },
    { id: "status", label: "Participação" }, { id: "student_id", label: "Estudante", sensitive: true },
  ],
  measures: [
    { id: "numeric_value", label: "Resultado numérico", unit: null, scaleKind: "numerico", nature: "observado", aggregations: ["media", "contagem", "soma"], scaleKey: "declarada-na-avaliacao" },
  ],
  joins: [
    { to: "matricula/alocacao", on: "student_id + data de referência", note: "via readers B3; sem cópia" },
    { to: "escola", on: "school_id", note: "versão cadastral vigente na data" },
    { to: "turma", on: "class_id", note: "class_at" },
    { to: "frequencia", on: "student_id + período", note: "cruzamento não é causa" },
  ],
  readCapability: "consultar-resultados-avaliativos",
};
export const DATASETS = [RESULTADOS_AVALIATIVOS] as const;

/** Capabilities preparadas. Nenhuma está na política homologada até configuração humana. */
export const EI_CAPABILITIES = [
  { id: "consultar-resultados-avaliativos", scope: "escola|rede", note: "agregado por padrão; estudante só com dimensão sensível explícita" },
  { id: "consultar-desempenho-educacional", scope: "escola|rede", note: "existente (0075)" },
  { id: "registrar-resultado-avaliacao-institucional", scope: "escola|rede", note: "existente (0075); importação pelo pipeline governado" },
  { id: "manter-avaliacao-institucional", scope: "rede", note: "existente (0075): instrumento/escala" },
  { id: "manter-metrica-desempenho", scope: "rede", note: "existente (0075): métrica, divulgação, meta" },
  { id: "manter-programa-avaliativo", scope: "rede", note: "programa e edição (0179)" },
  { id: "declarar-comparabilidade-avaliativa", scope: "rede", note: "comparable/not_comparable/unknown (0179)" },
  { id: "manter-painel-inteligencia", scope: "escola|rede", note: "painel pessoal/compartilhado/institucional (0179)" },
  { id: "definir-analise-avaliativa", scope: "rede", note: "só definição; sem execução (0179)" },
] as const;

export const EI_BLOCKERS = [
  { code: "CONTENT_SOURCE_PENDING", text: "Conteúdo oficial (SAEB/IDEB, AVALIA RJ, CAEd, Saber Ler, matrizes e descritores) ainda não importado." },
  { code: "ASSESSMENT_RULE_PENDING", text: "Escalas, faixas, metas e correspondências só entram quando fornecidas por fonte oficial ou homologadas." },
  { code: "REAL_ROLE_ASSIGNMENT_PENDING", text: "Nenhuma atuação recebeu as capabilities do setor; a política vigente precisa de nova versão homologada." },
] as const;
