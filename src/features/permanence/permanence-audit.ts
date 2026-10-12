/**
 * SIGEM Permanência — Lote 01: auditoria de Busca Ativa e Permanência Escolar.
 * Mapeia 41 seções + 18 critérios sobre o que JÁ existe (Diário/frequência oficial,
 * matrícula/enturmação B3, calendário aplicável, casos de busca ativa do AA 0374,
 * notificações, tarefas, família). Nada aqui cria segunda fonte: lacunas apontam a
 * estrutura a ESTENDER. Busca Ativa Escolar nacional (UNICEF/Undime) NÃO está
 * integrada: status externo nunca é presumido. Status "homologado" não existe.
 */
export type PermStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface PermRow { n: number; title: string; status: PermStatus; source: string[]; evidence: string[]; gap: string }

const M = "supabase/migrations";
const D = "drizzle/migrations";
const EI = "src/features/educational-intelligence";

/** Fontes canônicas — a Permanência só LÊ estas; nunca copia. */
export const CANONICAL_PERMANENCE_SOURCES = {
  frequencia: { tables: ["attendance_record_versions", "attendance_closing_versions", "attendance_closing_events"], reader: "aa_infrequency_at", migration: `${M}/20260929015103_a49e94a6-98b2-4384-8f5b-a647d068de3c.sql`, note: "Chamada oficial do Diário; aula sem marcação nunca vira falta." },
  politicaFrequencia: { tables: ["attendance_calculation_policies", "attendance_occurrence_types"], reader: "require_homologated_attendance_policy", migration: `${M}/20260929015643_558a08f4-2edc-4604-b248-11d657b9f296.sql`, note: "Limiar de infrequência só com política homologada." },
  matricula: { tables: ["school_enrollments", "school_enrollment_endings", "student_movement_events"], reader: "active_enrollments_at", migration: `${M}/20260929034657_33ccdb60-d883-4f4e-b63c-16fe0cd5a8e2.sql`, note: "Matrícula ≠ enturmação ≠ movimentação." },
  enturmacao: { tables: ["class_enrollment_episodes", "class_enrollment_episode_endings"], reader: "class_allocations_at", migration: `${M}/20260929020412_bb1f1e39-e00e-40e8-944b-d96be6f46925.sql`, note: "Vigência da enturmação delimita o denominador." },
  calendario: { tables: ["calendar_versions", "calendar_version_day_assignments"], reader: "calendário aplicável único (Supervisão)", migration: `${D}/0023_b4_6_1_calendar_structure.sql`, note: "Dia letivo só do calendário aplicável; sem calendário, sem prazo útil." },
  buscaAtivaLocal: { tables: ["aa_outreach_cases", "aa_outreach_events"], reader: "aa_open_outreach_case / aa_record_outreach_event", migration: `${D}/0374_aa_infrequency_outreach.sql`, note: "Caso de busca ativa já existe (AA); a Permanência estende, não duplica." },
  intervencao: { tables: ["aa_intervention_versions", "aa_intervention_events"], reader: "aa_record_intervention", migration: `${D}/0369_aa_pedagogical_interventions.sql`, note: "Intervenção pedagógica do AA." },
  familia: { tables: ["guardian_authorizations"], reader: "autorização vigente por seção", migration: `${D}/0069_family_portal_authorizations.sql`, note: "Contato com família só com autorização vigente." },
  notificacoes: { tables: ["notification_events"], reader: "emit_notification_event", migration: `${D}/0077_notifications_infrastructure.sql`, note: "Sem provedor externo: entrega simulada é proibida." },
  tarefas: { tables: ["operational_tasks"], reader: "create_operational_task", migration: `${D}/0095_operational_tasks.sql`, note: "Providência vira tarefa da central única." },
  transicaoAnual: { tables: ["year_transition_decisions"], reader: "record_year_transition_decision", migration: `${D}/0113_0113_s2_s4_year_transition_exact_lookup.sql`, note: "Não renovação é pendência, nunca evasão presumida." },
} as const;

/** Nomes que indicariam fonte paralela de frequência/caso/matrícula. */
export const FORBIDDEN_DUPLICATE_TABLES = ["frequencias", "faltas", "attendance", "busca_ativa", "busca_ativa_casos", "permanence_cases", "evasoes", "student_absences"] as const;

/** Busca Ativa Escolar nacional: nenhuma integração encontrada; status externo nunca é inferido. */
export const NATIONAL_BAE = {
  integrated: false,
  found: [] as string[],
  requirement: "Integração exige termo de adesão municipal, credencial institucional, contrato de dados e decisão da autoridade competente; até lá, status nacional = 'não consultado'.",
  statusWhenAbsent: "nao-consultado" as const,
};

const S = (n: number, title: string, status: PermStatus, source: string[], evidence: string[], gap = ""): PermRow => ({ n, title, status, source, evidence, gap });
const SRC = CANONICAL_PERMANENCE_SOURCES;

export const PERM_SECTIONS: readonly PermRow[] = [
  S(1, "Objetivo e princípios da permanência", "existente", [], ["src/features/permanence/AGENTS.md"]),
  S(2, "Fonte canônica de frequência", "existente", [...SRC.frequencia.tables], [SRC.frequencia.migration]),
  S(3, "Política de cálculo de frequência", "parcial", [...SRC.politicaFrequencia.tables], [SRC.politicaFrequencia.migration], "Nenhuma política de cálculo homologada."),
  S(4, "Matrícula como fonte única", "existente", [...SRC.matricula.tables], [SRC.matricula.migration]),
  S(5, "Enturmação e vigência", "existente", [...SRC.enturmacao.tables], [SRC.enturmacao.migration]),
  S(6, "Calendário letivo aplicável", "existente", [...SRC.calendario.tables], [SRC.calendario.migration]),
  S(7, "Infrequência por período e acumulada", "existente", ["aa_infrequency_at"], [`${EI}/infrequency-source.ts`, `${EI}/infrequency-source.test.ts`]),
  S(8, "Limiares e sinais de alerta", "bloqueado", [], [], "Limiar de infrequência não homologado pela rede."),
  S(9, "Faltas consecutivas", "lacuna", ["attendance_record_versions"], [], "Projeção de sequência sobre chamadas oficiais (L03)."),
  S(10, "Aulas sem marcação", "existente", ["aa_infrequency_at"], [`${EI}/infrequency-source.ts`]),
  S(11, "Justificativas e ocorrências", "parcial", ["attendance_occurrence_types"], [SRC.politicaFrequencia.migration], "Tipos de ocorrência não homologados."),
  S(12, "Abertura de caso de busca ativa", "existente", [...SRC.buscaAtivaLocal.tables], [SRC.buscaAtivaLocal.migration]),
  S(13, "Etapas do procedimento municipal", "parcial", ["aa_outreach_events"], ["src/features/school-management/attendance-permanence.ts"], "Procedimento municipal oficial não registrado como norma."),
  S(14, "Responsáveis e competências por etapa", "bloqueado", [], [], "Competências por etapa não atribuídas na política."),
  S(15, "Contato com a família", "parcial", [...SRC.familia.tables], [SRC.familia.migration], "Canal externo sem provedor."),
  S(16, "Visita domiciliar", "lacuna", [], [], "Registro de visita sem endereço em claro (L08)."),
  S(17, "Encaminhamento à rede de proteção", "bloqueado", [], [], "Fluxo com Conselho Tutelar sem norma/convênio registrado."),
  S(18, "Conselho Tutelar e Ministério Público", "bloqueado", [], [], "Sem integração nem decisão institucional."),
  S(19, "Assistência social e saúde", "bloqueado", [], [], "Sem convênio/compartilhamento autorizado."),
  S(20, "Intervenção pedagógica", "existente", [...SRC.intervencao.tables], [SRC.intervencao.migration]),
  S(21, "Plano individual de permanência", "lacuna", [], [], "Estender caso AA com plano versionado (L10)."),
  S(22, "Monitoramento e retorno", "parcial", ["aa_outreach_events"], [SRC.buscaAtivaLocal.migration], "Retorno exige frequência posterior lida."),
  S(23, "Encerramento do caso", "parcial", ["aa_outreach_events"], [SRC.buscaAtivaLocal.migration], "Motivos de encerramento não homologados."),
  S(24, "Evasão e abandono (nunca presumidos)", "bloqueado", [], [], "Classificação só por situação oficial/norma; nenhuma regra homologada."),
  S(25, "Transferência e movimentação", "existente", [...SRC.matricula.tables], [SRC.matricula.migration]),
  S(26, "Não renovação na transição anual", "existente", [...SRC.transicaoAnual.tables], [SRC.transicaoAnual.migration]),
  S(27, "Fora da escola / demanda não matriculada", "lacuna", [], [], "Sem fonte territorial autorizada."),
  S(28, "Busca Ativa Escolar nacional", "bloqueado", [], [], NATIONAL_BAE.requirement),
  S(29, "Notificações e avisos", "parcial", [...SRC.notificacoes.tables], [SRC.notificacoes.migration], "Sem provedor externo."),
  S(30, "Tarefas e prazos", "parcial", [...SRC.tarefas.tables], [SRC.tarefas.migration], "Prazos só com norma."),
  S(31, "Painel da escola", "parcial", [], [`${EI}/attendance-panel.tsx`], "Painel de permanência dedicado (L20)."),
  S(32, "Painel da rede", "lacuna", [], [], "Agregado com supressão declarada (L21)."),
  S(33, "Relatórios", "lacuna", [], [], "Catálogo de relatórios (L22)."),
  S(34, "Indicadores", "bloqueado", [], [], "Fórmulas e limiares não homologados."),
  S(35, "Perfis e capacidades", "parcial", [], ["src/features/educational-intelligence/aa-architecture.ts"], "Proposta de capacidades sem política homologada."),
  S(36, "RLS e escopo por escola", "existente", [...SRC.buscaAtivaLocal.tables], [SRC.buscaAtivaLocal.migration]),
  S(37, "LGPD e minimização", "existente", [], ["src/features/privacy/data-inventory.ts"]),
  S(38, "Dados sensíveis (saúde, violência)", "parcial", [], [], "Campos sensíveis do caso exigem anexo restrito (L18)."),
  S(39, "Auditoria e trilha", "existente", ["aa_outreach_events"], [SRC.buscaAtivaLocal.migration]),
  S(40, "Executor técnico restrito", "existente", [], ["src/features/permanence/permanence-executor.ts"]),
  S(41, "Testes, evidências e fechamento", "parcial", [], ["src/features/permanence/permanence-audit.test.ts"], "E2E autenticado pendente (L24)."),
];

export const PERM_CRITERIA: readonly PermRow[] = [
  S(1, "Frequência só da chamada oficial", "existente", [...SRC.frequencia.tables], [SRC.frequencia.migration]),
  S(2, "Ausência de marcação nunca vira falta", "existente", ["aa_infrequency_at"], [`${EI}/infrequency-source.ts`]),
  S(3, "Denominador limitado à vigência da enturmação", "existente", [...SRC.enturmacao.tables], [`${EI}/infrequency-source.ts`]),
  S(4, "Alerta só com limiar homologado", "bloqueado", [], [], "Limiar não homologado."),
  S(5, "Caso não duplica matrícula/frequência", "existente", [...SRC.buscaAtivaLocal.tables], [SRC.buscaAtivaLocal.migration]),
  S(6, "Evasão nunca inferida de ausência", "existente", [], ["src/features/permanence/permanence-executor.ts"]),
  S(7, "Autor humano real em cada ato", "existente", ["aa_outreach_events"], [SRC.buscaAtivaLocal.migration]),
  S(8, "Etapas na ordem do procedimento registrado", "parcial", [], ["src/features/school-management/attendance-permanence.ts"], "Procedimento oficial não registrado."),
  S(9, "Contato com família só autorizado", "existente", [...SRC.familia.tables], [SRC.familia.migration]),
  S(10, "Entrega externa nunca simulada", "existente", [...SRC.notificacoes.tables], [SRC.notificacoes.migration]),
  S(11, "Rede de proteção só com norma/convênio", "bloqueado", [], [], "Sem convênio."),
  S(12, "Status BAE nacional nunca presumido", "existente", [], ["src/features/permanence/permanence-audit.ts"]),
  S(13, "Escola vê só os próprios casos", "existente", [...SRC.buscaAtivaLocal.tables], [SRC.buscaAtivaLocal.migration]),
  S(14, "Rede vê agregado com supressão", "bloqueado", [], [], "Limiar de supressão não definido."),
  S(15, "Dado sensível minimizado", "parcial", [], ["src/features/privacy/data-inventory.ts"], "Anexo restrito do caso (L18)."),
  S(16, "Executor técnico idempotente e fail-closed", "existente", [], ["src/features/permanence/permanence-executor.ts", "src/features/permanence/permanence-executor.test.ts"]),
  S(17, "Relatórios com fonte e data de referência", "lacuna", [], [], "L22."),
  S(18, "Evidência SQL/TS/E2E", "parcial", [], ["src/features/permanence/permanence-audit.test.ts"], "E2E autenticado pendente."),
];

export const permAuditSummary = (rows: readonly PermRow[]) =>
  rows.reduce<Record<PermStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function permAuditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const p: string[] = [];
  if (PERM_SECTIONS.length !== 41) p.push("Esperadas 41 seções.");
  if (PERM_CRITERIA.length !== 18) p.push("Esperados 18 critérios.");
  for (const r of [...PERM_SECTIONS, ...PERM_CRITERIA]) {
    for (const e of r.evidence) if (!exists(e)) p.push(`#${r.n} evidência ausente: ${e}`);
    for (const t of r.source) if (!tableKnown(t)) p.push(`#${r.n} fonte desconhecida: ${t}`);
    if ((r.status === "bloqueado" || r.status === "lacuna" || r.status === "parcial") && !r.gap) p.push(`#${r.n} sem lacuna declarada`);
  }
  return p;
}
