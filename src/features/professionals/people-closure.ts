/**
 * Gestão de Pessoas — Lote 24: matriz de fechamento (37 seções + 18 critérios).
 * Cada linha aponta fonte (núcleo/tabela), tela, teste e status. Status só pode subir
 * com evidência em disco (teste confere). "homologado" NÃO existe como status: nenhuma
 * homologação humana, ato oficial ou dado real foi comprovado por este código.
 */
export type ClosureStatus =
  | "persistido-com-tela" // tabela canônica + tela + teste
  | "persistido" // tabela/RLS + teste, sem tela própria
  | "nucleo-testado" // regra pura testada, sem writer/reader institucional
  | "bloqueado"; // depende de decisão/ato/dado institucional

export interface ClosureRow { n: number; title: string; source: string[]; screen: string | null; tests: string[]; status: ClosureStatus; blocker: string }

const P = "src/features/professionals";
const R = "src/routes";
const HUB = `${R}/gestao-de-pessoas.tsx`;
const t = (f: string) => `${P}/${f}.test.ts`;
const s = (f: string) => `${P}/${f}.ts`;
const row = (n: number, title: string, status: ClosureStatus, source: string[], tests: string[], screen: string | null = null, blocker = ""): ClosureRow =>
  ({ n, title, status, source, tests, screen, blocker });

const NO_CAP = "Capacidades de RH sem política homologada atribuída a pessoas reais.";

export const CLOSURE_SECTIONS: readonly ClosureRow[] = [
  row(1, "Finalidade", "nucleo-testado", [s("people-hub-model")], [t("people-hub-model")], HUB, "Página fora do menu: setores que a veem não decididos."),
  row(2, "Objetivos estratégicos", "nucleo-testado", [s("teacher-need-engine"), s("coverage-map")], [t("teacher-need-engine"), t("coverage-map")], HUB),
  row(3, "Conceitos fundamentais", "persistido", [s("functional-life")], [t("functional-life")]),
  row(4, "Estrutura de perfis", "bloqueado", [s("people-access")], [t("people-access")], null, NO_CAP),
  row(5, "Menu principal", "bloqueado", [HUB], [`${P}/professionals-routes.test.tsx`], HUB, "Setores com acesso ao menu não decididos."),
  row(6, "Dashboard geral", "nucleo-testado", [s("people-hub-model"), s("people-hub-source")], [t("people-hub-model")], HUB, "Verificado só sem sessão; E2E autenticado não rodado."),
  row(7, "Cadastro de profissionais", "persistido-com-tela", [s("functional-life")], [`${P}/professional-identity-workspace.test.tsx`], `${R}/profissionais.index.tsx`),
  row(8, "Vínculos funcionais", "persistido-com-tela", [s("functional-links")], [t("functional-links"), `${P}/professionals-vinculos.test.tsx`], `${R}/profissionais.index.tsx`),
  row(9, "Catálogo de cargos e funções", "nucleo-testado", [s("role-catalog")], [t("role-catalog")], null, "Catálogo sem tabela; cargos oficiais não fornecidos."),
  row(10, "Lotação", "persistido-com-tela", [s("placement-exercise")], [t("placement-exercise"), `${P}/professionals-lotacoes.test.tsx`], `${R}/profissionais.index.tsx`),
  row(11, "Exercício profissional", "persistido", [s("placement-exercise")], [t("placement-exercise"), t("functional-life")]),
  row(12, "Designações", "nucleo-testado", [s("role-designations")], [t("role-designations")], null, "Sem writer; tipos de ato oficiais não fornecidos."),
  row(13, "Jornadas e cargas horárias", "nucleo-testado", [s("workload")], [t("workload")], null, "Regras de duração de hora-aula por etapa não homologadas."),
  row(14, "Disponibilidade profissional", "nucleo-testado", [s("availability")], [t("availability")], null, "Regra de efeito de afastamento não homologada."),
  row(15, "Afastamentos", "nucleo-testado", [s("leave-substitution")], [t("leave-substitution")], null, "Capacidade consultar-afastamentos não aprovada."),
  row(16, "Substituições", "persistido", [s("leave-substitution")], [t("leave-substitution")]),
  row(17, "Planejamento da oferta", "nucleo-testado", [s("offer-plan")], [t("offer-plan")]),
  row(18, "Motor de necessidade", "nucleo-testado", [s("teacher-need-engine")], [t("teacher-need-engine")], HUB),
  row(19, "Atribuição de aulas", "nucleo-testado", [s("class-assignment-flow")], [t("class-assignment-flow")], null, "Fluxo de 6 etapas sem writer; competências por etapa não configuradas."),
  row(20, "Quadro visual de atribuição", "nucleo-testado", [s("assignment-board-model")], [`${P}/assignment-board.test.tsx`], HUB, "Sem fonte de propostas institucional."),
  row(21, "Horários e conflitos", "nucleo-testado", [s("schedule-integrity")], [t("schedule-integrity")]),
  row(22, "Cobertura das turmas", "nucleo-testado", [s("coverage-map")], [t("coverage-map")], HUB),
  row(23, "Movimentações de pessoal", "nucleo-testado", [s("movement-requests")], [t("movement-requests"), t("nprof1-trajectory")]),
  row(24, "Solicitações das escolas", "nucleo-testado", [s("movement-requests")], [t("movement-requests")], null, "Protocolo sem tabela."),
  row(25, "Pessoal não docente", "bloqueado", [s("non-teaching-sizing")], [t("non-teaching-sizing")], null, "Critérios oficiais por área e aprovador não fornecidos."),
  row(26, "Simulações e cenários", "nucleo-testado", [s("staffing-simulator")], [t("staffing-simulator")]),
  row(27, "Relatórios", "nucleo-testado", [s("people-reports")], [t("people-reports")], null, "8 de 22 relatórios aguardam reader institucional."),
  row(28, "Documentos e atos", "bloqueado", [s("administrative-acts")], [t("administrative-acts")], null, "Lista oficial de tipos de ato e quem registra/lê não fornecidas."),
  row(29, "Integração com perfil docente", "nucleo-testado", [s("assignment-integration")], [t("assignment-integration")]),
  row(30, "Integração com demais perfis", "nucleo-testado", [s("assignment-integration")], [t("assignment-integration")], null, "Campos por setor escolhidos pelo implementador; a confirmar."),
  row(31, "Arquitetura de dados", "persistido", ["drizzle/migrations/0383_fix_functional_links_read_policy.sql"], [t("staff-reconciliation")]),
  row(32, "Segurança e auditoria", "persistido", [s("people-access"), "supabase/tests/gp23_people_rls_isolation.sql"], [t("people-access")]),
  row(33, "Requisitos de interface", "nucleo-testado", [`${P}/people-hub-page.tsx`], [t("people-hub-model")], HUB, "Sem verificação móvel autenticada."),
  row(34, "Automações", "nucleo-testado", [s("schedule-integrity")], [t("schedule-integrity")], null, "Por desenho só alertas; nenhuma correção automática."),
  row(35, "Plano de implementação", "nucleo-testado", [s("people-closure")], [t("people-closure")]),
  row(36, "Critérios de aceitação", "nucleo-testado", [s("people-closure")], [t("people-closure")]),
  row(37, "Resultado institucional esperado", "bloqueado", [], [t("people-closure")], null, "Exige homologação humana pelos responsáveis; nenhuma registrada."),
];

export const CLOSURE_CRITERIA: readonly ClosureRow[] = [
  row(1, "Múltiplos vínculos sem duplicação", "persistido-com-tela", [s("functional-links")], [t("functional-links"), t("people-scenario.integration")], `${R}/profissionais.index.tsx`),
  row(2, "Cargo e função distintos", "nucleo-testado", [s("role-catalog")], [t("role-catalog")]),
  row(3, "Lotação e exercício distintos", "persistido", [s("placement-exercise")], [t("placement-exercise")]),
  row(4, "Movimentações preservam histórico", "nucleo-testado", [s("movement-requests")], [t("movement-requests")]),
  row(5, "Designações com vigência", "nucleo-testado", [s("role-designations")], [t("role-designations")]),
  row(6, "Jornadas com unidades corretas", "nucleo-testado", [s("workload")], [t("workload"), t("people-scenario.integration")]),
  row(7, "Afastamentos afetam disponibilidade por regra autorizada", "bloqueado", [s("availability")], [t("availability")], null, "Regra de efeito não homologada ⇒ total null."),
  row(8, "Atribuições respeitam vínculos e períodos", "nucleo-testado", [s("class-assignment-flow")], [t("class-assignment-flow")]),
  row(9, "Conflitos de horário identificados", "nucleo-testado", [s("schedule-integrity")], [t("schedule-integrity")]),
  row(10, "Aulas descobertas corretas", "nucleo-testado", [s("teacher-need-engine")], [t("teacher-need-engine")]),
  row(11, "Relatórios com metodologia", "nucleo-testado", [s("people-reports")], [t("people-reports")]),
  row(12, "Relatórios existentes integrados", "nucleo-testado", [s("people-reports")], [t("people-reports")], null, "8 relatórios sem fonte institucional."),
  row(13, "Perfil docente reflete atribuições autorizadas", "nucleo-testado", [s("assignment-integration")], [t("assignment-integration")]),
  row(14, "Permissões aplicadas no banco", "persistido", ["supabase/tests/gp23_people_rls_isolation.sql"], [t("people-access")]),
  row(15, "Dados sensíveis protegidos", "persistido", [s("people-access")], [t("people-access"), t("leave-substitution")]),
  row(16, "Alterações críticas auditáveis", "nucleo-testado", [s("people-access"), s("administrative-acts")], [t("people-access")]),
  row(17, "Simulações não modificam registros", "nucleo-testado", [s("staffing-simulator")], [t("staffing-simulator")]),
  row(18, "Fluxos homologados pelos responsáveis", "bloqueado", [], [t("people-closure")], null, "Nenhuma homologação humana registrada."),
];

export function closureProblems(exists: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const r of [...CLOSURE_SECTIONS, ...CLOSURE_CRITERIA]) {
    for (const f of [...r.source, ...r.tests, ...(r.screen ? [r.screen] : [])]) if (!exists(f)) out.push(`${r.n}: ausente ${f}`);
    if (r.tests.length === 0) out.push(`${r.n}: sem teste`);
    if (r.status === "bloqueado" && !r.blocker) out.push(`${r.n}: bloqueio sem motivo`);
    if (r.status === "persistido-com-tela" && !r.screen) out.push(`${r.n}: tela não indicada`);
  }
  return out;
}

export const closureSummary = (rows: readonly ClosureRow[]) =>
  rows.reduce<Record<ClosureStatus, number>>((a, r) => ((a[r.status] += 1), a),
    { "persistido-com-tela": 0, persistido: 0, "nucleo-testado": 0, bloqueado: 0 });
