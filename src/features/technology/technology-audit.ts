// SIGEM Tecnologia — L01: auditoria de fontes canônicas e lacunas. Sem migration: não cria entidade alguma.
// Equipamento é bem permanente (ops_assets), ambiente é espaço (ops_spaces), chamado é solicitação compartilhada
// (ops_requests) e atendimento é ordem de serviço (ops_service_orders): a Tecnologia ESTENDE essas cadeias, nunca as copia.
const D = "drizzle/migrations";
const S = "supabase/migrations";

export interface CanonicalSource { tables: readonly string[]; migration: string; note: string }
export const TECH_CANONICAL_SOURCES: Record<string, CanonicalSource> = {
  escolas: { tables: ["institutional_schools"], migration: `${S}/20260929031130_3348d211-7583-485d-94db-42a059e1a09b.sql`, note: "Cadastro único da unidade; laboratório/conectividade referenciam a escola, nunca a recadastram." },
  pessoas: { tables: ["institutional_persons", "institutional_engagements"], migration: `${D}/0003_b3_1_chain_hardening_apply.sql`, note: "Técnico/usuário = pessoa + atuação vigente; cargo não autoriza." },
  autorizacao: { tables: ["capability_policies"], migration: `${S}/20260929005850_39761935-6524-45ac-a91b-3237c9d90f23.sql`, note: "Competência só por capability homologada (has_capability/effective_capabilities)." },
  patrimonio: { tables: ["ops_assets", "ops_asset_events", "ops_asset_category_versions"], migration: `${D}/0414_ops09_assets.sql`, note: "Equipamento de TI é bem permanente: categoria aprovada, localização e responsável na cadeia do bem." },
  infraestrutura: { tables: ["ops_spaces", "ops_space_versions"], migration: `${D}/0405_ops03_infrastructure_spaces.sql`, note: "Laboratório, sala de servidor e ponto de rede são espaços/instalações da hierarquia." },
  infraestruturaCenso: { tables: ["school_infrastructure_attribute_versions"], migration: `${D}/0105_school_infrastructure_facts.sql`, note: "Internet/banda declaradas ao Censo são fato versionado, não medição." },
  chamados: { tables: ["ops_requests", "ops_request_events"], migration: `${D}/0403_ops02_shared_requests.sql`, note: "Chamado técnico = solicitação compartilhada com setor próprio, não fila paralela." },
  manutencao: { tables: ["ops_maintenance_orders"], migration: `${D}/0408_ops05_maintenance_orders.sql`, note: "Manutenção de equipamento segue a ordem L05." },
  servicos: { tables: ["ops_service_orders"], migration: `${D}/0409_ops06_service_orders.sql`, note: "Atendimento efetivo, com evidência e confirmação por pessoa ≠ executor." },
  documentos: { tables: ["admin_case_files", "protocol_registrations"], migration: `${D}/0387_doc07_administrative_cases.sql`, note: "Termos, laudos e processos pelo SIGEM Documentos; protocolo único." },
  formacao: { tables: ["dev_classes", "dev_certifications"], migration: `${D}/0431_dev02_core_formation_chain.sql`, note: "Formação em tecnologia educacional é turma do SIGEM Desenvolvimento." },
  tarefas: { tables: ["operational_tasks"], migration: `${D}/0095_operational_tasks.sql`, note: "Providência vira tarefa da central única." },
  notificacoes: { tables: ["notification_events"], migration: `${D}/0077_notifications_infrastructure.sql`, note: "Avisos só pela camada única." },
  integracoes: { tables: ["integration_keys"], migration: `${D}/0091_integration_api_webhooks.sql`, note: "Sistema externo só por chave de máquina e endpoint fechado." },
};

/** Tabelas que NÃO podem nascer na Tecnologia, porque duplicariam fonte canônica. */
export const FORBIDDEN_TECH_DUPLICATES = ["tech_schools", "tech_users", "tech_staff", "tech_assets", "equipamentos", "tech_rooms", "tech_tickets_paralelo", "helpdesk_tickets", "tech_documents", "tech_courses"] as const;

/** Lacunas reais verificadas no banco (nenhuma tabela de TI existe hoje). */
export interface TechGap { id: string; title: string; extends: keyof typeof TECH_CANONICAL_SOURCES; gap: string; dependency: string | null }
export const TECH_GAPS: readonly TechGap[] = [
  { id: "g1", title: "Atributos técnicos do equipamento (série, sistema, especificação)", extends: "patrimonio", gap: "Bem não tem ficha técnica; deve ser filho versionado de ops_assets.", dependency: null },
  { id: "g2", title: "Setor 'tecnologia' em solicitações e ordens", extends: "chamados", gap: "Catálogo de setores L02 não declara tecnologia.", dependency: null },
  { id: "g3", title: "Catálogo de serviços/SLA de suporte", extends: "chamados", gap: "Sem catálogo aprovado; prazo só de regra homologada.", dependency: "Regra de atendimento aprovada pela Secretaria." },
  { id: "g4", title: "Conectividade medida por escola", extends: "infraestruturaCenso", gap: "Só há declaração ao Censo; medição exige fonte e provedor.", dependency: "Contrato/provedor de conectividade identificado." },
  { id: "g5", title: "Contas e acessos a sistemas educacionais", extends: "autorizacao", gap: "Sem inventário de sistemas externos; nenhum contrato registrado.", dependency: "Sistemas e contratos reais." },
  { id: "g6", title: "Licenças de software", extends: "documentos", gap: "Licença deve ser documento/contrato juntado; nenhum registrado.", dependency: "Contratos de licença reais." },
  { id: "g7", title: "Empréstimo de equipamento a estudante/servidor", extends: "patrimonio", gap: "Termo de responsabilidade e cadeia de cessão inexistentes.", dependency: "Norma de cessão aprovada." },
  { id: "g8", title: "Laboratórios e agenda de uso", extends: "infraestrutura", gap: "Tipo de espaço 'laboratório' não aprovado; agenda inexistente.", dependency: null },
  { id: "g9", title: "Formação em tecnologia educacional", extends: "formacao", gap: "Nenhum programa/curso cadastrado; usar cadeia L02 do Desenvolvimento.", dependency: null },
  { id: "g10", title: "Capabilities do setor de Tecnologia", extends: "autorizacao", gap: "Nenhuma capability de tecnologia definida ou atribuída.", dependency: "Política de capacidades homologada." },
];

/** Especificação de 49 seções e 18 critérios: os títulos dependem do documento enviado, que não está no projeto. */
export const SPEC_STATUS = {
  sectionsExpected: 49,
  criteriaExpected: 18,
  documentInProject: false,
  note: "Documento da especificação não localizado nos arquivos enviados; títulos das 49 seções e 18 critérios não são inventados.",
} as const;

export function techAuditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const p: string[] = [];
  for (const [k, s] of Object.entries(TECH_CANONICAL_SOURCES)) {
    if (!exists(s.migration)) p.push(`${k}: migration ausente ${s.migration}`);
    for (const t of s.tables) if (!tableKnown(t)) p.push(`${k}: tabela não nasce na migration citada ${t}`);
  }
  for (const g of TECH_GAPS) if (!(g.extends in TECH_CANONICAL_SOURCES)) p.push(`${g.id}: fonte inexistente`);
  return p;
}
