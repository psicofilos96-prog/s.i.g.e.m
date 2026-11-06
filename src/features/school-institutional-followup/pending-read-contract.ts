import { NO_UPDATE, SITUATIONS, type NetworkPendingAction } from "./model";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const optionalText = (value: unknown): value is string | null | undefined =>
  value == null || typeof value === "string";
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validTimestamp = (value: unknown): value is string =>
  typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && validDate(value.slice(0, 10))
  && Number.isFinite(Date.parse(value));

const allowed = new Set<string>([NO_UPDATE, ...SITUATIONS.map((s) => s.value)]);
allowed.delete("concluída");

/** Não aceita nem filtra silenciosamente fatos inválidos no quadro do Gabinete.
 * O escopo real continua sendo decidido exclusivamente pela RPC autorizada.
 */
export function parseNetworkPendingFollowup(value: unknown): NetworkPendingAction[] {
  if (!isRow(value) || !Array.isArray(value["pending"])) {
    throw new Error("A relação de providências retornou um formato inesperado.");
  }
  const rows: unknown[] = value["pending"];
  if (rows.length > 5000) throw new Error("O quadro excedeu o limite esperado.");
  const seen = new Set<string>();
  return rows.map((item) => {
    if (!isRow(item) ||
      !hasText(item["action_id"]) || !hasText(item["school_id"]) ||
      !hasText(item["school_name"]) || !hasText(item["description"]) ||
      !hasText(item["situation"]) || !allowed.has(item["situation"] as string) ||
      !optionalText(item["inep"]) || !optionalText(item["responsible_label"]) ||
      (item["due_on"] != null && !validDate(item["due_on"])) ||
      (item["last_update_on"] != null && !validDate(item["last_update_on"])) ||
      !validTimestamp(item["created_at"]) ||
      (item["situation"] === NO_UPDATE && item["last_update_on"] != null) ||
      (item["situation"] !== NO_UPDATE && item["last_update_on"] == null) ||
      seen.has(item["action_id"] as string)) {
      throw new Error("A relação de providências contém uma medida incompleta ou inválida.");
    }
    seen.add(item["action_id"] as string);
    return {
      action_id: item["action_id"] as string,
      school_id: item["school_id"] as string,
      school_name: item["school_name"] as string,
      description: item["description"] as string,
      inep: item["inep"] == null ? null : item["inep"] as string,
      responsible_label: item["responsible_label"] == null ? null : item["responsible_label"] as string,
      due_on: item["due_on"] == null ? null : item["due_on"] as string,
      situation: item["situation"] as string,
      last_update_on: item["last_update_on"] == null ? null : item["last_update_on"] as string,
      created_at: item["created_at"] as string,
    };
  });
}
