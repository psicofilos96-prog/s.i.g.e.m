import type { NetworkRow } from "./model";
import { NO_UPDATE, SITUATIONS, networkIndicators } from "./model";
import type { FollowupMonth, FollowupStatus } from "./source";

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const optionalText = (v: unknown): v is string | null | undefined =>
  v == null || typeof v === "string";
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(v + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
};
const month = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Complete network data are required: no "undefined" school names or NaN KPI values. */
export function parseFollowupNetworkRows(value: unknown): NetworkRow[] {
  if (!Array.isArray(value)) throw new Error("O panorama da rede retornou um formato inválido.");
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!isRow(item) || !text(item["school_id"]) || !text(item["school_name"]) ||
        !optionalText(item["inep"]) ||
        !count(item["visits"]) || !count(item["actions"]) ||
        !count(item["completed"]) || !count(item["overdue"]) ||
        (item["last_visit"] != null && !date(item["last_visit"])) ||
        (count(item["actions"]) && count(item["completed"]) &&
          item["completed"] > item["actions"]) ||
        (count(item["actions"]) && count(item["overdue"]) &&
          item["overdue"] > item["actions"]) ||
        (count(item["actions"]) && count(item["completed"]) && count(item["overdue"]) &&
          item["completed"] + item["overdue"] > item["actions"]) ||
        (count(item["visits"]) && item["visits"] > 0 && !date(item["last_visit"])) ||
        seen.has(String(item["school_id"]))) {
      throw new Error("O panorama da rede contém uma unidade ou contagem inválida.");
    }
    seen.add(item["school_id"] as string);
    return {
      school_id: item["school_id"] as string,
      school_name: item["school_name"] as string,
      inep: item["inep"] == null ? null : item["inep"] as string,
      visits: item["visits"] as number,
      actions: item["actions"] as number,
      completed: item["completed"] as number,
      overdue: item["overdue"] as number,
      last_visit: item["last_visit"] == null ? null : item["last_visit"] as string,
    };
  });
}

/** A monthly count may be zero or positive but must belong to the requested range. */
export function parseFollowupMonths(value: unknown, from: string, to: string): FollowupMonth[] {
  if (!Array.isArray(value)) throw new Error("Série mensal indisponível.");
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!isRow(item) || !month(item["month"]) || !count(item["visits"]) ||
        item["month"] < from.slice(0, 7) || item["month"] > to.slice(0, 7) ||
        seen.has(item["month"])) {
      throw new Error("A série mensal contém um período ou total inválido.");
    }
    seen.add(item["month"]);
    return { month: item["month"], visits: item["visits"] };
  });
}

/** Unknown or duplicate situation categories must not vanish silently from the chart. */
export function parseFollowupStatuses(value: unknown): FollowupStatus[] {
  if (!Array.isArray(value)) throw new Error("Situações indisponíveis.");
  const allowed = new Set<string>([NO_UPDATE, ...SITUATIONS.map((s) => s.value)]);
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!isRow(item) || !text(item["situation"]) || !allowed.has(item["situation"]) ||
        !count(item["actions"]) || seen.has(item["situation"])) {
      throw new Error("A distribuição de situações contém uma categoria ou total inválido.");
    }
    seen.add(item["situation"]);
    return { situation: item["situation"], actions: item["actions"] };
  });
}

/**
 * Independent read-only RPCs are not an atomic database snapshot. Prevent a
 * mixed-time or mixed-scope response from being presented as a coherent chart.
 * The monthly sum must equal current visits in the requested period; status
 * counts must account for every action and agree on completed actions.
 */
export function reconcileFollowupNetworkIndicators(
  network: readonly NetworkRow[],
  months: readonly FollowupMonth[],
  statuses: readonly FollowupStatus[],
): { monthlyConsistent: boolean; statusesConsistent: boolean } {
  const totals = networkIndicators(network);
  const monthVisits = months.reduce((sum, item) => sum + item.visits, 0);
  const statusActions = statuses.reduce((sum, item) => sum + item.actions, 0);
  const completed = statuses.find((item) => item.situation === "concluída")?.actions ?? 0;
  return {
    monthlyConsistent: Number.isSafeInteger(monthVisits) && monthVisits === totals.visits,
    statusesConsistent: Number.isSafeInteger(statusActions) &&
      statusActions === totals.actions && completed === totals.completed,
  };
}
