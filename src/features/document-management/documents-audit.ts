/**
 * SIGEM Documentos — Lote 01: auditoria de Gestão Documental e Protocolo.
 * Mapeia 41 seções + 20 critérios para o que JÁ existe (Studio/GED, DocServ,
 * Tramitação, emissões de relatório, base de conhecimento, verificação pública).
 * Nada aqui cria GED paralelo: lacunas apontam a estrutura a ESTENDER. Nenhum
 * sistema oficial municipal de protocolo foi encontrado no projeto; integração
 * nunca é presumida. Status "homologado" não existe neste mapa.
 */
export type DocAuditStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface DocAuditRow { n: number; title: string; status: DocAuditStatus; reuse: string; tables: string[]; evidence: string[]; gap: string }

const DS = "src/features/document-studio";
const DV = "src/features/docserv";
const WF = "src/features/workflows";
const RP = "src/features/reports";
const M = "drizzle/migrations";
const R = "src/routes";

/** Estruturas canônicas a reutilizar; GED novo deve estender estas, nunca duplicar. */
export const CANONICAL_DOCUMENT_STRUCTURES = {
  modelosEEmissoes: ["studio_template_versions", "studio_template_events", "studio_emissions", "studio_emission_events"],
  documentosFuncionais: ["docserv_document_versions", "docserv_document_events", "docserv_document_types", "docserv_document_policies", "docserv_audit_events", "docserv_purges"],
  tramitacao: ["workflow_definitions", "workflow_instances", "workflow_events", "workflow_outbox"],
  emissoesRelatorio: ["report_emissions"],
  baseConhecimento: ["kb_documents", "kb_document_versions", "kb_document_events"],
} as const;

/** Nomes que indicariam GED/protocolo concorrente. */
export const FORBIDDEN_DUPLICATE_TABLES = ["documents", "documentos", "protocols", "protocolos", "ged_documents", "processos", "tramitacoes"] as const;

export const EXTERNAL_OFFICIAL_SYSTEMS = {
  found: [] as string[],
  note: "Nenhum sistema oficial municipal de protocolo/GED identificado no repositório nem nas integrações cadastradas; integração exige nome do sistema, contrato e decisão da autoridade competente.",
} as const;

const r = (n: number, title: string, status: DocAuditStatus, reuse: string, gap = "", tables: string[] = [], evidence: string[] = []): DocAuditRow =>
  ({ n, title, status, reuse, gap, tables, evidence });

const STUDIO = [`${DS}/studio-cloud.ts`, `${DS}/studio-cloud.test.ts`, `${M}/0266_docs_pro_3_studio_persistence.sql`];
const GED = [`${DS}/ged-core.ts`, `${DS}/ged-core.test.ts`];
const WFE = [`${WF}/workflow-model.test.ts`, `${M}/0090_workflow_engine.sql`];
const DOCS = [`${DV}/documents-model.test.ts`, `${M}/0362_0362_docserv_documents.sql`];
const NO_ACT = "Tipos documentais oficiais, tabela de temporalidade e autoridade competente não fornecidos.";

export const DOC_SECTIONS: readonly DocAuditRow[] = [
  r(1, "Finalidade", "parcial", "Studio + DocServ + Tramitação", "Sem módulo unificado de protocolo; partes existem separadas.", [], [...GED]),
  r(2, "Objetivos", "parcial", "Studio/GED", "Protocolo geral e arquivo não persistidos.", [], GED),
  r(3, "Princípios (autenticidade, integridade, rastreabilidade)", "existente", "Hash SHA-256 e ledgers append-only", "", ["studio_emissions", "docserv_document_versions"], STUDIO),
  r(4, "Conceitos (documento, versão, processo, protocolo)", "parcial", "ged-core.ts", "Processo/protocolo só como regra pura.", [], GED),
  r(5, "Perfis e competências", "bloqueado", "capabilities homologadas", "Capacidades de protocolo/arquivo sem política homologada.", [], [`${DS}/studio-cloud.test.ts`]),
  r(6, "Estrutura organizacional (unidades)", "existente", "institutional_schools + setores", "", [], [`${R}/administracao.tsx`]),
  r(7, "Classificação documental (plano de classificação)", "bloqueado", "—", NO_ACT),
  r(8, "Tipologia documental", "parcial", "GED_TYPES + docserv_document_types", "Lista do GED é fechada no código; tipos oficiais municipais não fornecidos.", ["docserv_document_types"], GED),
  r(9, "Modelos de documento", "existente", "Studio (modelos declarativos homologados)", "", ["studio_template_versions"], STUDIO),
  r(10, "Produção e redação", "existente", "Studio", "", ["studio_template_events"], [`${DS}/studio-engine.test.ts`]),
  r(11, "Numeração oficial", "parcial", "nextNumber (tipo/ano/unidade)", "Numeração sem sequência no banco (sem lock).", [], GED),
  r(12, "Protocolo de entrada", "lacuna", "estender ged-core + workflow", "Sem registro persistido de protocolo de entrada.", [], GED),
  r(13, "Protocolo de saída", "lacuna", "estender ged-core + studio_emissions", "Emissão existe; protocolo de saída não.", ["studio_emissions"], STUDIO),
  r(14, "Autuação de processos", "lacuna", "workflow_instances", "Processo administrativo sem autuação persistida.", ["workflow_instances"], WFE),
  r(15, "Tramitação", "existente", "Motor de workflow versionado", "", ["workflow_events"], WFE),
  r(16, "Despacho", "parcial", "canMove do GED + transição de workflow", "Despacho só como estado puro.", [], GED),
  r(17, "Ciência", "parcial", "estado 'ciente' do GED; leitura de alerta do DocServ", "Ciência persistida só no DocServ.", ["docserv_alert_reads"], GED),
  r(18, "Prazos", "parcial", "process-automation (prazo útil sobre calendário lido)", "Prazos legais não configurados.", [], [`${WF}/process-automation.test.ts`]),
  r(19, "Pendências e filas", "existente", "/pendencias", "", ["workflow_instances"], [`${R}/pendencias.tsx`]),
  r(20, "Anexos", "existente", "bucket privado DocServ + attachmentAllowed", "", ["docserv_document_versions"], DOCS),
  r(21, "Versionamento", "existente", "versões append-only (Studio, DocServ, KB)", "", ["studio_template_versions", "docserv_document_versions", "kb_document_versions"], STUDIO),
  r(22, "Assinatura simples", "parcial", "signatureLabel", "Assinatura simples só como regra pura.", [], GED),
  r(23, "Assinatura qualificada ICP-Brasil", "bloqueado", "signatureLabel recusa sem evidência", "Sem provedor ICP-Brasil contratado.", [], GED),
  r(24, "Autenticidade e verificação pública", "existente", "verify_studio_document / verify_report_emission", "", ["studio_emissions", "report_emissions"], [`${R}/verificar.documento.$codigo.tsx`, `${R}/verificar.relatorio.$codigo.tsx`]),
  r(25, "Integridade (hash)", "existente", "SHA-256 nas emissões", "", ["studio_emissions", "report_emissions"], STUDIO),
  r(26, "Sigilo e acesso restrito", "existente", "RLS + capabilities + URL assinada", "", ["docserv_document_versions"], DOCS),
  r(27, "LGPD e minimização", "existente", "allowlist de verificação pública; inventário de privacidade", "", [], ["src/features/privacy/npriv1-minimization.test.ts"]),
  r(28, "Temporalidade e retenção", "bloqueado", "retentionAction (sem decisão ⇒ retém); docserv_purges", NO_ACT, ["docserv_purges"], GED),
  r(29, "Arquivo corrente/intermediário/permanente", "bloqueado", "estado 'arquivado' do GED", NO_ACT, [], GED),
  r(30, "Eliminação documental", "bloqueado", "docserv_purges exige política aprovada", "Sem tabela de temporalidade aprovada.", ["docserv_purges"], DOCS),
  r(31, "Digitalização", "lacuna", "bucket privado", "Sem padrão de digitalização (resolução, OCR, conferência) definido."),
  r(32, "Busca e recuperação", "parcial", "kb_search (lexical, ACL por versão)", "Sem busca de protocolo.", ["kb_documents"], ["src/features/knowledge-base/kb-core.test.ts"]),
  r(33, "Auditoria e trilha", "existente", "ledgers de eventos + docserv_audit_events", "", ["docserv_audit_events", "studio_emission_events"], DOCS),
  r(34, "Notificações", "parcial", "workflow_outbox", "Sem provedor de entrega configurado.", ["workflow_outbox"], WFE),
  r(35, "Integração com setores do SIGEM", "parcial", "Studio por setor, DocServ, relatórios", "Protocolo não ligado aos processos setoriais.", [], [`${DS}/sector-pack.test.ts`]),
  r(36, "Integração com sistemas oficiais municipais", "bloqueado", "—", EXTERNAL_OFFICIAL_SYSTEMS.note),
  r(37, "Relatórios e indicadores", "parcial", "motor de relatórios + report_emissions", "Sem relatórios de protocolo.", ["report_emissions"], [`${RP}/report-engine.test.ts`]),
  r(38, "Interface e acessibilidade", "parcial", "Central de documentos, Catálogo, DocServ", "Sem tela de protocolo; verificação móvel autenticada não feita.", [], [`${R}/central-de-documentos.tsx`, `${R}/docserv.tsx`]),
  r(39, "Executor técnico", "existente", "environment-gate fail-closed; técnico nunca autor", "", [], ["src/test/invariants/environment-gate.test.ts"]),
  r(40, "Plano de implementação", "parcial", "este mapa", "Abre o plano dos lotes seguintes.", [], ["src/features/document-management/documents-audit.test.ts"]),
  r(41, "Resultado institucional", "bloqueado", "—", "Nenhuma homologação humana registrada."),
];

export const DOC_CRITERIA: readonly DocAuditRow[] = [
  r(1, "Sem sistema concorrente ao oficial", "existente", "nenhuma tabela duplicada (teste)", "", [], ["src/features/document-management/documents-audit.test.ts"]),
  r(2, "Autoria verdadeira (pessoa natural)", "existente", "writers studio_* revalidam ator", "", ["studio_template_events"], STUDIO),
  r(3, "Versões imutáveis", "existente", "append-only", "", ["studio_template_versions", "docserv_document_versions"], STUDIO),
  r(4, "Hash de integridade", "existente", "SHA-256", "", ["studio_emissions"], STUDIO),
  r(5, "Numeração única por tipo/ano/unidade", "parcial", "nextNumber", "Sem garantia de unicidade no banco.", [], GED),
  r(6, "Protocolo com data e hora oficiais", "lacuna", "—", "Protocolo não persistido."),
  r(7, "Tramitação rastreável", "existente", "workflow_events seq contínuo", "", ["workflow_events"], WFE),
  r(8, "Despacho por autoridade competente", "bloqueado", "capability por transição", "Competências não homologadas."),
  r(9, "Prazos calculados por calendário", "parcial", "process-automation", "Prazos não configurados.", [], [`${WF}/process-automation.test.ts`]),
  r(10, "Acesso por RLS", "existente", "RLS em todas as tabelas canônicas", "", ["docserv_document_versions", "studio_emissions"], DOCS),
  r(11, "Sigilo de dado sensível", "existente", "allowlist pública + bucket privado", "", [], GED),
  r(12, "Verificação pública sem enumeração", "existente", "código opaco", "", ["studio_emissions"], [`${R}/verificar.documento.$codigo.tsx`]),
  r(13, "Assinatura não rotulada como ICP sem evidência", "existente", "signatureLabel", "", [], GED),
  r(14, "Retenção sem decisão sempre retém", "existente", "retentionAction", "", [], GED),
  r(15, "Eliminação só com política aprovada", "existente", "docserv_purges", "", ["docserv_purges"], DOCS),
  r(16, "Trilha de auditoria completa", "existente", "ledgers de eventos", "", ["docserv_audit_events"], DOCS),
  r(17, "Executor técnico restrito e fail-closed", "existente", "environment-gate", "", [], ["src/test/invariants/environment-gate.test.ts"]),
  r(18, "Temporalidade (vigência e conhecimento)", "parcial", "versões com recorded_at", "Leitura knownAt só em parte das fontes.", [], STUDIO),
  r(19, "Busca respeita ACL", "existente", "kb_search INVOKER", "", ["kb_documents"], ["src/features/knowledge-base/kb-core.test.ts"]),
  r(20, "Fluxos homologados pela autoridade competente", "bloqueado", "—", "Nenhuma homologação humana registrada."),
];

export const docAuditSummary = (rows: readonly DocAuditRow[]) =>
  rows.reduce<Record<DocAuditStatus, number>>((a, x) => ((a[x.status] += 1), a), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function docAuditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const out: string[] = [];
  for (const x of [...DOC_SECTIONS, ...DOC_CRITERIA]) {
    if (x.status === "existente" && x.evidence.length === 0) out.push(`${x.n}: existente sem evidência`);
    if (x.status !== "existente" && !x.gap) out.push(`${x.n}: lacuna sem descrição`);
    for (const e of x.evidence) if (!exists(e)) out.push(`${x.n}: evidência ausente ${e}`);
    for (const t of x.tables) if (!tableKnown(t)) out.push(`${x.n}: tabela desconhecida ${t}`);
  }
  return out;
}
