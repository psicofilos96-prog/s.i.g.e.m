/**
 * Operações em lote seguras: seleção → preview → validação item a item → resumo →
 * confirmação → execução → resultado por item → relatório.
 * O motor não grava nada: cada item passa pelo writer canônico declarado na operação,
 * que revalida capability, escopo e base esperada no banco. Não existe UPDATE em massa.
 */
import { neutralize, type ColumnDef, type ReportResult } from "@/features/reports/report-engine";

export type BulkMode = "parcial" | "tudo-ou-nada";
export type ItemOutcome = "pronto" | "recusado" | "executado" | "falhou" | "ja-executado" | "nao-executado";

export type BulkItem<P> = Readonly<{
  key: string;            // identidade estável do item (nunca rótulo)
  scope: string | null;   // escola/escopo do item; null = rede
  expectedBase: string | null; // base esperada para concorrência otimista
  payload: P;
}>;

export type BulkOperation<P> = Readonly<{
  id: string; version: number; label: string;
  mode: BulkMode;
  /** Limite por lote (síncrono). Acima disso, só por job. */
  maxItems: number;
  /** Validação local do item; mensagem = motivo da recusa. O banco revalida. */
  validate: (item: BulkItem<P>) => string | null;
  /** Base atual do item lida da fonte canônica no momento da execução (seleção stale). */
  currentBase?: (item: BulkItem<P>) => Promise<string | null>;
  /** Grava UM item pelo writer canônico. Para tudo-ou-nada use executeAll. */
  executeOne?: (item: BulkItem<P>, idempotencyKey: string) => Promise<void>;
  /** Writer canônico em lote atômico, quando o contrato existir. */
  executeAll?: (items: readonly BulkItem<P>[], keys: readonly string[]) => Promise<void>;
}>;

export class BulkError extends Error { constructor(public code: string, message: string) { super(message); } }

export type PreviewRow = Readonly<{ key: string; scope: string | null; outcome: "pronto" | "recusado"; reason: string | null }>;
export type BulkPreview = Readonly<{ operationId: string; operationVersion: number; batchId: string; fingerprint: string;
  rows: readonly PreviewRow[]; ready: number; refused: number; scopes: readonly (string | null)[] }>;
export type ResultRow = Readonly<{ key: string; scope: string | null; outcome: ItemOutcome; reason: string | null; idempotencyKey: string }>;
export type BulkResult = Readonly<{ operationId: string; batchId: string; mode: BulkMode; rows: readonly ResultRow[];
  counts: Readonly<Record<ItemOutcome, number>>; startedAt: string; finishedAt: string }>;

/** Chave determinística: o mesmo item no mesmo lote nunca grava duas vezes. */
export const idempotencyKeyOf = (op: { id: string; version: number }, batchId: string, itemKey: string) => `${op.id}@${op.version}:${batchId}:${itemKey}`;

const fp = (items: readonly BulkItem<unknown>[]) => items.map((i) => `${i.key}|${i.scope ?? ""}|${i.expectedBase ?? ""}`).sort().join("\n");

/**
 * Preview: recusa por item (fora do escopo autorizado, duplicado, inválido, limite).
 * `authorizedScopes` vem da autoridade da sessão; ausente ⇒ nenhum escopo (falha fechada).
 * Nenhum item recusado some: todos aparecem com motivo.
 */
export function previewBulk<P>(op: BulkOperation<P>, items: readonly BulkItem<P>[], authorizedScopes: ReadonlySet<string | null> | null, batchId: string): BulkPreview {
  if (items.length > op.maxItems) throw new BulkError("bulk:limit", `Lote acima do limite de ${op.maxItems} itens; divida em páginas ou use job.`);
  const seen = new Set<string>();
  const rows: PreviewRow[] = items.map((i) => {
    const reason = seen.has(i.key) ? "Item duplicado na seleção."
      : !authorizedScopes || !authorizedScopes.has(i.scope) ? "Fora do escopo autorizado para sua conta."
      : op.validate(i);
    seen.add(i.key);
    return { key: i.key, scope: i.scope, outcome: reason ? "recusado" : "pronto", reason };
  });
  const ready = rows.filter((r) => r.outcome === "pronto").length;
  return { operationId: op.id, operationVersion: op.version, batchId, fingerprint: fp(items), rows, ready, refused: rows.length - ready,
    scopes: [...new Set(items.map((i) => i.scope))] };
}

const zero = (): Record<ItemOutcome, number> => ({ pronto: 0, recusado: 0, executado: 0, falhou: 0, "ja-executado": 0, "nao-executado": 0 });

/** Ledger de chaves concluídas (retry não regrava). Persistência remota pode substituir. */
export interface CompletedKeys { has(k: string): boolean; add(k: string): void }

/**
 * Executa somente o preview confirmado: se a seleção mudou, recusa (preview stale).
 * Itens recusados no preview permanecem no resultado como recusados.
 */
export async function executeBulk<P>(op: BulkOperation<P>, items: readonly BulkItem<P>[], preview: BulkPreview, opts: {
  confirmed: boolean; completed: CompletedKeys; concurrency?: number; now?: () => Date;
}): Promise<BulkResult> {
  const now = opts.now ?? (() => new Date());
  if (!opts.confirmed) throw new BulkError("bulk:unconfirmed", "Confirme o resumo antes de executar.");
  if (preview.operationId !== op.id || preview.operationVersion !== op.version || preview.fingerprint !== fp(items))
    throw new BulkError("bulk:stale-preview", "A seleção mudou desde a prévia. Gere uma nova prévia.");
  const startedAt = now().toISOString();
  const byKey = new Map<string, PreviewRow>(); preview.rows.forEach((r) => { if (!byKey.has(r.key)) byKey.set(r.key, r); });
  const firstIdx = new Map<string, number>(); items.forEach((it, i) => { if (!firstIdx.has(it.key)) firstIdx.set(it.key, i); });
  const out: ResultRow[] = new Array(items.length);
  const ready: number[] = [];
  items.forEach((it, i) => {
    const pr = byKey.get(it.key)!; const k = idempotencyKeyOf(op, preview.batchId, it.key);
    const dup = firstIdx.get(it.key) !== i;
    if (dup || pr.outcome === "recusado") out[i] = { key: it.key, scope: it.scope, outcome: "recusado", reason: dup ? "Item duplicado na seleção." : pr.reason, idempotencyKey: k };
    else if (opts.completed.has(k)) out[i] = { key: it.key, scope: it.scope, outcome: "ja-executado", reason: null, idempotencyKey: k };
    else ready.push(i);
  });

  const staleReason = async (it: BulkItem<P>) => op.currentBase && (await op.currentBase(it)) !== it.expectedBase ? "Item alterado por outra pessoa desde a seleção." : null;

  if (op.mode === "tudo-ou-nada") {
    if (!op.executeAll) throw new BulkError("bulk:contract", "Operação tudo-ou-nada exige writer de lote atômico.");
    const refusedAny = preview.refused > 0;
    const stale = refusedAny ? [] : await Promise.all(ready.map((i) => staleReason(items[i]!)));
    const blocker = refusedAny ? "Lote tudo-ou-nada com item recusado: nada foi executado." : stale.some(Boolean) ? "Lote tudo-ou-nada com item alterado: nada foi executado." : null;
    let err: string | null = blocker;
    if (!blocker && ready.length) {
      try { await op.executeAll(ready.map((i) => items[i]!), ready.map((i) => idempotencyKeyOf(op, preview.batchId, items[i]!.key))); }
      catch (e) { err = e instanceof Error ? e.message : "Falha no writer."; }
    }
    ready.forEach((i, n) => { const it = items[i]!; const k = idempotencyKeyOf(op, preview.batchId, it.key);
      if (!err) opts.completed.add(k);
      out[i] = { key: it.key, scope: it.scope, outcome: err ? (stale[n] ? "recusado" : "nao-executado") : "executado", reason: stale[n] ?? err, idempotencyKey: k }; });
  } else {
    if (!op.executeOne) throw new BulkError("bulk:contract", "Operação parcial exige writer por item.");
    const limit = Math.max(1, Math.min(opts.concurrency ?? 4, 6));
    let cursor = 0;
    const worker = async () => { while (cursor < ready.length) { const i = ready[cursor++]!; const it = items[i]!;
      const k = idempotencyKeyOf(op, preview.batchId, it.key);
      try {
        const s = await staleReason(it);
        if (s) { out[i] = { key: it.key, scope: it.scope, outcome: "recusado", reason: s, idempotencyKey: k }; continue; }
        await op.executeOne!(it, k); opts.completed.add(k);
        out[i] = { key: it.key, scope: it.scope, outcome: "executado", reason: null, idempotencyKey: k };
      } catch (e) { out[i] = { key: it.key, scope: it.scope, outcome: "falhou", reason: e instanceof Error ? e.message : "Falha no writer.", idempotencyKey: k }; }
    } };
    await Promise.all(Array.from({ length: limit }, worker));
  }
  const counts = zero(); out.forEach((r) => counts[r.outcome]++);
  return { operationId: op.id, batchId: preview.batchId, mode: op.mode, rows: out, counts, startedAt, finishedAt: now().toISOString() };
}

/** Paginação estável por chave: páginas nunca se sobrepõem nem pulam itens. */
export function paginate<T extends { key: string }>(items: readonly T[], pageSize: number): T[][] {
  const sorted = [...items].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const pages: T[][] = []; for (let i = 0; i < sorted.length; i += pageSize) pages.push(sorted.slice(i, i + pageSize)); return pages;
}

/** Execução grande: páginas sequenciais por um JobRunner substituível (hoje local). */
export type BulkJobRunner = (run: () => Promise<BulkResult[]>) => Promise<BulkResult[]>;
export const localJobRunner: BulkJobRunner = (run) => run();

const OUTCOME_LABEL: Record<ItemOutcome, string> = { pronto: "Pronto", recusado: "Recusado", executado: "Executado", falhou: "Falhou", "ja-executado": "Já executado", "nao-executado": "Não executado" };
const COLUMNS: ColumnDef[] = [
  { id: "key", label: "Item", kind: "text" }, { id: "scope", label: "Escopo", kind: "text" },
  { id: "outcome", label: "Resultado", kind: "text" }, { id: "reason", label: "Motivo", kind: "text" }, { id: "idem", label: "Chave de idempotência", kind: "text" },
];

/** Relatório do lote no formato do motor de relatórios (CSV/XLSX/PDF saem de lá). */
export function bulkReport(r: BulkResult): ReportResult {
  return { definitionId: `lote:${r.operationId}`, definitionVersion: 1, params: { lote: r.batchId, modo: r.mode },
    columns: COLUMNS, rows: r.rows.map((x) => [x.key, x.scope, OUTCOME_LABEL[x.outcome], x.reason, x.idempotencyKey]),
    groups: (Object.keys(r.counts) as ItemOutcome[]).filter((k) => r.counts[k] > 0).map((k) => ({ key: OUTCOME_LABEL[k], count: r.counts[k] })),
    generatedAt: r.finishedAt, mode: "sync" };
}
export { OUTCOME_LABEL, neutralize };
