/**
 * Avaliação e Desempenho — projeção analítica pura.
 * Resultado bruto (observado) ≠ métrica calculada (fórmula versionada) ≠ meta (declarada com fonte).
 * Nenhum índice, faixa, peso ou limiar existe aqui: fórmulas são primitivas declaradas na métrica,
 * limiar de divulgação vem só da política registrada. Ausência nunca vira zero.
 */

export type AssessmentVersion = Readonly<{
  id: string; logical_id: string; version: number; event_kind: string; title: string; origin: "institucional" | "externa";
  source_note: string | null; applied_from: string; applied_to: string;
  target_population: readonly { axis_id: string; value_id: string }[];
  items: readonly { item_id: string; label?: string; reference_item_id?: string | null }[];
  scale: Readonly<{ kind: "numerico" | "categorico"; min?: number; max?: number; values?: readonly string[] }>;
  recorded_at: string;
}>;

export type ResultRow = Readonly<{
  id: string; logical_id: string; version: number; event_kind: string; assessment_logical_id: string; assessment_version_id: string;
  school_id: string; student_id: string; class_id: string | null; item_id: string | null;
  status: "observado" | "ausente" | "nao-aplicado"; raw_value: string | null; numeric_value: number | string | null; recorded_at: string;
}>;

export type Formula =
  | Readonly<{ op: "media" }>
  | Readonly<{ op: "contagem-observados" }>
  | Readonly<{ op: "proporcao-em-valores"; values: readonly string[] }>;

export type MetricVersion = Readonly<{
  id: string; logical_id: string; version: number; event_kind: string; label: string; assessment_logical_id: string;
  formula: Formula; population_key: string; unit_label: string | null; source_note: string; recorded_at: string;
}>;

export type Disclosure = Readonly<{ id: string; min_group_size: number; source_note: string }> | null;
export type Goal = Readonly<{ id: string; metric_version_id: string; school_id: string | null; target_value: number | string; comparator: ">=" | "<="; source_note: string }>;

export type MetricValue =
  | Readonly<{ status: "calculada"; value: number; base: number; absent: number; notApplied: number; resultIds: readonly string[] }>
  | Readonly<{ status: "sem-base"; reason: string; absent: number; notApplied: number; resultIds: readonly string[] }>
  | Readonly<{ status: "formula-incompativel"; reason: string; resultIds: readonly string[] }>;

/** Linhas vigentes (não revogadas). Revogação remove o resultado da base, mas o histórico continua. */
export const liveResults = (rows: readonly ResultRow[]) => rows.filter((r) => r.event_kind !== "revogacao");

export function computeMetric(formula: Formula, scale: AssessmentVersion["scale"] | null, rows: readonly ResultRow[]): MetricValue {
  const live = liveResults(rows);
  const ids = live.map((r) => r.id);
  const observed = live.filter((r) => r.status === "observado");
  const absent = live.filter((r) => r.status === "ausente").length;
  const notApplied = live.filter((r) => r.status === "nao-aplicado").length;
  if (formula.op === "media") {
    if (scale && scale.kind !== "numerico") return { status: "formula-incompativel", reason: "Média exige escala numérica declarada na avaliação.", resultIds: ids };
    const nums = observed.map((r) => (r.numeric_value === null ? NaN : Number(r.numeric_value))).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return { status: "sem-base", reason: "Nenhum resultado observado.", absent, notApplied, resultIds: ids };
    return { status: "calculada", value: nums.reduce((a, b) => a + b, 0) / nums.length, base: nums.length, absent, notApplied, resultIds: ids };
  }
  if (formula.op === "contagem-observados") {
    if (live.length === 0) return { status: "sem-base", reason: "Nenhum resultado registrado.", absent, notApplied, resultIds: ids };
    return { status: "calculada", value: observed.length, base: observed.length, absent, notApplied, resultIds: ids };
  }
  if (!formula.values?.length) return { status: "formula-incompativel", reason: "A fórmula não declara os valores contados.", resultIds: ids };
  if (observed.length === 0) return { status: "sem-base", reason: "Nenhum resultado observado.", absent, notApplied, resultIds: ids };
  const hit = observed.filter((r) => r.raw_value !== null && formula.values.includes(r.raw_value)).length;
  return { status: "calculada", value: hit / observed.length, base: observed.length, absent, notApplied, resultIds: ids };
}

export type GroupBy = "escola" | "turma" | "item" | "posicao";
export type Aggregate = Readonly<{ key: string; label: string; students: number; metric: MetricValue; disclosed: boolean; suppressedReason: string | null }>;

/** Posição curricular só entra por mapa explícito (aluno → posição) vindo do reader canônico; nunca inferida. */
export function aggregate(
  rows: readonly ResultRow[], by: GroupBy, formula: Formula, scale: AssessmentVersion["scale"] | null,
  disclosure: Disclosure, positionOf?: ReadonlyMap<string, string>,
): Aggregate[] {
  const groups = new Map<string, ResultRow[]>();
  for (const r of liveResults(rows)) {
    const k = by === "escola" ? r.school_id : by === "turma" ? r.class_id : by === "item" ? r.item_id : positionOf?.get(r.student_id) ?? null;
    const key = k ?? "__nao-informado__";
    const list = groups.get(key) ?? []; list.push(r); groups.set(key, list);
  }
  const out = [...groups.entries()].map(([key, list]) => ({
    key, label: key === "__nao-informado__" ? "Não informado" : key,
    students: new Set(list.map((r) => r.student_id)).size, metric: computeMetric(formula, scale, list),
  }));
  return applyDisclosure(out, disclosure);
}

/**
 * Supressão de grupos pequenos: só com política registrada. Sem política, nada é suprimido nem inventado;
 * a ausência de política é sinalizada e a exportação fica bloqueada pela tela.
 * Supressão complementar: se só um grupo ficaria suprimido, o menor visível também é suprimido.
 */
export function applyDisclosure<T extends { key: string; students: number }>(groups: readonly T[], d: Disclosure): (T & { disclosed: boolean; suppressedReason: string | null })[] {
  if (!d) return groups.map((g) => ({ ...g, disclosed: true, suppressedReason: null }));
  const res = groups.map((g) => ({ ...g, disclosed: g.students >= d.min_group_size, suppressedReason: g.students >= d.min_group_size ? null : `Grupo abaixo do mínimo de ${d.min_group_size} estudantes da política de divulgação.` }));
  const hidden = res.filter((g) => !g.disclosed);
  if (hidden.length === 1) {
    const visible = res.filter((g) => g.disclosed).sort((a, b) => a.students - b.students)[0];
    if (visible) { visible.disclosed = false; visible.suppressedReason = "Suprimido para impedir dedução do grupo protegido pelo total."; }
  }
  return res;
}

/** Soma das bases das partes = base do todo: prova de reconciliação até os registros. */
export function reconciles(total: MetricValue, parts: readonly MetricValue[]): boolean {
  const ids = new Set(total.resultIds);
  const partIds = parts.flatMap((p) => p.resultIds);
  return partIds.length === ids.size && partIds.every((i) => ids.has(i));
}

export const populationFingerprint = (a: AssessmentVersion) =>
  [...a.target_population].map((p) => `${p.axis_id}=${p.value_id}`).sort().join("|");

export type Comparison = Readonly<{ comparable: true; delta: number | null } | { comparable: false; reason: string }>;

/** Comparação temporal só entre mesma métrica (lógica + versão de fórmula), mesma chave e mesma população declarada. */
export function compareTemporal(
  a: { metric: MetricVersion; assessment: AssessmentVersion; value: MetricValue },
  b: { metric: MetricVersion; assessment: AssessmentVersion; value: MetricValue },
): Comparison {
  if (a.metric.population_key !== b.metric.population_key) return { comparable: false, reason: "As métricas declaram chaves de população diferentes." };
  if (JSON.stringify(a.metric.formula) !== JSON.stringify(b.metric.formula)) return { comparable: false, reason: "As fórmulas são diferentes; não há comparação silenciosa entre versões." };
  if (populationFingerprint(a.assessment) !== populationFingerprint(b.assessment)) return { comparable: false, reason: "As populações-alvo declaradas nas avaliações são diferentes." };
  if (a.value.status !== "calculada" || b.value.status !== "calculada") return { comparable: true, delta: null };
  return { comparable: true, delta: b.value.value - a.value.value };
}

export function goalStatus(goal: Goal, v: MetricValue): "atingida" | "nao-atingida" | "sem-base" {
  if (v.status !== "calculada") return "sem-base";
  const t = Number(goal.target_value);
  return goal.comparator === ">=" ? (v.value >= t ? "atingida" : "nao-atingida") : v.value <= t ? "atingida" : "nao-atingida";
}

export const FORMULA_LABEL = (f: Formula) =>
  f.op === "media" ? "Média dos valores observados" : f.op === "contagem-observados" ? "Contagem de resultados observados" : `Proporção de observados em: ${f.values.join(", ")}`;

const MSG: Record<string, string> = {
  "session-required": "Entre com sua conta institucional.",
  "perf:base-superseded": "Este registro já foi corrigido por outra pessoa. Recarregue e tente de novo.",
  "perf:duplicate-use-rectification": "Já existe registro vigente; use correção em vez de novo registro.",
  "perf:student-not-in-school": "O estudante não tem matrícula nesta escola.",
  "perf:item-unknown": "O item não faz parte da versão da avaliação.",
  "perf:value-outside-scale": "Valor fora da escala declarada na avaliação.",
  "perf:value-not-numeric": "A escala é numérica e o valor não é número.",
  "perf:value-required": "Resultado observado precisa de valor.",
  "perf:assessment-version-superseded": "A versão da avaliação foi substituída; use a versão vigente.",
  "perf:plan-conflict": "Esta linha já foi gravada por outra pessoa.",
  "perf:population-required": "Declare ao menos um critério de população-alvo.",
  "perf:formula-invalid": "A fórmula não é uma primitiva aceita ou está incompleta.",
};
export function perfMessage(raw: string): string {
  for (const [k, v] of Object.entries(MSG)) if (raw.includes(k)) return v;
  if (raw.includes("capability:")) return "Sua atuação não tem a permissão vigente necessária para esta ação.";
  return "Não foi possível concluir. Tente de novo.";
}
