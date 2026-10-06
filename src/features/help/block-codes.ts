// BK — registro único dos códigos de bloqueio. Cada código diz o que está indisponível,
// por quê, qual dependência falta e quem resolve (null quando ainda não é conhecido).
// Não é norma: só descreve dependências reais do sistema atual.
export type BlockKind = "institucional" | "fonte-externa" | "plataforma" | "decisao-humana";
export type BlockCode = Readonly<{ code: string; kind: BlockKind; unavailable: string; why: string; missing: string; resolver: string | null }>;

export const BLOCK_CODES: readonly BlockCode[] = [
  { code: "REAL_2027_CONFIGURATION_PENDING", kind: "decisao-humana", unavailable: "Operação do ano letivo 2027", why: "2027 ainda não foi configurado nem aberto", missing: "calendário, matrizes, turmas, grades, atribuições homologadas e ato de abertura", resolver: "Supervisão, gestão pedagógica e Administração Geral, em /preparacao-2027" },
  { code: "DP_FILE_CONTRACT_PENDING", kind: "fonte-externa", unavailable: "Leitura da planilha oficial do DP externo", why: "o DP é externo e o leiaute da planilha não foi entregue", missing: "identificadores estáveis, snapshot ou delta, múltiplos vínculos, competência/vigência e semântica de ausência", resolver: "Departamento Pessoal externo" },
  { code: "EDUCACENSO_LAYOUT_BLOCKED_BY_OFFICIAL_SOURCE", kind: "fonte-externa", unavailable: "Importação contínua do Educacenso", why: "não há leiaute oficial vigente no projeto", missing: "leiaute oficial e arquivo de origem", resolver: null },
  { code: "CONTENT_SOURCE_PENDING", kind: "fonte-externa", unavailable: "Conteúdo BNCC/SAEB e textos normativos de ajuda", why: "não há edição oficial importada", missing: "fonte oficial verificável", resolver: "gestão pedagógica da rede" },
  { code: "MENU_CONTENT_PENDING", kind: "fonte-externa", unavailable: "Cardápios da alimentação escolar", why: "nenhum cardápio real foi fornecido", missing: "cardápios da nutrição", resolver: "setor de alimentação escolar" },
  { code: "INVENTORY_CATALOG_PENDING", kind: "institucional", unavailable: "Estoque da alimentação", why: "não há catálogo de itens homologado", missing: "catálogo de itens", resolver: "setor de alimentação escolar" },
  { code: "OFFICIAL_TEMPLATES_PENDING", kind: "institucional", unavailable: "Documentos oficiais em PDF", why: "não há modelo oficial aprovado", missing: "modelo aprovado por documento", resolver: "Secretaria/Supervisão" },
  { code: "ASSESSMENT_RULE_PENDING", kind: "institucional", unavailable: "Cálculo de resultado, publicação à família e alertas", why: "a regra avaliativa/publicação/alerta não está homologada", missing: "regra homologada", resolver: "gestão pedagógica da rede" },
  { code: "AEE_ELIGIBILITY_POLICY_PENDING", kind: "institucional", unavailable: "Elegibilidade automática ao AEE", why: "não há critério institucional", missing: "política de elegibilidade", resolver: "equipe de inclusão da rede" },
  { code: "DATA_RETENTION_POLICY_PENDING", kind: "institucional", unavailable: "Eliminação por prazo", why: "não há prazo decidido; dados são retidos", missing: "decisão de retenção", resolver: "encarregado LGPD/rede" },
  { code: "LEGAL_BASIS_POLICY_PENDING", kind: "institucional", unavailable: "Declaração de base legal por categoria", why: "não há parecer institucional", missing: "decisão jurídica", resolver: "encarregado LGPD/rede" },
  { code: "DISPOSAL_POLICY_PENDING", kind: "institucional", unavailable: "Descarte ou anonimização", why: "não há política; nada é descartado", missing: "política de descarte", resolver: "encarregado LGPD/rede" },
  { code: "EXTERNAL_DELIVERY_PROVIDER_PENDING", kind: "plataforma", unavailable: "Envio de e-mail/SMS de comunicados", why: "nenhum provedor configurado", missing: "provedor e decisão de uso", resolver: null },
  { code: "EXTERNAL_MONITORING_PROVIDER_PENDING", kind: "plataforma", unavailable: "Alertas técnicos externos", why: "nenhum provedor configurado; eventos ficam no log da plataforma", missing: "provedor de monitoramento", resolver: null },
  { code: "PLATFORM_BACKUP_RESTORE_VALIDATION_PENDING", kind: "plataforma", unavailable: "Restauração testada", why: "backup é da plataforma e nunca foi testado aqui", missing: "teste de restauração", resolver: "plataforma" },
  { code: "EXTERNAL_INTEGRATION_UNDEFINED", kind: "fonte-externa", unavailable: "Integração GPE", why: "integração histórica sem contrato ativo; nenhum arquivo é aguardado", missing: "decisão de integração", resolver: null },
];

export const blockByCode = (code: string) => BLOCK_CODES.find((b) => b.code === code) ?? null;
