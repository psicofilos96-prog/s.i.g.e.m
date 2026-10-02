/**
 * B2.6 — Fonte institucional dos Catálogos (scheme_id → value_id → versões).
 * Leitura administrativa com histórico completo; escrita só por
 * `record_attribute_value_version` (rede, base esperada, append-only).
 * Nenhum esquema ou valor é pré-definido aqui: catálogo vazio é estado válido.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveCapability } from "@/features/authority/session-authority";

export const CATALOG_CAPABILITY = "manter-catalogos-institucionais" as const;
const SQL_NULL = null as unknown as string;

/** Rede: capacidade sem escola na atuação. */
export const canMaintainCatalogs = (caps: readonly EffectiveCapability[]) =>
  caps.some((c) => c.capabilityId === CATALOG_CAPABILITY && c.schoolId === null);

export type CatalogVersion = {
  schemeId: string; valueId: string; version: number; label: string; status: "rascunho" | "homologada";
  homologationActRef: string | null; validFrom: string | null; changeReason: string | null; createdAt: string;
};
export type CatalogValue = { schemeId: string; valueId: string; versions: CatalogVersion[]; latest: CatalogVersion };
export type CatalogScheme = { schemeId: string; values: CatalogValue[] };

export function groupCatalog(rows: readonly CatalogVersion[]): CatalogScheme[] {
  const schemes = new Map<string, Map<string, CatalogVersion[]>>();
  for (const r of rows) {
    const s = schemes.get(r.schemeId) ?? new Map<string, CatalogVersion[]>();
    s.set(r.valueId, [...(s.get(r.valueId) ?? []), r]);
    schemes.set(r.schemeId, s);
  }
  return [...schemes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([schemeId, vals]) => ({
    schemeId,
    values: [...vals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([valueId, versions]) => {
      const sorted = [...versions].sort((a, b) => a.version - b.version);
      return { schemeId, valueId, versions: sorted, latest: sorted[sorted.length - 1]! };
    }),
  }));
}

export async function loadCatalog(): Promise<CatalogScheme[]> {
  const { data, error } = await supabase.from("attribute_value_definitions").select("*").order("version");
  if (error) throw error;
  return groupCatalog(((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    schemeId: String(r["scheme_id"]), valueId: String(r["value_id"]), version: Number(r["version"]), label: String(r["label"]),
    status: r["status"] === "homologada" ? "homologada" : "rascunho",
    homologationActRef: (r["homologation_act_ref"] as string | null) ?? null, validFrom: (r["valid_from"] as string | null) ?? null,
    changeReason: (r["change_reason"] as string | null) ?? null, createdAt: String(r["created_at"]),
  })));
}

export async function recordCatalogValue(input: {
  schemeId: string; valueId: string; baseVersion: number | null; label: string; status: "rascunho" | "homologada";
  validFrom: string | null; actRef: string | null; reason: string | null;
}): Promise<number> {
  const { data, error } = await supabase.rpc("record_attribute_value_version", {
    _scheme: input.schemeId, _value: input.valueId, _base_version: (input.baseVersion ?? null) as unknown as number,
    _label: input.label, _status: input.status, _valid_from: input.validFrom ?? SQL_NULL,
    _act_ref: input.actRef ?? SQL_NULL, _reason: input.reason ?? SQL_NULL,
  });
  if (error) throw error;
  return data as number;
}

export function humanCatalogError(message: string): string {
  const m = message ?? "";
  if (m.includes("network-capability-required")) return "Sua atuação vigente não concede manter catálogos institucionais com alcance de rede.";
  if (m.includes("homologation-act-required")) return "A homologação exige a referência do ato de homologação.";
  if (m.includes("invalid-identifier")) return "Identificadores usam apenas letras minúsculas, números e hífen.";
  if (m.includes("label-required")) return "Informe o rótulo.";
  if (m.includes("value-exists")) return "Esse valor já existe neste esquema; registre uma nova versão.";
  if (m.includes("base-superseded")) return "Outra versão foi registrada antes; recarregue e confira o histórico.";
  if (m.includes("reason-required")) return "Informe o motivo da nova versão.";
  return "Operação recusada; nada foi gravado.";
}
