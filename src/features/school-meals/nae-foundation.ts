// NAE.0 — catálogo do Núcleo de Alimentação Escolar: capabilities, estágios do fluxo e bloqueios.
// Nada aqui concede permissão: capability só vale com regra em política homologada + atuação vigente.

export type MealScope = "rede" | "escola";

export interface MealCapability {
  id: string;
  label: string;
  scopes: MealScope[];
  sensitive?: boolean;
  /** "existente" = já usada por writer/reader; "catalogo" = reservada, sem writer até NAE.1+. */
  status: "existente" | "catalogo";
}

export const NAE_CAPABILITIES: MealCapability[] = [
  { id: "manter-planejamento-nutricional", label: "Manter planejamento nutricional", scopes: ["rede"], status: "catalogo" },
  { id: "manter-catalogo-tecnico-alimentar", label: "Manter catálogo técnico", scopes: ["rede"], status: "catalogo" },
  { id: "manter-parametros-nutricionais", label: "Manter parâmetros nutricionais", scopes: ["rede"], status: "catalogo" },
  { id: "administrar-janela-de-pedido-alimentar", label: "Administrar janelas de pedido", scopes: ["rede"], status: "catalogo" },
  { id: "submeter-pedido-alimentar", label: "Submeter pedido escolar", scopes: ["escola", "rede"], status: "catalogo" },
  { id: "analisar-pedido-alimentar", label: "Analisar pedido", scopes: ["rede"], status: "catalogo" },
  { id: "autorizar-pedido-alimentar", label: "Autorizar pedido", scopes: ["rede"], status: "catalogo" },
  { id: "consolidar-demanda-alimentar", label: "Consolidar demanda", scopes: ["rede"], status: "catalogo" },
  { id: "registrar-programacao-de-entrega-alimentar", label: "Registrar programação de entrega", scopes: ["rede"], status: "catalogo" },
  { id: "conferir-recebimento-alimentar", label: "Conferir recebimento", scopes: ["escola", "rede"], status: "catalogo" },
  { id: "registrar-nao-conformidade-alimentar", label: "Registrar não conformidade", scopes: ["escola", "rede"], status: "catalogo" },
  { id: "registrar-estoque-alimentar", label: "Registrar estoque/inventário", scopes: ["escola", "rede"], status: "existente" },
  { id: "registrar-execucao-alimentacao", label: "Registrar execução/refeições", scopes: ["escola", "rede"], status: "existente" },
  { id: "acompanhar-alimentacao-rede", label: "Consultar rede", scopes: ["rede"], status: "existente" },
  { id: "publicar-cardapio-escolar", label: "Publicar cardápio", scopes: ["escola", "rede"], status: "existente" },
  { id: "consultar-restricao-alimentar", label: "Consultar restrição alimentar mínima", scopes: ["escola", "rede"], sensitive: true, status: "existente" },
  { id: "gerir-documentos-alimentacao", label: "Gerir documentos do Núcleo", scopes: ["rede"], status: "catalogo" },
  { id: "exportar-relatorios-alimentacao", label: "Exportar relatórios", scopes: ["rede"], status: "catalogo" },
];

/** Estágios distintos do fluxo documentado; nenhum deriva do outro. */
export const NAE_FLOW = [
  "planejamento", "dimensionamento", "pedido", "autorizacao", "consolidacao",
  "recebimento", "estoque", "execucao", "fechamento",
] as const;
export type NaeStage = (typeof NAE_FLOW)[number];

export type NaeBlock = "BLOCKED_BY_HOMOLOGATED_RULE" | "BLOCKED_BY_OFFICIAL_SOURCE";
export const NAE_BLOCKERS: { id: string; block: NaeBlock }[] = [
  { id: "janela-prazo-do-pedido", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "formula-teto-per-capita-embalagem", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "saldo-de-estoque-no-pedido", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "restricoes-por-categoria", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "formula-de-adesao", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "baixa-observada-vs-teorica", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "alcadas-financeiras-compra-fornecedor", block: "BLOCKED_BY_OFFICIAL_SOURCE" },
  { id: "fatores-de-conversao", block: "BLOCKED_BY_HOMOLOGATED_RULE" },
  { id: "frequencia-de-entrega-por-contrato", block: "BLOCKED_BY_OFFICIAL_SOURCE" },
  { id: "cardapios-e-itens-normalizados", block: "BLOCKED_BY_OFFICIAL_SOURCE" },
];

/** Quantidade ausente nunca vira zero; planejado e executado nunca se fundem. */
export function naeQuantity(v: number | null | undefined): number | "UNKNOWN" {
  return v === null || v === undefined || Number.isNaN(v) ? "UNKNOWN" : v;
}
export function plannedVsExecuted(planned: number | null, executed: number | null) {
  return { planned: naeQuantity(planned), executed: naeQuantity(executed),
    difference: planned == null || executed == null ? "UNKNOWN" as const : executed - planned };
}
