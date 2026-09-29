/**
 * 14.3 — Fronteira única de consulta analítica do CIECE.
 *
 * usuário → pessoa → atuação vigente → política homologada → capacidade →
 * escopo → POLÍTICA DE DIVULGAÇÃO → resposta.
 *
 * Autorização (pode consultar?) e divulgação (qual granularidade revelar?) são
 * perguntas separadas. O motor 14.2 só calcula; esta fronteira decide o que sai.
 * O recibo bruto (com referências a sujeitos) NUNCA é devolvido: a resposta é
 * construída campo a campo a partir do que foi autorizado.
 */
import type { SchoolUnit } from "@/features/schools/school-registry";
import type { CanonicalFact } from "./canonical-fact-types";
import { computeIndicator, type GroupResult, type IndicatorRegistry, type IndicatorRequest, type ResultStatus } from "./indicator-engine";

// ---------------- Capacidades analíticas (identificadores; nenhuma concedida) ----------------

export const ANALYTIC_CAPABILITIES = {
  aggregate: "consultar-indicador-agregado",
  decomposition: "consultar-decomposicao-analitica",
  provenance: "consultar-proveniencia-analitica",
  individual: "consultar-informacao-individual-analitica",
} as const;

/** Mesma forma de `effective_capabilities()`; cargo não existe aqui. */
export type AnalyticGrant = {
  capabilityId: string;
  engagementId: string;
  policyId: string;
  policyVersion: number;
  schoolId: string | null;
  classId: string | null;
  componentId: string | null;
  periodId: string | null;
  /** Presente só em concessões de nível institucional (effective_scope_capabilities). */
  scopeLevel?: "escola" | "rede";
};

export type AnalyticAuthority =
  | { status: "signed-out" }
  | { status: "signed-in"; personId: string | null; grants: readonly AnalyticGrant[] };

// ---------------- Política de divulgação (dado homologável) ----------------

export type SmallGroupTreatment = "suprimir-grupo" | "agregar-superior" | "nao-divulgar";

export type DisclosurePolicy = {
  id: string;
  version: number;
  status: "rascunho" | "homologada";
  /** Dimensões cuja decomposição pode ser revelada. Vazio ⇒ só total. */
  decomposableDimensions: readonly string[];
  /** Parâmetro da política; ausente ⇒ nenhum limiar aplicado (declarado, não presumido). */
  minimumGroupSize: number | null;
  smallGroupTreatment: SmallGroupTreatment;
  /** Supressão complementar para impedir reconstrução por diferença. */
  complementarySuppression: boolean;
  provenanceLevel: "nenhuma" | "referencias-institucionais" | "referencias-individuais";
};

export function disclosurePolicyProblems(p: DisclosurePolicy | null | undefined): string[] {
  if (!p) return ["política de divulgação ausente"];
  const out: string[] = [];
  if (p.status !== "homologada") out.push("política de divulgação não homologada");
  if (!Array.isArray(p.decomposableDimensions)) out.push("decomposableDimensions não declarado");
  if (p.minimumGroupSize !== null && !(Number.isInteger(p.minimumGroupSize) && p.minimumGroupSize > 0)) out.push("minimumGroupSize inválido");
  if (!["suprimir-grupo", "agregar-superior", "nao-divulgar"].includes(p.smallGroupTreatment)) out.push("smallGroupTreatment desconhecido");
  if (typeof p.complementarySuppression !== "boolean") out.push("complementarySuppression não declarado");
  if (!["nenhuma", "referencias-institucionais", "referencias-individuais"].includes(p.provenanceLevel)) out.push("provenanceLevel desconhecido");
  return out;
}

// ---------------- Resposta ----------------

export type DisclosedGroupState = ResultStatus | "suprimido-por-politica";

export type DisclosedGroup = {
  groupKey: string | null;
  state: DisclosedGroupState;
  /** Todos nulos quando suprimido: supressão nunca vira zero nem ausência. */
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  coverage: { eligible: number; observed: number; complete: boolean } | null;
  absentSubjects: number | null;
  notApplicableSubjects: number | null;
  indeterminateSubjects: number | null;
  suppressionReason?: string;
};

export type DisclosedProvenance =
  | { level: "referencias-institucionais"; sources: readonly { sourceId: string; recordId: string; recordVersion: number | null; ruleOrPolicyId?: string | undefined; ruleOrPolicyVersion?: number | undefined }[] }
  | { level: "referencias-individuais"; facts: readonly { sourceId: string; recordId: string; recordVersion: number | null; subject: Readonly<Record<string, string>> }[] };

export type AnalyticResponse =
  | { state: "nao-autorizado"; reason: string }
  | { state: "divulgacao-indisponivel"; reason: string }
  | { state: "calculo-recusado"; code: string; detail: string }
  | { state: "nao-divulgavel"; reason: string }
  | {
      state: "respondido";
      indicatorDefinitionId: string;
      definitionVersion: number;
      unit: string;
      disclosurePolicy: { id: string; version: number };
      groupBy: string | null;
      groups: DisclosedGroup[];
      provenance?: DisclosedProvenance;
      limitations: string[];
    };

export type AnalyticQuery = IndicatorRequest & {
  wantProvenance?: boolean;
};

// ---------------- Escopo ----------------

const SCOPE_DIMENSIONS = ["schoolId", "classId", "componentId", "periodId"] as const;

/** Valor de escopo fixado pela consulta (filtro explícito ou referência de período). */
function requestedScope(q: AnalyticQuery): Record<(typeof SCOPE_DIMENSIONS)[number], string | undefined> {
  const f = q.filters ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  return { schoolId: s(f["schoolId"]), classId: s(f["classId"]), componentId: s(f["componentId"]), periodId: s(f["periodId"]) ?? q.reference.periodId };
}

/**
 * A consulta está contida no escopo da concessão quando cada dimensão restrita
 * na concessão está FIXADA na consulta com o mesmo valor. Consulta ampla nunca
 * é aceita por concessão estreita, mesmo sendo agregada.
 */
export function grantCovers(g: AnalyticGrant, q: AnalyticQuery): boolean {
  // Rede é escopo institucional EXPLÍCITO; nunca é inferida de dimensões ausentes.
  if (g.scopeLevel === "rede") return SCOPE_DIMENSIONS.every((d) => g[d] == null);
  const req = requestedScope(q);
  for (const d of SCOPE_DIMENSIONS) {
    const gv = g[d];
    if (gv != null && req[d] !== gv) return false;
  }
  // Concessão sem nenhum escopo não é "rede": nega.
  return SCOPE_DIMENSIONS.some((d) => g[d] != null);
}

function authorizedFor(a: AnalyticAuthority, capabilityId: string, q: AnalyticQuery): AnalyticGrant | null {
  if (a.status !== "signed-in" || !a.personId) return null;
  return a.grants.find((g) => g.capabilityId === capabilityId && grantCovers(g, q)) ?? null;
}

// ---------------- Fronteira ----------------

export function queryAnalytic(input: {
  authority: AnalyticAuthority;
  query: AnalyticQuery;
  registry: IndicatorRegistry;
  facts: readonly CanonicalFact[];
  schools?: readonly SchoolUnit[];
  disclosurePolicy: DisclosurePolicy | null;
}): AnalyticResponse {
  const { authority: a, query: q } = input;
  if (a.status !== "signed-in") return { state: "nao-autorizado", reason: "sessão ausente" };
  if (!a.personId) return { state: "nao-autorizado", reason: "conta sem pessoa institucional" };
  if (a.grants.length === 0) return { state: "nao-autorizado", reason: "nenhuma capacidade efetiva (atuação vigente × política homologada)" };
  if (!authorizedFor(a, ANALYTIC_CAPABILITIES.aggregate, q))
    return { state: "nao-autorizado", reason: "capacidade de consulta agregada ausente para o escopo solicitado" };
  if (q.groupBy && !authorizedFor(a, ANALYTIC_CAPABILITIES.decomposition, q))
    return { state: "nao-autorizado", reason: "decomposição exige capacidade própria no escopo" };
  if (q.wantProvenance && !authorizedFor(a, ANALYTIC_CAPABILITIES.provenance, q))
    return { state: "nao-autorizado", reason: "proveniência exige capacidade própria no escopo" };

  const problems = disclosurePolicyProblems(input.disclosurePolicy);
  if (problems.length) return { state: "divulgacao-indisponivel", reason: problems.join("; ") };
  const policy = input.disclosurePolicy!;
  if (q.groupBy && !policy.decomposableDimensions.includes(q.groupBy))
    return { state: "nao-divulgavel", reason: `decomposição por ${q.groupBy} não admitida pela política de divulgação` };

  const receipt = computeIndicator(input.registry, input.facts, q, input.schools ?? []);
  if (!receipt.ok) return { state: "calculo-recusado", code: receipt.code, detail: receipt.detail };

  const limitations: string[] = [
    "Diferenciação entre consultas sucessivas com filtros distintos não é detectada nesta etapa (sem registro de consultas).",
    ...(policy.complementarySuppression ? [] : ["Supressão complementar desativada pela política: grupo suprimido pode ser dedutível pelo total."]),
  ];
  const min = policy.minimumGroupSize;
  const isSmall = (g: GroupResult) => min !== null && g.eligibleSubjects > 0 && g.eligibleSubjects < min;

  let groups = receipt.groups;
  let groupBy = receipt.groupBy;
  const anySmall = groups.some(isSmall);
  if (anySmall && policy.smallGroupTreatment === "nao-divulgar")
    return { state: "nao-divulgavel", reason: "grupo abaixo do tamanho mínimo declarado na política" };
  if (anySmall && groupBy && policy.smallGroupTreatment === "agregar-superior") {
    const { groupBy: _drop, wantProvenance: _w, ...ungrouped } = q;
    const total = computeIndicator(input.registry, input.facts, ungrouped as IndicatorRequest, input.schools ?? []);
    if (!total.ok) return { state: "calculo-recusado", code: total.code, detail: total.detail };
    groups = total.groups;
    groupBy = null;
    limitations.push("Decomposição substituída pelo total por conter grupo abaixo do mínimo declarado.");
  }

  const suppressed = new Set<number>();
  groups.forEach((g, i) => { if (isSmall(g)) suppressed.add(i); });
  if (policy.complementarySuppression && groupBy && suppressed.size > 0) {
    // 14.3.1 — Supressão complementar contra reconstrução por diferença.
    // O total é divulgável isoladamente; logo "total − visíveis" revela a UNIÃO
    // dos suprimidos. Suprime-se o menor grupo remanescente até que (a) haja
    // mais de um grupo suprimido e (b) a união suprimida também atinja o
    // tamanho mínimo declarado. Nenhum grupo protegido fica exatamente dedutível.
    const unionSize = () => [...suppressed].reduce((acc, i) => acc + groups[i]!.eligibleSubjects, 0);
    const unsafe = () => suppressed.size === 1 || (min !== null && unionSize() < min);
    while (unsafe() && suppressed.size < groups.length) {
      let j = -1;
      groups.forEach((g, i) => { if (!suppressed.has(i) && (j < 0 || g.eligibleSubjects < groups[j]!.eligibleSubjects)) j = i; });
      suppressed.add(j);
    }
    if (suppressed.size === groups.length || unsafe())
      return { state: "nao-divulgavel", reason: "decomposição não pode ser protegida contra reconstrução pelo total; o indicador agregado continua consultável" };
  }

  const disclosed: DisclosedGroup[] = groups.map((g, i) =>
    suppressed.has(i)
      ? { groupKey: g.groupKey, state: "suprimido-por-politica", value: null, numerator: null, denominator: null, coverage: null,
          absentSubjects: null, notApplicableSubjects: null, indeterminateSubjects: null,
          suppressionReason: `política ${policy.id} v${policy.version}` }
      : { groupKey: g.groupKey, state: g.status, value: g.value, numerator: g.numerator, denominator: g.denominator, coverage: g.coverage,
          absentSubjects: g.absentSubjects, notApplicableSubjects: g.notApplicableSubjects, indeterminateSubjects: g.indeterminateSubjects },
  );

  let provenance: DisclosedProvenance | undefined;
  if (q.wantProvenance && policy.provenanceLevel !== "nenhuma") {
    const visible = groups.filter((_, i) => !suppressed.has(i)).flatMap((g) => g.factRefs);
    const individual = policy.provenanceLevel === "referencias-individuais" && !!authorizedFor(a, ANALYTIC_CAPABILITIES.individual, q);
    if (individual) {
      provenance = { level: "referencias-individuais", facts: visible.map((r) => ({ sourceId: r.sourceId, recordId: r.recordId, recordVersion: r.recordVersion, subject: r.subject })) };
    } else {
      const seen = new Map<string, { sourceId: string; recordId: string; recordVersion: number | null; ruleOrPolicyId?: string | undefined; ruleOrPolicyVersion?: number | undefined }>();
      for (const r of visible) seen.set(`${r.sourceId}:${r.recordId}:${r.recordVersion}`, { sourceId: r.sourceId, recordId: r.recordId, recordVersion: r.recordVersion, ruleOrPolicyId: r.ruleOrPolicyId, ruleOrPolicyVersion: r.ruleOrPolicyVersion });
      provenance = { level: "referencias-institucionais", sources: [...seen.values()] };
      limitations.push("Referências institucionais apontam registros oficiais; o identificador do registro pode corresponder a um único estudante.");
    }
  }

  return {
    state: "respondido",
    indicatorDefinitionId: receipt.indicatorDefinitionId,
    definitionVersion: receipt.definitionVersion,
    unit: receipt.unit,
    disclosurePolicy: { id: policy.id, version: policy.version },
    groupBy,
    groups: disclosed,
    ...(provenance ? { provenance } : {}),
    limitations,
  };
}

/** Nenhuma política de divulgação homologada existe: a rede ainda não a declarou. */
export const HOMOLOGATED_DISCLOSURE_POLICIES: readonly DisclosurePolicy[] = [];

export function currentDisclosurePolicy(): DisclosurePolicy | null {
  return HOMOLOGATED_DISCLOSURE_POLICIES.filter((p) => p.status === "homologada").sort((a, b) => b.version - a.version)[0] ?? null;
}
