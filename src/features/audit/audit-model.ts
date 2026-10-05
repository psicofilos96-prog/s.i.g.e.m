/**
 * Central de auditoria (pura). Projeção transversal dos ledgers já existentes — nunca uma
 * segunda trilha gravada. Cada fonte tem adaptador com ALLOWLIST de campos: o que não está
 * listado não sai (minimização por construção). Texto livre passa por redaction.
 */

export type AuditKind = "seguranca" | "funcional";
export type AuditEvent = Readonly<{
  id: string; source: string; module: string; kind: AuditKind; action: string;
  entity: string | null; entityVersion: number | null;
  actorUserId: string | null; actorPersonId: string | null; engagementId: string | null;
  capability: string | null; schoolIds: readonly string[];
  at: string; effectiveOn: string | null; reason: string | null; origin: string | null;
  correlation: readonly string[]; // refs canônicas tocadas (operação ↔ efeitos)
}>;

const SECRET = /\b(senha|password|token|secret|bearer|apikey|api_key)\b\s*[:=]?\s*\S+/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
const KEY = /\bsb_(secret|publishable)_[\w-]+/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CLINICAL = /\b(cid[- ]?[a-z]?\d+|diagn[oó]stic\w*|laudo\w*|medica[cç][aã]o)\b/gi;
/** Redaction: segredo, identificadores pessoais e termos clínicos nunca chegam à tela/exportação. */
export function redact(t: string | null | undefined, max = 280): string | null {
  if (t == null) return null;
  const r = t.replace(JWT, "[token]").replace(KEY, "[chave]").replace(SECRET, "[segredo]")
    .replace(EMAIL, "[e-mail]").replace(CPF, "[documento]").replace(CLINICAL, "[conteúdo sensível]");
  return r.length > max ? `${r.slice(0, max)}…` : r;
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? null : String(v));
const n = (v: unknown) => (typeof v === "number" ? v : null);

export type SourceAdapter = Readonly<{ table: string; module: string; kind: AuditKind; select: string; atColumn: string; map: (r: Row) => AuditEvent }>;
const base = (table: string, module: string, kind: AuditKind, r: Row, at: string) => ({
  id: `${table}:${s(r["id"])}`, source: table, module, kind, at,
  entity: null, entityVersion: null, actorUserId: null, actorPersonId: null, engagementId: null,
  capability: null, schoolIds: [] as string[], effectiveOn: null, reason: null, origin: null, correlation: [] as string[],
});

/** Cada adaptador seleciona SÓ colunas seguras. Ex.: login de conta, payload do mapa e texto de movimento não são lidos. */
export const ADAPTERS: readonly SourceAdapter[] = [
  { table: "account_credential_events", module: "Contas", kind: "seguranca", atColumn: "created_at",
    select: "id,user_id,kind,recorded_by,created_at",
    map: (r) => ({ ...base("account_credential_events", "Contas", "seguranca", r, s(r["created_at"])!), action: `conta:${s(r["kind"])}`,
      entity: `conta:${s(r["user_id"])}`, actorUserId: s(r["recorded_by"]), correlation: [`conta:${s(r["user_id"])}`] }) },
  { table: "capability_policies", module: "Políticas de acesso", kind: "seguranca", atColumn: "created_at",
    select: "id,logical_policy_id,version,status,created_by,homologated_by,homologation_origin,created_at,homologated_at",
    map: (r) => ({ ...base("capability_policies", "Políticas de acesso", "seguranca", r, s(r["homologated_at"]) ?? s(r["created_at"])!),
      action: `politica:${s(r["status"])}`, entity: `politica:${s(r["logical_policy_id"])}`, entityVersion: n(r["version"]),
      actorUserId: s(r["homologated_by"]) ?? s(r["created_by"]), origin: s(r["homologation_origin"]),
      correlation: [`politica:${s(r["logical_policy_id"])}`] }) },
  { table: "inclusion_access_events", module: "Inclusão", kind: "seguranca", atColumn: "at",
    select: "id,attachment_id,user_id,engagement_id,granted,denial_code,at", // finalidade (texto) não é lida
    map: (r) => ({ ...base("inclusion_access_events", "Inclusão", "seguranca", r, s(r["at"])!),
      action: r["granted"] ? "anexo:acesso-concedido" : `anexo:acesso-negado:${s(r["denial_code"])}`,
      entity: `anexo:${s(r["attachment_id"])}`, actorUserId: s(r["user_id"]), engagementId: s(r["engagement_id"]),
      correlation: [`anexo:${s(r["attachment_id"])}`] }) },
  { table: "school_document_emission_events", module: "Documentos escolares", kind: "funcional", atColumn: "recorded_at",
    select: "id,emission_id,event_kind,replacement_emission_id,reason,recorded_by,recorded_by_engagement,recorded_at",
    map: (r) => ({ ...base("school_document_emission_events", "Documentos escolares", "funcional", r, s(r["recorded_at"])!),
      action: `documento:${s(r["event_kind"])}`, entity: `emissao:${s(r["emission_id"])}`, actorUserId: s(r["recorded_by"]),
      engagementId: s(r["recorded_by_engagement"]), reason: redact(s(r["reason"])),
      correlation: [`emissao:${s(r["emission_id"])}`, ...(r["replacement_emission_id"] ? [`emissao:${s(r["replacement_emission_id"])}`] : [])] }) },
  { table: "import_batch_events", module: "Importações", kind: "funcional", atColumn: "recorded_at",
    select: "id,batch_id,row_id,kind,canonical_ref,actor,actor_engagement,recorded_at", // detail não é lido
    map: (r) => ({ ...base("import_batch_events", "Importações", "funcional", r, s(r["recorded_at"])!),
      action: `importacao:${s(r["kind"])}`, entity: `lote:${s(r["batch_id"])}`, actorUserId: s(r["actor"]),
      engagementId: s(r["actor_engagement"]), origin: "importacao",
      correlation: [`lote:${s(r["batch_id"])}`, ...(r["canonical_ref"] ? [s(r["canonical_ref"])!] : [])] }) },
  { table: "student_movement_events", module: "Vida escolar", kind: "funcional", atColumn: "created_at",
    select: "id,logical_id,version,supersedes_id,movement_type_id,effective_on,correction_reason,recorded_by,school_scope_ids,created_at",
    map: (r) => ({ ...base("student_movement_events", "Vida escolar", "funcional", r, s(r["created_at"])!),
      action: r["supersedes_id"] ? "movimentacao:retificacao" : `movimentacao:${s(r["movement_type_id"])}`,
      entity: `movimentacao:${s(r["logical_id"])}`, entityVersion: n(r["version"]), actorUserId: s(r["recorded_by"]),
      schoolIds: Array.isArray(r["school_scope_ids"]) ? (r["school_scope_ids"] as string[]) : [],
      effectiveOn: s(r["effective_on"]), reason: redact(s(r["correction_reason"])),
      correlation: [`movimentacao:${s(r["logical_id"])}`] }) },
];

export type AuditFilter = Readonly<{ from?: string | null; to?: string | null; module?: string | null; schoolId?: string | null; actor?: string | null; kind?: AuditKind | null; knownAt?: string | null; entity?: string | null }>;

export function filterEvents(evs: readonly AuditEvent[], f: AuditFilter): AuditEvent[] {
  return evs.filter((e) =>
    (!f.from || e.at.slice(0, 10) >= f.from) && (!f.to || e.at.slice(0, 10) <= f.to) &&
    (!f.module || e.module === f.module) && (!f.kind || e.kind === f.kind) &&
    (!f.schoolId || e.schoolIds.includes(f.schoolId)) &&
    (!f.actor || e.actorUserId === f.actor || e.actorPersonId === f.actor) &&
    (!f.knownAt || e.at <= f.knownAt) && (!f.entity || e.entity === f.entity))
    .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? 1 : -1));
}

/** Paginação por cursor estável (at,id). */
export function page(evs: readonly AuditEvent[], size: number, cursor?: string | null) {
  const start = cursor ? evs.findIndex((e) => `${e.at}|${e.id}` === cursor) + 1 : 0;
  const items = evs.slice(Math.max(0, start), Math.max(0, start) + size);
  const last = items[items.length - 1];
  return { items, next: last && start + size < evs.length ? `${last.at}|${last.id}` : null };
}

/** Correlação: eventos que compartilham ref canônica com o evento escolhido. */
export function correlated(evs: readonly AuditEvent[], ev: AuditEvent): AuditEvent[] {
  const refs = new Set(ev.correlation);
  return evs.filter((e) => e.id !== ev.id && e.correlation.some((r) => refs.has(r)));
}

/** Alteração retroativa: fato com data de efeito anterior ao dia em que foi conhecido. */
export const isRetroactive = (e: AuditEvent) => !!e.effectiveOn && e.effectiveOn < e.at.slice(0, 10);

// ---------- Integridade ----------
export type Finding = Readonly<{ code: "versao-orfa" | "lacuna-de-versao" | "sem-proveniencia" | "dml-direto"; ref: string; detail: string }>;

export function versionFindings(rows: readonly { id: string; logical: string; version: number; supersedes: string | null }[], table: string): Finding[] {
  const out: Finding[] = []; const ids = new Set(rows.map((r) => r.id));
  const by = new Map<string, number[]>();
  for (const r of rows) {
    by.set(r.logical, [...(by.get(r.logical) ?? []), r.version]);
    if (r.version > 1 && (!r.supersedes || !ids.has(r.supersedes))) out.push({ code: "versao-orfa", ref: `${table}:${r.id}`, detail: `versão ${r.version} sem predecessora visível` });
  }
  for (const [l, vs] of by) { const sorted = [...vs].sort((a, b) => a - b);
    sorted.forEach((v, i) => { if (v !== i + 1) out.push({ code: "lacuna-de-versao", ref: `${table}:${l}`, detail: `sequência ${sorted.join(",")}` }); }); }
  return [...new Map(out.map((f) => [`${f.code}${f.ref}`, f])).values()];
}

export const provenanceFindings = (evs: readonly AuditEvent[]): Finding[] =>
  evs.filter((e) => !e.actorUserId && !e.actorPersonId && !e.origin).map((e) => ({ code: "sem-proveniencia", ref: e.id, detail: "evento sem ator nem origem declarada" }));

/** Writers × DML direto: GRANT de escrita a anon/authenticated nas migrations (última concessão vence). */
export function directDmlGrants(sqlFiles: readonly string[]): string[] {
  const state = new Map<string, boolean>();
  const re = /\b(GRANT|REVOKE)\s+([A-Z ,]+?)\s+ON\s+(?:TABLE\s+)?(public\.[\w]+)\s+(TO|FROM)\s+([\w ,]+)/gi;
  for (const sql of sqlFiles) for (const m of sql.matchAll(re)) {
    const privs = m[2]!.toUpperCase(); const roles = m[5]!.toLowerCase();
    if (!/INSERT|UPDATE|DELETE|ALL/.test(privs) || !/\b(anon|authenticated)\b/.test(roles)) continue;
    state.set(m[3]!.toLowerCase(), m[1]!.toUpperCase() === "GRANT");
  }
  return [...state].filter(([, g]) => g).map(([t]) => t).sort();
}

// ---------- Retenção e exportação ----------
/** Retenção é configuração: null = não decidida (nada é apagado automaticamente). */
export type RetentionConfig = Readonly<Record<AuditKind, { days: number | null; decidedBy: string | null }>>;
export const RETENTION_UNDECIDED: RetentionConfig = { seguranca: { days: null, decidedBy: null }, funcional: { days: null, decidedBy: null } };
export const retentionLabel = (c: RetentionConfig, k: AuditKind) => (c[k].days == null ? "não decidida — nada é descartado" : `${c[k].days} dias`);

export const EXPORT_CAPABILITY = "exportar-auditoria";
export const canExport = (caps: readonly string[]) => caps.includes(EXPORT_CAPABILITY);
export const AUDIT_COLUMNS = ["at", "kind", "module", "action", "entity", "entityVersion", "actorUserId", "engagementId", "effectiveOn", "reason", "origin"] as const;
export const auditRows = (evs: readonly AuditEvent[]) => evs.map((e) => Object.fromEntries(AUDIT_COLUMNS.map((c) => [c, (e[c] ?? null) as string | number | null])));
