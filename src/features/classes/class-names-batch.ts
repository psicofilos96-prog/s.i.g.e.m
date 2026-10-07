/**
 * NDB.1.1 — nomes de turmas em lote pelo reader `classes_at_batch` (INVOKER sobre
 * `class_at`: mesma RLS, mesmo validOn/knownAt). Substitui N chamadas por uma.
 * Resultado por turma: 1 linha = nome; 0 = sem cadastro; >1 = inconsistente.
 * Falha do lote cai para a leitura individual, para que o erro de uma turma não
 * apague as demais (comportamento anterior preservado).
 */
import type { BitemporalContext } from "./class-offering-shift-projection";
import { readerArgs } from "./class-offering-shift-projection";

export type ClassNameOutcome =
  | { kind: "ok"; name: string }
  | { kind: "ausente" }
  | { kind: "inconsistente" }
  | { kind: "erro" };

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
type Db = { rpc: Rpc };

export function groupClassRows(ids: string[], rows: { class_id: string; name: string }[]): Map<string, ClassNameOutcome> {
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.class_id, [...(by.get(r.class_id) ?? []), r.name]);
  const out = new Map<string, ClassNameOutcome>();
  for (const id of ids) {
    const n = by.get(id) ?? [];
    out.set(id, n.length === 1 ? { kind: "ok", name: n[0]! } : n.length === 0 ? { kind: "ausente" } : { kind: "inconsistente" });
  }
  return out;
}

export async function classNamesAt(db: unknown, ids: string[], t: BitemporalContext): Promise<Map<string, ClassNameOutcome>> {
  const d = db as Db;
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const r = await d.rpc("classes_at_batch", { _class_ids: uniq, _valid_on: t.validOn, ...(t.knownAt ? { _known_at: t.knownAt } : {}) });
  if (!r.error) return groupClassRows(uniq, (r.data ?? []) as { class_id: string; name: string }[]);
  const out = new Map<string, ClassNameOutcome>();
  await Promise.all(uniq.map(async (id) => {
    const x = await d.rpc("class_at", readerArgs(id, t));
    if (x.error) { out.set(id, { kind: "erro" }); return; }
    const rows = (x.data ?? []) as { name: string }[];
    out.set(id, rows.length === 1 ? { kind: "ok", name: rows[0]!.name } : rows.length ? { kind: "inconsistente" } : { kind: "ausente" });
  }));
  return out;
}
