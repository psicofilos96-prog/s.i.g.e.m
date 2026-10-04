/**
 * B4.6.5c — Ponte PURA composição → efeitos dos dias, sobre a evidência privada
 * `calendar_composition_evidence_at` (contrato "b4.6.5c/1"). Não abre acesso, não autoriza e não publica:
 * o servidor será a fonte final de qualquer oficialização; esta ponte só interpreta evidência.
 *
 * - Dimensão ↔ efeito só por vínculo versionado explícito na norma (`effectBindings`:
 *   primitiva `school_day_effect`, contrato 1). Sem vínculo ⇒ `efeito-nao-vinculado` (nada é contado).
 * - Cada declaração do dia de cada calendário candidato vira declaração da dimensão vinculada
 *   (id = tipo:declaração, versão = versão fixada do tipo de dia); null ≠ false.
 * - Multicalendário nunca é reduzido a um versionId único: saída preserva todos os calendários,
 *   versões, recortes, homologações e declarações.
 * - Candidato não homologado/referência B2.4 inválida/indeterminado bloqueia; nada é descartado.
 * - Contexto (escola/alocação/posição) vem só do banco; a ponte não aceita contexto do cliente.
 */
import { instantMicros, sameInstant } from "@/lib/postgres-instant";
import { composeCalendarDeclarations, type CompositionCandidate, type CompositionResult, type CompositionDeclaration } from "./calendar-composition-engine";
import { datesBetween } from "./institutional-calendar-days";
import { isCivilIsoDate, isoWeekday, type RecurringBlock } from "./institutional-calendar-effects";

export const EVIDENCE_CONTRACT = "b4.6.5c/1";

export type ComposedDayState =
  | "letivo" | "nao-letivo"
  | "evidencia-invalida" | "snapshot-divergente" | "contexto-indisponivel"
  | "efeito-nao-vinculado" | "composicao-indeterminada";

export type ComposedCalendarRef = {
  calendarId: string; versionId: string; version: number; resolution: string;
  scopeKeys: string[]; homologationState: string | null;
};

export type ComposedDeclaration = {
  calendarId: string; versionId: string; kind: string; declarationId: string;
  dayTypeId: string; dayTypeVersionId: string; dayTypeVersion: number; schoolDayEffect: boolean | null;
};

export type ComposedDay = {
  date: string;
  knownAt: string;
  state: ComposedDayState;
  determined: boolean;
  schoolDayEffect: boolean | null;
  reason: string | null;
  context: { allocation: string; school: string; class: string; position: string | null } | null;
  binding: { dimensionId: string; effectPrimitive: "school_day_effect"; effectContractVersion: 1 } | null;
  calendars: ComposedCalendarRef[];
  declarations: ComposedDeclaration[];
  composition: CompositionResult | null;
  authorizes: false;
  publishes: false;
};

const ROW_KEYS = ["day_state", "version_id", "reference_issue", "homologation_state", "declaration_kind", "declaration_id", "starts_on",
  "ends_on", "event_label", "day_type_id", "day_type_version_id", "day_type_version", "day_type_label", "school_day_effect"];

class Bad extends Error {}
const bad = (m: string): never => { throw new Bad(m); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, w: string): string => (typeof v === "string" && v.trim() !== "" ? v : bad(`${w} inválido`));
const exact = (o: Record<string, unknown>, keys: string[], w: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) bad(`${w}: campo não reconhecido "${k}"`);
  for (const k of keys) if (!(k in o)) bad(`${w}: campo ausente "${k}"`);
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function deepFreeze<T>(v: T): T {
  if (typeof v === "object" && v !== null && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); }
  return v;
}

function day(expected: { on: string; knownAt: string }, p: Partial<ComposedDay> & { state: ComposedDayState }): ComposedDay {
  return deepFreeze(structuredClone({
    date: expected.on, knownAt: expected.knownAt, determined: false, schoolDayEffect: null, reason: null, context: null, binding: null,
    calendars: [], declarations: [], composition: null, ...p, authorizes: false, publishes: false,
  }) as ComposedDay);
}

/** Interpreta a evidência de UM dia. `expected` = data/knownAt que o chamador pediu (conferidos com a evidência). */
export function bridgeComposedDay(evidence: unknown, expected: { on: string; knownAt: string }): ComposedDay {
  if (!isCivilIsoDate(expected.on) || instantMicros(expected.knownAt) === null)
    return day(expected, { state: "evidencia-invalida", reason: "data ou knownAt pedidos são inválidos" });
  try {
    if (!isObj(evidence)) bad("evidência não é objeto");
    if (evidence["contract"] !== EVIDENCE_CONTRACT) bad(`contrato de evidência desconhecido "${String(evidence["contract"])}"`);
    const snap = evidence["snapshot"];
    if (!isObj(snap)) bad("snapshot ausente");
    exact(snap, ["on", "knownAt"], "snapshot");
    if (snap["on"] !== expected.on || !sameInstant(snap["knownAt"], expected.knownAt))
      return day(expected, { state: "snapshot-divergente", reason: "evidência de outra data ou outro knownAt" });
    const ctx = evidence["context"];
    if (!isObj(ctx)) bad("contexto ausente");
    if (ctx["state"] !== "derivado") {
      exact(evidence, ["contract", "snapshot", "context"], "evidência");
      return day(expected, { state: "contexto-indisponivel", reason: `contexto: ${str(ctx["state"], "context.state")}` });
    }
    exact(evidence, ["contract", "snapshot", "context", "norm", "candidates"], "evidência");
    exact(ctx, ["state", "allocation", "school", "class", "academicYear", "position", "axis"], "contexto");
    if (ctx["axis"] !== "nao-derivado") bad("contexto: eixo com forma desconhecida");
    const context = { allocation: str(ctx["allocation"], "allocation"), school: str(ctx["school"], "school"), class: str(ctx["class"], "class"),
      position: ctx["position"] === null ? null : str(ctx["position"], "position") };
    str(ctx["academicYear"], "academicYear");

    // Norma: vínculos são separados antes de entregar ao motor (que exige forma exata da B4.6.5b).
    const rawNorm = evidence["norm"];
    if (!isObj(rawNorm)) bad("norma ausente");
    let binding: ComposedDay["binding"] = null;
    const { effectBindings, ...norm } = rawNorm;
    if (rawNorm["state"] === "norma-homologada") {
      if (!Array.isArray(effectBindings)) bad("norma: effectBindings ausente");
      for (const b of effectBindings as unknown[]) {
        if (!isObj(b)) bad("vínculo inválido");
        exact(b, ["dimensionId", "effectPrimitive", "effectContractVersion"], "vínculo");
        if (b["effectPrimitive"] !== "school_day_effect") bad(`primitiva de efeito desconhecida "${String(b["effectPrimitive"])}"`);
        if (b["effectContractVersion"] !== 1) bad(`versão de contrato de efeito desconhecida "${String(b["effectContractVersion"])}"`);
        if (binding) bad("mais de um vínculo para school_day_effect");
        binding = { dimensionId: str(b["dimensionId"], "vínculo.dimensionId"), effectPrimitive: "school_day_effect", effectContractVersion: 1 };
      }
    } else if (effectBindings !== undefined) bad("vínculos fora de norma homologada");

    if (!Array.isArray(evidence["candidates"])) bad("candidatos ausentes");
    const calendars: ComposedCalendarRef[] = [];
    const declarations: ComposedDeclaration[] = [];
    const engineCands: CompositionCandidate[] = [];
    const seenCal = new Set<string>();
    for (const cRaw of evidence["candidates"] as unknown[]) {
      if (!isObj(cRaw)) bad("candidato inválido");
      const c = cRaw as Record<string, unknown>;
      exact(c, ["resolution", "calendarId", "versionId", "version", "scopes", "dayRows"], "candidato");
      const calendarId = str(c["calendarId"], "calendarId"); const versionId = str(c["versionId"], "versionId");
      const resolution = str(c["resolution"], "resolution");
      const key = `${calendarId}\u0000${resolution}`;
      if (seenCal.has(key)) bad(`candidato repetido ${calendarId}/${resolution}`);
      seenCal.add(key);
      if (!Array.isArray(c["scopes"]) || !Array.isArray(c["dayRows"])) bad("candidato: listas ausentes");
      const scopes = c["scopes"] as CompositionCandidate["scopes"];
      let effRes = resolution; let hs: string | null = null;
      const decls: CompositionDeclaration[] = [];
      if (resolution === "candidato") {
        const rows = c["dayRows"] as unknown[];
        if (rows.length === 0) bad(`candidato ${calendarId}: sem linhas do dia`);
        const states = new Set<string>(); const homs = new Set<unknown>();
        for (const r of rows) {
          if (!isObj(r)) bad("linha do dia inválida");
          exact(r, ROW_KEYS, "linha do dia");
          if (r["version_id"] !== versionId) bad(`candidato ${calendarId}: linha de outra versão`);
          states.add(String(r["day_state"])); homs.add(r["homologation_state"]);
        }
        if (homs.size !== 1 || states.size !== 1) bad(`candidato ${calendarId}: snapshot do dia divergente`);
        hs = typeof [...homs][0] === "string" ? ([...homs][0] as string) : null;
        const st = [...states][0]!;
        if (!["declarado", "conflito-sem-regra", "nao-declarado", "referencia-b2-4-invalida"].includes(st)) bad(`estado de dia desconhecido "${st}"`);
        if (st === "referencia-b2-4-invalida") effRes = "referencia-invalida:calendario-referencia-b2-4";
        else if (hs !== "homologada") effRes = `referencia-indeterminada:calendario-${hs ?? "homologacao-ausente"}`;
        else if (st === "nao-declarado") { if (rows.length !== 1) bad("nao-declarado com conteúdo"); }
        else for (const r of rows as Record<string, unknown>[]) {
          const eff = r["school_day_effect"] as boolean | null;
          if (!(eff === null || typeof eff === "boolean")) bad("school_day_effect fora de boolean/null");
          const dtv = r["day_type_version"];
          if (typeof dtv !== "number" || !Number.isInteger(dtv) || dtv < 1) bad("versão do tipo de dia inválida");
          const d: ComposedDeclaration = { calendarId, versionId, kind: str(r["declaration_kind"], "declaration_kind"),
            declarationId: str(r["declaration_id"], "declaration_id"), dayTypeId: str(r["day_type_id"], "day_type_id"),
            dayTypeVersionId: str(r["day_type_version_id"], "day_type_version_id"), dayTypeVersion: dtv, schoolDayEffect: eff };
          declarations.push(d);
          if (binding) decls.push({ dimensionId: binding.dimensionId, declarationId: `${d.kind}:${d.declarationId}`,
            declarationVersionId: d.dayTypeVersionId, value: eff });
        }
      } else if ((c["dayRows"] as unknown[]).length) bad("linhas do dia em não-candidato");
      calendars.push({ calendarId, versionId, version: c["version"] as number, resolution: effRes,
        scopeKeys: scopes.map((s) => (isObj(s) ? String(s["scopeKey"]) : "")).sort(cmp), homologationState: hs });
      engineCands.push({ resolution: effRes, calendarId, versionId, version: c["version"] as number, scopes, declarations: decls });
    }
    calendars.sort((a, b) => cmp(a.calendarId, b.calendarId) || cmp(a.resolution, b.resolution));
    declarations.sort((a, b) => cmp(a.calendarId, b.calendarId) || cmp(a.kind, b.kind) || cmp(a.declarationId, b.declarationId));

    const composition = composeCalendarDeclarations({ snapshot: { on: expected.on, knownAt: expected.knownAt }, norm, candidates: engineCands });
    const base = { context, binding, calendars, declarations, composition };
    if (composition.state === "entrada-invalida") return day(expected, { ...base, state: "evidencia-invalida", reason: composition.reasons.join("; ") });
    if (composition.state === "norma-bloqueada" || composition.state === "candidato-indeterminado" || composition.state === "sem-candidato"
      || composition.state === "multiplicidade-proibida" || composition.state === "snapshot-invalido")
      return day(expected, { ...base, state: "composicao-indeterminada", reason: `${composition.state}: ${composition.reasons.join("; ")}` });
    if (!binding) return day(expected, { ...base, state: "efeito-nao-vinculado", reason: "norma sem vínculo explícito de school_day_effect" });
    const b = binding as NonNullable<ComposedDay["binding"]>;
    const dim = composition.dimensions.find((d) => d.dimensionId === b.dimensionId);
    if (composition.state !== "determinado" || !dim || dim.state !== "determinado")
      return day(expected, { ...base, state: "composicao-indeterminada",
        reason: dim ? composition.reasons.join("; ") || dim.state : "nenhuma declaração na dimensão vinculada" });
    if (typeof dim.value !== "boolean") bad("valor composto de school_day_effect não é boolean");
    return day(expected, { ...base, state: dim.value ? "letivo" : "nao-letivo", determined: true, schoolDayEffect: dim.value as boolean });
  } catch (e) {
    if (e instanceof Bad) return day(expected, { state: "evidencia-invalida", reason: e.message });
    throw e;
  }
}

/** Contagem de dias letivos: null se algum dia indeterminado, datas duplicadas ou contextos distintos. */
export function countComposedSchoolDays(days: readonly ComposedDay[]) {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const d of days) (seen.has(d.date) ? dup : seen).add(d.date);
  const ctx = new Set(days.map((d) => d.context?.allocation ?? "\u0000"));
  const undetermined = days.filter((d) => !d.determined);
  const count = undetermined.length || dup.size || ctx.size > 1 ? null : days.filter((d) => d.state === "letivo").length;
  return { count, undetermined, duplicatedDates: [...dup].sort(cmp), mixedContexts: ctx.size > 1 };
}

export type ComposedPlannedDay =
  | { date: string; kind: "aulas-previstas"; blocks: RecurringBlock[]; calendar: ComposedDay }
  | { date: string; kind: "sem-aula-por-calendario" | "sem-bloco-na-grade" | "indeterminado"; calendar: ComposedDay };

/** Projeção da grade sobre dias compostos; indeterminado nunca vira zero; não gera ausência. */
export function projectComposedPlannedLessons(blocks: readonly RecurringBlock[], days: readonly ComposedDay[]) {
  const out: ComposedPlannedDay[] = days.map((cal) => {
    if (!cal.determined) return { date: cal.date, kind: "indeterminado", calendar: cal };
    if (cal.state === "nao-letivo") return { date: cal.date, kind: "sem-aula-por-calendario", calendar: cal };
    const b = blocks.filter((x) => x.weekday === isoWeekday(cal.date));
    return b.length ? { date: cal.date, kind: "aulas-previstas", blocks: b, calendar: cal } : { date: cal.date, kind: "sem-bloco-na-grade", calendar: cal };
  });
  const c = countComposedSchoolDays(days);
  const blocked = out.some((d) => d.kind === "indeterminado") || c.duplicatedDates.length > 0 || c.mixedContexts;
  const plannedUnits = blocked ? null : out.reduce((s, d) => s + (d.kind === "aulas-previstas" ? d.blocks.reduce((a, x) => a + x.units, 0) : 0), 0);
  return { days: out, plannedUnits };
}

export type ComposedCalendarBasis = Readonly<{
  knownAt: string; range: Readonly<{ start: string; end: string }>;
  kind: "determinado" | "indeterminado"; schoolDays: number | null; reason: string | null;
  /** Todos os calendários/versões que sustentaram algum dia (sem versionId único fictício). */
  calendars: readonly Readonly<{ calendarId: string; versionId: string; version: number }>[];
  days: readonly ComposedDay[];
}>;

/** Base congelada na emissão (B4.6.3f) sobre dias compostos; compatível com `ratioOverSchoolDays`. */
export function composedCalendarBasis(days: readonly ComposedDay[], meta: { knownAt: string; start: string; end: string }): ComposedCalendarBasis {
  let valid = instantMicros(meta.knownAt) !== null;
  try {
    const expected = datesBetween(meta.start, meta.end);
    valid = valid && expected.length === days.length && new Set(days.map((d) => d.date)).size === days.length
      && expected.every((d) => days.some((x) => x.date === d)) && days.every((d) => sameInstant(d.knownAt, meta.knownAt));
  } catch { valid = false; }
  const c = countComposedSchoolDays(days);
  const calMap = new Map<string, { calendarId: string; versionId: string; version: number }>();
  for (const d of days) for (const k of d.calendars) if (k.resolution === "candidato") calMap.set(`${k.calendarId}\u0000${k.versionId}`, { calendarId: k.calendarId, versionId: k.versionId, version: k.version });
  const ok = valid && c.count !== null;
  return deepFreeze({
    knownAt: meta.knownAt, range: { start: meta.start, end: meta.end },
    kind: ok ? "determinado" : "indeterminado", schoolDays: ok ? c.count : null,
    reason: !valid ? "Base de calendário incompleta ou divergente do intervalo/instante informado."
      : ok ? null : `Dias não determinados: ${c.undetermined.map((d) => `${d.date} (${d.state})`).join(", ") || "contexto misto ou datas duplicadas"}`,
    calendars: [...calMap.values()].sort((a, b) => cmp(a.calendarId, b.calendarId) || cmp(a.versionId, b.versionId)),
    days: [...days],
  });
}
