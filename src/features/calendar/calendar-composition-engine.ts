/**
 * B4.6.5b — Motor PURO de composição das declarações de calendários a partir de norma explícita (B4.6.5a).
 *
 * Sem RPC, store, laboratório ou consumidor institucional: recebe EVIDÊNCIA (snapshot on/knownAt, norma
 * identificada/versionada/homologada, candidatos com calendário+versão+recortes+declarações por dimensão)
 * e devolve um resultado congelado. O resultado NUNCA autoriza, publica ou homologa nada
 * (`authorizes: false`, `publishes: false`); entrada com chaves desconhecidas (ex.: flag "autorizado")
 * é recusada como entrada inválida.
 *
 * Invariantes:
 * - dimensões são tokens abertos; o motor não conhece etapa, AEE, feriado, nome, cor, fim de semana nem escola;
 * - null/ausência nunca vira false/zero; false é valor válido; true × false conflitam;
 * - sem prioridade, especificidade ou dominante: conflito/divergência conservam diagnóstico e proveniência;
 * - candidato com referência/consulta indeterminada bloqueia (nunca é descartado);
 * - declaração em dimensão sem regra torna o resultado indeterminado (nunca é eliminada);
 * - vários recortes do MESMO calendário+versão não duplicam nem criam multiplicidade;
 * - canonicalização determinística (ordenação lexical) não confere prioridade.
 */
import { instantMicros } from "@/lib/postgres-instant";
import { isCivilIsoDate } from "./institutional-calendar-effects";

export type DeclaredValue = boolean | string | number | null;

export type CompositionDeclaration = {
  dimensionId: string;
  declarationId: string;
  declarationVersionId: string;
  /** null = declarada sem valor; tratada como AUSÊNCIA (nunca false/zero). */
  value: DeclaredValue;
};

export type CompositionScope = { scopeKey: string; windowFrom: string | null; windowTo: string | null };

export type CompositionCandidate = {
  resolution: string;
  calendarId: string;
  versionId: string;
  version: number;
  scopes: CompositionScope[];
  declarations: CompositionDeclaration[];
};

export type NormDimensionRule = {
  dimensionId: string;
  operation: "exigir-concordancia" | "uniao-com-diagnostico";
  onAbsence: "indeterminado" | "desconsiderar-candidato-sem-declaracao";
};

export type NormEvidence = {
  state: string;
  normId: string;
  versionId: string;
  version: number;
  validFrom: string;
  validTo: string | null;
  recordedAt: string;
  actId: string;
  configuration: {
    recorded: boolean;
    multiplicity: "exigir-exclusividade" | "compor-por-dimensao" | null;
    dimensionRules: NormDimensionRule[];
  };
  homologation: {
    state: string;
    recordId: string;
    sequence: number;
    effectiveFrom: string;
    recordedAt: string;
    exercisedCapabilityId: string;
  } | null;
};

export type CompositionInput = {
  snapshot: { on: string; knownAt: string };
  norm: NormEvidence | { state: string };
  candidates: CompositionCandidate[];
};

export type DimensionOutcome = {
  dimensionId: string;
  state: "determinado" | "conflito" | "divergente" | "indeterminado" | "dimensao-sem-regra";
  value?: Exclude<DeclaredValue, null>;
  values: Exclude<DeclaredValue, null>[];
  reason: string | null;
  provenance: { calendarId: string; versionId: string; declarationId: string; declarationVersionId: string; value: DeclaredValue }[];
  absentCalendars: string[];
};

export type CompositionState =
  | "determinado"
  | "entrada-invalida"
  | "snapshot-invalido"
  | "norma-bloqueada"
  | "candidato-indeterminado"
  | "sem-candidato"
  | "multiplicidade-proibida"
  | "indeterminado";

export type CompositionResult = {
  state: CompositionState;
  reasons: string[];
  snapshot: { on: string; knownAt: string } | null;
  norm: { normId: string; versionId: string; version: number; homologationRecordId: string } | null;
  calendars: { calendarId: string; versionId: string; version: number; scopeKeys: string[] }[];
  excluded: { calendarId: string; versionId: string; resolution: string }[];
  dimensions: DimensionOutcome[];
  authorizes: false;
  publishes: false;
};

const EXCLUDED_RESOLUTIONS = new Set(["nao-corresponde", "fora-da-janela"]);
const BLOCKING_EXACT = new Set(["aplicabilidade-nao-registrada", "janela-nao-registrada"]);
const BLOCKING_PREFIX = ["referencia-indeterminada:", "referencia-invalida:"];
const MULTIPLICITY = new Set(["exigir-exclusividade", "compor-por-dimensao"]);
const DIM_OPS = new Set(["exigir-concordancia", "uniao-com-diagnostico"]);
const ON_ABSENCE = new Set(["indeterminado", "desconsiderar-candidato-sem-declaracao"]);

class Invalid extends Error {}
const fail = (m: string): never => { throw new Invalid(m); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const keysExactly = (o: Record<string, unknown>, keys: string[], where: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${where}: campo não reconhecido "${k}"`);
  for (const k of keys) if (!(k in o)) fail(`${where}: campo ausente "${k}"`);
};
const tok = (v: unknown, where: string): string =>
  typeof v === "string" && v.trim() !== "" && v === v.trim() ? v : fail(`${where}: identificador inválido`);
const posInt = (v: unknown, where: string): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : fail(`${where}: inteiro ≥ 1 exigido`);
const date = (v: unknown, where: string): string => (isCivilIsoDate(v) ? v : fail(`${where}: data civil inválida`));
const instant = (v: unknown, where: string): bigint => instantMicros(v) ?? fail(`${where}: instante inválido`);
const valueKey = (v: Exclude<DeclaredValue, null>) => `${typeof v}:${String(v)}`;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function deepFreeze<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const x of Object.values(v)) deepFreeze(x);
    Object.freeze(v);
  }
  return v;
}

function result(partial: Partial<CompositionResult> & { state: CompositionState }): CompositionResult {
  return deepFreeze({
    reasons: [], snapshot: null, norm: null, calendars: [], excluded: [], dimensions: [],
    ...partial, authorizes: false, publishes: false,
  } as CompositionResult);
}

function validateNorm(raw: Record<string, unknown>, on: string, knownAt: bigint): CompositionResult | NormEvidence {
  const state = tok(raw["state"], "norma.state");
  if (state !== "norma-homologada") {
    keysExactly(raw, ["state"], "norma");
    return result({ state: "norma-bloqueada", reasons: [`norma: ${state}`] });
  }
  keysExactly(raw, ["state", "normId", "versionId", "version", "validFrom", "validTo", "recordedAt", "actId", "configuration", "homologation"], "norma");
  const n = raw as unknown as NormEvidence;
  tok(n.normId, "norma.normId"); tok(n.versionId, "norma.versionId"); posInt(n.version, "norma.version");
  tok(n.actId, "norma.actId");
  const from = date(n.validFrom, "norma.validFrom");
  const to = n.validTo === null ? null : date(n.validTo, "norma.validTo");
  if (to !== null && to < from) fail("norma: vigência invertida");
  const rec = instant(n.recordedAt, "norma.recordedAt");
  if (!isObj(n.configuration)) fail("norma.configuration ausente");
  keysExactly(n.configuration as unknown as Record<string, unknown>, ["recorded", "multiplicity", "dimensionRules"], "norma.configuration");
  if (typeof n.configuration.recorded !== "boolean") fail("norma.configuration.recorded inválido");
  const mult = n.configuration.multiplicity;
  if (mult !== null && !MULTIPLICITY.has(mult)) fail(`norma: operação de multiplicidade desconhecida "${String(mult)}"`);
  if (!Array.isArray(n.configuration.dimensionRules)) fail("norma.dimensionRules inválido");
  const seen = new Set<string>();
  for (const r of n.configuration.dimensionRules as unknown[]) {
    if (!isObj(r)) fail("norma: regra de dimensão inválida");
    keysExactly(r as Record<string, unknown>, ["dimensionId", "operation", "onAbsence"], "norma.regra");
    const d = tok((r as NormDimensionRule).dimensionId, "norma.regra.dimensionId");
    if (!DIM_OPS.has((r as NormDimensionRule).operation)) fail(`norma: operação de dimensão desconhecida "${String((r as NormDimensionRule).operation)}"`);
    if (!ON_ABSENCE.has((r as NormDimensionRule).onAbsence)) fail(`norma: on_absence desconhecido "${String((r as NormDimensionRule).onAbsence)}"`);
    if (seen.has(d)) fail(`norma: dimensão repetida "${d}"`);
    seen.add(d);
  }
  if (n.homologation === null) return result({ state: "norma-bloqueada", reasons: ["norma: evidência de homologação ausente"] });
  if (!isObj(n.homologation)) fail("norma.homologation inválido");
  keysExactly(n.homologation as unknown as Record<string, unknown>, ["state", "recordId", "sequence", "effectiveFrom", "recordedAt", "exercisedCapabilityId"], "norma.homologation");
  const h = n.homologation;
  const hs = tok(h.state, "homologation.state");
  tok(h.recordId, "homologation.recordId"); posInt(h.sequence, "homologation.sequence");
  tok(h.exercisedCapabilityId, "homologation.exercisedCapabilityId");
  const eff = date(h.effectiveFrom, "homologation.effectiveFrom");
  const hrec = instant(h.recordedAt, "homologation.recordedAt");

  const blocks: string[] = [];
  if (hs !== "homologada") blocks.push(`homologação: ${hs}`);
  if (!n.configuration.recorded) blocks.push("configuração não registrada");
  if (mult === null) blocks.push("configuração incompleta: multiplicidade não declarada");
  if (mult === "compor-por-dimensao" && n.configuration.dimensionRules.length === 0) blocks.push("configuração incompleta: compor-por-dimensao sem regra");
  if (mult === "exigir-exclusividade" && n.configuration.dimensionRules.length > 0) blocks.push("configuração incoerente: exclusividade com regras de dimensão");
  // Consistência com o snapshot (precisão de microssegundos; knownAt inclusivo).
  if (on < from || (to !== null && on > to)) blocks.push("snapshot fora da vigência da versão da norma");
  if (rec > knownAt) blocks.push("versão da norma posterior ao knownAt");
  if (hrec > knownAt) blocks.push("homologação posterior ao knownAt");
  if (hrec < rec) blocks.push("homologação registrada antes da versão");
  if (eff > on) blocks.push("homologação ainda não vigente na data");
  if (eff < from || (to !== null && eff > to)) blocks.push("homologação fora da vigência da versão");
  if (blocks.length) return result({ state: "norma-bloqueada", reasons: blocks });
  return n;
}

type Merged = { calendarId: string; versionId: string; version: number; scopeKeys: Set<string>; decls: Map<string, CompositionDeclaration>; signature: string };

export function composeCalendarDeclarations(input: unknown): CompositionResult {
  try {
    if (!isObj(input)) fail("entrada não é objeto");
    keysExactly(input as Record<string, unknown>, ["snapshot", "norm", "candidates"], "entrada");
    const inp = input as unknown as CompositionInput;
    if (!isObj(inp.snapshot)) fail("snapshot ausente");
    keysExactly(inp.snapshot as unknown as Record<string, unknown>, ["on", "knownAt"], "snapshot");
    if (!isCivilIsoDate(inp.snapshot.on) || instantMicros(inp.snapshot.knownAt) === null)
      return result({ state: "snapshot-invalido", reasons: ["snapshot: data civil ou knownAt inválidos"] });
    const on = inp.snapshot.on;
    const knownAt = instantMicros(inp.snapshot.knownAt)!;
    const snapshot = { on, knownAt: inp.snapshot.knownAt };

    if (!isObj(inp.norm)) fail("norma ausente");
    const nv = validateNorm(inp.norm as Record<string, unknown>, on, knownAt);
    if ("authorizes" in nv) return result({ ...nv, snapshot });
    const norm = nv;
    const normOut = { normId: norm.normId, versionId: norm.versionId, version: norm.version, homologationRecordId: norm.homologation!.recordId };

    if (!Array.isArray(inp.candidates)) fail("candidatos devem ser lista");
    const merged = new Map<string, Merged>();
    const excluded: CompositionResult["excluded"] = [];
    const blocking: string[] = [];
    for (const c of inp.candidates as unknown[]) {
      if (!isObj(c)) fail("candidato inválido");
      keysExactly(c as Record<string, unknown>, ["resolution", "calendarId", "versionId", "version", "scopes", "declarations"], "candidato");
      const cand = c as unknown as CompositionCandidate;
      const res = tok(cand.resolution, "candidato.resolution");
      const calendarId = tok(cand.calendarId, "candidato.calendarId");
      const versionId = tok(cand.versionId, "candidato.versionId");
      const version = posInt(cand.version, "candidato.version");
      if (!Array.isArray(cand.scopes) || cand.scopes.length === 0) fail("candidato sem recorte");
      const scopeKeys: string[] = [];
      for (const s of cand.scopes as unknown[]) {
        if (!isObj(s)) fail("recorte inválido");
        keysExactly(s as Record<string, unknown>, ["scopeKey", "windowFrom", "windowTo"], "recorte");
        const sc = s as CompositionScope;
        scopeKeys.push(tok(sc.scopeKey, "recorte.scopeKey"));
        const wf = sc.windowFrom === null ? null : date(sc.windowFrom, "recorte.windowFrom");
        const wt = sc.windowTo === null ? null : date(sc.windowTo, "recorte.windowTo");
        if ((wf === null) !== (wt === null)) fail("recorte: janela parcial");
        if (wf !== null && wt !== null && wf > wt) fail("recorte: janela invertida");
        if (res === "candidato" && wf !== null && wt !== null && (on < wf || on > wt)) fail("recorte candidato fora da própria janela");
      }
      if (!Array.isArray(cand.declarations)) fail("declarações devem ser lista");
      const decls = new Map<string, CompositionDeclaration>();
      for (const d of cand.declarations as unknown[]) {
        if (!isObj(d)) fail("declaração inválida");
        keysExactly(d as Record<string, unknown>, ["dimensionId", "declarationId", "declarationVersionId", "value"], "declaração");
        const dd = d as CompositionDeclaration;
        tok(dd.dimensionId, "declaração.dimensionId"); tok(dd.declarationId, "declaração.declarationId");
        tok(dd.declarationVersionId, "declaração.declarationVersionId");
        const v = dd.value;
        if (!(v === null || typeof v === "boolean" || typeof v === "string" || (typeof v === "number" && Number.isFinite(v))))
          fail("declaração: valor fora de boolean/texto/número/null");
        const k = `${dd.dimensionId}\u0000${dd.declarationId}\u0000${dd.declarationVersionId}`;
        const prev = decls.get(k);
        if (prev && !(prev.value === v)) fail(`declaração ${dd.declarationId}: mesma identidade com valores diferentes`);
        decls.set(k, { dimensionId: dd.dimensionId, declarationId: dd.declarationId, declarationVersionId: dd.declarationVersionId, value: v });
      }
      if (res === "candidato") {
        const signature = JSON.stringify([...decls.entries()].sort(([a], [b]) => cmp(a, b)));
        const prev = merged.get(calendarId);
        if (prev) {
          if (prev.versionId !== versionId || prev.version !== version)
            fail(`calendário ${calendarId}: versões diferentes no mesmo snapshot`);
          if (prev.signature !== signature) fail(`calendário ${calendarId}: evidência repetida com declarações divergentes`);
          scopeKeys.forEach((s) => prev.scopeKeys.add(s));
        } else merged.set(calendarId, { calendarId, versionId, version, scopeKeys: new Set(scopeKeys), decls, signature });
      } else if (EXCLUDED_RESOLUTIONS.has(res)) {
        excluded.push({ calendarId, versionId, resolution: res });
      } else if (BLOCKING_EXACT.has(res) || BLOCKING_PREFIX.some((p) => res.startsWith(p) && res.length > p.length)) {
        blocking.push(`candidato ${calendarId}/${versionId}: ${res}`);
      } else fail(`resolução de candidato desconhecida "${res}"`);
    }
    excluded.sort((a, b) => cmp(a.calendarId, b.calendarId) || cmp(a.versionId, b.versionId) || cmp(a.resolution, b.resolution));
    const cals = [...merged.values()].sort((a, b) => cmp(a.calendarId, b.calendarId));
    const calendars = cals.map((m) => ({ calendarId: m.calendarId, versionId: m.versionId, version: m.version, scopeKeys: [...m.scopeKeys].sort(cmp) }));
    const base = { snapshot, norm: normOut, calendars, excluded };
    if (blocking.length) return result({ ...base, state: "candidato-indeterminado", reasons: blocking.sort(cmp) });
    if (cals.length === 0) return result({ ...base, state: "sem-candidato", reasons: ["nenhum calendário candidato na data"] });

    const multiplicity = norm.configuration.multiplicity!;
    if (multiplicity === "exigir-exclusividade" && cals.length > 1)
      return result({ ...base, state: "multiplicidade-proibida", reasons: [`exigir-exclusividade com ${cals.length} calendários efetivos`] });

    const rules = new Map(norm.configuration.dimensionRules.map((r) => [r.dimensionId, r]));
    const allDims = new Set<string>();
    for (const m of cals) for (const d of m.decls.values()) allDims.add(d.dimensionId);
    if (multiplicity === "compor-por-dimensao") for (const d of rules.keys()) allDims.add(d);

    const dimensions: DimensionOutcome[] = [...allDims].sort(cmp).map((dim) => {
      const rule = rules.get(dim);
      const provenance: DimensionOutcome["provenance"] = [];
      const absent: string[] = [];
      const valueMap = new Map<string, Exclude<DeclaredValue, null>>();
      let innerConflict = false;
      for (const m of cals) {
        const own = [...m.decls.values()].filter((d) => d.dimensionId === dim);
        own.forEach((d) => provenance.push({ calendarId: m.calendarId, versionId: m.versionId, declarationId: d.declarationId, declarationVersionId: d.declarationVersionId, value: d.value }));
        const vals = new Set<string>();
        for (const d of own) if (d.value !== null) { vals.add(valueKey(d.value)); valueMap.set(valueKey(d.value), d.value); }
        if (vals.size === 0) absent.push(m.calendarId);
        if (vals.size > 1) innerConflict = true;
      }
      provenance.sort((a, b) => cmp(a.calendarId, b.calendarId) || cmp(a.declarationId, b.declarationId) || cmp(a.declarationVersionId, b.declarationVersionId));
      const values = [...valueMap.keys()].sort(cmp).map((k) => valueMap.get(k)!);
      const out = (state: DimensionOutcome["state"], reason: string | null): DimensionOutcome => ({
        dimensionId: dim, state, values, reason, provenance, absentCalendars: absent.sort(cmp),
        ...(state === "determinado" ? { value: values[0] } : {}),
      });
      if (multiplicity === "compor-por-dimensao" && !rule) return out("dimensao-sem-regra", "dimensão declarada sem regra na norma");
      const union = rule?.operation === "uniao-com-diagnostico";
      if (values.length > 1) return union ? out("divergente", "valores divergentes preservados") : out("conflito", innerConflict ? "declarações conflitantes" : "calendários discordam");
      if (absent.length > 0) {
        if (!rule || rule.onAbsence === "indeterminado") return out("indeterminado", "declaração ausente");
        if (absent.length === cals.length) return out("indeterminado", "todos os candidatos sem declaração");
      }
      return out("determinado", null);
    });

    const pending = dimensions.filter((d) => d.state !== "determinado");
    if (pending.length || dimensions.length === 0)
      return result({ ...base, dimensions, state: "indeterminado", reasons: dimensions.length === 0 ? ["nenhuma dimensão declarada"] : pending.map((d) => `${d.dimensionId}: ${d.state}`) });
    return result({ ...base, dimensions, state: "determinado" });
  } catch (e) {
    if (e instanceof Invalid) return result({ state: "entrada-invalida", reasons: [e.message] });
    throw e;
  }
}
