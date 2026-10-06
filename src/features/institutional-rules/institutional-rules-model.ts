/**
 * BT — Regras institucionais consumidas por motores oficiais (seis domínios).
 * Contrato da tela: só nomeia domínios, endpoints e estados projetados pelo banco.
 * Nenhum valor, prazo, percentual, fórmula ou tipo de ocorrência é sugerido aqui.
 */
export type RuleDomain =
  | "correcao-diario" | "correcao-avaliacao" | "fechamento-ciclo"
  | "calculo-frequencia" | "tipo-ocorrencia-frequencia" | "configuracao-colegiado";

export type RuleDomainInfo = Readonly<{
  id: RuleDomain;
  label: string;
  /** Domínio com vigência própria (valid_from obrigatório). */
  temporal: boolean;
  draftRpc: string;
  homologateRpc: string;
  configureCapability: string;
  homologateCapability: string;
  /** Campos do contrato fechado (o banco recusa qualquer outro). */
  fields: readonly string[];
}>;

export const RULE_DOMAINS: readonly RuleDomainInfo[] = [
  { id: "correcao-diario", label: "Política de correção do Diário", temporal: true,
    draftRpc: "record_diary_correction_policy_draft", homologateRpc: "homologate_diary_correction_policy",
    configureCapability: "configurar-politica-correcao-diario", homologateCapability: "homologar-politica-correcao-diario",
    fields: ["familyId", "appliesWhenOfficialClosing", "outcome", "requiredCapabilities", "requirementCodes", "admissibleChanges", "definition"] },
  { id: "correcao-avaliacao", label: "Política de correção de Avaliação", temporal: true,
    draftRpc: "record_assessment_correction_policy_draft", homologateRpc: "homologate_assessment_correction_policy",
    configureCapability: "configurar-politica-correcao-avaliacao", homologateCapability: "homologar-politica-correcao-avaliacao",
    fields: ["classId", "appliesWhenPeriodClosing", "outcome", "requiredCapabilities", "requirementCodes", "admissibleValueKinds", "definition"] },
  { id: "fechamento-ciclo", label: "Política de Fechamento de Ciclo", temporal: false,
    draftRpc: "record_cycle_closing_policy_draft", homologateRpc: "homologate_cycle_closing_policy",
    configureCapability: "configurar-encerramento", homologateCapability: "homologar-encerramento",
    fields: ["definition", "closingCapabilities", "rectificationCapabilities", "reopeningCapabilities"] },
  { id: "calculo-frequencia", label: "Política de Cálculo de Frequência", temporal: true,
    draftRpc: "record_attendance_calculation_policy_draft", homologateRpc: "homologate_attendance_calculation_policy",
    configureCapability: "configurar-politica-calculo-frequencia", homologateCapability: "homologar-politica-calculo-frequencia",
    fields: ["definition"] },
  { id: "tipo-ocorrencia-frequencia", label: "Tipo de Ocorrência de Frequência", temporal: true,
    draftRpc: "record_attendance_occurrence_type_draft", homologateRpc: "homologate_attendance_occurrence_type",
    configureCapability: "configurar-tipos-ocorrencia-frequencia", homologateCapability: "homologar-tipos-ocorrencia-frequencia",
    fields: ["code", "label", "description", "requiresDocument"] },
  { id: "configuracao-colegiado", label: "Configuração de Colegiado", temporal: false,
    draftRpc: "record_collegial_body_configuration_draft", homologateRpc: "homologate_collegial_body_configuration",
    configureCapability: "configurar-colegiado", homologateCapability: "homologar-colegiado",
    fields: ["definition", "conductCapabilities"] },
];

export const ruleDomain = (id: string) => RULE_DOMAINS.find((d) => d.id === id) ?? null;

export type RuleVersionState = "rascunho" | "rascunho-superado" | "homologada-futura" | "vigente" | "expirada" | "superada";

export const STATE_LABEL: Record<RuleVersionState, string> = {
  rascunho: "Rascunho (não vale)",
  "rascunho-superado": "Rascunho superado por versão posterior (não vale)",
  "homologada-futura": "Homologada, vigência ainda não iniciada",
  vigente: "Homologada e vigente",
  expirada: "Homologada, vigência encerrada",
  superada: "Homologada, substituída por versão posterior",
};

export const stateLabel = (s: string) => STATE_LABEL[s as RuleVersionState] ?? `Estado não reconhecido (${s})`;

export type RuleVersionRow = Readonly<{
  logicalId: string; version: number; state: string; validFrom: string | null; validUntil: string | null;
  payload: Record<string, any>; reason: string; recordedAt: string; homologatedAt: string | null;
}>;

/** Leitura do domínio: estado explícito; nunca "lista vazia" para acesso negado ou falha. */
export type DomainRead =
  | { kind: "acesso-negado" }
  | { kind: "sem-sessao" }
  | { kind: "falha"; message: string }
  | { kind: "lido"; rows: RuleVersionRow[] };

export function classifyReadError(message: string): DomainRead {
  if (/session:required/.test(message)) return { kind: "sem-sessao" };
  if (/access-denied|permission denied/.test(message)) return { kind: "acesso-negado" };
  return { kind: "falha", message };
}

/** Resumo do domínio: "não configurado" só quando a leitura foi permitida e não há versão alguma. */
export function domainSummary(read: DomainRead): string {
  if (read.kind === "acesso-negado") return "Acesso negado: sua atuação não tem as capacidades deste domínio.";
  if (read.kind === "sem-sessao") return "Entre com uma conta institucional para consultar.";
  if (read.kind === "falha") return "Não foi possível ler este domínio.";
  if (!read.rows.length) return "Não configurado: nenhuma versão registrada. Sem regra homologada, o motor não conclui.";
  const vig = read.rows.filter((r) => r.state === "vigente").length;
  const dr = read.rows.filter((r) => r.state === "rascunho").length;
  return `${vig} versão(ões) vigente(s); ${dr} rascunho(s) aguardando homologação.`;
}

/** Próxima base esperada: maior versão conhecida (0 quando não há nenhuma). */
export const expectedHead = (rows: readonly RuleVersionRow[], logicalId: string) =>
  rows.filter((r) => r.logicalId === logicalId).reduce((m, r) => Math.max(m, r.version), 0);
