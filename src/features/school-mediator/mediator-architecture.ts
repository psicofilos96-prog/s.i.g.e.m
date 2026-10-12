/**
 * PERFIL MEDIADOR ESCOLAR — LOTE 01 (diagnóstico e funções).
 *
 * 1) Mapa das 30 seções → tabela/função/rota existentes ou lacuna declarada.
 * 2) Funções de apoio (Mediador Escolar, Profissional de Apoio Escolar, Acompanhante
 *    Especializado) são PARAMETRIZÁVEIS: nenhuma competência nasce no código. Sem
 *    configuração homologada, a função existe só como rótulo e não concede nada.
 *    Bloqueio registrado: atribuições municipais de Itaperuna não verificadas.
 */

export type Status = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface SectionMap { n: number; title: string; tables: string[]; functions: string[]; routes: string[]; status: Status; note: string }

const S = (n: number, title: string, status: Status, note: string, tables: string[] = [], functions: string[] = [], routes: string[] = []): SectionMap =>
  ({ n, title, tables, functions, routes, status, note });

export const MEDIATOR_SECTIONS: readonly SectionMap[] = [
  S(1, "Finalidade do perfil", "parcial", "Mediação existe como vínculo NEI; falta estação própria.", ["inclusion_mediation_assignments"]),
  S(2, "Princípios orientadores", "existente", "Regras transversais em AGENTS.md (fail-closed, LGPD de menores)."),
  S(3, "Objetivos estratégicos", "parcial", "Cobertos pelas seções seguintes."),
  S(4, "Configuração das funções", "bloqueado", "Funções parametrizáveis neste módulo; atribuições municipais não verificadas: nenhuma competência concedida."),
  S(5, "Arquitetura do perfil (menu)", "lacuna", "Menu deve sair de pathAllowed por função configurada."),
  S(6, "Painel geral", "lacuna", "Sem painel; dados vêm de inclusion_my_mediated_students.", [], ["inclusion_my_mediated_students"]),
  S(7, "Minha agenda", "parcial", "Grade da turma e agenda NEI existem; sem agenda do mediador.", ["class_schedule_blocks"], [], ["/inclusao/nei/agenda"]),
  S(8, "Estudantes acompanhados", "existente", "Leitura só durante a vigência da mediação.", ["inclusion_mediation_assignments"], ["inclusion_my_mediated_students", "inclusion_my_mediation", "inclusion_mediations_at"]),
  S(9, "Orientações de apoio", "parcial", "Registros marcados para mediação em inclusion_records.", ["inclusion_records"], ["inclusion_records_at"]),
  S(10, "Registro diário de acompanhamento", "lacuna", "Sem ledger próprio do mediador."),
  S(11, "Categorias de apoio", "bloqueado", "Catálogo homologado ausente; nenhuma categoria semeada."),
  S(12, "Participação escolar", "lacuna", "Sem registro próprio."),
  S(13, "Promoção da autonomia", "lacuna", "Sem registro próprio."),
  S(14, "Ocorrências", "bloqueado", "Ocorrência disciplinar é da Direção; registro do mediador depende de decisão."),
  S(15, "Comunicação com o docente", "parcial", "Protocolos NEI com destinatário elegível.", [], [], ["/inclusao/nei/protocolos"]),
  S(16, "Integração com o NEI", "existente", "Ficha, apoio e mediação pelo NEI.", ["nei_role_grants"], ["record_inclusion_mediation"], ["/inclusao/nei", "/inclusao/nei/apoio", "/inclusao/nei/ficha"]),
  S(17, "Solicitações de orientação", "parcial", "Pedido de apoio NEI existe; não iniciado pelo mediador.", [], [], ["/inclusao/nei/apoio"]),
  S(18, "Acompanhamento da evolução", "parcial", "Relatório evolutivo só ordena registros pedagógicos.", ["inclusion_records"]),
  S(19, "Relatórios", "parcial", "report-engine existente; sem catálogo do mediador."),
  S(20, "Documentos", "parcial", "Central de documentos existente.", [], [], ["/central-de-documentos"]),
  S(21, "Meu histórico", "lacuna", "Derivável das versões de mediação."),
  S(22, "Integração com demais módulos", "parcial", "Mapa Estatístico projeta mediação.", [], ["map_mediation_projection_at"]),
  S(23, "Arquitetura de dados", "parcial", "Reaproveita estudante, escola, atuação e NEI; nada duplicado.", ["institutional_engagements", "inclusion_mediation_assignments"]),
  S(24, "Perfis e permissões", "bloqueado", "Capacidades por função dependem de configuração homologada."),
  S(25, "Segurança e proteção de dados", "existente", "Clínico só em inclusion_clinical_records com trilha.", ["inclusion_clinical_records", "inclusion_access_events"]),
  S(26, "Requisitos de interface", "lacuna", "Estação ainda não construída."),
  S(27, "Automações", "lacuna", "Sem automação; alertas só com prazo declarado."),
  S(28, "Plano de implementação", "existente", "Lotes do perfil."),
  S(29, "Critérios de aceitação", "lacuna", "Teste com sessão real pendente."),
  S(30, "Resultado institucional esperado", "parcial", "Depende das seções anteriores."),
];

/** Funções de apoio: identificador aberto, rótulo e competências só da configuração. */
export const SUPPORT_FUNCTION_IDS = ["mediador-escolar", "profissional-de-apoio-escolar", "acompanhante-especializado"] as const;
export type Competence = string;
export interface FunctionConfig { functionId: string; label: string; competences: Competence[]; homologated: boolean; source: string | null; validFrom: string; validTo: string | null }

export interface SupportDesignation { personId: string; functionId: string; engagementId: string; schoolId: string; studentIds: string[]; from: string; to: string | null }

/**
 * Competências efetivas = configuração homologada da função vigente na data
 * × designação vigente na mesma data × estudante acompanhado. Sem configuração ⇒ nada.
 */
export function effectiveCompetences(p: { configs: FunctionConfig[]; designations: SupportDesignation[]; personId: string; schoolId: string; studentId: string; date: string }):
  { competences: Competence[]; blockers: string[] } {
  const blockers: string[] = [];
  const ds = p.designations.filter((d) => d.personId === p.personId && d.schoolId === p.schoolId && d.studentIds.includes(p.studentId)
    && d.from <= p.date && (d.to === null || p.date <= d.to));
  if (ds.length === 0) return { competences: [], blockers: ["Sem designação vigente para este estudante nesta data."] };
  const out = new Set<Competence>();
  for (const d of ds) {
    const cfg = p.configs.filter((c) => c.functionId === d.functionId && c.homologated && c.validFrom <= p.date && (c.validTo === null || p.date <= c.validTo));
    if (cfg.length === 0) { blockers.push(`Função "${d.functionId}" sem atribuições homologadas: nenhuma competência concedida.`); continue; }
    if (cfg.length > 1) { blockers.push(`Função "${d.functionId}" com mais de uma configuração vigente: ambígua.`); continue; }
    cfg[0]!.competences.forEach((c) => out.add(c));
  }
  return { competences: [...out].sort(), blockers };
}

/** Configuração não pode herdar competência de outra função: comparação explícita. */
export function sharedWithoutConfig(a: FunctionConfig, b: FunctionConfig): Competence[] {
  return a.competences.filter((c) => b.competences.includes(c));
}

export const MEDIATOR_BLOCKERS = [
  "Atribuições municipais de Mediador Escolar, Profissional de Apoio Escolar e Acompanhante Especializado em Itaperuna não verificadas (nenhum ato ou regimento homologado no SIGEM).",
  "Catálogo homologado de categorias de apoio (seção 11) ausente.",
  "Mapeamento cargo→função GPE/Educacenso do mediador não confirmado.",
  "Nenhuma mediação registrada (inclusion_mediation_assignments = 0) e nenhuma concessão NEI: teste com sessão real impossível.",
] as const;
