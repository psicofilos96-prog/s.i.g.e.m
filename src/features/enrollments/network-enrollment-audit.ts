/**
 * Organização da Rede, Matrículas e Vagas — Lote 01: auditoria e fonte única.
 * 42 seções + 20 critérios → tabela canônica, núcleo, tela, teste, status e lacuna.
 * Não cria entidade acadêmica: só aponta para as existentes. Status "homologado" não existe:
 * nenhuma aprovação humana é afirmada pelo código.
 * Títulos agrupados por tema; a numeração deve ser conferida com o documento do usuário.
 */
export type NetAuditStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface NetAuditRow { n: number; title: string; status: NetAuditStatus; tables: string[]; evidence: string[]; gap: string }

const SS = "src/features/school-secretariat";
const ST = "src/features/students";
const CL = "src/features/classes";
const R = "src/routes";
const M = "drizzle/migrations";
const r = (n: number, title: string, status: NetAuditStatus, gap: string, tables: string[] = [], evidence: string[] = []): NetAuditRow =>
  ({ n, title, status, gap, tables, evidence });

/** Entidades acadêmicas canônicas: toda tela/motor do domínio lê só estas. */
export const CANONICAL_ENTITIES = {
  escola: "institutional_schools",
  pessoa: "institutional_persons",
  estudante: "institutional_students",
  matriculaEscolar: "school_enrollments",
  participacaoNoCiclo: "cycle_participations",
  enturmacao: "class_enrollment_episodes",
  turma: "institutional_classes",
  capacidade: "class_capacity_records",
  movimentacao: "student_movement_events",
  responsavel: "guardian_authorizations",
} as const;

/** Nomes que, se aparecerem como tabela nova, duplicariam entidade acadêmica. */
export const FORBIDDEN_DUPLICATES = ["students", "enrollments", "matriculas", "alunos", "classes", "turmas", "schools", "escolas", "vagas", "class_allocations"] as const;

export const NET_SECTIONS: readonly NetAuditRow[] = [
  r(1, "Finalidade", "parcial", "Secretaria, Turmas, Enturmações e Transferências existem; sem visão de rede de matrículas e vagas.", [], [`${R}/secretaria.tsx`, `${R}/matriculas.tsx`]),
  r(2, "Objetivos", "parcial", "Matrícula e enturmação operam; demanda/fila de espera e planejamento de vagas de rede ausentes.", [], [`${SS}/vacancy-center.ts`]),
  r(3, "Princípios: fonte única", "existente", "", Object.values(CANONICAL_ENTITIES), [`${ST}/institutional-roster.ts`, `${ST}/institutional-chain.test.ts`]),
  r(4, "Conceitos fundamentais", "existente", "", ["school_enrollments", "cycle_participations", "class_enrollment_episodes"], [`${M}/0001_b3_cycle_enrollment_participation_allocation.sql`]),
  r(5, "Perfis e competências", "parcial", "Capacidades da Secretaria escolar existem; perfis de rede (central de matrículas) sem política homologada.", [], [`${SS}/secretariat-competences.test.ts`]),
  r(6, "Organização da rede (escolas)", "existente", "", ["institutional_schools"], [`${R}/escolas.tsx`]),
  r(7, "Território e zoneamento", "parcial", "Catálogo territorial existe; zoneamento escola×território sem regra homologada.", ["territorial_districts"], ["src/features/territory/territory-catalog.test.ts"]),
  r(8, "Infraestrutura e capacidade física", "parcial", "Infraestrutura registrada; ligação sala→capacidade de turma não derivada.", [], ["src/features/schools/school-infrastructure.test.ts"]),
  r(9, "Oferta educacional por escola", "existente", "", ["class_offering_versions"], ["src/features/offer-organization/offer-model.test.ts"]),
  r(10, "Turmas", "existente", "", ["institutional_classes"], [`${CL}/classes-routes.test.tsx`, `${R}/turmas.tsx`]),
  r(11, "Turnos", "existente", "", ["class_shift_versions"], [`${CL}/class-offering-shift.test.ts`]),
  r(12, "Composição/multisseriação", "existente", "", ["class_composition_versions"], [`${CL}/class-composition-projection.test.ts`]),
  r(13, "Capacidade de turma", "existente", "", ["class_capacity_records"], [`${SS}/vacancies-book.test.ts`]),
  r(14, "Cadastro da pessoa", "existente", "", ["institutional_persons", "student_identity_versions"], [`${ST}/person-workspace.test.tsx`]),
  r(15, "Papel de estudante", "existente", "", ["institutional_students"], [`${ST}/student-record.test.ts`]),
  r(16, "Responsáveis", "parcial", "Autorizações versionadas; tela de rede do vínculo responsável limitada.", ["guardian_authorizations"], ["src/features/family-portal"]),
  r(17, "Deduplicação de estudantes", "parcial", "Revisão de identidade existe; nunca por nome sozinho; sem fila de rede unificada.", ["identity_link_reviews"], []),
  r(18, "Matrícula escolar", "existente", "", ["school_enrollments"], [`${SS}/enrollment-flow.test.ts`, `${R}/matriculas.tsx`]),
  r(19, "Assistente de matrícula", "existente", "", ["enrollment_wizard_events"], [`${SS}/enrollment-wizard.test.tsx`]),
  r(20, "Participação no ciclo", "existente", "", ["cycle_participations"], [`${M}/0001_b3_cycle_enrollment_participation_allocation.sql`]),
  r(21, "Enturmação (alocação temporal)", "existente", "", ["class_enrollment_episodes", "class_enrollment_episode_endings"], [`${SS}/class-allocation-flow.test.ts`, `${R}/enturmacoes.tsx`]),
  r(22, "Posição curricular individual", "existente", "", ["allocation_curricular_positions"], [`${M}/0008_b3_3_allocation_curricular_position.sql`]),
  r(23, "Vagas", "parcial", "Livro de vagas deriva capacidade − enturmados; sem reserva de vaga.", ["class_capacity_records"], [`${SS}/vacancy-center.test.ts`, `${R}/secretaria_.vagas.tsx`]),
  r(24, "Demanda e fila de espera", "lacuna", "Sem entidade de demanda/fila; critérios de prioridade não fornecidos."),
  r(25, "Critérios de prioridade", "bloqueado", "Norma municipal de prioridade não fornecida nem homologada."),
  r(26, "Reserva e oferta de vaga", "lacuna", "Sem reserva com prazo; depende de fila (24) e prazo homologado."),
  r(27, "Transferências", "existente", "", ["student_movement_events"], ["src/features/transfers/transfer-workspace.test.tsx", `${R}/transferencias.tsx`]),
  r(28, "Remanejamento", "existente", "", ["student_movement_events"], [`${SS}/movement-flow.test.ts`]),
  r(29, "Encerramentos (evasão/cancelamento)", "existente", "", ["school_enrollment_endings", "cycle_enrollment_ending_versions"], [`${SS}/secretariat-flows.test.ts`]),
  r(30, "Rematrícula/renovação", "parcial", "Renovação documental existe; rematrícula automática proibida (2027 não copia 2026).", [], [`${M}/0223_n5_4_secretariat_documents_transfer_renewal.sql`, "src/features/year-transition/year-transition.test.ts"]),
  r(31, "Protocolos de atendimento", "parcial", "Balcão da Secretaria e pedidos da família; sem protocolo de rede para pedido de vaga.", [], [`${SS}/service-desk.test.ts`, `${SS}/family-requests.test.ts`]),
  r(32, "Documentação da matrícula", "existente", "", ["student_document_pendency_events"], [`${SS}/document-pendencies.test.ts`]),
  r(33, "Livro de matrícula", "existente", "", [], [`${SS}/registry-books.test.ts`, `${R}/secretaria_.livro-matricula.tsx`]),
  r(34, "Integração Educacenso", "existente", "", ["student_official_identifiers"], [`${M}/0109_0109_educacenso_2026_students_enrollments.sql`]),
  r(35, "Mapa Estatístico", "existente", "", [], ["src/features/statistical-map/map-movements.test.ts"]),
  r(36, "Integração com Diário/turma", "existente", "", [], [`${ST}/institutional-roster.ts`]),
  r(37, "Painéis e relatórios", "parcial", "Relatórios da Secretaria por escola; sem painel de rede de vagas×demanda (demanda inexistente).", [], [`${SS}/academic-panel.test.ts`]),
  r(38, "Segurança, RLS e LGPD", "existente", "", [], [`${M}/0110_0110_school_enrollments_revoke_direct_dml.sql`, `${M}/0214_n5_2_1_enrollment_wizard_acl.sql`]),
  r(39, "Auditoria", "existente", "", ["student_registration_events", "student_movement_events"], [`${M}/0001_b3_cycle_enrollment_participation_allocation.sql`]),
  r(40, "Interface e acessibilidade", "parcial", "Telas existentes; verificação móvel autenticada não feita.", [], ["src/features/transfers/field-a11y-nform2.test.tsx"]),
  r(41, "Plano de implementação", "parcial", "Este lote abre o plano.", [], ["src/features/enrollments/network-enrollment-audit.test.ts"]),
  r(42, "Resultado institucional", "bloqueado", "Depende de homologação humana pelos responsáveis; nenhuma registrada."),
];

export const NET_CRITERIA: readonly NetAuditRow[] = [
  r(1, "Uma pessoa, um estudante, sem duplicação", "existente", "", ["institutional_students"], [`${ST}/institutional-chain.test.ts`]),
  r(2, "Matrícula, participação e enturmação distintas", "existente", "", [], [`${M}/0001_b3_cycle_enrollment_participation_allocation.sql`]),
  r(3, "Temporalidade (vigência e conhecimento)", "existente", "", [], [`${ST}/institutional-temporal.ts`]),
  r(4, "Histórico preservado em movimentações", "existente", "", [], [`${SS}/movement-flow.test.ts`]),
  r(5, "Vagas derivadas de capacidade, nunca digitadas", "existente", "", [], [`${SS}/vacancies-book.test.ts`]),
  r(6, "Capacidade ausente ⇒ vaga não calculável", "existente", "", [], [`${SS}/vacancy-center.test.ts`]),
  r(7, "Fila de espera com critério homologado", "bloqueado", "Fila inexistente e critério não fornecido."),
  r(8, "Reserva de vaga com prazo", "lacuna", "Sem reserva."),
  r(9, "Transferência com origem e destino", "existente", "", [], ["src/features/transfers/transfer-workspace.test.tsx"]),
  r(10, "Remanejados como grupamento próprio", "existente", "", [], ["src/features/statistical-map/map-movements.test.ts"]),
  r(11, "Rematrícula sem cópia automática de fatos", "existente", "", [], ["src/features/year-transition/year-transition.test.ts"]),
  r(12, "Protocolo de solicitação", "parcial", "Só balcão escolar."),
  r(13, "Documentos pendentes não bloqueiam direito", "existente", "", [], [`${SS}/document-pendencies.test.ts`]),
  r(14, "Escrita só por funções do banco", "existente", "", [], [`${M}/0110_0110_school_enrollments_revoke_direct_dml.sql`]),
  r(15, "Leitura por escopo de escola (RLS)", "existente", "", [], [`${M}/0159_ad2_enrollments_network_policy_initplan.sql`]),
  r(16, "Dados sensíveis minimizados (LGPD)", "parcial", "Sem trilha unificada de leitura de cadastro do estudante."),
  r(17, "Integração Educacenso/Mapa sem dupla contagem", "existente", "", [], ["src/features/statistical-map/map-integrity.test.ts"]),
  r(18, "Executor técnico auditável e restrito", "existente", "", [], ["src/test/invariants/environment-gate.test.ts"]),
  r(19, "Listas grandes paginadas no servidor", "parcial", "Leitor de matrículas ativas otimizado; demais listas a revisar (PERF.LOADING.1).", [], [`${M}/0265_perf_loading_3_active_enrollments_reader.sql`]),
  r(20, "Fluxos homologados pelos responsáveis", "bloqueado", "Nenhuma homologação humana registrada."),
];

export const NET_GAPS = [
  "Demanda/fila de espera e reserva de vaga não existem; dependem de critério municipal de prioridade.",
  "Zoneamento escola×território sem regra homologada.",
  "Perfil de central de matrículas de rede sem política de capacidades homologada.",
  "Protocolo de rede para pedido de vaga ausente.",
] as const;

export const netSummary = (rows: readonly NetAuditRow[]) =>
  rows.reduce<Record<NetAuditStatus, number>>((a, x) => ((a[x.status] += 1), a), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function netAuditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const out: string[] = [];
  for (const x of [...NET_SECTIONS, ...NET_CRITERIA]) {
    if (x.status === "existente" && x.evidence.length === 0) out.push(`${x.n}: existente sem evidência`);
    if (x.status !== "existente" && !x.gap) out.push(`${x.n}: lacuna sem descrição`);
    for (const e of x.evidence) if (!exists(e)) out.push(`${x.n}: evidência ausente ${e}`);
    for (const t of x.tables) if (!tableKnown(t)) out.push(`${x.n}: tabela desconhecida ${t}`);
  }
  return out;
}
