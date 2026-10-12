// Matrículas L24 — matriz de fechamento 45 seções + 22 critérios sobre evidência conferida em disco.
// Nunca há status "homologado": homologação é ato humano que o sistema não simula. "tecnico" = código+teste+migration
// existem; "parcial" = falta tela/capability atribuída/E2E; "bloqueado" = depende de decisão ou sistema externo.
export type ClosureStatus = "tecnico" | "parcial" | "bloqueado";
export interface ClosureRow { n: number; title: string; status: ClosureStatus; evidence: readonly string[]; gap: string }

export const INGRESS_CLOSURE_BASE_SHA = "2350179a";
const E = "src/features/enrollments";
const M = (n: string) => `drizzle/migrations/${n}`;
const NO_CAP = "Capabilities não atribuídas; E2E autenticado não executado.";
const NO_UI = "Sem tela operacional; " + NO_CAP;
const s = (n: number, title: string, status: ClosureStatus, evidence: string[], gap = ""): ClosureRow => ({ n, title, status, evidence, gap });

export const CLOSURE_SECTIONS: readonly ClosureRow[] = [
  s(1, "Finalidade do Portal de Ingresso", "tecnico", [`${E}/ingress-public.ts`]),
  s(2, "Objetivos", "tecnico", [`${E}/ingress-boundaries.ts`]),
  s(3, "Fonte única", "tecnico", [`${E}/network-enrollment-audit.ts`, `${E}/ingress-portal-audit.test.ts`]),
  s(4, "Conceitos estudante/matrícula/participação/enturmação", "tecnico", [`${E}/ingress-boundaries.ts`]),
  s(5, "Atores e competências", "parcial", [`${E}/ingress-boundaries.ts`], NO_CAP),
  s(6, "Oferta por escola", "tecnico", [`${E}/school-offer-lifecycle.ts`]),
  s(7, "Capacidade", "tecnico", [`${E}/capacity-model.ts`, M("0468_enr15_seat_concurrency_apply.sql")]),
  s(8, "Planejamento de turmas", "tecnico", [`${E}/class-planning.ts`]),
  s(9, "Quadro de vagas", "tecnico", [`${E}/vacancy-board.ts`, `${E}/seat-concurrency.ts`]),
  s(10, "Tela de vagas da Secretaria", "tecnico", [`${E}/enrollment-workspace-page.tsx`]),
  s(11, "Campanhas", "tecnico", [`${E}/campaign-cloud.ts`]),
  s(12, "Edital e calendário", "parcial", [`${E}/campaign-cloud.ts`], "Edital real assinado não registrado."),
  s(13, "Critérios de prioridade", "parcial", [`${E}/classification-run.ts`], "Nenhum critério aprovado por pessoa real."),
  s(14, "Inscrição pública", "tecnico", [`${E}/application-wizard.ts`, M("0459_enr07_public_applications.sql")]),
  s(15, "Identificação sem duplicar pessoa", "tecnico", [`${E}/student-reconciliation.ts`]),
  s(16, "Responsável e vínculo", "tecnico", [`${E}/ingress-identity.ts`]),
  s(17, "Documentos da inscrição", "tecnico", [`${E}/application-documents.ts`]),
  s(18, "Protocolo", "tecnico", [`${E}/application-protocol.ts`]),
  s(19, "Consulta pública do protocolo", "tecnico", [`${E}/application-protocol.ts`, `${E}/result-lookup.tsx`]),
  s(20, "Solicitações de vaga", "tecnico", [`${E}/admin-panel.ts`]),
  s(21, "Conferência e análise", "parcial", [`${E}/admin-panel-page.tsx`], NO_CAP),
  s(22, "Distribuição/classificação", "tecnico", [`${E}/distribution-proposal.ts`, `${E}/classification-run.ts`]),
  s(23, "Empates", "tecnico", [`${E}/distribution-engine.ts`]),
  s(24, "Reservas", "parcial", [`${E}/reservation-states.ts`], NO_UI),
  s(25, "Listas de espera", "parcial", [`${E}/waitlist-cloud.test.ts`], NO_UI),
  s(26, "Convocação e comunicação", "parcial", [`${E}/individual-result.ts`], "Sem provedor externo de mensagens; textos aprovados ausentes."),
  s(27, "Confirmação pelo responsável", "tecnico", [`${E}/seat-acceptance.ts`]),
  s(28, "Matrícula oficial", "tecnico", [M("0472_enr19_confirmation_validation.sql")]),
  s(29, "Matrícula guiada", "tecnico", [`${E}/enrollment-workspace-page.tsx`]),
  s(30, "Enturmação temporal", "tecnico", [`${E}/temporal-allocation.ts`, M("0473_enr20_allocation_transfer.sql")]),
  s(31, "Transferências", "parcial", [`${E}/ingress-allocation-transfer.test.ts`], "Destino matriculado por fluxo próprio da Secretaria; " + NO_UI),
  s(32, "Remanejamento", "parcial", [`${E}/transfer-flow.ts`], NO_UI),
  s(33, "Educação Infantil", "parcial", [`${E}/early-childhood.ts`, `${E}/assisted-attendance.ts`], "Regra de agrupamento etário não homologada."),
  s(34, "Fundamental e EJA semestral", "parcial", [`${E}/fundamental-eja.ts`, `${E}/assisted-attendance.ts`], "Idades de autorrepresentação/EJA não homologadas."),
  s(35, "Inclusão/NEI", "parcial", [`${E}/inclusion-support.ts`], NO_UI),
  s(36, "Transporte e território", "parcial", [`${E}/territorial-map.ts`, `${E}/ingress-dashboard.ts`], "Limiar de supressão não aprovado."),
  s(37, "Ocupação e alertas", "parcial", [`${E}/ingress-dashboard.ts`], NO_UI),
  s(38, "Portal da Família", "tecnico", [`${E}/family-enrollment-portal.ts`]),
  s(39, "Acompanhamento pela família", "tecnico", [`${E}/result-lookup.tsx`]),
  s(40, "Simulador", "tecnico", [`${E}/network-simulator.ts`]),
  s(41, "Relatórios", "parcial", [`${E}/ingress-dashboard.ts`], "24 relatórios catalogados; execução pelo motor de relatórios pendente."),
  s(42, "GED e atos", "tecnico", [`${E}/enrollment-ged.ts`]),
  s(43, "Painel e telas", "parcial", [`${E}/admin-panel-page.tsx`], NO_UI),
  s(44, "Integração externa", "bloqueado", [], "Sem contrato nem decisão sobre Educacenso/sistema estadual."),
  s(45, "Fechamento e evidências", "tecnico", [`${E}/ingress-closure.test.ts`, "supabase/tests/enr24_ingress_rls.sql"]),
];

export const CLOSURE_CRITERIA: readonly ClosureRow[] = [
  s(1, "Estudante só do cadastro canônico", "tecnico", [`${E}/network-enrollment-audit.test.ts`]),
  s(2, "Sem tabela duplicada", "tecnico", [`${E}/ingress-portal-audit.test.ts`]),
  s(3, "Inscrição nunca cria matrícula/pessoa", "tecnico", [`${E}/pre-registration.ts`]),
  s(4, "Protocolo único e idempotente", "tecnico", [`${E}/application-protocol.test.ts`]),
  s(5, "Vaga só de capacidade autorizada", "tecnico", [`${E}/seat-concurrency.test.ts`]),
  s(6, "Disponível sem dupla contagem", "tecnico", [`${E}/ingress-dashboard.test.ts`]),
  s(7, "Reserva concorrente com lock", "parcial", [`${E}/seat-concurrency.test.ts`], "Duas sessões reais simultâneas não executadas."),
  s(8, "Critério só aprovado", "tecnico", [`${E}/classification-run.test.ts`]),
  s(9, "Empate nunca decidido pelo sistema", "tecnico", [`${E}/distribution-engine.test.ts`]),
  s(10, "Aprovador ≠ autor", "tecnico", [`${E}/distribution-proposal.test.ts`, `${E}/ingress-dashboard.test.ts`]),
  s(11, "Autoria = pessoa da sessão", "tecnico", [`${E}/assisted-attendance.test.ts`]),
  s(12, "Família vê só a própria posição", "tecnico", [`${E}/waitlist-cloud.test.ts`]),
  s(13, "CPF/contato só HMAC", "tecnico", [`${E}/ingress-public-identity.test.ts`]),
  s(14, "Sem texto clínico", "tecnico", [`${E}/inclusion-support.test.ts`]),
  s(15, "Arquivos privados", "tecnico", [`${E}/application-documents.test.ts`]),
  s(16, "Ausência nunca vira zero", "tecnico", [`${E}/ingress-dashboard.test.ts`]),
  s(17, "Matrícula/enturmação só pelos writers da Secretaria", "tecnico", [`${E}/ingress-allocation-transfer.test.ts`]),
  s(18, "RLS e sem DML direta", "tecnico", ["supabase/tests/enr24_ingress_rls.sql", `${E}/ingress-closure.test.ts`]),
  s(19, "Consulta pública sem dado pessoal", "tecnico", [`${E}/individual-result.test.ts`]),
  s(20, "Exportação auditada", "parcial", [`${E}/ingress-dashboard.ts`], "Relatórios do ingresso ainda não saem pela trilha de emissões."),
  s(21, "Simulação nunca altera oferta", "tecnico", [`${E}/network-simulator.ts`]),
  s(22, "Evidência SQL/TS/E2E", "parcial", [`${E}/ingress-closure.test.ts`], "E2E autenticado não executado: nenhuma conta tem as capabilities do ingresso."),
];

/** Tabelas do ingresso que precisam: RLS ligada, sem DML para anon/authenticated, sem SELECT anon. */
export const INGRESS_TABLES = [
  "enr_applications", "enr_application_protocols", "enr_seat_pools", "enr_seat_pool_versions", "enr_seat_events",
  "enr_waitlists", "enr_waitlist_versions", "enr_waitlist_calls", "enr_family_acceptances", "enr_admin_validations",
  "enr_formalization_links", "enr_allocation_links", "enr_transfer_events", "enr_assisted_attendances",
  "enr_support_needs", "enr_support_referrals", "enr_appeal_events",
] as const;

export function closureProblems(exists: (p: string) => boolean): string[] {
  const p: string[] = [];
  if (CLOSURE_SECTIONS.length !== 45 || CLOSURE_CRITERIA.length !== 22) p.push("Esperadas 45 seções e 22 critérios.");
  for (const x of [...CLOSURE_SECTIONS, ...CLOSURE_CRITERIA]) {
    if (x.status === "tecnico" && x.evidence.length === 0) p.push(`#${x.n} técnico sem evidência`);
    if (x.status !== "tecnico" && !x.gap) p.push(`#${x.n} sem lacuna descrita`);
    if (/homolog/i.test(x.status)) p.push(`#${x.n} status de homologação proibido`);
    for (const e of x.evidence) if (!exists(e)) p.push(`#${x.n}: evidência ausente ${e}`);
  }
  return p;
}
