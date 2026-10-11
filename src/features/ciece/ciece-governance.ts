/**
 * CIECE Lote 01 — governança do catálogo de dados.
 * Metadados (proprietário, writer, data de referência, linhagem) SOBRE o FACT_CATALOG existente:
 * não há segundo catálogo de fatos; cada tipo de fato precisa de exatamente uma entrada aqui.
 */
import { FACT_CATALOG } from "./fact-catalog";

export type ReferenceDateRule = "data-da-ocorrencia" | "vigencia-na-data" | "fechamento-do-periodo" | "fechamento-do-ciclo";

export type FactGovernance = {
  factTypeId: string;
  ownerSector: string;
  /** Writer canônico do setor dono; o CIECE nunca grava o fato. */
  writer: string;
  referenceDate: ReferenceDateRule;
  lineage: readonly string[];
};

const REF: Record<string, ReferenceDateRule> = { ocorrencia: "data-da-ocorrencia", vigencia: "vigencia-na-data", periodo: "fechamento-do-periodo", ciclo: "fechamento-do-ciclo" };

const OWNERS: Record<string, [string, string]> = {
  "frequencia-apurada-do-periodo": ["Docente/Secretaria", "record_attendance_closing"],
  "resultado-oficial-do-periodo": ["Docente/Secretaria", "record_period_closing_act"],
  "situacao-academica-oficial": ["Secretaria", "register_academic_standings"],
  "encerramento-da-turma-no-ciclo": ["Secretaria", "cycle_closing writer"],
  "episodio-de-enturmacao": ["Secretaria", "writers B3 de alocação"],
  "vinculo-escolar": ["Secretaria", "enrollment_draft_complete"],
  "evento-de-movimentacao": ["Secretaria", "record_student_movement"],
  "identidade-cadastral-do-estudante": ["Secretaria", "student identity writer"],
  "organizacao-da-oferta-da-turma": ["Secretaria/Rede", "record_class_offering_version"],
  "turno-da-turma": ["Secretaria", "class shift writer"],
  "episodio-de-atuacao": ["Administração", "engagement writer"],
  "episodio-de-lotacao": ["DP administrativo", "functional-record writers"],
  "alteracao-funcional": ["DP administrativo", "functional-record writers"],
  "visita-institucional": ["Escola", "visit-record writer"],
};

export const FACT_GOVERNANCE: readonly FactGovernance[] = FACT_CATALOG.map((d) => {
  const o = OWNERS[d.factTypeId];
  return { factTypeId: d.factTypeId, ownerSector: o?.[0] ?? "", writer: o?.[1] ?? "", referenceDate: REF[d.temporal]!, lineage: [d.sourceId, "fact-loader", "indicator-engine", "analytic-boundary"] };
});

/** Problemas de governança: tipo sem dono/writer ou fonte não persistida usada como canônica. */
export function governanceProblems(): string[] {
  const out: string[] = [];
  for (const g of FACT_GOVERNANCE) if (!g.ownerSector || !g.writer) out.push(`${g.factTypeId}: sem proprietário/writer`);
  for (const d of FACT_CATALOG) if (d.sourceStatus !== "persistida") out.push(`${d.factTypeId}: fonte futura`);
  return out;
}

export type TraceRow = { section: string; source: string; owner: string; permission: string; route: string | null; test: string; status: "entregue" | "parcial" | "bloqueado" };

/** Rastreabilidade das 11 seções do documento de decisões da Estatística (o de 41 seções não está no projeto). */
export const CIECE_TRACE: readonly TraceRow[] = [
  { section: "1 Papel do login de Estatística", source: "effective_capabilities", owner: "Administração", permission: "capability de rede", route: "/ciece", test: "analytic-boundary.test.ts", status: "parcial" },
  { section: "2 Mapa Estatístico", source: "map_competence_rules + motor 14.2", owner: "Estatística", permission: "officialize_statistical_map", route: "/mapa-estatistico", test: "statistical-map/*.test.ts", status: "entregue" },
  { section: "3 Censo/Educacenso/INEP", source: "census_snapshots, educacenso_*", owner: "Estatística", permission: "preparar-censo-escolar", route: "/educacenso", test: "educacenso/*.test.ts", status: "parcial" },
  { section: "4 GPE/SGP", source: "nenhuma (contrato ausente)", owner: "Rede", permission: "—", route: null, test: "data-import (EXTERNAL_INTEGRATION_UNDEFINED)", status: "bloqueado" },
  { section: "5 Importações", source: "stage_import_batch", owner: "Estatística", permission: "por adaptador", route: "/importacoes", test: "data-import/*.test.ts", status: "entregue" },
  { section: "6 Planilha Matriz da rede", source: "staging governado", owner: "Estatística", permission: "por adaptador", route: "/importacoes", test: "data-import/*.test.ts", status: "parcial" },
  { section: "7 Relatórios", source: "report-engine / report_custom_query", owner: "Estatística", permission: "ACL do reader", route: "/relatorios", test: "reports/*.test.ts", status: "entregue" },
  { section: "8 Auditoria e segurança", source: "ledgers append-only", owner: "Administração", permission: "RLS", route: "/qualidade-dos-dados", test: "audit/*.test.ts", status: "entregue" },
  { section: "9 Outros pedidos", source: "—", owner: "—", permission: "—", route: null, test: "—", status: "parcial" },
  { section: "10 Condução do trabalho", source: "AGENTS.md", owner: "—", permission: "—", route: null, test: "ciece-governance.test.ts", status: "entregue" },
  { section: "11 Pendências do setor", source: "—", owner: "Rede", permission: "—", route: null, test: "—", status: "bloqueado" },
];
