import { supabase } from "@/integrations/supabase/client";
import type { CanonicalRecord, EventView, Rpc, StagedRow } from "./import-engine";

const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
export const importRpc = rpc;

export type BatchView = Readonly<{ id: string; adapter_id: string; adapter_version: number; source_name: string; source_sha256: string; staged_sha256: string; row_count: number; reprocesses_id: string | null; source_ref: string | null; operator_person: string | null; received_at: string }>;
export type StoredRow = StagedRow & { id: string };

export async function stageBatch(a: { adapterId: string; adapterVersion: number; sourceName: string; sourceSha256: string; rows: readonly StagedRow[]; reprocessesId: string | null; sourceRef: string | null }) {
  const { data, error } = await rpc("stage_import_batch", {
    _adapter_id: a.adapterId, _adapter_version: a.adapterVersion, _source_name: a.sourceName, _source_sha256: a.sourceSha256,
    _rows: a.rows, _reprocesses_id: a.reprocessesId, _source_ref: a.sourceRef,
  });
  if (error) throw new Error(error.message);
  return data as { id: string | null; already_staged: boolean; adopted_technical_import?: boolean };
}

export async function listBatches(): Promise<BatchView[]> {
  const { data, error } = await rpc("import_batches_list", {});
  if (error) throw new Error(error.message);
  return (data as BatchView[]) ?? [];
}

export async function batchDetail(id: string): Promise<{ rows: StoredRow[]; events: EventView[] }> {
  const { data, error } = await rpc("import_batch_detail", { _batch_id: id });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as { rows?: StoredRow[]; events?: EventView[] };
  return { rows: d.rows ?? [], events: d.events ?? [] };
}

export async function recordEvent(batchId: string, rowId: string | null, kind: "compensacao" | "descartado", detail: string) {
  const { error } = await rpc("record_import_event", { _batch_id: batchId, _row_id: rowId, _kind: kind, _canonical_ref: null, _detail: detail });
  if (error) throw new Error(error.message);
}

/** Registros canônicos para matching, lidos com a sessão (RLS aplica). Falha de leitura ⇒ erro, nunca "lista vazia". */
export async function canonicalRecordsFor(adapterId: string): Promise<CanonicalRecord[]> {
  if (adapterId !== "censo-matriz-escolas") return [];
  const [ids, vers] = await Promise.all([
    supabase.from("institutional_school_identifiers").select("school_id, identifier_kind, value").eq("identifier_kind", "inep"),
    supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number"),
  ]);
  if (ids.error) throw new Error(ids.error.message);
  if (vers.error) throw new Error(vers.error.message);
  const latest = new Map<string, { official_name: string | null; version: number }>();
  for (const v of ((vers.data ?? []) as { school_id: string; official_name: string | null; version_number: number }[]).map((x) => ({ ...x, version: x.version_number }))) {
    const cur = latest.get(v.school_id);
    if (!cur || v.version > cur.version) latest.set(v.school_id, v);
  }
  return ((ids.data ?? []) as { school_id: string; value: string }[]).map((i) => ({
    identityKey: `inep:${i.value.replace(/\D/g, "")}`,
    canonicalRef: `escola ${i.school_id}`,
    values: { nome: latest.get(i.school_id)?.official_name?.normalize("NFC").replace(/\s+/g, " ").trim() ?? null },
  }));
}
