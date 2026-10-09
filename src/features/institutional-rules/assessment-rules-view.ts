/**
 * NAVRULES.1 — projeção legível das regras de Avaliação lidas por `institutional_rule_versions_at`.
 * Só apresenta o que o banco devolveu: nenhum valor é sugerido, calculado ou traduzido por palpite.
 */
import { ruleDomain, stateLabel, type DomainRead, type RuleVersionRow } from "./institutional-rules-model";

export const ASSESSMENT_RULE_DOMAIN = "correcao-avaliacao" as const;
const INFO = ruleDomain(ASSESSMENT_RULE_DOMAIN)!;

const FIELD_LABEL: Record<string, string> = {
  classId: "Turma",
  appliesWhenPeriodClosing: "Vale quando o período está fechado",
  outcome: "Resultado da correção",
  requiredCapabilities: "Capacidades exigidas",
  requirementCodes: "Exigências",
  admissibleValueKinds: "Tipos de resultado admitidos",
  definition: "Definição",
};

export type ReadableField = { label: string; value: string };

function readable(v: unknown): string {
  if (v === null || v === undefined || v === "") return "Não informado";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.map(readable).join(", ") : "Nenhum";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Campos do conteúdo na ordem do contrato; campo fora do contrato aparece com o nome técnico. */
export function readablePayload(payload: Record<string, unknown>): ReadableField[] {
  const keys = [...INFO.fields.filter((f) => f in payload), ...Object.keys(payload).filter((k) => !INFO.fields.includes(k))];
  return keys.map((k) => ({ label: FIELD_LABEL[k] ?? k, value: readable(payload[k]) }));
}

export type RuleGroup = { logicalId: string; current: RuleVersionRow | null; versions: RuleVersionRow[] };

/** Agrupa por regra lógica; histórico em ordem decrescente de versão; "vigente" só se o banco disse. */
export function groupRules(rows: readonly RuleVersionRow[]): RuleGroup[] {
  const by = new Map<string, RuleVersionRow[]>();
  for (const r of rows) by.set(r.logicalId, [...(by.get(r.logicalId) ?? []), r]);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([logicalId, vs]) => {
    const versions = [...vs].sort((a, b) => b.version - a.version);
    return { logicalId, versions, current: versions.find((v) => v.state === "vigente") ?? null };
  });
}

export type AssessmentRulesState =
  | { kind: "sem-sessao" | "acesso-negado" | "falha" | "vazio" | "sem-homologada"; text: string }
  | { kind: "com-homologada"; text: string };

export function assessmentRulesState(read: DomainRead): AssessmentRulesState {
  if (read.kind === "sem-sessao") return { kind: "sem-sessao", text: "Entre com uma conta institucional para consultar as regras de Avaliação." };
  if (read.kind === "acesso-negado") return { kind: "acesso-negado", text: "Sua atuação não tem capacidade para consultar as regras de Avaliação." };
  if (read.kind === "falha") return { kind: "falha", text: "Não foi possível ler as regras de Avaliação agora." };
  if (!read.rows.length) return { kind: "vazio", text: "Nenhuma regra de Avaliação registrada. Sem regra homologada, correções de resultado ficam bloqueadas." };
  if (!read.rows.some((r) => r.state === "vigente")) return { kind: "sem-homologada", text: "Há versões registradas, mas nenhuma está homologada e vigente hoje. Sem regra homologada, correções de resultado ficam bloqueadas." };
  return { kind: "com-homologada", text: "Há regra homologada e vigente." };
}

/** Ações só pelas capacidades efetivas; a gravação continua nos writers do banco. */
export function assessmentRuleActions(capabilities: readonly string[]) {
  return { draft: capabilities.includes(INFO.configureCapability), homologate: capabilities.includes(INFO.homologateCapability) };
}

export { stateLabel, INFO as ASSESSMENT_RULE_INFO };
