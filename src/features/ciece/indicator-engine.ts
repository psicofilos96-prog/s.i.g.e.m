/**
 * 14.2 — Motor Canônico de Indicadores do CIECE.
 *
 * Três camadas distintas: FATO (catálogo 14.1) → POPULAÇÃO analítica declarada →
 * INDICADOR. O motor só conhece primitivas (contar, somar, dividir); a definição
 * declara o que calcular e a operação é resolvida por AVALIADOR REGISTRADO — nunca
 * fórmula executável em configuração, nunca regra educacional em tela.
 *
 * Nada é persistido: o recibo é projeção reproduzível. Ausente nunca é zero.
 */
import type { CanonicalFact, FactAvailability } from "./canonical-fact-types";
import { factTypeDefinition } from "./fact-catalog";
import { projectSchoolDimensions } from "./school-dimensions";
import { isDimensionAvailable } from "./institutional-dimension-gaps";
import { DIMENSION_LINKS } from "./dimension-links";
import type { SchoolUnit } from "@/features/schools/school-registry";

// ---------------- Definições ----------------

export type IndicatorTemporal =
  | { kind: "fotografia" } // vigência contendo a data de referência
  | { kind: "intervalo" } // ocorrência dentro de [from, to]
  | { kind: "periodo" } // periodId do fato = periodId de referência
  | { kind: "ciclo" } // cycleId do fato = cycleId de referência
  // 14.6 — fluxo sobre a PRÓPRIA vigência do registro oficial (início/fim em [from, to]).
  | { kind: "inicio-de-vigencia-no-intervalo" }
  | { kind: "fim-de-vigencia-no-intervalo" };

/** Seleção de valor dentro do fato: nunca expressão, só descritor declarativo. */
export type ValueSelector =
  | { kind: "categoria-em"; categoryIds: readonly string[] }
  | { kind: "medida"; measureId: string };

export type IndicatorOperation = { evaluatorId: string; params: Readonly<Record<string, unknown>> };

export type IndicatorDefinition = {
  id: string;
  version: number;
  label: string;
  status: "rascunho" | "homologada";
  factTypeId: string;
  /** Chave do `subject` que identifica o sujeito da população (ex.: studentId). */
  subjectKey: string;
  /** Critérios explícitos de pertencimento; nada é selecionado em silêncio. */
  populationCriteria: Readonly<Record<string, string | number | boolean>>;
  temporal: IndicatorTemporal;
  operation: IndicatorOperation;
  coverage: "completa" | "parcial";
  unit: string;
};

export type IndicatorReference = { at?: string; from?: string; to?: string; periodId?: string; cycleId?: string };

export type IndicatorRequest = {
  definitionId: string;
  definitionVersion?: number;
  reference: IndicatorReference;
  filters?: Readonly<Record<string, string | number | boolean>>;
  groupBy?: string;
};

// ---------------- Recibo ----------------

export type FactRef = {
  factTypeId: string;
  subject: Readonly<Record<string, string>>;
  sourceId: string;
  recordId: string;
  recordVersion: number | null;
  ruleOrPolicyId?: string | undefined;
  ruleOrPolicyVersion?: number | undefined;
  availability: FactAvailability;
  schoolVersionId?: string | null | undefined;
  /** 14.7 — versões dos fatos cadastrais usados na junção (proveniência). */
  linkedRecordRefs?: string[] | undefined;
};

export type ResultStatus =
  | "calculado"
  | "populacao-vazia"
  | "sem-fatos-disponiveis"
  | "cobertura-incompleta"
  | "indeterminado";

export type GroupResult = {
  groupKey: string | null;
  status: ResultStatus;
  eligibleSubjects: number;
  observedSubjects: number;
  absentSubjects: number;
  notApplicableSubjects: number;
  indeterminateSubjects: number;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  coverage: { eligible: number; observed: number; complete: boolean };
  reasons: string[];
  factRefs: FactRef[];
};

export type IndicatorReceipt =
  | {
      ok: true;
      indicatorDefinitionId: string;
      definitionVersion: number;
      unit: string;
      reference: IndicatorReference;
      temporal: IndicatorTemporal["kind"];
      appliedFilters: Readonly<Record<string, string | number | boolean>>;
      groupBy: string | null;
      groups: GroupResult[];
      privacy: { populationSize: number; granularity: string[]; dimensionsUsed: string[]; reachesIndividuals: boolean; smallestGroup: number };
    }
  | { ok: false; code: string; detail: string };

// ---------------- Avaliadores registrados ----------------

type SubjectObservation = { subjectId: string; fact: CanonicalFact };
export type EvaluatorOutput = { numerator: number | null; denominator: number | null; value: number | null; indeterminate?: string | undefined };
export type IndicatorEvaluator = (observed: readonly SubjectObservation[], params: Readonly<Record<string, unknown>>) => EvaluatorOutput;

function matches(fact: CanonicalFact, sel: ValueSelector): boolean | null {
  const p = fact.payload;
  if (!p) return null;
  if (sel.kind === "categoria-em") return p.kind === "categorico" ? (p.categoryId != null && sel.categoryIds.includes(p.categoryId)) : null;
  return null;
}
function measure(fact: CanonicalFact, id: string): number | null {
  const p = fact.payload;
  if (!p || p.kind !== "quantitativo") return null;
  const v = p.measures[id];
  return typeof v === "number" ? v : null;
}
function sumMeasure(obs: readonly SubjectObservation[], id: string): { total: number; missing: boolean } {
  let total = 0, missing = false;
  for (const o of obs) { const m = measure(o.fact, id); if (m == null) missing = true; else total += m; }
  return { total, missing };
}
function countSelected(obs: readonly SubjectObservation[], sel?: ValueSelector): { n: number; unknown: boolean } {
  if (!sel) return { n: obs.length, unknown: false };
  let n = 0, unknown = false;
  for (const o of obs) { const m = matches(o.fact, sel); if (m == null) unknown = true; else if (m) n++; }
  return { n, unknown };
}
function operand(obs: readonly SubjectObservation[], sel: ValueSelector | "observados"): { v: number; bad?: string } {
  if (sel === "observados") return { v: obs.length };
  if (sel.kind === "medida") { const s = sumMeasure(obs, sel.measureId); return s.missing ? { v: 0, bad: `medida ${sel.measureId} ausente em fato disponível` } : { v: s.total }; }
  const c = countSelected(obs, sel);
  return c.unknown ? { v: 0, bad: "fato sem categoria comparável" } : { v: c.n };
}
function ratio(obs: readonly SubjectObservation[], p: Readonly<Record<string, unknown>>, scale: number): EvaluatorOutput {
  const num = operand(obs, p["numerator"] as ValueSelector);
  const den = operand(obs, (p["denominator"] as ValueSelector | "observados") ?? "observados");
  if (num.bad || den.bad) return { numerator: null, denominator: null, value: null, indeterminate: num.bad ?? den.bad };
  if (den.v === 0) return { numerator: num.v, denominator: 0, value: null, indeterminate: "denominador zero" };
  return { numerator: num.v, denominator: den.v, value: (num.v / den.v) * scale };
}

const EVALUATORS = new Map<string, IndicatorEvaluator>([
  ["contagem", (obs, p) => {
    const c = countSelected(obs, p["select"] as ValueSelector | undefined);
    return c.unknown ? { numerator: null, denominator: null, value: null, indeterminate: "fato sem categoria comparável" } : { numerator: null, denominator: null, value: c.n };
  }],
  ["soma-de-medida", (obs, p) => {
    const s = sumMeasure(obs, String(p["measureId"]));
    return s.missing ? { numerator: null, denominator: null, value: null, indeterminate: "medida ausente em fato disponível" } : { numerator: null, denominator: null, value: s.total };
  }],
  // 14.6 — saldo só existe quando a definição o declara: conta fatos cuja dimensão
  // declarada coincide com o valor de entrada e de saída; nada é inferido de contagens.
  ["saldo-entre-selecoes", (obs, p) => {
    const e = p["entrada"] as { dimension: string; value: string } | undefined;
    const s = p["saida"] as { dimension: string; value: string } | undefined;
    if (!e || !s) return { numerator: null, denominator: null, value: null, indeterminate: "saldo sem seleções declaradas" };
    let inn = 0, out = 0;
    for (const o of obs) {
      if (o.fact.dimensions[e.dimension] === e.value) inn++;
      if (o.fact.dimensions[s.dimension] === s.value) out++;
    }
    return { numerator: inn, denominator: out, value: inn - out };
  }],
  ["razao", (obs, p) => ratio(obs, p, 1)],
  ["proporcao", (obs, p) => ratio(obs, p, 1)],
  ["percentual", (obs, p) => ratio(obs, p, 100)],
  ["taxa", (obs, p) => ratio(obs, p, Number(p["scale"] ?? 1))],
]);

export function registerIndicatorEvaluator(id: string, fn: IndicatorEvaluator): void {
  if (EVALUATORS.has(id)) throw new Error(`Avaliador já registrado: ${id}`);
  EVALUATORS.set(id, fn);
}

// ---------------- Registro de definições ----------------

export class IndicatorRegistry {
  private defs: IndicatorDefinition[] = [];
  register(def: IndicatorDefinition): void {
    if (this.defs.some((d) => d.id === def.id && d.version === def.version)) throw new Error("Definição duplicada");
    this.defs.push(Object.freeze({ ...def }));
  }
  resolve(id: string, version?: number): IndicatorDefinition | undefined {
    const c = this.defs.filter((d) => d.id === id && d.status === "homologada" && (version == null || d.version === version));
    return c.sort((a, b) => b.version - a.version)[0];
  }
}

// ---------------- Motor ----------------

const SCHOOL_PREFIX = "school.";

function inTime(f: CanonicalFact, t: IndicatorTemporal, r: IndicatorReference): boolean | "referencia-invalida" {
  const tm = f.temporal;
  const within = (d: string | null | undefined) => !!d && d.slice(0, 10) >= r.from! && d.slice(0, 10) <= r.to!;
  // 14.6.3 — fato oficialmente sem data não é descartado nem tido por vigente:
  // entra na população como indeterminado (cobertura incompleta, nunca zero).
  const undated = f.availability === "indeterminado" && !tm.validFrom && !tm.occurredAt;
  switch (t.kind) {
    case "inicio-de-vigencia-no-intervalo":
      if (!r.from || !r.to) return "referencia-invalida";
      return undated || within(tm.validFrom);
    case "fim-de-vigencia-no-intervalo":
      if (!r.from || !r.to) return "referencia-invalida";
      return undated || within(tm.validTo);
    case "fotografia": {
      if (!r.at) return "referencia-invalida";
      if (undated) return true;
      if (!tm.validFrom) return false; // vigência nunca é inferida
      return tm.validFrom <= r.at && (tm.validTo == null || tm.validTo >= r.at);
    }
    case "intervalo":
      if (!r.from || !r.to) return "referencia-invalida";
      return undated || within(tm.occurredAt);
    case "periodo":
      if (!r.periodId) return "referencia-invalida";
      return (tm.periodId ?? f.subject["periodId"]) === r.periodId;
    case "ciclo":
      if (!r.cycleId) return "referencia-invalida";
      return (tm.cycleId ?? f.subject["cycleId"]) === r.cycleId;
  }
}

/** Data pertinente ao fato para resolver versão histórica da escola. */
function factDate(f: CanonicalFact, r: IndicatorReference): string | null {
  return r.at ?? f.temporal.occurredAt?.slice(0, 10) ?? f.temporal.validFrom ?? null;
}

type Resolved = { value: string | number | boolean | undefined; schoolVersionId?: string | null; linkedRecordRef?: string };
type LinkIndex = Map<string, Map<string, CanonicalFact[]>>;

function buildLinkIndex(facts: readonly CanonicalFact[]): LinkIndex {
  const idx: LinkIndex = new Map();
  for (const [dim, l] of Object.entries(DIMENSION_LINKS)) {
    const m = new Map<string, CanonicalFact[]>();
    for (const f of facts) {
      if (f.factTypeId !== l.factTypeId || f.availability !== "disponivel") continue;
      const k = f.subject[l.joinKey];
      if (k) m.set(k, [...(m.get(k) ?? []), f]);
    }
    idx.set(dim, m);
  }
  return idx;
}

/** Junção declarada: exatamente um fato vigente ⇒ valor; zero ou conflito ⇒ sem valor (nunca inferido). */
function resolveLinked(f: CanonicalFact, dim: string, idx: LinkIndex, r: IndicatorReference): Resolved {
  const l = DIMENSION_LINKS[dim]!;
  const key = f.subject[l.joinKey] ?? f.dimensions[l.joinKey];
  if (typeof key !== "string") return { value: undefined };
  let c = idx.get(dim)?.get(key) ?? [];
  if (l.temporal === "vigencia-na-data") {
    const on = factDate(f, r);
    if (!on) return { value: undefined };
    c = c.filter((x) => !!x.temporal.validFrom && x.temporal.validFrom <= on && (x.temporal.validTo == null || x.temporal.validTo >= on));
  }
  if (c.length !== 1) return { value: undefined };
  const p = c[0]!.payload;
  return {
    value: p?.kind === "categorico" ? (p.categoryId ?? undefined) : undefined,
    linkedRecordRef: `${c[0]!.provenance.sourceId}:${c[0]!.provenance.recordId}@${c[0]!.provenance.recordVersion}`,
  };
}

function resolveDimension(f: CanonicalFact, dim: string, schools: readonly SchoolUnit[], r: IndicatorReference, idx?: LinkIndex): Resolved {
  if (DIMENSION_LINKS[dim]) return idx ? resolveLinked(f, dim, idx, r) : { value: undefined };
  if (dim === "categoria") return { value: f.payload?.kind === "categorico" ? (f.payload.categoryId ?? undefined) : undefined };
  if (dim.startsWith(SCHOOL_PREFIX)) {
    const sid = f.dimensions["schoolId"];
    const on = factDate(f, r);
    if (typeof sid !== "string" || !on) return { value: undefined };
    const d = projectSchoolDimensions(schools, sid, on);
    if (!d) return { value: undefined };
    const key = dim.slice(SCHOOL_PREFIX.length) as keyof typeof d;
    const v = d[key];
    return { value: v && typeof v === "object" && "value" in v ? (v.value ?? undefined) : undefined, schoolVersionId: d.sourceVersionId };
  }
  const v = f.dimensions[dim] ?? f.subject[dim];
  return { value: v };
}

function dimensionSupported(dim: string, factDims: Set<string>): boolean {
  if (dim === "categoria") return true;
  if (DIMENSION_LINKS[dim]) return true;
  if (dim.startsWith(SCHOOL_PREFIX)) return isDimensionAvailable(dim.slice(SCHOOL_PREFIX.length));
  if (!isDimensionAvailable(dim)) return false;
  return factDims.has(dim);
}

export function computeIndicator(
  registry: IndicatorRegistry,
  facts: readonly CanonicalFact[],
  request: IndicatorRequest,
  schools: readonly SchoolUnit[] = [],
): IndicatorReceipt {
  const def = registry.resolve(request.definitionId, request.definitionVersion);
  if (!def) return { ok: false, code: "definicao-desconhecida", detail: `Sem definição homologada: ${request.definitionId}` };
  const evaluator = EVALUATORS.get(def.operation.evaluatorId);
  if (!evaluator) return { ok: false, code: "avaliador-desconhecido", detail: def.operation.evaluatorId };
  const catalog = factTypeDefinition(def.factTypeId);
  if (!catalog || catalog.sourceStatus !== "persistida")
    return { ok: false, code: "fato-indisponivel", detail: `Tipo de fato sem fonte canônica: ${def.factTypeId}` };

  // Só fatos do catálogo canônico, do tipo e da fonte declarados.
  const typed = facts.filter((f) => f.factTypeId === def.factTypeId && f.provenance.sourceId === catalog.sourceId);
  const factDims = new Set<string>(["schoolId", ...catalog.granularity]);
  for (const f of typed) { Object.keys(f.dimensions).forEach((k) => factDims.add(k)); Object.keys(f.subject).forEach((k) => factDims.add(k)); }

  const criteria = { ...def.populationCriteria, ...(request.filters ?? {}) };
  const usedDims = [...Object.keys(criteria), ...(request.groupBy ? [request.groupBy] : [])];
  for (const d of usedDims)
    if (!dimensionSupported(d, factDims)) return { ok: false, code: "dimensao-indisponivel", detail: `Dimensão não fornecida por fonte canônica: ${d}` };

  // População: critérios explícitos + recorte temporal.
  const idx = buildLinkIndex(facts);
  const selected: { f: CanonicalFact; group: string | null; schoolVersionId?: string | null | undefined; linkedRecordRefs?: string[] }[] = [];
  for (const f of typed) {
    const t = inTime(f, def.temporal, request.reference);
    if (t === "referencia-invalida") return { ok: false, code: "referencia-temporal-invalida", detail: def.temporal.kind };
    if (!t) continue;
    let ok = true, sv: string | null | undefined;
    const linked: string[] = [];
    for (const [k, v] of Object.entries(criteria)) {
      const r = resolveDimension(f, k, schools, request.reference, idx);
      if (r.linkedRecordRef) linked.push(r.linkedRecordRef);
      if (r.schoolVersionId !== undefined) sv = r.schoolVersionId;
      if (r.value !== v) { ok = false; break; }
    }
    if (!ok) continue;
    let group: string | null = null;
    if (request.groupBy) {
      const r = resolveDimension(f, request.groupBy, schools, request.reference, idx);
      if (r.linkedRecordRef) linked.push(r.linkedRecordRef);
      if (r.schoolVersionId !== undefined) sv = r.schoolVersionId;
      group = r.value === undefined ? "(sem valor declarado)" : String(r.value);
    }
    selected.push({ f, group, schoolVersionId: sv, ...(linked.length ? { linkedRecordRefs: linked } : {}) });
  }

  const groupKeys = request.groupBy ? [...new Set(selected.map((s) => s.group!))].sort() : [null];
  const groups: GroupResult[] = groupKeys.map((g) => evaluateGroup(def, evaluator, selected.filter((s) => s.group === g), g));
  const populationSize = new Set(selected.map((s) => s.f.subject[def.subjectKey] ?? "")).size;

  return {
    ok: true,
    indicatorDefinitionId: def.id,
    definitionVersion: def.version,
    unit: def.unit,
    reference: request.reference,
    temporal: def.temporal.kind,
    appliedFilters: criteria,
    groupBy: request.groupBy ?? null,
    groups,
    privacy: {
      populationSize,
      granularity: [def.subjectKey],
      dimensionsUsed: usedDims,
      reachesIndividuals: true, // recibo referencia sujeitos; decisão de exibição é 14.3
      smallestGroup: groups.length ? Math.min(...groups.map((g) => g.eligibleSubjects)) : 0,
    },
  };
}

function evaluateGroup(
  def: IndicatorDefinition,
  evaluator: IndicatorEvaluator,
  rows: { f: CanonicalFact; schoolVersionId?: string | null | undefined; linkedRecordRefs?: string[] }[],
  groupKey: string | null,
): GroupResult {
  const bySubject = new Map<string, typeof rows>();
  for (const r of rows) {
    const id = r.f.subject[def.subjectKey];
    if (!id) continue;
    bySubject.set(id, [...(bySubject.get(id) ?? []), r]);
  }
  const observed: SubjectObservation[] = [];
  let absent = 0, na = 0, indet = 0;
  const reasons: string[] = [];
  for (const [subjectId, list] of bySubject) {
    // O mesmo registro oficial (mesma versão) visto por mais de um polo não é concorrência.
    const seen = new Set<string>();
    const avail = list.filter((r) => {
      if (r.f.availability !== "disponivel") return false;
      const k = `${r.f.provenance.sourceId}|${r.f.provenance.recordId}|${r.f.provenance.recordVersion}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (avail.length > 1) { indet++; reasons.push(`sujeito ${subjectId}: fatos concorrentes no mesmo recorte`); continue; }
    if (avail.length === 1) { observed.push({ subjectId, fact: avail[0]!.f }); continue; }
    const a = list[0]!.f.availability;
    if (a === "ausente") absent++;
    else if (a === "nao-aplicavel") na++;
    else indet++;
  }
  const eligible = bySubject.size - na; // não aplicável sai da população elegível
  const factRefs: FactRef[] = rows.map(({ f, schoolVersionId, linkedRecordRefs }) => ({
    factTypeId: f.factTypeId, subject: f.subject, sourceId: f.provenance.sourceId, recordId: f.provenance.recordId,
    recordVersion: f.provenance.recordVersion, ruleOrPolicyId: f.provenance.ruleOrPolicyId,
    ruleOrPolicyVersion: f.provenance.ruleOrPolicyVersion, availability: f.availability,
    ...(schoolVersionId !== undefined ? { schoolVersionId } : {}),
    ...(linkedRecordRefs ? { linkedRecordRefs } : {}),
  }));
  const complete = observed.length === eligible;
  const base = {
    groupKey, eligibleSubjects: eligible, observedSubjects: observed.length, absentSubjects: absent,
    notApplicableSubjects: na, indeterminateSubjects: indet,
    coverage: { eligible, observed: observed.length, complete }, factRefs,
  };
  const empty = { numerator: null, denominator: null, value: null };
  if (bySubject.size === 0 || eligible === 0) return { ...base, ...empty, status: "populacao-vazia", reasons: ["população declarada vazia"] };
  if (observed.length === 0) return { ...base, ...empty, status: "sem-fatos-disponiveis", reasons: ["nenhum fato disponível na população"] };
  if (!complete && def.coverage === "completa")
    return { ...base, ...empty, status: "cobertura-incompleta", reasons: [...reasons, `cobertura ${observed.length}/${eligible} exigida completa`] };
  const out = evaluator(observed, def.operation.params);
  if (out.indeterminate) return { ...base, ...empty, status: "indeterminado", reasons: [...reasons, out.indeterminate] };
  return { ...base, numerator: out.numerator, denominator: out.denominator, value: out.value, status: "calculado", reasons };
}

/**
 * 14.8 — Aplica um avaliador registrado a observações já classificadas por uma
 * derivação canônica (ex.: classificação idade-série). Mantém a aritmética
 * exclusivamente no motor 14.2; a derivação nunca divide nem conta por conta própria.
 */
export function applyRegisteredEvaluator(
  evaluatorId: string,
  observed: readonly { subjectId: string; fact: CanonicalFact }[],
  params: Readonly<Record<string, unknown>>,
): EvaluatorOutput | null {
  const fn = EVALUATORS.get(evaluatorId);
  return fn ? fn(observed, params) : null;
}
