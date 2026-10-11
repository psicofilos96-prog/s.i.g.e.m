/** Modelos do gerador personalizado: versões append-only em `report_template_versions` (dono = auth.uid()), setor "personalizado". */
import { supabase } from "@/integrations/supabase/client";
import type { CustomSpec } from "./custom-report";
import type { CustomLayout } from "./custom-layout";

export const CUSTOM_SECTOR = "personalizado";
export type CustomTemplate = Readonly<{ name: string; version: number; recordedAt: string; spec: CustomSpec; layout: CustomLayout }>;
type Row = { name: string; version: number; archived: boolean; choice: unknown; recorded_at: string };

/** Compartilhar exige capability própria; não há uma definida, então a ação fica desabilitada com o motivo. */
export const CUSTOM_SHARE_CAPABILITY: string | null = null;
export const CUSTOM_SHARE_REASON = "Compartilhar modelo com outras contas ainda não tem permissão definida; o modelo é pessoal. Quem recebe o arquivo vê só o que foi exportado.";

export function latestCustom(rows: readonly Row[]): CustomTemplate[] {
  const head = new Map<string, Row>();
  for (const r of rows) { const c = head.get(r.name); if (!c || c.version < r.version) head.set(r.name, r); }
  return [...head.values()].filter((r) => !r.archived && (r.choice as { kind?: string })?.kind === "custom-v1")
    .map((r) => { const c = r.choice as { spec: CustomSpec; layout: CustomLayout }; return { name: r.name, version: r.version, recordedAt: r.recorded_at, spec: c.spec, layout: c.layout }; })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export async function listCustomTemplates(): Promise<CustomTemplate[]> {
  const r = await supabase.from("report_template_versions").select("name,version,archived,choice,recorded_at").eq("sector", CUSTOM_SECTOR).limit(1000);
  if (r.error) throw new Error("Não foi possível ler seus modelos.");
  return latestCustom((r.data ?? []) as Row[]);
}
export async function saveCustomTemplate(name: string, spec: CustomSpec, layout: CustomLayout, archived = false): Promise<void> {
  const n = name.trim().slice(0, 80);
  if (!n) throw new Error("Dê um nome ao modelo.");
  const choice = { kind: "custom-v1", spec, layout };
  if (JSON.stringify(choice).length > 7800) throw new Error("Modelo grande demais para salvar (reduza linhas de cabeçalho ou filtros).");
  const r = await supabase.from("report_template_versions").insert({ sector: CUSTOM_SECTOR, name: n, choice: choice as never, archived, idempotency_key: `rcq-${crypto.randomUUID()}` });
  if (r.error) throw new Error("Não foi possível salvar o modelo.");
}
export function copyName(name: string, existing: readonly CustomTemplate[]) {
  const taken = new Set(existing.map((t) => t.name.toLocaleLowerCase("pt-BR")));
  for (let i = 1; i < 100; i++) { const c = `${name} (cópia${i > 1 ? ` ${i}` : ""})`.slice(0, 80); if (!taken.has(c.toLocaleLowerCase("pt-BR"))) return c; }
  throw new Error("Nomes de cópia esgotados.");
}
