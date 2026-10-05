/**
 * Dashboards executivos — camada de métricas como PROJEÇÃO.
 * Cada métrica declara definição, versão, fórmula, fonte, granularidade, escopo e capabilities exigidas;
 * o valor é derivado na hora dos readers canônicos e carrega as referências que o compõem (drill-down).
 * Cache é só memória de sessão com idade explícita; nunca é gravado nem vira fonte.
 * "Não disponível" (sem permissão, alcance parcial, sem fonte, sem registro) é sempre distinto de zero.
 */

export type Scope = Readonly<{ kind: "escola"; schoolId: string } | { kind: "pessoal" }>;
export type Ctx = Readonly<{ scope: Scope; validOn: string; knownAt: string | null }>;

export type MetricResult =
  | Readonly<{ status: "disponivel"; value: number; unit: string; refs: readonly string[]; note: string | null }>
  | Readonly<{ status: "nao-disponivel"; reason: string }>;

export type MetricDefinition = Readonly<{
  id: string; version: number; label: string; perspective: PerspectiveId;
  definition: string; formula: string; source: string; granularity: string;
  scope: Scope["kind"];
  /** Capabilities aceitas com alcance escola (da própria escola) ou rede. Vazio ⇒ métrica pessoal do próprio usuário. */
  capabilities: readonly string[];
  /** Idade máxima do cache em ms antes de ser marcado desatualizado. */
  freshnessMs: number;
  drillRoute: string | null;
  compute(ctx: Ctx): Promise<MetricResult>;
}>;

export type PerspectiveId = "secretaria" | "departamento-pessoal" | "alimentacao" | "pessoal";

export type CapabilityRow = Readonly<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }>;

/** Alcance: capability homologada na própria escola ou na rede. Cargo textual nunca entra. */
export function hasScope(caps: readonly CapabilityRow[], wanted: readonly string[], scope: Scope): boolean {
  if (wanted.length === 0) return scope.kind === "pessoal";
  if (scope.kind !== "escola") return false;
  return caps.some((c) => c.policy_id && wanted.includes(c.capability_id) && (c.scope_level === "rede" || (c.scope_level === "escola" && c.school_id === scope.schoolId)));
}

export const notAvailable = (reason: string): MetricResult => ({ status: "nao-disponivel", reason });

// ---------- cache de sessão (nunca canônico) ----------
export type CacheEntry = Readonly<{ result: MetricResult; fetchedAt: number }>;
export const cacheKey = (d: MetricDefinition, c: Ctx) =>
  [d.id, d.version, c.scope.kind === "escola" ? c.scope.schoolId : "self", c.validOn, c.knownAt ?? "agora"].join("|");

export class SessionMetricCache {
  private m = new Map<string, CacheEntry>();
  constructor(private now: () => number = Date.now) {}
  get(d: MetricDefinition, c: Ctx): (CacheEntry & { stale: boolean }) | null {
    const e = this.m.get(cacheKey(d, c));
    return e ? { ...e, stale: this.now() - e.fetchedAt > d.freshnessMs } : null;
  }
  set(d: MetricDefinition, c: Ctx, result: MetricResult) { this.m.set(cacheKey(d, c), { result, fetchedAt: this.now() }); }
  invalidate(prefix?: string) { for (const k of [...this.m.keys()]) if (!prefix || k.startsWith(prefix)) this.m.delete(k); }
}

export async function evaluate(d: MetricDefinition, c: Ctx, caps: readonly CapabilityRow[], cache: SessionMetricCache, force = false) {
  if (!hasScope(caps, d.capabilities, c.scope))
    return { result: notAvailable("Sua atuação não tem permissão vigente com alcance desta escola para esta fonte."), fetchedAt: Date.now(), stale: false };
  const hit = !force ? cache.get(d, c) : null;
  if (hit && !hit.stale) return hit;
  let result: MetricResult;
  try { result = await d.compute(c); } catch { result = notAvailable("A fonte não respondeu. Tente atualizar."); }
  cache.set(d, c, result);
  return { ...cache.get(d, c)! };
}

// ---------- derivações puras ----------
type Versioned = { id: string; supersedes_id: string | null; created_at: string };
export function headsKnownAt<T extends Versioned>(rows: readonly T[], knownAt: string | null): T[] {
  const known = knownAt ? rows.filter((r) => r.created_at <= knownAt) : rows;
  const sup = new Set(known.map((r) => r.supersedes_id).filter(Boolean));
  return known.filter((r) => !sup.has(r.id));
}

export type Enrollment = Versioned & { school_id: string; opened_on: string | null };
export type EnrollmentEnding = { enrollment_id: string; ended_on: string; created_at: string };

/** Matrículas vigentes na data, como conhecidas em knownAt. Abertura não informada não conta como vigente: vai para `undated`. */
export function activeEnrollments(enr: readonly Enrollment[], endings: readonly EnrollmentEnding[], schoolId: string, on: string, knownAt: string | null) {
  const heads = headsKnownAt(enr, knownAt).filter((e) => e.school_id === schoolId);
  const ended = new Set(endings.filter((x) => (!knownAt || x.created_at <= knownAt) && x.ended_on <= on).map((x) => x.enrollment_id));
  return {
    active: heads.filter((e) => e.opened_on && e.opened_on <= on && !ended.has(e.id)).map((e) => e.id),
    undated: heads.filter((e) => !e.opened_on).map((e) => e.id),
  };
}

export type ServiceRow = { id: string; served_count: number | null; event_kind: string };
/** Soma só onde houve informação; registros sem servido informado são contados à parte, nunca como zero. */
export function servedTotal(rows: readonly ServiceRow[]) {
  const live = rows.filter((r) => r.event_kind !== "revogacao");
  const informed = live.filter((r) => r.served_count !== null);
  return { total: informed.reduce((a, r) => a + (r.served_count ?? 0), 0), informedRefs: informed.map((r) => r.id), notInformed: live.length - informed.length, records: live.length };
}
