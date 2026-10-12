/**
 * Lote corretivo 21 — escolha por nome na central de Matrículas e retorno do writer na tela.
 * Busca lê só tabelas sob a RLS de quem consulta (nunca leitor privilegiado), exige termo mínimo para
 * não virar listagem nominal e nunca mostra CPF/contato. A gravação continua no writer do banco.
 */

export interface LookupSpec {
  table: string;
  /** Colunas mostradas para reconhecer o registro (nunca CPF, contato ou hash). */
  label: readonly string[];
  /** Colunas texto pesquisáveis; ausente = lista dos mais recentes visíveis. */
  search?: readonly string[];
  order: string;
}

export const LOOKUP_MIN_TERM = 3;
export const LOOKUP_LIMIT = 20;
const FORBIDDEN_LABEL = /cpf|hmac|phone|email|check_hash|object_path/;

const APP: LookupSpec = { table: "enr_applications", label: ["application_code", "student_name"], search: ["application_code", "student_name"], order: "submitted_at" };
const CAMPAIGN: LookupSpec = { table: "enr_campaigns", label: ["kind", "cycle_year", "cycle_term"], search: ["kind"], order: "created_at" };

/** Campo (argumento do writer) → busca por nome. */
export const ENROLLMENT_LOOKUPS: Readonly<Record<string, LookupSpec>> = {
  _app: APP,
  _application: APP,
  _c: CAMPAIGN,
  _campaign: CAMPAIGN,
  _w: { table: "enr_waitlists", label: ["cell_key", "created_at"], search: ["cell_key"], order: "created_at" },
  _pool: { table: "enr_seat_pools", label: ["cell_key", "created_at"], search: ["cell_key"], order: "created_at" },
  _doc: { table: "enr_application_documents", label: ["doc_type", "version", "created_at"], search: ["doc_type"], order: "created_at" },
  _criteria: { table: "enr_classification_criteria", label: ["version", "created_at"], order: "created_at" },
  _policy: { table: "enr_preference_policies", label: ["version", "created_at"], order: "created_at" },
  _proposal: { table: "enr_distribution_proposals", label: ["conflict_count", "created_at"], order: "created_at" },
  _run: { table: "enr_classification_runs", label: ["mode", "created_at"], order: "created_at" },
};

export function assertSafeLookups(map: Readonly<Record<string, LookupSpec>>): string[] {
  return Object.entries(map).flatMap(([k, s]) => s.label.filter((c) => FORBIDDEN_LABEL.test(c)).map((c) => `${k}:${c}`));
}

/** Filtro `or` do PostgREST com o termo escapado; null quando o termo é curto demais. */
export function lookupFilter(spec: LookupSpec, term: string): string | null {
  if (!spec.search) return "";
  const t = term.trim().replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < LOOKUP_MIN_TERM) return null;
  return spec.search.map((c) => `${c}.ilike.*${t}*`).join(",");
}

const RETURN_KEYS = ["protocol_number", "number", "receipt", "receipt_code", "application_code", "code", "status", "id"];

/** Resume o retorno do writer para a pessoa ver o que foi emitido (ex.: número de protocolo). */
export function summarizeReturn(data: unknown): string | null {
  if (data === null || data === undefined || data === "") return null;
  if (typeof data !== "object") return String(data);
  if (Array.isArray(data)) return data.length ? summarizeReturn(data[0]) : null;
  const o = data as Record<string, unknown>;
  const parts = RETURN_KEYS.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => `${k}: ${String(o[k])}`);
  return parts.length ? parts.join(" · ") : null;
}
