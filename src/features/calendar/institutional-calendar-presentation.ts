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
  effect: "letivo" | "nao-letivo" | "sem-declaracao" | "efeito-nao-declarado" | "conflito" | "indeterminado";
}>;
export type PrintPeriod = Readonly<{ name: string; startsOn: string; endsOn: string; schoolDays: number | null; reason: string | null }>;
export type PrintModel = Readonly<{
  title: string | null; months: readonly { key: string; days: readonly PrintDay[] }[];
  periods: readonly PrintPeriod[]; total: { schoolDays: number | null; reason: string | null };
  signatures: readonly string[]; unmappedTypes: readonly string[];
}>;

export function buildPrintModel(presentation: Record<string, unknown>, days: readonly CalendarDayRead[],
  periods: readonly { name: string; startsOn: string; endsOn: string }[]): PrintModel {
  const typeMap = isObj(presentation["typeMap"]) ? (presentation["typeMap"] as Record<string, unknown>) : {};
  const unmapped = new Set<string>();
  const out: PrintDay[] = days.map((d) => {
    const e = dayEffectFromRows(d);
    const decl = (d.rows ?? []).filter((r) => r.declarationId !== null);
    const one = decl.length > 0 && new Set(decl.map((r) => r.dayTypeVersionId)).size === 1 ? decl[0]! : null;
    const code = one?.dayTypeVersionId && typeof typeMap[one.dayTypeVersionId] === "string" ? (typeMap[one.dayTypeVersionId] as string) : null;
    if (one?.dayTypeVersionId && !code) unmapped.add(one.dayTypeLabel ?? "tipo sem nome");
    const effect: PrintDay["effect"] = e.kind === "letivo" || e.kind === "nao-letivo" || e.kind === "conflito" || e.kind === "efeito-nao-declarado"
      ? e.kind : e.kind === "nao-declarado" ? "sem-declaracao" : "indeterminado";
    return { on: d.on, label: decl.find((r) => r.eventLabel)?.eventLabel ?? null, typeLabel: one?.dayTypeLabel ?? null, symbolCode: code, effect };
  });
  const count = (from: string, to: string) => {
    const sel = out.filter((d) => d.on >= from && d.on <= to);
    if (sel.length === 0) return { schoolDays: null, reason: "fora do intervalo lido" };
    const bad = sel.find((d) => d.effect !== "letivo" && d.effect !== "nao-letivo");
    if (bad) return { schoolDays: null, reason: `${bad.on}: ${bad.effect}` };
    return { schoolDays: sel.filter((d) => d.effect === "letivo").length, reason: null };
  };
  const months = new Map<string, PrintDay[]>();
  for (const d of out) { const k = d.on.slice(0, 7); (months.get(k) ?? months.set(k, []).get(k)!).push(d); }
  const sig = Array.isArray(presentation["signatures"]) ? (presentation["signatures"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return {
    title: presentationTitle(presentation),
    months: [...months].map(([key, ds]) => ({ key, days: ds })),
    periods: periods.map((p) => ({ ...p, ...count(p.startsOn, p.endsOn) })),
    total: out.length ? count(out[0]!.on, out[out.length - 1]!.on) : { schoolDays: null, reason: "sem dias lidos" },
    signatures: sig, unmappedTypes: [...unmapped],
  };
}
