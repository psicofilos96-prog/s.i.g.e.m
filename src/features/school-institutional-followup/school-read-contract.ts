import type { SchoolSnapshot } from "./model";
import { SITUATIONS } from "./model";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasText = (row: Row, field: string): boolean =>
  typeof row[field] === "string" && (row[field] as string).length > 0;
const optionalText = (row: Row, field: string): boolean =>
  row[field] == null || typeof row[field] === "string";
const date = (value: unknown): boolean =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

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
  const allLogicalIds = new Set<string>();
  for (const [index, item] of [...visits, ...history].entries()) {
    if (!isRow(item) || !hasText(item, "id") || !hasText(item, "logical_id") ||
        !Number.isInteger(item["version"]) || (item["version"] as number) < 1 ||
        item["school_id"] !== schoolId || !date(item["visit_date"]) ||
        !hasText(item, "diagnosis") || typeof item["strengths"] !== "string" ||
        typeof item["weaknesses"] !== "string" || !hasText(item, "created_at") ||
        !optionalText(item, "summary") || !optionalText(item, "correction_reason") ||
        !optionalText(item, "supersedes_id") || !optionalText(item, "participants_note") ||
        !optionalText(item, "purpose_note") || !optionalText(item, "author_name") ||
        (item["can_correct"] != null && typeof item["can_correct"] !== "boolean") ||
        visitIds.has(item["id"] as string) ||
        (index < visits.length && currentLogicalIds.has(item["logical_id"] as string))) {
      throw new Error("O histórico da unidade contém uma visita inválida ou fora do escopo.");
    }
    visitIds.add(item["id"] as string);
    allLogicalIds.add(item["logical_id"] as string);
    if (index < visits.length) currentLogicalIds.add(item["logical_id"] as string);
  }

  const actionIds = new Set<string>();
  for (const item of actions) {
    if (!isRow(item) || !hasText(item, "id") || item["school_id"] !== schoolId ||
        !hasText(item, "visit_logical_id") || !allLogicalIds.has(item["visit_logical_id"] as string) ||
        !hasText(item, "description") || !hasText(item, "created_at") ||
        !optionalText(item, "responsible_label") ||
        !optionalText(item, "author_name") ||
        (item["due_on"] != null && !date(item["due_on"])) ||
        actionIds.has(item["id"] as string)) {
      throw new Error("O histórico da unidade contém uma medida inválida ou sem visita de origem.");
    }
    actionIds.add(item["id"] as string);
  }

  const updateIds = new Set<string>();
  const situations = new Set<string>(SITUATIONS.map((s) => s.value));
  for (const item of updates) {
    if (!isRow(item) || !hasText(item, "id") ||
        !hasText(item, "action_id") || !actionIds.has(item["action_id"] as string) ||
        (item["visit_logical_id"] != null &&
          (!hasText(item, "visit_logical_id") || !allLogicalIds.has(item["visit_logical_id"] as string))) ||
        !date(item["occurred_on"]) || !situations.has(String(item["situation"])) ||
        !hasText(item, "created_at") || !optionalText(item, "done_text") ||
        !optionalText(item, "not_done_text") || !optionalText(item, "results") ||
        !optionalText(item, "referrals") || !optionalText(item, "author_name") ||
        updateIds.has(item["id"] as string)) {
      throw new Error("O histórico da unidade contém uma evolução inválida ou sem medida vinculada.");
    }
    updateIds.add(item["id"] as string);
  }

  return value as unknown as SchoolSnapshot;
}
