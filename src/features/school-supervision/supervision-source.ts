import { supabase } from "@/integrations/supabase/client";
import type { SupervisionRecord } from "./supervision-model";

// Única porta TS: lê só pelo reader e grava só pelo writer da Supervisão. A tela nunca é garantia.
type Res = { data: unknown; error: { message: string } | null };
type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<Res>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const db = supabase as unknown as { from: (t: string) => any };

export async function readSupervisionRecords(school: string, knownAt: string | null, logicalId: string | null = null): Promise<SupervisionRecord[]> {
  const r = await rpc("school_supervision_records_at", { _school: school, _known_at: knownAt, _logical_id: logicalId });
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as SupervisionRecord[];
}

export type CatalogOption = { value_id: string; label: string };
export async function readCatalog(scheme: "modalidade-de-acompanhamento-da-supervisao" | "situacao-de-acompanhamento-da-supervisao"): Promise<CatalogOption[]> {
  const { data, error } = await db.from("attribute_value_definitions").select("value_id, label, version").eq("scheme_id", scheme).eq("status", "homologada").order("version", { ascending: false });
  if (error) return [];
  const m = new Map<string, string>();
  for (const d of (data ?? []) as { value_id: string; label: string }[]) if (!m.has(d.value_id)) m.set(d.value_id, d.label);
  return [...m].map(([value_id, label]) => ({ value_id, label }));
}

export type RecordInput = {
  baseId: string | null; kind: "registro" | "retificacao" | "anulacao"; school: string; modality: string | null; subject: string | null;
  occurredOn: string | null; referral: string | null; responsible: string | null; returnOn: string | null; status: string | null; schoolVisible: boolean | null; reason: string | null;
};
export async function recordSupervision(i: RecordInput): Promise<string> {
  const r = await rpc("record_school_supervision", {
    _base_id: i.baseId, _kind: i.kind, _school: i.school, _modality: i.modality, _subject: i.subject, _occurred_on: i.occurredOn,
    _referral: i.referral, _responsible_label: i.responsible, _return_on: i.returnOn, _status_value: i.status, _school_visible: i.schoolVisible, _reason: i.reason,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data as string;
}
