/**
 * B4.6.7c — Apresentação institucional do calendário (snapshot 0035) e modelo de impressão.
 *
 * - O snapshot guarda SÓ aparência/origem (título, documento, simbologia, assinaturas, original). Dias e efeitos da
 *   folha vêm exclusivamente das declarações da versão institucional (`calendar_days_at`); o motor do laboratório
 *   não é chamado, e data sem declaração é impressa como "sem declaração", nunca como letiva/não letiva.
 * - O vínculo aparência↔tipo institucional é explícito (`typeMap`: versão do tipo → código de símbolo da fonte).
 * - Anexo que falhou fica guardado em memória (`pendingPresentation`) para nova tentativa SEM nova versão.
 */
import { supabase } from "@/integrations/supabase/client";
import { dayEffectFromRows, type CalendarDayRead } from "./institutional-calendar-readers";
import { canonicalTypeMap } from "./calendar-visual-resolver";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export const PRESENTATION_CONTRACT = "b4.6.7c/apresentacao-2";
export type PresentationSourceKind = "importacao-navegador" | "referencia-codigo" | "edicao-institucional";
export type PresentationSnapshot = Readonly<{
  versionId: string; sourceKind: PresentationSourceKind; sourceKey: string | null; sourceEntryId: string | null;
  sourceDigest: string; presentation: Record<string, unknown>; declaredNote: string | null; recordedAt: string;
}>;
export type PresentationRead =
  | { kind: "acesso-negado" } | { kind: "sem-snapshot" } | { kind: "invalido"; reason: string }
  | { kind: "lido"; snapshot: PresentationSnapshot };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const KINDS: PresentationSourceKind[] = ["importacao-navegador", "referencia-codigo", "edicao-institucional"];

export function parsePresentation(p: unknown, versionId: string): PresentationRead {
  if (!isObj(p) || p["contract"] !== "b4.6.7b/1") return { kind: "invalido", reason: "contrato" };
  const keys = Object.keys(p).sort().join(",");
  if (p["state"] === "access-denied") return keys === "contract,state" ? { kind: "acesso-negado" } : { kind: "invalido", reason: "chaves" };
  if (p["state"] === "sem-snapshot") return keys === "contract,state" ? { kind: "sem-snapshot" } : { kind: "invalido", reason: "chaves" };
  if (p["state"] !== "lido" || keys !== "contract,snapshot,state") return { kind: "invalido", reason: "estado" };
  const s = p["snapshot"];
  if (!isObj(s)) return { kind: "invalido", reason: "snapshot" };
  const expected = ["declaredNote", "presentation", "recordedAt", "sourceDigest", "sourceEntryId", "sourceKey", "sourceKind", "versionId"];
  if (Object.keys(s).sort().join(",") !== expected.join(",")) return { kind: "invalido", reason: "chaves-snapshot" };
  if (s["versionId"] !== versionId) return { kind: "invalido", reason: "versao-divergente" };
  if (!KINDS.includes(s["sourceKind"] as PresentationSourceKind)) return { kind: "invalido", reason: "origem" };
  if (typeof s["sourceDigest"] !== "string" || !/^[0-9a-f]{64}$/.test(s["sourceDigest"])) return { kind: "invalido", reason: "digest" };
  if (!isObj(s["presentation"]) || typeof s["recordedAt"] !== "string") return { kind: "invalido", reason: "apresentacao" };
  const strN = (v: unknown) => (v === null ? null : typeof v === "string" ? v : undefined);
  const key = strN(s["sourceKey"]), entry = strN(s["sourceEntryId"]), note = strN(s["declaredNote"]);
  if (key === undefined || entry === undefined || note === undefined) return { kind: "invalido", reason: "campos" };
  return { kind: "lido", snapshot: { versionId, sourceKind: s["sourceKind"] as PresentationSourceKind, sourceKey: key, sourceEntryId: entry,
    sourceDigest: s["sourceDigest"], presentation: s["presentation"], declaredNote: note, recordedAt: s["recordedAt"] } };
}

export async function readPresentation(p: { versionId: string; on: string; knownAt: string }, rpc: Rpc = defaultRpc): Promise<PresentationRead> {
  const { data, error } = await rpc("calendar_presentation_at", { _version_id: p.versionId, _on: p.on, _known_at: p.knownAt });
  if (error) throw error;
  return parsePresentation(data, p.versionId);
}

/** Título humano (Regular/EJA/ano) declarado na apresentação; nunca derivado de ID. */
export function presentationTitle(pr: Record<string, unknown> | null | undefined): string | null {
  const t = pr?.["title"];
  return typeof t === "string" && t.trim() ? t.trim() : null;
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
/** Título já usado por OUTRO calendário no mesmo ano letivo ⇒ conflito (Regular e EJA precisam ser distinguíveis). */
export function titleCollision(title: string, yearId: string, calendarId: string | null,
  others: readonly { calendarId: string; academicYearId: string; title: string | null }[]): boolean {
  return others.some((o) => o.academicYearId === yearId && o.calendarId !== calendarId && o.title !== null && norm(o.title) === norm(title));
}

/**
 * Apresentação de uma nova versão: parte da apresentação da BASE (preservando documento, simbologia, assinaturas,
 * catálogo visual e original) e acrescenta título e vínculo explícito de tipos; nunca descarta campos da base.
 */
export function composePresentation(p: {
  base: Record<string, unknown> | null; title: string; typeMap: Record<string, string>; baseVersionId: string | null;
}): Record<string, unknown> {
  const prevMap = isObj(p.base?.["typeMap"]) ? (p.base!["typeMap"] as Record<string, string>) : {};
  return { ...(p.base ?? {}), contract: PRESENTATION_CONTRACT, title: p.title.trim(), typeMap: { ...prevMap, ...p.typeMap },
    derivedFromVersionId: p.baseVersionId };
}

// ---------- anexo pendente (nova tentativa sem nova versão) ----------
export type PendingPresentation = {
  versionId: string; sourceKind: PresentationSourceKind; sourceKey: string | null; sourceEntryId: string | null;
  digest: string; raw: unknown; presentation: Record<string, unknown>; note: string | null; lastError: string;
};
const pending = new Map<string, PendingPresentation>();
export const pendingPresentation = {
  put: (p: PendingPresentation) => { pending.set(p.versionId, p); },
  get: (versionId: string) => pending.get(versionId) ?? null,
  clear: (versionId: string) => { pending.delete(versionId); },
  reset: () => pending.clear(),
};

// ---------- modelo de impressão ----------
export type PrintDay = Readonly<{
  on: string; label: string | null; typeLabel: string | null; symbolCode: string | null;
  /** Marcadores coexistentes vinculados explicitamente (outras declarações mapeadas + `coexistingEvents` da fonte). */
  extraCodes: readonly string[];
  effect: "letivo" | "nao-letivo" | "sem-declaracao" | "efeito-nao-declarado" | "conflito" | "indeterminado";
  /** Símbolo da fonte cujo catálogo visual diz o contrário do efeito institucional (efeito vale; aviso exibido). */
  markMismatch: boolean;
}>;
export type PrintCount = { schoolDays: number | null; reason: string | null };
export type PrintPeriod = Readonly<{ name: string; startsOn: string; endsOn: string } & PrintCount>;
export type PrintModel = Readonly<{
  title: string | null; months: readonly { key: string; days: readonly PrintDay[]; total: PrintCount }[];
  periods: readonly PrintPeriod[]; total: PrintCount;
  signatures: readonly string[]; unmappedTypes: readonly string[];
  holidays: readonly { on: string; name: string }[]; legendCodes: readonly string[]; mismatches: readonly string[];
}>;

const addDay = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const lastOfMonth = (key: string) => { const [y, m] = key.split("-").map(Number); return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10); };

export function buildPrintModel(presentation: Record<string, unknown>, days: readonly CalendarDayRead[],
  periods: readonly { name: string; startsOn: string; endsOn: string }[]): PrintModel {
  // Lote 3: vínculo por identidade nas duas direções gravadas (snapshots reais: código → versão). Sem isso o
  // Interno e os externos mostravam "?" e "Tipos sem símbolo vinculado" para todos os tipos na tela real.
  const typeMap: Record<string, unknown> = canonicalTypeMap(presentation);
  const catalog = isObj(presentation["dayTypeCatalog"]) ? (presentation["dayTypeCatalog"] as Record<string, Record<string, unknown>>) : {};
  const coexisting = isObj(presentation["coexistingEvents"]) ? (presentation["coexistingEvents"] as Record<string, unknown>) : {};
  const unmapped = new Set<string>();
  const holidays: { on: string; name: string }[] = [];
  const mismatches: string[] = [];
  const codeOf = (tv: string | null) => (tv && typeof typeMap[tv] === "string" ? (typeMap[tv] as string) : null);
  const out: PrintDay[] = days.map((d) => {
    // Folha de prévia da construção: rascunho salvo (ainda não homologado) mostra o efeito das MESMAS
    // declarações, para a folha não virar "indeterminado" a cada salvamento. Só a apresentação usa isto;
    // contagens institucionais (dayEffectFromRows) continuam exigindo homologação.
    const e = dayEffectFromRows(d.state === "nao-homologada" && d.rows ? { ...d, state: "homologada" } : d);
    const decl = (d.rows ?? []).filter((r) => r.declarationId !== null);
    const distinct = [...new Map(decl.map((r) => [r.dayTypeVersionId, r])).values()];
    for (const r of distinct) if (r.dayTypeVersionId && !codeOf(r.dayTypeVersionId)) unmapped.add(r.dayTypeLabel ?? "tipo sem nome");
    const one = distinct.length === 1 ? distinct[0]! : null;
    // Principal: declaração de evento (se houver) sobre a de intervalo; demais mapeadas viram companheiras.
    const ordered = [...distinct.filter((r) => r.declarationKind === "evento"), ...distinct.filter((r) => r.declarationKind !== "evento")];
    const main = ordered[0] ?? null;
    const code = main ? codeOf(main.dayTypeVersionId) : null;
    const extras = ordered.slice(1).map((r) => codeOf(r.dayTypeVersionId)).filter((c): c is string => !!c);
    const src = coexisting[d.on];
    if (code && Array.isArray(src)) for (const c of src) if (typeof c === "string" && c !== code && !extras.includes(c)) extras.push(c);
    const effect: PrintDay["effect"] = e.kind === "letivo" || e.kind === "nao-letivo" || e.kind === "conflito" || e.kind === "efeito-nao-declarado"
      ? e.kind : e.kind === "nao-declarado" ? "sem-declaracao" : "indeterminado";
    const info = code ? catalog[code] : undefined;
    const counts = info && typeof info["countsAsSchoolDay"] === "boolean" ? (info["countsAsSchoolDay"] as boolean) : null;
    const mismatch = counts !== null && (effect === "letivo" || effect === "nao-letivo") && counts !== (effect === "letivo");
    if (mismatch) mismatches.push(d.on);
    const label = decl.find((r) => r.eventLabel)?.eventLabel ?? null;
    const kind = info?.["kind"];
    // Feriado sem nome de evento entra com o nome do tipo, para nunca sumir da lista.
    const holidayName = label ?? main?.dayTypeLabel ?? null;
    if (!mismatch && holidayName && (kind === "feriado" || kind === "feriado-letivo")) holidays.push({ on: d.on, name: holidayName });
    return { on: d.on, label, typeLabel: one?.dayTypeLabel ?? main?.dayTypeLabel ?? null, symbolCode: code, extraCodes: extras, effect, markMismatch: mismatch };
  });
  const byDate = new Map(out.map((d) => [d.on, d]));
  /** Cobertura INTEGRAL: toda data de [from, to] precisa ter sido lida; subconjunto nunca é contado. */
  const count = (from: string, to: string): PrintCount => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return { schoolDays: null, reason: "intervalo inválido" };
    let n = 0;
    for (let c = from, guard = 0; c <= to && guard < 800; c = addDay(c), guard++) {
      const d = byDate.get(c);
      if (!d) return { schoolDays: null, reason: `${c}: fora do intervalo lido` };
      if (d.effect !== "letivo" && d.effect !== "nao-letivo") return { schoolDays: null, reason: `${c}: ${d.effect}` };
      if (d.effect === "letivo") n += 1;
    }
    return { schoolDays: n, reason: null };
  };
  const months = new Map<string, PrintDay[]>();
  for (const d of out) { const k = d.on.slice(0, 7); (months.get(k) ?? months.set(k, []).get(k)!).push(d); }
  const sig = Array.isArray(presentation["signatures"]) ? (presentation["signatures"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const hidden = new Set(Array.isArray(presentation["legendHidden"]) ? (presentation["legendHidden"] as unknown[]).filter((x): x is string => typeof x === "string") : []);
  const used = new Set<string>();
  for (const d of out) { if (d.symbolCode) used.add(d.symbolCode); for (const c of d.extraCodes) used.add(c); }
  const order = (c: string) => (typeof catalog[c]?.["legendOrder"] === "number" ? (catalog[c]!["legendOrder"] as number) : 999);
  const legendCodes = [...used].filter((c) => !hidden.has(c) && catalog[c]?.["showInLegend"] !== false).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return {
    title: presentationTitle(presentation),
    months: [...months].map(([key, ds]) => ({ key, days: ds, total: count(`${key}-01`, lastOfMonth(key)) })),
    periods: periods.map((p) => ({ ...p, ...count(p.startsOn, p.endsOn) })),
    total: out.length ? count(out[0]!.on, out[out.length - 1]!.on) : { schoolDays: null, reason: "sem dias lidos" },
    signatures: sig, unmappedTypes: [...unmapped], holidays, legendCodes, mismatches,
  };
}
