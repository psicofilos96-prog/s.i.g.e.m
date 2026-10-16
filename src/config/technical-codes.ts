/**
 * Tradução única de códigos técnicos internos (ex.: "ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE")
 * para frases simples em pt-BR, dizendo O QUE falta e ONDE se configura. O código continua
 * existindo na lógica; só a tela muda. Código desconhecido nunca aparece cru.
 */

/** Assunto do parâmetro: o que falta definir e onde. */
const SUBJECT: Record<string, string> = {
  NONCONFORMITY_DEADLINE: "Defina o prazo para resolver não conformidades em Parâmetros",
  ADHESION_METRIC: "Defina como a adesão é calculada em Parâmetros",
  THEORETICAL_STOCK_DEBIT: "Defina a baixa de estoque pelas fichas técnicas em Parâmetros",
  STOCK_BASIS_POLICY: "Defina qual saldo de estoque vale para o pedido em Parâmetros",
  UNIT_CONVERSIONS: "Cadastre as conversões entre unidades em Parâmetros",
  UNIT_CONVERSION: "Cadastre a conversão entre as unidades deste item em Parâmetros",
  QUANTITY_LIMIT: "Defina o limite de quantidade do pedido em Parâmetros",
  PER_CAPITA: "Defina o per capita deste item em Parâmetros",
  MINIMUM_STOCK: "Defina o estoque mínimo em Parâmetros",
  LABEL_TEMPLATE: "Escolha um modelo de etiqueta em Parâmetros",
  MAX_CAPACITY: "Informe a capacidade máxima em Parâmetros",
  CONTRACTUAL_BALANCE: "Informe a carga contratual no cadastro funcional",
  EDUCACENSO_LAYOUT: "Envie o leiaute oficial do Educacenso",
  DP_FILE_CONTRACT_PENDING: "Envie o modelo do arquivo do DP",
  RULE_CALCULATION: "Defina a regra de cálculo em Regras avaliativas",
};

/** Código isolado (sem assunto). */
const LONE: Record<string, string> = {
  BLOCKED_BY_HOMOLOGATED_RULE: "Falta definir este parâmetro em Parâmetros",
  BLOCKED_BY_HOMOLOGATED_RULES: "Falta definir este parâmetro em Parâmetros",
  BLOCKED_BY_OFFICIAL_SOURCE: "Falta o documento oficial de referência",
  BLOCKED_BY_FUNCTIONAL_SOURCE: "Falta a informação no cadastro funcional",
  BLOCKED_BY_SOURCE_FILE: "Falta o arquivo de origem",
  PARAMETER_PENDING: "Falta definir este parâmetro em Parâmetros",
  HOMOLOGATED_RULE_PENDING: "Falta definir este parâmetro em Parâmetros",
  NOT_CONFIGURED: "Ainda não configurado",
  INVENTORY_CATALOG_PENDING: "Cadastre e valide os itens e unidades para usar o estoque",
  STOCK_BASIS_POLICY_PENDING: "Defina qual saldo de estoque vale para o pedido em Parâmetros",
  ADHESION_METRIC_PENDING: "Defina como a adesão é calculada em Parâmetros",
  ASSIGNMENT_PENDING: "Falta escolher quem é responsável",
  REAL_ROLE_ASSIGNMENT_PENDING: "Falta escolher quem é responsável",
  TERRITORIAL_DATA_PENDING: "Faltam os dados de localização",
  OFFICIAL_TEMPLATES_PENDING: "Falta o modelo oficial",
  DOCUMENT_TEMPLATE_PENDING: "Falta o modelo do documento",
  ASSESSMENT_RULE_PENDING: "Defina a regra em Regras avaliativas",
  MENU_CONTENT_PENDING: "Falta cadastrar o cardápio",
  CONTENT_SOURCE_PENDING: "Falta o conteúdo de origem",
};

const GENERIC = "Falta uma configuração para mostrar esta informação";
const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

function phrase(code: string): string {
  const c = code.trim();
  return SUBJECT[c] ?? LONE[c] ?? (/_PENDING$|^BLOCKED_BY_/.test(c) ? GENERIC : c);
}

/** Troca códigos técnicos por frases simples. Texto comum passa intacto. */
export function humanizeTechnical(text: string): string;
export function humanizeTechnical(text: string | null | undefined): string | null | undefined;
export function humanizeTechnical(text: string | null | undefined) {
  if (!text || !CODE.test(text)) return text;
  // "ASSUNTO — MOTIVO" (com espaço livre opcional entre palavras, ex.: "RULE CALCULATION")
  let out = text.replace(/\b([A-Z][A-Z0-9_ ]*[A-Z0-9])\s+[—-]\s+([A-Z][A-Z0-9_]+)\b/g, (all, subj: string, why: string) => {
    const key = subj.replace(/\s+/g, "_");
    if (SUBJECT[key]) return SUBJECT[key]!;
    if (!CODE.test(why) && !CODE.test(key)) return all;
    return LONE[why] ?? (LONE[key] ? LONE[key]! : GENERIC);
  });
  out = out.replace(new RegExp(CODE.source, "g"), (c) => {
    const p = phrase(c);
    return p === c && !/_PENDING$|^BLOCKED_BY_/.test(c) && !SUBJECT[c] ? c : p;
  });
  return out;
}

/** Só para a tela: código com cara de constante interna e não traduzido vira frase genérica. */
export function humanizeForScreen(text: string | null | undefined): string | null | undefined {
  const h = humanizeTechnical(text);
  if (!h) return h;
  return h.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/g, (c) => (SUBJECT[c] || LONE[c] ? phrase(c) : GENERIC));
}
