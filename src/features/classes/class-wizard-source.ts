/** N5.3.1 — leituras/escrita do assistente "Nova turma" e da composição. Só RPCs canônicos. */
import { supabase } from "@/integrations/supabase/client";
import { homologatedValues, SHIFT_SCHEME } from "./class-offering-shift-source";
import type { CatalogPosition } from "./class-wizard-model";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

/** Catálogos homologados de posição (todos exceto turno), agrupados por catálogo. */
export async function positionCatalogs(on: string): Promise<Map<string, CatalogPosition[]>> {
  const all = await homologatedValues(null, on);
  const m = new Map<string, CatalogPosition[]>();
  for (const v of all) {
    if (v.schemeId === SHIFT_SCHEME) continue;
    const list = m.get(v.schemeId) ?? [];
    list.push({ scheme: v.schemeId, value: v.valueId, version: v.version, label: v.label });
    m.set(v.schemeId, list);
  }
  return m;
}

export const shiftOptions = (on: string) => homologatedValues(SHIFT_SCHEME, on);

export async function classNamesFor(school: string, year: string): Promise<string[]> {
  const { data } = await supabase.from("institutional_classes").select("name").eq("school_id", school).eq("academic_year_id", year);
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

export async function createClassWithSetup(args: Record<string, unknown>): Promise<{ class_id: string }> {
  const { data, error } = await rpc("secretariat_create_class_with_journey", args);
  if (error) throw new Error(error.message);
  return data as { class_id: string };
}

export type CompositionRead = { versionId: string; version: number; kind: "simples" | "multisseriada"; positions: { scheme: string; value: string; version: number }[]; validFrom: string };

export async function classCompositionAt(classId: string, on: string): Promise<CompositionRead | null> {
  const { data, error } = await rpc("class_composition_at", { _class: classId, _on: on, _known_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { version_id: string; version: number; kind: "simples" | "multisseriada"; positions: CompositionRead["positions"]; valid_from: string }[];
  const r = rows[0];
  return r ? { versionId: r.version_id, version: r.version, kind: r.kind, positions: r.positions ?? [], validFrom: r.valid_from } : null;
}

export async function recordComposition(classId: string, expectedHead: string | null, positions: CatalogPosition[], validFrom: string, reason: string) {
  const { error } = await rpc("record_class_composition", {
    _class: classId, _expected_head: expectedHead, _positions: positions.map((p) => ({ scheme: p.scheme, value: p.value, version: p.version })),
    _valid_from: validFrom, _valid_until: null, _reason: reason,
  });
  if (error) throw new Error(error.message);
}
