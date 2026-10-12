/**
 * Gestão de Pessoas, Lotação e Atribuição de Aulas — Lote 01: auditoria.
 * 37 seções e 18 critérios da especificação → tabelas canônicas, telas, testes e lacunas.
 * Status é derivado de evidência existente (teste confere); homologação nunca é declarada aqui.
 */
export type AuditStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface PeopleSection { n: number; title: string; status: AuditStatus; tables: string[]; evidence: string[]; gap: string }

const PR = "src/features/professionals";
const ST = "src/features/staffing";
const OF = "src/features/offer-organization";
const SC = "src/features/schedules";
const SM = "src/features/school-management";
const MIG = "drizzle/migrations";
const R = "src/routes";
const S = (n: number, title: string, status: AuditStatus, gap: string, tables: string[] = [], evidence: string[] = []): PeopleSection => ({ n, title, status, gap, tables, evidence });

export const PEOPLE_SECTIONS: readonly PeopleSection[] = [
  S(1, "Finalidade", "parcial", "Módulos existem separados (profissionais, DP, quadro docente, horários); sem entrada única.", [], [`${R}/departamento-pessoal.tsx`, `${R}/profissionais.index.tsx`]),
  S(2, "Objetivos estratégicos", "parcial", "Necessidade docente e cobertura existem; não docente e simulação de rede parciais.", [], [`${ST}/teacher-need.ts`]),
  S(3, "Conceitos fundamentais", "existente", "", ["institutional_persons", "professional_functional_links", "professional_postings", "professional_exercises"], [`${PR}/AGENTS.md`, `${PR}/functional-life.test.ts`]),
  S(4, "Estrutura de perfis", "parcial", "Capabilities por atuação; perfis RH/rede/escola sem política homologada atribuída.", ["institutional_engagements"], [`${PR}/dp-external-authority.test.ts`]),
  S(5, "Menu principal", "parcial", "Rotas existem dispersas; sem menu do módulo.", [], [`${R}/profissionais.tsx`, `${R}/quadro-docente.tsx`, `${R}/horarios.tsx`]),
  S(6, "Dashboard geral", "parcial", "Quadro docente e painel da Direção; sem dashboard de rede da força de trabalho.", [], [`${ST}/staffing-page.tsx`, `${SM}/staff-schedule.ts`]),
  S(7, "Cadastro de profissionais", "existente", "", ["institutional_persons"], [`${PR}/professional-identity-workspace.test.tsx`, `${PR}/professionals-list-page.tsx`]),
  S(8, "Vínculos funcionais", "existente", "", ["professional_functional_links"], [`${PR}/professionals-vinculos.test.tsx`, `${PR}/functional-link-draft.ts`]),
  S(9, "Catálogo de cargos e funções", "parcial", "Funções por atribuição; catálogo homologado de cargos ausente.", [], [`${PR}/professionals-funcoes.test.tsx`]),
  S(10, "Lotação", "existente", "", ["professional_postings"], [`${PR}/professionals-lotacoes.test.tsx`, `${PR}/posting-draft.ts`]),
  S(11, "Exercício profissional", "existente", "", ["professional_exercises"], [`${MIG}/0076_functional_life_exercise_qualification_process.sql`, `${PR}/functional-life.test.ts`]),
  S(12, "Designações", "parcial", "Designações específicas (calendário, turmas); sem designação funcional genérica com ato.", ["class_designation_reservations"], []),
  S(13, "Jornadas e cargas horárias", "parcial", "Carga declarada no Censo; carga contratual sem fonte funcional ⇒ não calculável.", ["professional_schedule_declarations"], [`${ST}/teacher-need.test.ts`]),
  S(14, "Disponibilidade profissional", "lacuna", "Sem fonte canônica de disponibilidade (staffing AGENTS)."),
  S(15, "Afastamentos", "parcial", "Eventos funcionais registráveis; efeito sobre disponibilidade sem regra homologada.", ["professional_functional_events"], [`${PR}/functional-timeline.test.ts`]),
  S(16, "Substituições", "existente", "", ["teaching_substitutions", "teaching_substitution_versions"], [`${MIG}/0129_v_offer_organization.sql`, `${OF}/offer-model.test.ts`]),
  S(17, "Planejamento da oferta educacional", "existente", "", ["class_offering_versions"], [`${OF}/offer-model.ts`, `${OF}/offer-model.test.ts`]),
  S(18, "Motor de necessidade de professores", "existente", "", ["class_schedule_blocks", "teaching_assignments"], [`${ST}/teacher-need.ts`, `${ST}/teacher-need.test.ts`]),
  S(19, "Atribuição de aulas", "existente", "", ["teaching_assignments", "teaching_assignment_versions"], [`${MIG}/0063_b4_8_teaching_assignments.sql`, `${PR}/assignment-draft.ts`]),
  S(20, "Quadro visual de atribuição", "parcial", "Quadro docente tabular; sem quadro visual arrastável.", [], [`${ST}/staffing-page.tsx`]),
  S(21, "Horários e conflitos", "existente", "", ["class_schedule_blocks"], [`${SC}/schedule-conflicts.test.ts`, `${SC}/teacher-cross-class-nhor4.test.ts`]),
  S(22, "Cobertura das turmas", "existente", "", [], [`${ST}/staffing-model.test.ts`]),
  S(23, "Movimentações de pessoal", "existente", "", ["professional_postings"], [`${R}/profissionais.$id.vinculos.$vinculoId.lotacoes.movimentar.tsx`, `${PR}/nprof1-trajectory.test.ts`]),
  S(24, "Solicitações das escolas", "parcial", "Pedido de cobertura da Direção é núcleo puro; sem writer no banco.", [], [`${SM}/staff-schedule.test.ts`]),
  S(25, "Planejamento de pessoal não docente", "lacuna", "Sem parâmetro homologado de módulo não docente."),
  S(26, "Simulações e cenários", "parcial", "Cenário só com parâmetro explícito no quadro docente; nunca grava.", [], [`${ST}/staffing-model.ts`]),
  S(27, "Relatórios", "existente", "", [], [`${ST}/teacher-need-reports.ts`, `${ST}/teacher-need-reports.test.ts`]),
  S(28, "Documentos e atos administrativos", "parcial", "Processos funcionais registráveis; numeração/assinatura de ato no GED.", ["professional_functional_processes"], [`${PR}/functional-record.test.ts`]),
  S(29, "Integração com o perfil docente", "parcial", "Turmas do Diário vêm da atuação vigente; atribuição de aula → Diário em parte.", ["institutional_engagements"], [`${PR}/professional-journey.test.tsx`]),
  S(30, "Integração com os demais perfis", "parcial", "Direção lê quadro; Secretaria/NEI/Mediador sem visão do quadro.", [], [`${SM}/staff-schedule.ts`]),
  S(31, "Arquitetura de dados", "existente", "", ["staff_administrative_records", "staff_reconciliation_decisions"], [`${MIG}/0276_int8_staff_administrative_records.sql`, `${PR}/staff-reconciliation.test.ts`]),
  S(32, "Segurança e auditoria", "parcial", "Writers DEFINER e append-only; trilha de leitura de dado funcional não unificada.", [], [`${PR}/staff-records.test.ts`]),
  S(33, "Requisitos de interface", "parcial", "Telas existentes; sem verificação móvel autenticada.", [], [`${PR}/professionals-routes.test.tsx`]),
  S(34, "Automações", "lacuna", "Só alertas derivados; nenhuma automação gravadora (correto)."),
  S(35, "Plano de implementação", "parcial", "Este lote abre o plano.", [], [`${PR}/people-audit.test.ts`]),
  S(36, "Critérios de aceitação", "parcial", "Ver PEOPLE_ACCEPTANCE.", [], [`${PR}/people-audit.test.ts`]),
  S(37, "Resultado institucional esperado", "bloqueado", "Depende de homologação pelos responsáveis institucionais."),
];

export interface PeopleCriterion { n: number; text: string; status: AuditStatus; evidence: string[]; gap: string }
const C = (n: number, text: string, status: AuditStatus, gap: string, evidence: string[] = []): PeopleCriterion => ({ n, text, status, gap, evidence });

export const PEOPLE_ACCEPTANCE: readonly PeopleCriterion[] = [
  C(1, "Múltiplos vínculos sem duplicação cadastral", "existente", "", [`${PR}/professionals-vinculos.test.tsx`, `${PR}/staff-reconciliation.test.ts`]),
  C(2, "Cargo e função distintos", "existente", "", [`${PR}/professionals-funcoes.test.tsx`]),
  C(3, "Lotação e exercício distintos", "existente", "", [`${PR}/functional-life.test.ts`]),
  C(4, "Movimentações preservam histórico", "existente", "", [`${PR}/nprof1-trajectory.test.ts`]),
  C(5, "Designações com vigência", "parcial", "Só designações específicas."),
  C(6, "Jornadas com unidades corretas", "existente", "", [`${ST}/teacher-need.test.ts`]),
  C(7, "Afastamentos afetam disponibilidade por regra autorizada", "lacuna", "Sem regra homologada nem fonte de disponibilidade."),
  C(8, "Atribuições respeitam vínculos e períodos", "existente", "", [`${MIG}/0063_b4_8_teaching_assignments.sql`]),
  C(9, "Conflitos de horário identificados", "existente", "", [`${SC}/schedule-conflicts.test.ts`]),
  C(10, "Aulas descobertas calculadas corretamente", "existente", "", [`${ST}/teacher-need.test.ts`]),
  C(11, "Relatórios com metodologia documentada", "existente", "", [`${ST}/teacher-need-reports.test.ts`]),
  C(12, "Relatórios existentes integrados", "parcial", "Relatórios de pessoal 2026 (planilhas) não integrados ao motor."),
  C(13, "Perfis docentes refletem atribuições autorizadas", "parcial", "Diário lê atuação; atribuição de aula não alimenta tudo.", [`${PR}/professional-journey.test.tsx`]),
  C(14, "Permissões aplicadas no banco", "existente", "", [`${MIG}/0063_b4_8_teaching_assignments.sql`]),
  C(15, "Dados sensíveis protegidos", "parcial", "CPF por HMAC; trilha de leitura funcional ausente.", [`${PR}/staff-records.test.ts`]),
  C(16, "Alterações críticas auditáveis", "existente", "", [`${PR}/functional-timeline.test.ts`]),
  C(17, "Simulações não modificam registros oficiais", "existente", "", [`${ST}/teacher-need-reports.test.ts`]),
  C(18, "Fluxos homologados pelos responsáveis", "bloqueado", "Nenhuma homologação humana registrada."),
];

export const PEOPLE_GLOBAL_GAPS = [
  "Disponibilidade e regra de afastamento sem fonte/regra homologada.",
  "Catálogo homologado de cargos e parâmetro de pessoal não docente ausentes.",
  "Nenhuma política homologada atribui as capacidades de RH a pessoas reais.",
] as const;

export const summarize = <T extends { status: AuditStatus }>(rows: readonly T[]) =>
  rows.reduce<Record<AuditStatus, number>>((a, r) => ((a[r.status] += 1), a), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function auditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const out: string[] = [];
  for (const r of [...PEOPLE_SECTIONS, ...PEOPLE_ACCEPTANCE]) {
    if (r.status === "existente" && r.evidence.length === 0) out.push(`${r.n}: existente sem evidência`);
    if (r.status !== "existente" && !r.gap) out.push(`${r.n}: lacuna sem descrição`);
    for (const e of r.evidence) if (!exists(e)) out.push(`${r.n}: evidência ausente ${e}`);
  }
  for (const s of PEOPLE_SECTIONS) for (const t of s.tables) if (!tableKnown(t)) out.push(`${s.n}: tabela desconhecida ${t}`);
  return out;
}
