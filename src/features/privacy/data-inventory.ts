// Inventário técnico de dados por domínio. Não é parecer jurídico: base legal, prazo de
// retenção e política de eliminação são DECISÃO INSTITUCIONAL e ficam `null` até decididas.

export type Sensitivity = "comum" | "pessoal" | "pessoal-crianca" | "sensivel";

export type InventoryEntry = Readonly<{
  domain: string;
  category: string;
  sensitivity: Sensitivity;
  /** Titular pode ser criança/adolescente (proteção reforçada). */
  minors: boolean;
  source: string;
  purpose: string; // finalidade funcional no sistema, não base legal
  access: string; // escopo técnico de acesso
  tables: readonly string[];
  readers: readonly string[];
  exports: string;
  logs: string;
  attachments: string | null;
  projections: string;
}>;

export const SIGNED_URL_TTL_SECONDS = 60;

export const DATA_INVENTORY: readonly InventoryEntry[] = [
  { domain: "vida-escolar", category: "identificação do estudante", sensitivity: "pessoal-crianca", minors: true, source: "Secretaria escolar / importação governada", purpose: "identificar o estudante na matrícula e documentos", access: "capability escolar + RLS por escola", tables: ["institutional_students", "student_identity_versions", "student_official_identifiers"], readers: ["global_search (nome; identificador só por igualdade)", "rosterStudents"], exports: "motor de relatórios; colunas sensitive fora por padrão", logs: "nunca (telemetria descarta objetos; CPF/e-mail mascarados)", attachments: null, projections: "Diário, Mapa/CIECE (contagens)" },
  { domain: "vida-escolar", category: "matrícula, participação, alocação, movimentação", sensitivity: "pessoal-crianca", minors: true, source: "writers B3", purpose: "trajetória escolar", access: "capability escolar", tables: ["school_enrollments", "cycle_participations", "class_enrollment_episodes", "student_movement_events"], readers: ["class_allocations_at", "class_occupancy_at"], exports: "motor de relatórios", logs: "nunca", attachments: null, projections: "Mapa/CIECE agregados" },
  { domain: "diario", category: "frequência, notas, pareceres", sensitivity: "pessoal-crianca", minors: true, source: "docente via writers do Diário", purpose: "registro pedagógico e situação acadêmica", access: "regência/atuação vigente + capability", tables: ["attendance_record_versions", "assessment_entry_versions", "descriptive_report_versions", "academic_standing_versions"], readers: ["readers do Diário (INVOKER)"], exports: "Pauta/relatórios autorizados", logs: "nunca (chaves nota/grade/score redigidas)", attachments: null, projections: "dashboards com supressão de grupos pequenos" },
  { domain: "inclusao", category: "registros NEI/AEE/mediação e anexos", sensitivity: "sensivel", minors: true, source: "equipe de inclusão", purpose: "apoio pedagógico inclusivo", access: "`consultar-apoio-inclusivo` da escola ou mediação vigente; clínico exige capability própria", tables: ["inclusion_records", "inclusion_mediation_assignments", "inclusion_attachments", "inclusion_access_events", "aee_services", "aee_service_slots", "aee_sessions"], readers: ["inclusion_records_at", "aee_services_at", "aee_sessions_at", "inclusion_my_mediated_students", "inclusion_teaching_support_flags"], exports: "minimizedExport (sem autoria, motivos, categorias, anexos)", logs: "trilha inclusion_access_events sem conteúdo", attachments: `bucket privado inclusao-sensivel; URL assinada ${SIGNED_URL_TTL_SECONDS}s após autorização no banco`, projections: "inclusion_network_overview: contagens por escola sem educando, só com capability de rede" },
  { domain: "alimentacao", category: "restrições alimentares", sensitivity: "sensivel", minors: true, source: "escola/família", purpose: "servir refeição adequada", access: "capability de alimentação da escola", tables: ["dietary_restrictions"], readers: ["reader de alimentação"], exports: "não exportado", logs: "nunca", attachments: null, projections: "nenhuma" },
  { domain: "familia", category: "vínculo de responsável e autorização", sensitivity: "pessoal-crianca", minors: true, source: "Secretaria", purpose: "acesso read-only do responsável", access: "autorização vigente do próprio responsável; fail-closed", tables: ["guardian_authorizations"], readers: ["readers da Família"], exports: "nenhum", logs: "nunca", attachments: null, projections: "portal Família derivado" },
  { domain: "documentos", category: "emissões de documento escolar", sensitivity: "pessoal-crianca", minors: true, source: "motor de documentos", purpose: "certificar fatos escolares", access: "capability de emissão; verificação pública mínima", tables: ["school_document_emissions", "school_document_emission_events"], readers: ["verify_school_document (só status/tipo/número/data/hash/public_fields)"], exports: "PDF do snapshot", logs: "nunca", attachments: null, projections: "/verificar sem school_id" },
  { domain: "importacao", category: "linhas de staging", sensitivity: "pessoal-crianca", minors: true, source: "arquivo importado", purpose: "preview e confirmação humana", access: "capability de importação", tables: ["import_batches", "import_batch_rows", "import_batch_events"], readers: ["preview de importação"], exports: "nenhum", logs: "detalhe de importação nunca lido pela auditoria", attachments: null, projections: "nenhuma" },
  { domain: "pessoal", category: "vínculos, lotação, exercício, eventos funcionais", sensitivity: "pessoal", minors: false, source: "Departamento Pessoal", purpose: "gestão funcional", access: "capability DP", tables: ["institutional_persons", "professional_functional_links", "professional_postings", "professional_exercises", "professional_functional_events"], readers: ["readers DP"], exports: "motor de relatórios", logs: "nunca", attachments: null, projections: "nenhuma" },
  { domain: "contas", category: "eventos de credencial e acesso", sensitivity: "pessoal", minors: false, source: "administração de contas", purpose: "segurança", access: "Administração Geral", tables: ["account_credential_events", "user_person_links"], readers: ["admin_account_overview (sem hash/senha/token)"], exports: "auditoria exige `exportar-auditoria`", logs: "nunca credencial", attachments: null, projections: "Central de Auditoria com redact" },
  { domain: "planejamento/avaliacao-docente", category: "planos, itens, mídia", sensitivity: "comum", minors: false, source: "docente", purpose: "planejamento e instrumentos", access: "regência + capability", tables: ["teaching_plan_versions", "teaching_plan_attachments", "assessment_item_versions", "assessment_item_keys", "assessment_item_media"], readers: ["readers de planejamento/avaliação"], exports: "impressão sem gabarito", logs: "nunca", attachments: `buckets privados planejamento-docente/avaliacao-docente; URL assinada ${SIGNED_URL_TTL_SECONDS}s`, projections: "nenhuma" },
  { domain: "portal-publico", category: "publicações autoradas", sensitivity: "comum", minors: false, source: "autor com `publicar-conteudo-publico`", purpose: "transparência", access: "público só publicado", tables: ["public_publications", "public_publication_versions"], readers: ["public_portal_list", "public_portal_get"], exports: "n/a", logs: "nunca", attachments: null, projections: "/publico" },
];

/** Decisões que o sistema NÃO toma. `null` = não decidido ⇒ nada é descartado nem anonimizado. */
export type LifecycleDecision = Readonly<{ domain: string; legalBasis: string | null; retentionDays: number | null; disposal: "eliminar" | "anonimizar" | "arquivar" | null; decidedBy: string | null }>;

export const LIFECYCLE_UNDECIDED: readonly LifecycleDecision[] = [...new Set(DATA_INVENTORY.map((e) => e.domain))].map((domain) => ({
  domain, legalBasis: null, retentionDays: null, disposal: null, decidedBy: null,
}));

/** Só age com decisão completa; sem ela, o registro é retido. Ledgers append-only nunca são apagados por esta função. */
export function lifecycleAction(d: LifecycleDecision, recordAgeDays: number): "reter" | "arquivar" | "anonimizar" | "eliminar" {
  if (d.retentionDays == null || d.disposal == null || !d.decidedBy) return "reter";
  return recordAgeDays > d.retentionDays ? d.disposal === "arquivar" ? "arquivar" : d.disposal === "anonimizar" ? "anonimizar" : "eliminar" : "reter";
}

/** Anonimização que preserva integridade histórica: troca valor por marcador, mantém IDs/versões. */
export function anonymizeFields<T extends Record<string, unknown>>(row: T, fields: readonly (keyof T)[]): T {
  const out = { ...row };
  for (const f of fields) if (f in out) (out as Record<string, unknown>)[f as string] = "[anonimizado]";
  return out;
}
