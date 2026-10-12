/**
 * Centro Integrado de Operações e Recursos Escolares — Lote 01: auditoria.
 * Mapeia 60 seções (20 Transporte, 20 Infraestrutura/Manutenção, 20 Patrimônio/Almoxarifado)
 * + 20 critérios sobre o que JÁ existe. Nada aqui cria cadastro: lacunas apontam a estrutura
 * a ESTENDER. Sistemas municipais (contratos, licitação, contabilidade, frota oficial,
 * patrimônio contábil) NUNCA são presumidos integrados: `MUNICIPAL_SYSTEMS.found` nasce vazio.
 * Status "homologado" não existe.
 */
export type OpsStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export type OpsArea = "transporte" | "infraestrutura" | "patrimonio";
export interface OpsRow { n: number; area: OpsArea | "transversal"; title: string; status: OpsStatus; source: string[]; evidence: string[]; gap: string }

const D = "drizzle/migrations";
const T = "src/features/school-transport";

/** Fontes canônicas — o Centro só LÊ/ESTENDE estas; nunca copia. */
export const CANONICAL_OPS_SOURCES = {
  escolas: { tables: ["institutional_schools"], migration: `${D}/0102_school_registry_revoke_direct_dml.sql`, note: "Cadastro canônico da escola; coordenada só desta fonte." },
  pessoal: { tables: ["institutional_engagements"], migration: `${D}/0003_b3_1_chain_hardening_apply.sql`, note: "Atuação vigente = pessoa responsável; cargo não autoriza." },
  infraestrutura: { tables: ["school_infrastructure_attribute_versions", "school_infrastructure_observations"], migration: `${D}/0105_school_infrastructure_facts.sql`, note: "Infraestrutura como fato versionado (SEMED 09/Educacenso)." },
  transporte: { tables: ["school_transport_facts"], migration: `${D}/0237_n11_2_3_school_transport.sql`, note: "Rota, ponto e vínculo estudante↔ponto append-only." },
  estoqueAlimentacao: { tables: ["meal_stock_counts", "meal_stock_closings"], migration: `${D}/0185_nae4_meal_stock_operational.sql`, note: "Estoque da alimentação é do NAE; almoxarifado geral não o duplica." },
  tarefas: { tables: ["operational_tasks"], migration: `${D}/0095_operational_tasks.sql`, note: "Providência vira tarefa da central única." },
  documentos: { tables: ["admin_case_files"], migration: `${D}/0387_doc07_administrative_cases.sql`, note: "Processos e anexos pelo SIGEM Documentos." },
  notificacoes: { tables: ["notification_events"], migration: `${D}/0077_notifications_infrastructure.sql`, note: "Avisos só pela camada única." },
} as const;
const S_ = CANONICAL_OPS_SOURCES;

/** Sistemas municipais externos: nenhum identificado com contrato e decisão. */
export const MUNICIPAL_SYSTEMS = {
  found: [] as string[],
  requirement: "Integração só com sistema identificado, contrato/termo, credencial e decisão da autoridade competente.",
  domains: ["contratos e licitações", "contabilidade/empenho", "patrimônio contábil", "frota municipal", "almoxarifado central"],
} as const;

/** Tabelas que NÃO podem nascer: duplicariam fonte canônica. */
export const FORBIDDEN_DUPLICATE_TABLES = ["schools", "escolas", "transport_routes", "rotas", "vehicles_copy", "staff", "servidores", "infrastructure", "assets_copy", "estoque_alimentacao"] as const;

const R = (n: number, area: OpsRow["area"], title: string, status: OpsStatus, source: string[] = [], evidence: string[] = [], gap = ""): OpsRow => ({ n, area, title, status, source, evidence, gap });
const tr = (n: number, t: string, s: OpsStatus, src: string[] = [], ev: string[] = [], g = "") => R(n, "transporte", t, s, src, ev, g);
const inf = (n: number, t: string, s: OpsStatus, src: string[] = [], ev: string[] = [], g = "") => R(n, "infraestrutura", t, s, src, ev, g);
const pa = (n: number, t: string, s: OpsStatus, src: string[] = [], ev: string[] = [], g = "") => R(n, "patrimonio", t, s, src, ev, g);
const TRF = [...S_.transporte.tables];

export const OPS_SECTIONS: readonly OpsRow[] = [
  tr(1, "Rotas", "existente", TRF, [S_.transporte.migration]),
  tr(2, "Pontos de embarque", "existente", TRF, [S_.transporte.migration]),
  tr(3, "Vínculo estudante ↔ ponto", "existente", TRF, [S_.transporte.migration]),
  tr(4, "Elegibilidade ao transporte", "bloqueado", [], [], "Nenhuma regra de elegibilidade/distância aprovada."),
  tr(5, "Veículos", "parcial", [], [`${T}/transport-fleet.ts`], "Núcleo puro; sem persistência de veículo."),
  tr(6, "Condutores e documentação", "parcial", [], [`${T}/transport-fleet.ts`], "Núcleo puro; sem persistência."),
  tr(7, "Monitores", "lacuna", [], [], "Sem fonte; depende de atuação canônica."),
  tr(8, "Viagens e autorização", "parcial", [], [`${T}/transport-fleet.ts`], "Autorização só com documentação conhecida."),
  tr(9, "Capacidade e acessibilidade do veículo", "parcial", [], [`${T}/transport-fleet.ts`], "Capacidade desconhecida bloqueia."),
  tr(10, "Contratos de transporte", "bloqueado", [], [], MUNICIPAL_SYSTEMS.requirement),
  tr(11, "Quilometragem e custos", "bloqueado", [], [], "Custo só de fonte contábil real."),
  tr(12, "Frequência no transporte", "lacuna", [], [], "Sem registro de embarque."),
  tr(13, "Ocorrências", "lacuna", [], [], "Estender tarefas/ocorrências."),
  tr(14, "Mapa de rotas", "parcial", [], [`${T}/transport-fleet.ts`], "Coordenada só de fonte declarada."),
  tr(15, "Otimização de rotas", "parcial", [], [`${T}/transport-fleet.ts`], "Só sugere; exige revisão humana."),
  tr(16, "Família e transporte", "bloqueado", [], [`${T}/ntransp3.test.ts`], "Sem seção `transporte` na autorização de responsável."),
  tr(17, "Transporte de estudantes com deficiência", "lacuna", [], [], "Depende de NEI/acessibilidade."),
  tr(18, "Interrupção e contingência", "lacuna", [], [], "Sem plano registrado."),
  tr(19, "Relatórios de transporte", "existente", TRF, [`${T}/transport-report.test.ts`]),
  tr(20, "Tela de transporte", "existente", TRF, [`${T}/transport-page.tsx`]),
  inf(21, "Infraestrutura como fato versionado", "existente", [...S_.infraestrutura.tables], [S_.infraestrutura.migration]),
  inf(22, "Leitura por escopo", "existente", [...S_.infraestrutura.tables], [`${D}/0287_r1_infrastructure_scoped_read.sql`]),
  inf(23, "Cobertura de dados", "existente", [...S_.infraestrutura.tables], [`${D}/0264_perf_loading_3_infra_coverage_reader.sql`]),
  inf(24, "Anexos de infraestrutura", "existente", [], [`${D}/0350_semed_t09_infra_attachments.sql`]),
  inf(25, "Ambientes e espaços", "parcial", [...S_.infraestrutura.tables], [S_.infraestrutura.migration], "Ambiente como entidade não existe."),
  inf(26, "Vistorias", "lacuna", [], [], "Sem registro de vistoria."),
  inf(27, "Solicitação de manutenção", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Ordem de serviço só núcleo puro."),
  inf(28, "Aprovação ≠ solicitante", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Sem persistência."),
  inf(29, "Execução e aceite com evidência", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Sem persistência."),
  inf(30, "Prioridade de manutenção", "bloqueado", [], [], "Critério de prioridade não configurado."),
  inf(31, "Manutenção preventiva", "bloqueado", [], [], "Periodicidade não configurada."),
  inf(32, "Fornecedores e contratos de manutenção", "bloqueado", [], [], MUNICIPAL_SYSTEMS.requirement),
  inf(33, "Segurança predial (AVCB, laudos)", "lacuna", [], [], "Documento via SIGEM Documentos."),
  inf(34, "Acessibilidade arquitetônica", "parcial", [...S_.infraestrutura.tables], [S_.infraestrutura.migration], "Só atributo Educacenso."),
  inf(35, "Obras e reformas", "bloqueado", [], [], "Sem fonte de obras."),
  inf(36, "Custos de manutenção", "bloqueado", [], [], "Custo só de fonte contábil."),
  inf(37, "Tarefas e prazos", "existente", [...S_.tarefas.tables], [S_.tarefas.migration]),
  inf(38, "Integração Educacenso/SEMED 09", "existente", [...S_.infraestrutura.tables], [`${D}/0343_semed_tables_structure_access.sql`]),
  inf(39, "Painel de infraestrutura", "lacuna", [], [], "Painel do Centro (lotes futuros)."),
  inf(40, "Relatórios de infraestrutura", "lacuna", [], [], "Catálogo do Centro."),
  pa(41, "Tombamento", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Núcleo puro; sem persistência."),
  pa(42, "Cadeia de eventos do bem", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Sem persistência."),
  pa(43, "Transferência entre escolas", "lacuna", [], [], "Evento de transferência a persistir."),
  pa(44, "Baixa com motivo", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Sem persistência."),
  pa(45, "Inventário periódico", "bloqueado", [], [], "Periodicidade não configurada."),
  pa(46, "Conciliação com patrimônio contábil", "bloqueado", [], [], MUNICIPAL_SYSTEMS.requirement),
  pa(47, "Responsável pela guarda", "parcial", [...S_.pessoal.tables], [S_.pessoal.migration], "Guarda = atuação vigente; sem registro."),
  pa(48, "Almoxarifado: itens", "lacuna", [], [], "Sem catálogo de itens."),
  pa(49, "Entradas", "lacuna", [], [], "Entrada só com documento de origem."),
  pa(50, "Saídas e requisições", "lacuna", [], [], "Requisição com pessoa real."),
  pa(51, "Saldo de estoque", "lacuna", [], [], "Saldo é projeção de movimentos; nunca gravado."),
  pa(52, "Estoque da alimentação (NAE)", "existente", [...S_.estoqueAlimentacao.tables], [S_.estoqueAlimentacao.migration]),
  pa(53, "Validade e lotes", "lacuna", [], [], "Sem lote."),
  pa(54, "Compras e empenhos", "bloqueado", [], [], MUNICIPAL_SYSTEMS.requirement),
  pa(55, "Doações", "lacuna", [], [], "Entrada com termo de doação."),
  pa(56, "Etiquetas/QR", "lacuna", [], [], "Código opaco, sem dado pessoal."),
  pa(57, "Bens de tecnologia", "lacuna", [], [], "Classe de bem configurável."),
  pa(58, "Furto/extravio", "lacuna", [], [], "Ocorrência com boletim anexado via Documentos."),
  pa(59, "Painel de patrimônio", "lacuna", [], [], "Lotes futuros."),
  pa(60, "Relatórios de patrimônio", "lacuna", [], [], "Lotes futuros."),
];

const C = (n: number, t: string, s: OpsStatus, src: string[] = [], ev: string[] = [], g = "") => R(n, "transversal", t, s, src, ev, g);
export const OPS_CRITERIA: readonly OpsRow[] = [
  C(1, "Escola só do cadastro canônico", "existente", [...S_.escolas.tables], [S_.escolas.migration]),
  C(2, "Pessoa responsável = atuação vigente", "existente", [...S_.pessoal.tables], [S_.pessoal.migration]),
  C(3, "Nenhum cadastro paralelo", "existente", [], ["src/features/operations-center/operations-audit.test.ts"]),
  C(4, "Sistema municipal nunca presumido", "existente", [], ["src/features/operations-center/operations-audit.ts"]),
  C(5, "Fatos append-only", "existente", TRF, [S_.transporte.migration]),
  C(6, "Autoria humana real", "existente", TRF, [S_.transporte.migration]),
  C(7, "Escrita só por writer com capacidade", "existente", TRF, [S_.transporte.migration]),
  C(8, "Sem DML direto para authenticated", "existente", [...S_.escolas.tables], [S_.escolas.migration]),
  C(9, "Aprovador ≠ solicitante", "parcial", [], ["src/features/school-assets/asset-core.ts"], "Sem persistência."),
  C(10, "Custo só de fonte contábil", "bloqueado", [], [], MUNICIPAL_SYSTEMS.requirement),
  C(11, "Ausência nunca vira zero", "existente", [], [`${T}/transport-model.ts`]),
  C(12, "Saldo é projeção, nunca gravado", "lacuna", [], [], "Almoxarifado a construir."),
  C(13, "Endereço de estudante nunca exposto", "existente", [], [`${T}/transport-fleet.ts`]),
  C(14, "Família só com autorização vigente", "bloqueado", [], [], "Seção transporte não decidida."),
  C(15, "Anexos privados pelo SIGEM Documentos", "existente", [...S_.documentos.tables], [S_.documentos.migration]),
  C(16, "Avisos pela camada única", "existente", [...S_.notificacoes.tables], [S_.notificacoes.migration]),
  C(17, "Executor técnico restrito e idempotente", "lacuna", [], [], "Executor do Centro (lotes futuros)."),
  C(18, "Normas só configuradas e aprovadas", "existente", [], ["src/features/school-assets/asset-core.ts"]),
  C(19, "Relatórios pelo motor único", "existente", [], ["src/features/reports/report-engine.ts"]),
  C(20, "Evidência SQL/TS/E2E", "parcial", [], ["src/features/operations-center/operations-audit.test.ts"], "E2E autenticado pendente."),
];

export const opsAuditSummary = (rows: readonly OpsRow[]) =>
  rows.reduce<Record<OpsStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function opsAuditProblems(exists: (p: string) => boolean, tableKnown: (t: string) => boolean): string[] {
  const p: string[] = [];
  if (OPS_SECTIONS.length !== 60) p.push("Esperadas 60 seções.");
  if (OPS_CRITERIA.length !== 20) p.push("Esperados 20 critérios.");
  for (const a of ["transporte", "infraestrutura", "patrimonio"] as const) if (OPS_SECTIONS.filter((r) => r.area === a).length !== 20) p.push(`Área ${a} ≠ 20 seções.`);
  for (const r of [...OPS_SECTIONS, ...OPS_CRITERIA]) {
    for (const e of r.evidence) if (!exists(e)) p.push(`#${r.n} evidência ausente: ${e}`);
    for (const t of r.source) if (!tableKnown(t)) p.push(`#${r.n} fonte desconhecida: ${t}`);
    if (r.status !== "existente" && !r.gap) p.push(`#${r.n} sem lacuna declarada`);
  }
  return p;
}
