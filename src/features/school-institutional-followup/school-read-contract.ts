import type { SchoolSnapshot } from "./model";
import { SITUATIONS } from "./model";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasText = (row: Row, field: string): boolean =>
  typeof row[field] === "string" && (row[field] as string).length > 0;
const optionalText = (row: Row, field: string): boolean =>
  row[field] == null || typeof row[field] === "string";
const date = (value: unknown): boolean => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const timestamp = (value: unknown): boolean =>
  typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && date(value.slice(0, 10))
  && Number.isFinite(Date.parse(value));

/** Fail closed on malformed/incomplete scoped read results; never silently hide rows. */
export function parseSchoolFollowupSnapshot(value: unknown, schoolId: string): SchoolSnapshot {
  if (!schoolId || !isRow(value) ||
      !Array.isArray(value["visits"]) || !Array.isArray(value["visit_history"]) ||
      !Array.isArray(value["actions"]) || !Array.isArray(value["updates"])) {
    throw new Error("O histórico da escola veio incompleto ou em formato inesperado.");
  }

  const visits = value["visits"] as unknown[];
  const history = value["visit_history"] as unknown[];
  const actions = value["actions"] as unknown[];
  const updates = value["updates"] as unknown[];
  // The SQL reader must refuse to truncate. Enforce the contract again at the UI boundary.
  if (visits.length + history.length > 1000 || actions.length > 2000 || updates.length > 5000)
    throw new Error("O histórico recebido ultrapassa o limite seguro de leitura.");

  const visitIds = new Set<string>();
  const currentLogicalIds = new Set<string>();
  const currentVisitDates = new Map<string, string>();
  for (const [index, item] of [...visits, ...history].entries()) {
    if (!isRow(item) || !hasText(item, "id") || !hasText(item, "logical_id") ||
        !Number.isInteger(item["version"]) || (item["version"] as number) < 1 ||
        item["school_id"] !== schoolId || !date(item["visit_date"]) ||
        !hasText(item, "diagnosis") || typeof item["strengths"] !== "string" ||
        typeof item["weaknesses"] !== "string" || !timestamp(item["created_at"]) ||
        !optionalText(item, "summary") || !optionalText(item, "correction_reason") ||
        !optionalText(item, "supersedes_id") || !optionalText(item, "participants_note") ||
        !optionalText(item, "purpose_note") || !optionalText(item, "author_name") ||
        (item["can_correct"] != null && typeof item["can_correct"] !== "boolean") ||
        visitIds.has(item["id"] as string) ||
        (index < visits.length && currentLogicalIds.has(item["logical_id"] as string))) {
      throw new Error("O histórico da unidade contém uma visita inválida ou fora do escopo.");
    }
    visitIds.add(item["id"] as string);
    if (index < visits.length) {
      currentLogicalIds.add(item["logical_id"] as string);
      currentVisitDates.set(item["logical_id"] as string, item["visit_date"] as string);
    }
  }

  const actionIds = new Set<string>();
  const actionOriginDates = new Map<string, string>();
  for (const item of actions) {
    if (!isRow(item) || !hasText(item, "id") || item["school_id"] !== schoolId ||
        !hasText(item, "visit_logical_id") || !currentVisitDates.has(item["visit_logical_id"] as string) ||
        !hasText(item, "description") || !timestamp(item["created_at"]) ||
        !optionalText(item, "responsible_label") ||
        !optionalText(item, "author_name") ||
        (item["due_on"] != null && (!date(item["due_on"]) ||
          (item["due_on"] as string) < currentVisitDates.get(item["visit_logical_id"] as string)!)) ||
        actionIds.has(item["id"] as string)) {
      throw new Error("O histórico da unidade contém uma medida inválida ou sem visita de origem.");
    }
    actionIds.add(item["id"] as string);
    actionOriginDates.set(item["id"] as string, currentVisitDates.get(item["visit_logical_id"] as string)!);
  }

  const updateIds = new Set<string>();
  const situations = new Set<string>(SITUATIONS.map((s) => s.value));
  for (const item of updates) {
    if (!isRow(item) || !hasText(item, "id") ||
        !hasText(item, "action_id") || !actionIds.has(item["action_id"] as string) ||
        (item["visit_logical_id"] != null &&
          (!hasText(item, "visit_logical_id") ||
            !currentVisitDates.has(item["visit_logical_id"] as string) ||
            currentVisitDates.get(item["visit_logical_id"] as string)! <
              actionOriginDates.get(item["action_id"] as string)!)) ||
        !date(item["occurred_on"]) ||
        (item["occurred_on"] as string) < actionOriginDates.get(item["action_id"] as string)! ||
        (item["visit_logical_id"] != null &&
          (item["occurred_on"] as string) < currentVisitDates.get(item["visit_logical_id"] as string)!) ||
        !situations.has(String(item["situation"])) ||
        !timestamp(item["created_at"]) || !optionalText(item, "done_text") ||
        !optionalText(item, "not_done_text") || !optionalText(item, "results") ||
        !optionalText(item, "referrals") || !optionalText(item, "author_name") ||
        updateIds.has(item["id"] as string)) {
      throw new Error("O histórico da unidade contém uma evolução inválida ou sem medida vinculada.");
    }
    updateIds.add(item["id"] as string);
  }

  return value as unknown as SchoolSnapshot;
}
