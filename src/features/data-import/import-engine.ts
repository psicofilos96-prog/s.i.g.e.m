/**
 * Camada de interoperabilidade (puro, sem rede).
 * arquivo → parsing → normalização → validação → matching → divergências → staging → confirmação → writers canônicos.
 *
 * Três estados distintos, nunca confundidos:
 * - RECEBIDO: o que veio no arquivo (raw), guardado literalmente no staging.
 * - RECONCILIADO: linha normalizada e classificada contra o SIGEM (válida, rejeitada, duplicada, conflito, já reconciliada).
 * - FATO CANÔNICO: só existe depois que um writer canônico do domínio aceitou a linha, com sua própria capability.
 *
 * Matching nunca usa só nome: identidade vem de chave declarada pelo adaptador (ex.: INEP).
 * Conflito nunca é resolvido aqui: vira linha "conflito" com motivo por extenso.
 */

export type RowOutcome = "valida" | "rejeitada" | "duplicada-na-fonte" | "conflito" | "ja-reconciliada";

export type ParsedRow = Readonly<{ lineRef: string; raw: Readonly<Record<string, unknown>> }>;

export type Normalized = Readonly<{ identityKey: string | null; values: Readonly<Record<string, string | number | boolean | null>>; problems: readonly string[] }>;

/** Registro canônico já existente, como o adaptador o enxerga para matching. */
export type CanonicalRecord = Readonly<{ identityKey: string; canonicalRef: string; values: Readonly<Record<string, string | number | boolean | null>> }>;

export type StagedRow = Readonly<{
  line_ref: string;
  raw: Readonly<Record<string, unknown>>;
  normalized: Normalized["values"] | null;
  identity_key: string | null;
  outcome: RowOutcome;
  reasons: readonly string[];
}>;

export type ApplyResult = Readonly<{ ok: true; canonicalRef: string } | { ok: false; message: string }>;
export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type ImportAdapter = Readonly<{
  id: string;
  version: number;
  label: string;
  /** "disponivel": há leiaute real no repositório. "leiaute-ausente": interface pronta, sem colunas inventadas. */
  layoutStatus: "disponivel" | "leiaute-ausente";
  layoutSource: string | null;
  accepts: string;
  /** Campos comparados no matching; divergência em qualquer um ⇒ conflito. */
  comparedFields: readonly string[];
  parse(text: string): ParsedRow[];
  normalize(row: ParsedRow): Normalized;
  /** Writer canônico do domínio; recebe só linha válida e confirmada. */
  apply?: (row: StagedRow, ctx: ApplyContext, rpc: Rpc) => Promise<ApplyResult>;
  /** Campos exigidos do operador na confirmação (ex.: data de início da vigência). */
  confirmFields?: readonly Readonly<{ key: string; label: string; kind: "date" | "text"; required: boolean }>[];
}>;

export type ApplyContext = Readonly<{ batchId: string; sourceName: string; sourceSha256: string; sourceRef: string | null; fields: Readonly<Record<string, string>> }>;

/** Normalização textual neutra: só espaços e forma Unicode. Nunca altera semântica. */
export const normText = (s: unknown): string | null => {
  if (s === null || s === undefined) return null;
  const t = String(s).normalize("NFC").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
};

/** Classificação: validação + duplicidade na fonte + matching por identidade declarada. */
export function classifyRows(adapter: ImportAdapter, rows: readonly ParsedRow[], existing: readonly CanonicalRecord[]): StagedRow[] {
  const byKey = new Map<string, CanonicalRecord[]>();
  for (const e of existing) byKey.set(e.identityKey, [...(byKey.get(e.identityKey) ?? []), e]);
  const seen = new Map<string, string>();
  const refs = new Set<string>();
  return rows.map((row) => {
    const n = adapter.normalize(row);
    const base = { line_ref: row.lineRef, raw: row.raw, normalized: n.values, identity_key: n.identityKey };
    if (refs.has(row.lineRef)) return { ...base, outcome: "rejeitada" as const, reasons: [`Referência de linha repetida: ${row.lineRef}.`] };
    refs.add(row.lineRef);
    if (n.problems.length) return { ...base, outcome: "rejeitada" as const, reasons: n.problems };
    if (!n.identityKey) return { ...base, outcome: "rejeitada" as const, reasons: ["Linha sem identidade reconhecível; não se identifica registro só por nome."] };
    const first = seen.get(n.identityKey);
    if (first) return { ...base, outcome: "duplicada-na-fonte" as const, reasons: [`Mesma identidade da linha ${first}.`] };
    seen.set(n.identityKey, row.lineRef);
    const matches = byKey.get(n.identityKey) ?? [];
    if (matches.length > 1) return { ...base, outcome: "conflito" as const, reasons: [`Identidade corresponde a ${matches.length} registros no SIGEM; nenhum é escolhido automaticamente.`] };
    const m = matches[0];
    if (!m) return { ...base, outcome: "valida" as const, reasons: [] };
    const diffs = adapter.comparedFields.filter((f) => (n.values[f] ?? null) !== (m.values[f] ?? null))
      .map((f) => `${f}: SIGEM "${m.values[f] ?? "sem registro"}" × arquivo "${n.values[f] ?? "sem valor"}"`);
    return diffs.length
      ? { ...base, outcome: "conflito" as const, reasons: [`Já existe no SIGEM (${m.canonicalRef}) com divergência; correção é feita no cadastro, não pela importação.`, ...diffs] }
      : { ...base, outcome: "ja-reconciliada" as const, reasons: [] };
  });
}

export type Counts = Readonly<Record<RowOutcome | "total", number>>;
export function countRows(rows: readonly Pick<StagedRow, "outcome">[]): Counts {
  const c = { total: rows.length, valida: 0, rejeitada: 0, "duplicada-na-fonte": 0, conflito: 0, "ja-reconciliada": 0 };
  for (const r of rows) c[r.outcome]++;
  return c;
}

export { sha256Hex } from "./import-kernel";

export type EventView = Readonly<{ row_id: string | null; kind: "confirmacao" | "aplicada" | "falhou" | "compensacao" | "descartado"; canonical_ref: string | null; detail: string | null; recorded_at: string }>;

/** Estado derivado por linha a partir dos eventos (nunca persistido). */
export type RowState = "pendente" | "aplicada" | "falhou" | "compensada" | "nao-aplicavel";
export function rowStates(rows: readonly (StagedRow & { id: string })[], events: readonly EventView[]): Map<string, RowState> {
  const out = new Map<string, RowState>();
  for (const r of rows) {
    if (r.outcome !== "valida") { out.set(r.id, "nao-aplicavel"); continue; }
    const ev = events.filter((e) => e.row_id === r.id);
    if (ev.some((e) => e.kind === "compensacao")) out.set(r.id, "compensada");
    else if (ev.some((e) => e.kind === "aplicada")) out.set(r.id, "aplicada");
    else if (ev.some((e) => e.kind === "falhou")) out.set(r.id, "falhou");
    else out.set(r.id, "pendente");
  }
  return out;
}

/**
 * Aplicação confirmada: cada linha válida e ainda não aplicada passa pelo writer canônico (atômico por linha).
 * Falha numa linha não desfaz as anteriores (cada uma já é fato) e fica registrada; reexecutar retoma só pendentes/falhas.
 */
export async function applyConfirmed(
  adapter: ImportAdapter, rows: readonly (StagedRow & { id: string })[], events: readonly EventView[], ctx: ApplyContext, rpc: Rpc,
): Promise<{ applied: number; failed: number; skipped: number }> {
  if (!adapter.apply) throw new Error("import:adapter-without-writer");
  for (const f of adapter.confirmFields ?? []) if (f.required && !ctx.fields[f.key]?.trim()) throw new Error(`import:field-required:${f.key}`);
  if (!events.some((e) => e.kind === "confirmacao")) {
    const { error } = await rpc("record_import_event", { _batch_id: ctx.batchId, _row_id: null, _kind: "confirmacao", _canonical_ref: null, _detail: null });
    if (error) throw new Error(error.message);
  }
  const states = rowStates(rows, events);
  let applied = 0, failed = 0, skipped = 0;
  for (const r of rows) {
    const s = states.get(r.id);
    if (s !== "pendente" && s !== "falhou") { skipped++; continue; }
    const res = await adapter.apply(r, ctx, rpc);
    const ev = res.ok
      ? { _kind: "aplicada", _canonical_ref: res.canonicalRef, _detail: null }
      : { _kind: "falhou", _canonical_ref: null, _detail: res.message };
    const { error } = await rpc("record_import_event", { _batch_id: ctx.batchId, _row_id: r.id, ...ev });
    if (error) throw new Error(error.message);
    if (res.ok) applied++; else failed++;
  }
  return { applied, failed, skipped };
}

export function importMessage(raw: string): string {
  const m = raw ?? "";
  if (m.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (m.includes("capability:gerir-importacao-de-dados")) return "Sua conta não tem a permissão de gerir importações. Ela ainda não foi atribuída a nenhuma atuação.";
  if (m.includes("capability:")) return `O cadastro de destino recusou: falta a permissão "${m.split("capability:")[1]?.split(/\s/)[0]}".`;
  if (m.includes("import:confirmation-required")) return "Confirme o lote antes de aplicar.";
  if (m.includes("import:row-already-applied")) return "Esta linha já foi aplicada; nada foi repetido.";
  if (m.includes("import:row-not-applicable")) return "Só linhas válidas podem ser aplicadas.";
  if (m.includes("import:nothing-to-compensate")) return "Não há aplicação para compensar nesta linha.";
  if (m.includes("import:field-required:")) return "Preencha os campos obrigatórios da confirmação.";
  if (m.includes("import:adapter-without-writer")) return "Este formato ainda não tem destino oficial: o lote pode ser conferido, não aplicado.";
  if (m.includes("import:append-only")) return "Registros de importação não podem ser alterados nem apagados.";
  return m;
}

export const OUTCOME_LABEL: Record<RowOutcome, string> = {
  valida: "Válida (nova)", rejeitada: "Rejeitada", "duplicada-na-fonte": "Duplicada no arquivo",
  conflito: "Conflito", "ja-reconciliada": "Já existe igual no SIGEM",
};
export const STATE_LABEL: Record<RowState, string> = {
  pendente: "Aguardando aplicação", aplicada: "Aplicada", falhou: "Falhou", compensada: "Compensada", "nao-aplicavel": "—",
};
