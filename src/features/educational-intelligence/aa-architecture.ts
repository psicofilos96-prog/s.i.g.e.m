/**
 * Acompanhamento e Avaliação — Lote 01 SIGEM 2.0: auditoria e arquitetura (núcleo puro, nunca grava).
 * Mapa área → módulo/schema/tela/teste/estado sobre o que JÁ existe; papéis do setor como
 * PROPOSTA de capacidades (não autorizam até política homologada); fronteira institucional ×
 * cotidiana docente: o setor nunca grava Diário, nota, matrícula nem catálogo curricular.
 */
export type Status = "entregue" | "parcial" | "bloqueado";
export type Area = { id: string; title: string; module: string; schema: string[]; screen: string | null; test: string; owner: "aa" | "docente" | "secretaria" | "curriculo" | "op"; status: Status; blocker?: string };

export const AA_TRACE: Area[] = [
  { id: "programas", title: "Programas, edições e ciclo", module: "program-catalog.ts, assessment-cycle.ts", schema: ["assessment_program_versions", "assessment_edition_versions", "assessment_edition_cycle_events"], screen: "/acompanhamento-avaliacao", test: "assessment-cycle.test.ts", owner: "aa", status: "entregue" },
  { id: "calendario", title: "Calendário unificado de avaliações", module: "aa-calendar.ts", schema: ["aa_calendar_items", "aa_calendar_status_events"], screen: "/acompanhamento-avaliacao", test: "aa-calendar.test.ts", owner: "aa", status: "parcial", blocker: "cronograma 2026 enviado não importado como fonte homologada" },
  { id: "matrizes-regras", title: "Matrizes, pesos, faixas e fórmulas", module: "calc-rules.ts, methodology-rules.ts", schema: ["aa_calc_rule_versions", "aa_calc_rule_homologations"], screen: null, test: "calc-rules.test.ts", owner: "aa", status: "parcial", blocker: "nenhuma regra homologada" },
  { id: "correlacao", title: "Correlação BNCC × SAEB × AVALIA RJ", module: "matrix-skills.ts; curricular-reference", schema: ["curricular_reference_relations", "curricular_reference_correspondence_assessments"], screen: "/referencias-curriculares", test: "matrix-skills.test.ts", owner: "curriculo", status: "parcial", blocker: "matrizes AVALIA RJ 2026 (PDF) não registradas como edição" },
  { id: "saber-ler", title: "Saber Ler", module: "saber-ler.ts", schema: ["sl_instrument_versions"], screen: null, test: "saber-ler.test.ts", owner: "aa", status: "parcial", blocker: "rodada não homologada" },
  { id: "locais", title: "Diagnóstica, Formativa, Simula SAEB, Produção Textual", module: "local-assessments.ts", schema: ["lc_instrument_versions"], screen: null, test: "local-assessments.test.ts", owner: "aa", status: "parcial", blocker: "instrumentos não homologados" },
  { id: "externas", title: "SAEB, IDEB, AVALIA RJ, CNCA", module: "external-results.ts", schema: ["ext_result_versions", "ext_result_homologations"], screen: null, test: "external-results.test.ts", owner: "aa", status: "parcial", blocker: "resultados AVALIA RJ 2025 não lançados com escala do programa" },
  { id: "importacao", title: "Importação de planilhas de resultados", module: "result-import.ts", schema: ["aa_import_batches", "aa_import_rows", "aa_import_review_events"], screen: null, test: "result-import.test.ts", owner: "aa", status: "parcial" },
  { id: "infrequencia", title: "Infrequência e busca ativa", module: "infrequency-source.ts", schema: ["aa_outreach_cases", "aa_outreach_events"], screen: null, test: "infrequency-source.test.ts", owner: "aa", status: "parcial" },
  { id: "intervencao", title: "Intervenção pedagógica", module: "interventions.ts", schema: ["aa_intervention_versions", "aa_intervention_events"], screen: null, test: "interventions.test.ts", owner: "aa", status: "parcial" },
  { id: "ei", title: "Acompanhamento da Educação Infantil", module: "infant-followup.ts", schema: ["ei_followup_versions", "ei_feedback_events"], screen: null, test: "infant-followup.test.ts", owner: "aa", status: "parcial" },
  { id: "paineis", title: "Painéis e relatórios do setor", module: "semantic-layer.ts; reports/aa-report-sources.ts", schema: ["report_emissions"], screen: "/avaliacao-desempenho", test: "semantic-layer.test.ts", owner: "aa", status: "parcial", blocker: "limiar de supressão não definido" },
  { id: "sipe", title: "Planejamento docente (SIPE)", module: "teaching-planning", schema: ["teaching_plan_versions"], screen: "/acompanhamento-planejamento", test: "teaching-planning", owner: "docente", status: "entregue" },
  { id: "sia", title: "Avaliações do professor e cartão QR/OMR (SIA)", module: "teacher-assessment", schema: ["assessment_item_versions", "sia_card_corrections"], screen: "/avaliacoes-do-professor", test: "sia-scoring.test.ts", owner: "docente", status: "entregue" },
  { id: "revisao-op", title: "Envio de plano/prova à OP", module: "teacher-review", schema: ["teacher_work_review_events"], screen: null, test: "teacher-work-review.test.ts", owner: "op", status: "entregue" },
  { id: "diario-notas", title: "Pauta, fechamento e situação (Diário)", module: "assessment", schema: ["assessment_entry_versions", "academic_standing_versions"], screen: "/diario", test: "assessment", owner: "docente", status: "entregue" },
  { id: "matriculas", title: "Estudantes e enturmação", module: "students/institutional-roster.ts", schema: ["class_enrollment_episodes"], screen: null, test: "institutional-roster", owner: "secretaria", status: "entregue" },
];

/** O setor lê fatos de outros donos; escrita só no que é próprio. */
export function canAAWrite(areaId: string): { ok: boolean; reason?: string } {
  const a = AA_TRACE.find((x) => x.id === areaId);
  if (!a) return { ok: false, reason: "area-desconhecida" };
  return a.owner === "aa" ? { ok: true } : { ok: false, reason: `dono-${a.owner}:aa-so-le` };
}

export type Kind = "institucional" | "cotidiana-docente";
/** Institucional = programa/edição da rede; cotidiana = instrumento do professor na sua regência. Nunca se misturam. */
export function classifyAssessment(x: { programId?: string | null; editionId?: string | null; teacherAssignmentId?: string | null }): Kind | { refused: string } {
  const inst = !!(x.programId && x.editionId), daily = !!x.teacherAssignmentId;
  if (inst && daily) return { refused: "ambigua:programa-e-regencia" };
  if (inst) return "institucional";
  if (daily) return "cotidiana-docente";
  return { refused: "sem-origem" };
}

export type AARole = "coordenacao" | "equipe" | "analista" | "aplicador";
export const AA_ROLE_PROPOSAL: Record<AARole, { capabilities: string[]; scope: "rede" | "escola"; note: string }> = {
  coordenacao: { capabilities: ["gerir-programas-avaliativos", "homologar-regra-de-calculo", "acompanhar-infrequencia", "exportar-acompanhamento"], scope: "rede", note: "homologa por outra pessoa; não lança" },
  equipe: { capabilities: ["gerir-programas-avaliativos", "importar-resultados-avaliativos", "acompanhar-infrequencia"], scope: "rede", note: "prepara e importa" },
  analista: { capabilities: ["consultar-resultados-avaliativos", "registrar-intervencao-pedagogica"], scope: "rede", note: "lê agregado e propõe intervenção" },
  aplicador: { capabilities: ["aplicar-avaliacao-institucional"], scope: "escola", note: "só na escola e edição designadas; não vê resultado nominal de outra escola" },
};
/** Perfil não concede nada sem política homologada; o autor nunca homologa o próprio. */
export function roleGrants(role: AARole, policyHomologated: boolean) { return policyHomologated ? AA_ROLE_PROPOSAL[role].capabilities : []; }

export const traceSummary = () => AA_TRACE.reduce((s, a) => ({ ...s, [a.status]: (s[a.status] ?? 0) + 1 }), {} as Partial<Record<Status, number>>);
