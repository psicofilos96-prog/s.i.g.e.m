/**
 * Família Lote 01 — auditoria do módulo existente contra a especificação
 * "Perfil de Acompanhamento Familiar" (35 seções, 18 critérios de aceite).
 * Status é derivado da evidência (arquivo existente); nada é homologado aqui.
 */
export type AuditStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface FamilySectionAudit { n: number; title: string; status: AuditStatus; reuse: string[]; evidence: string[]; gap: string }

const FP = "src/features/family-portal";
const CM = "src/features/communication";
const MIG = "drizzle/migrations";
const S = (n: number, title: string, status: AuditStatus, gap: string, evidence: string[] = [], reuse: string[] = []): FamilySectionAudit => ({ n, title, status, gap, evidence, reuse });

export const FAMILY_SPEC_SECTIONS: readonly FamilySectionAudit[] = [
  S(1, "Finalidade do perfil", "parcial", "Portal só leitura existe; ambiente único ainda não reúne todas as áreas.", ["src/routes/familia.tsx"]),
  S(2, "Objetivos estratégicos", "parcial", "Objetivos 7, 8, 10–14, 16, 17, 20 sem tela.", [`${FP}/family-portal.ts`]),
  S(3, "Público e tipos de acesso", "parcial", "Responsável por educando existe; pessoa autorizada e estudante com acesso próprio não modelados.", [`${MIG}/0142_ac_family_guardian_person_hardening.sql`], ["guardian_authorizations", "user_person_links"]),
  S(4, "Segurança do vínculo familiar", "existente", "", [`${MIG}/0069_family_portal_authorizations.sql`, `${FP}/guardian-admin.ts`, `${FP}/guardian-admin.test.ts`], ["record_guardian_authorization_v3", "guardian_authorization_chain"]),
  S(5, "Arquitetura do SIGEM Família (menu de 18 itens)", "parcial", "Menu com 7 seções (FAMILY_SECTIONS); faltam atividades, mensagens, reuniões, pedagógico, solicitações, orientações, cadastro, ajuda.", [`${FP}/family-portal.ts`]),
  S(6, "Painel inicial", "parcial", "Resumo por estudante; destaques e ações rápidas ausentes.", [`${FP}/family-portal-page.tsx`]),
  S(7, "Meus estudantes", "existente", "", [`${FP}/family-portal.ts`, `${FP}/family-portal.test.ts`]),
  S(8, "Vida escolar", "parcial", "Matrícula vigente e carteirinha; histórico escolar não exposto.", [`${MIG}/0245_nfam1_family_student_card.sql`], ["family_enrollment_school", "student_school_life"]),
  S(9, "Frequência escolar", "parcial", "Aguardando ato de publicação à família; comunicação de ausência ausente.", [`${FP}/family-portal.ts`], ["attendance_record_versions"]),
  S(10, "Aprendizagem e resultados", "parcial", "Só após publicação institucional; sem ato de publicação implementado.", [`${FP}/family-portal.ts`], ["assessment_entry_versions"]),
  S(11, "Educação Infantil", "lacuna", "Parecer descritivo existe, mas sem apresentação própria à família.", [], ["descriptive_report_versions"]),
  S(12, "Atividades escolares", "lacuna", "Sem publicação de atividades docentes à família."),
  S(13, "Calendário escolar", "parcial", "Calendário homologado existe; seção calendario no portal sem projeção própria.", ["src/routes/calendario-escolar.index.tsx"]),
  S(14, "Comunicados institucionais", "existente", "", [`${CM}/communication-model.ts`, `${CM}/communication.test.ts`, `${CM}/family-communications.tsx`, `${MIG}/0172_aj_school_family_communication.sql`]),
  S(15, "Mensagens e comunicação", "parcial", "Núcleo de mensageria puro; sem gravação no banco nem provedor externo.", [`${CM}/family-messaging.ts`, `${CM}/family-messaging.test.ts`]),
  S(16, "Reuniões e atendimentos", "lacuna", "Sem agenda de atendimento à família."),
  S(17, "Alimentação escolar", "parcial", "Saúde declarada pela família existe; cardápio à família ausente.", [`${FP}/family-health.ts`, `${FP}/nfam2.test.ts`, `${MIG}/0326_nfam2_family_health_declarations.sql`]),
  S(18, "Acompanhamento pedagógico familiar", "lacuna", "Registros da OP não têm projeção autorizada à família.", [], ["school_pedagogical_records"]),
  S(19, "Educação inclusiva", "lacuna", "NEI sem canal à família; laudo nunca exposto.", [], ["inclusion_records"]),
  S(20, "Documentos e serviços", "parcial", "Carteirinha à família; demais documentos só pela Secretaria.", [`${FP}/student-card.ts`, `${FP}/ncard1.test.ts`]),
  S(21, "Atualização cadastral", "lacuna", "Sem solicitação de alteração validada pela Secretaria."),
  S(22, "Central de solicitações", "lacuna", "Protocolo de atendimento da Secretaria existe; sem entrada pela família.", [], ["service-desk (Secretaria)"]),
  S(23, "Participação familiar", "lacuna", "Sem registro de participação."),
  S(24, "Orientações às famílias", "lacuna", "Base de conhecimento pública poderia servir; sem seção."),
  S(25, "Notificações", "parcial", "Infraestrutura de notificações existe; aviso sem conteúdo.", [`${MIG}/0077_notifications_infrastructure.sql`]),
  S(26, "Acessibilidade e inclusão digital", "parcial", "Componentes compartilhados com teste de acessibilidade.", ["src/components/a11y.test.tsx"]),
  S(27, "Experiência do usuário", "parcial", "Portal responsivo; navegação de app ausente.", [`${FP}/family-portal-page.tsx`]),
  S(28, "Perfis e permissões", "existente", "", [`${FP}/guardian-admin.ts`, `${MIG}/0161_ac2_guardian_staff_readers.sql`]),
  S(29, "Integração com os demais módulos", "parcial", "Secretaria, Alimentação e Comunicação integradas; Docente, OP, NEI, Direção não.", [`${FP}/family-source.ts`]),
  S(30, "Arquitetura de dados", "existente", "", ["src/features/privacy/data-inventory.ts"]),
  S(31, "Segurança e LGPD", "existente", "", ["src/features/privacy/data-inventory.ts", "src/features/privacy/privacy-leak.test.ts"]),
  S(32, "Recursos adicionais", "lacuna", "Nenhum recurso adicional implementado."),
  S(33, "Plano de implementação", "parcial", "Este lote abre o plano; lotes seguintes pendentes."),
  S(34, "Critérios de aceitação", "parcial", "Ver FAMILY_ACCEPTANCE.", [`${FP}/family-audit.test.ts`]),
  S(35, "Resultado institucional esperado", "bloqueado", "Depende de homologação pela Secretaria Municipal de Educação."),
];

export interface FamilyCriterion { n: number; text: string; status: AuditStatus; evidence: string[]; gap: string }
const C = (n: number, text: string, status: AuditStatus, gap: string, evidence: string[] = []): FamilyCriterion => ({ n, text, status, gap, evidence });

export const FAMILY_ACCEPTANCE: readonly FamilyCriterion[] = [
  C(1, "Vínculos familiares validados", "parcial", "Writer exige pessoa validada; 0 autorizações no banco.", [`${FP}/guardian-admin.test.ts`]),
  C(2, "Sem acesso a estudante não autorizado", "existente", "", [`${FP}/family-portal.test.ts`]),
  C(3, "Restrições de acesso respeitadas", "existente", "", [`${MIG}/0142_ac_family_guardian_person_hardening.sql`]),
  C(4, "Estudantes vinculados exibidos corretamente", "existente", "", [`${FP}/family-portal.test.ts`]),
  C(5, "Dados acadêmicos das fontes oficiais", "parcial", "Readers canônicos; atividades e EI ausentes.", [`${FP}/family-source.ts`]),
  C(6, "Frequência preserva situação de registro", "parcial", "Sem ato de publicação, fica 'aguardando publicação'.", [`${FP}/family-portal.ts`]),
  C(7, "Avaliações respeitam publicação institucional", "parcial", "Idem: nada publicado.", [`${FP}/family-portal.ts`]),
  C(8, "Educação Infantil com apresentação própria", "lacuna", "Sem tela de EI para a família."),
  C(9, "Calendário integrado", "parcial", "Calendário homologado não projetado no portal."),
  C(10, "Comunicados respeitam destinatários", "existente", "", [`${CM}/communication.test.ts`]),
  C(11, "Mensagens protegidas", "parcial", "Só núcleo puro.", [`${CM}/family-messaging.test.ts`]),
  C(12, "Solicitações com protocolo", "lacuna", "Sem entrada pela família."),
  C(13, "Documentos com controle de acesso", "existente", "", [`${FP}/ncard1.test.ts`]),
  C(14, "Permissões verificadas no banco", "existente", "", [`${MIG}/0069_family_portal_authorizations.sql`]),
  C(15, "Acesso revogado deixa de funcionar", "existente", "", [`${FP}/guardian-admin.test.ts`]),
  C(16, "Interface adequada em celulares", "parcial", "Sem verificação móvel autenticada (0 autorizações).", [`${FP}/family-portal-page.tsx`]),
  C(17, "Dados sensíveis protegidos", "existente", "", ["src/features/privacy/privacy-leak.test.ts"]),
  C(18, "Fluxos homologados pela rede", "bloqueado", "Nenhuma homologação humana registrada; nunca declarada pelo sistema."),
];

export const FAMILY_GLOBAL_GAPS = [
  "0 autorizações de responsável no banco: nenhum teste com família real é possível.",
  "Nenhum ato de publicação de frequência/avaliação à família existe.",
  "Homologação dos fluxos pela Secretaria Municipal de Educação não registrada.",
] as const;

export const summarize = <T extends { status: AuditStatus }>(rows: readonly T[]) =>
  rows.reduce<Record<AuditStatus, number>>((a, r) => ((a[r.status] += 1), a), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

/** "existente" sem evidência é afirmação sem prova: recusado. */
export function auditProblems(exists: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const r of [...FAMILY_SPEC_SECTIONS, ...FAMILY_ACCEPTANCE]) {
    if (r.status === "existente" && r.evidence.length === 0) out.push(`${r.n}: existente sem evidência`);
    if (r.status !== "existente" && !r.gap) out.push(`${r.n}: lacuna sem descrição`);
    for (const e of r.evidence) if (!exists(e)) out.push(`${r.n}: evidência ausente ${e}`);
  }
  return out;
}
