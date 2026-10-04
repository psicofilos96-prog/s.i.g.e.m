/**
 * B4.6.7b — Importação explícita dos calendários registrados no navegador (`sigem.calendarios.v1`).
 *
 * - Só lê o armazenamento quando a Supervisão pede (função recebe `getItem`); NUNCA grava nem limpa.
 * - Sem registro no navegador, a referência 2027 do código é oferecida marcada como REFERÊNCIA, nunca como "salvo".
 * - A resolução da fonte (`resolveCalendar`) vira declarações diárias explícitas (uma por data resolvida); nenhuma
 *   faixa base + exceção é emitida, então não há declarações contraditórias criadas pela conversão. Datas que a
 *   fonte não resolveu ficam sem declaração (nunca preenchidas). Fim de semana não é regra do motor: só entra
 *   como a declaração que a própria fonte resolveu para aquela data.
 * - `countsAsSchoolDay: null` na fonte permanece `null` (efeito não declarado) no tipo institucional sugerido.
 * - O original bruto e a apresentação (documento, simbologia, legenda, assinaturas, períodos, eventos) vão para o
 *   snapshot imutável da versão (`record_calendar_presentation_snapshot`); não decidem efeito.
 */
import { createCalendarFixtures } from "./calendar-fixtures";
import { resolveCalendar } from "./calendar-engine";
import type { NetworkCalendar } from "./calendar-types";

export const BROWSER_CALENDAR_KEY = "sigem.calendarios.v1";

export type BrowserCalendarRead =
  | { state: "ausente" }
  | { state: "erro-leitura"; reason: string }
  | { state: "ilegivel"; raw: string; reason: string }
  | { state: "lido"; raw: string; entries: NetworkCalendar[] };

/** Leitura sob demanda. `getItem` é injetado para nunca tocar o armazenamento fora do pedido explícito. */
export function readBrowserCalendarsOnRequest(getItem: (k: string) => string | null): BrowserCalendarRead {
  let raw: string | null;
  try { raw = getItem(BROWSER_CALENDAR_KEY); } catch (e) {
    // Exceção de leitura NÃO é ausência: nunca oferecer a referência como se o registro estivesse vazio.
    return { state: "erro-leitura", reason: e instanceof Error ? e.message : "leitura do navegador recusada" };
  }
  if (raw === null || raw === "") return { state: "ausente" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { state: "ilegivel", raw, reason: "conteúdo não é JSON válido" }; }
  if (!Array.isArray(parsed)) return { state: "ilegivel", raw, reason: "formato inesperado (não é lista de calendários)" };
  const entries = parsed.filter((c): c is NetworkCalendar =>
    !!c && typeof c === "object" && typeof (c as NetworkCalendar).id === "string" && typeof (c as NetworkCalendar).year === "number"
    && Array.isArray((c as NetworkCalendar).ranges) && Array.isArray((c as NetworkCalendar).events));
  if (entries.length !== parsed.length) return { state: "ilegivel", raw, reason: "há registros em formato inesperado" };
  return { state: "lido", raw, entries };
}

/** Referência do código (Regular/EJA 2027). Sempre identificada como referência. */
export const referenceCalendars2027 = (): NetworkCalendar[] => createCalendarFixtures().filter((c) => c.year === 2027);

const PERSONALIZABLE: (keyof NetworkCalendar)[] = [
  "title", "ranges", "events", "periods", "periodGroups", "overrides", "inheritedHolidays", "document", "legendHidden",
  "customLegend", "symbology", "symbologyPrint", "dayTypeCatalog", "signatures", "observations",
];
/** Campos em que o registro do navegador difere da referência do código com o mesmo id. */
export function customizationsAgainstReference(entry: NetworkCalendar, refs = referenceCalendars2027()): string[] | null {
  const ref = refs.find((r) => r.id === entry.id);
  if (!ref) return null;
  return PERSONALIZABLE.filter((k) => JSON.stringify(entry[k] ?? null) !== JSON.stringify(ref[k] ?? null)).map(String);
}

export type SourceDayType = { code: string; label: string; countsAsSchoolDay: boolean | null; councilRole: string | null; days: number };
export type ImportPlan = {
  calendarId: string; title: string; modality: string; year: number;
  firstDay: string | null; lastDay: string | null;
  days: { day: string; code: string; label: string | null }[];
  types: SourceDayType[];
  presentation: Record<string, unknown>;
};

export function buildImportPlan(cal: NetworkCalendar): ImportPlan {
  const r = resolveCalendar(cal);
  const days = [...r.byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([day, code]) => ({ day, code, label: r.eventsByDate.get(day)?.name ?? null }));
  const counts = new Map<string, number>();
  for (const d of days) counts.set(d.code, (counts.get(d.code) ?? 0) + 1);
  const types = [...counts].map(([code, n]) => {
    const t = r.types[code];
    return { code, label: t?.label ?? code, countsAsSchoolDay: t ? t.countsAsSchoolDay : null, councilRole: t?.councilRole ?? null, days: n };
  }).sort((a, b) => a.label.localeCompare(b.label));
  const presentation: Record<string, unknown> = {
    contract: "b4.6.7b/apresentacao-1",
    sourceCalendarId: cal.id, title: cal.title, modality: cal.modality, year: cal.year, observations: cal.observations ?? null,
    document: cal.document, symbology: cal.symbology ?? null, symbologyPrint: cal.symbologyPrint ?? null,
    legendHidden: cal.legendHidden, customLegend: cal.customLegend ?? null, signatures: cal.signatures,
    periods: cal.periods, periodGroups: cal.periodGroups, events: cal.events, dayTypeCatalog: r.types,
    coexistingEvents: Object.fromEntries([...r.extraByDate.entries()]),
  };
  return { calendarId: cal.id, title: cal.title, modality: cal.modality, year: cal.year,
    firstDay: days[0]?.day ?? null, lastDay: days[days.length - 1]?.day ?? null, days, types, presentation };
}

export type InstitutionalTypeChoice = { versionId: string; schoolDayEffect: boolean | null };
export type DaysPayloadResult =
  | { ok: true; days: { day: string; day_type_version_id: string }[] }
  | { ok: false; problems: string[] };

/**
 * Converte o plano em declarações diárias para o writer. Todo tipo usado precisa de escolha explícita, e o efeito do
 * tipo institucional escolhido deve ser IDÊNTICO ao resultado da fonte (true/false/null), para preservar o resultado.
 */
export function buildDaysPayload(plan: ImportPlan, mapping: Record<string, InstitutionalTypeChoice | undefined>, window?: { from: string; to: string }): DaysPayloadResult {
  const problems: string[] = [];
  for (const t of plan.types) {
    const m = mapping[t.code];
    if (!m) problems.push(`Tipo "${t.label}" sem tipo institucional escolhido.`);
    else if (m.schoolDayEffect !== t.countsAsSchoolDay) problems.push(`Tipo "${t.label}": o efeito do tipo institucional escolhido difere do resultado da fonte.`);
  }
  if (problems.length) return { ok: false, problems };
  const days = plan.days.filter((d) => !window || (d.day >= window.from && d.day <= window.to))
    .map((d) => ({ day: d.day, day_type_version_id: mapping[d.code]!.versionId }));
  if (days.length === 0) return { ok: false, problems: ["Nenhuma data da fonte cai dentro da vigência informada."] };
  return { ok: true, days };
}

/** SHA-256 hex do texto (Web Crypto). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
