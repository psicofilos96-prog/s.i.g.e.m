/**
 * NREL.3 — Modelos pessoais do gerador no servidor, por principal (auth.uid()), versionados e append-only.
 * Guarda só a escolha; o dado é sempre relido com a ACL de quem gera. Sem compartilhamento:
 * não há capability definida para isso, então a opção fica desabilitada (DEPENDE_DECISAO).
 */
import { supabase } from "@/integrations/supabase/client";
import { validateChoice, type BuilderChoice, type BuilderSource, type SavedTemplate, type Sector } from "./report-builder";

/** Capability de compartilhamento com o setor. `null` = não definida ⇒ compartilhar fica desabilitado. */
export const SHARE_WITH_SECTOR_CAPABILITY: string | null = null;
export const SHARE_DISABLED_REASON = "Compartilhar com o setor ainda não está disponível: não há permissão definida para isso.";

export type TemplateRow = Readonly<{ sector: string; name: string; version: number; archived: boolean; choice: unknown; recorded_at: string }>;
export type CloudTemplate = SavedTemplate & Readonly<{ version: number }>;

/** Projeção pura: última versão de cada (setor, nome); arquivado some; inválido para o setor/assunto atual é omitido. */
export function latestTemplates(rows: readonly TemplateRow[], sector: Sector, sources: readonly BuilderSource[]): CloudTemplate[] {
  const head = new Map<string, TemplateRow>();
  for (const r of rows) {
    if (r.sector !== sector) continue;
    const cur = head.get(r.name);
    if (!cur || cur.version < r.version) head.set(r.name, r);
  }
  const out: CloudTemplate[] = [];
  for (const r of head.values()) {
    if (r.archived) continue;
    const choice = r.choice as BuilderChoice;
    const src = sources.find((s) => s.id === choice?.sourceId);
    if (!src || !src.sectors.includes(sector) || validateChoice(src, choice).length) continue;
    out.push({ name: r.name, sector, choice, savedAt: r.recorded_at, version: r.version });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Validação antes de gravar (o banco revalida dono, tamanho e versão). */
export function prepareTemplate(t: SavedTemplate, sources: readonly BuilderSource[]): SavedTemplate {
  const src = sources.find((s) => s.id === t.choice.sourceId);
  if (!src || !src.sectors.includes(t.sector)) throw new Error("Este assunto não pertence ao setor escolhido.");
  const errs = validateChoice(src, t.choice);
  if (errs.length) throw new Error(errs.join(" "));
  const name = t.name.trim().slice(0, 80);
  if (!name) throw new Error("Dê um nome ao modelo.");
  return { ...t, name };
}

export const newIdempotencyKey = () => `rtv-${crypto.randomUUID()}`;

export async function loadCloudTemplates(sector: Sector, sources: readonly BuilderSource[]): Promise<CloudTemplate[]> {
  const r = await supabase.from("report_template_versions").select("sector,name,version,archived,choice,recorded_at").eq("sector", sector).limit(1000);
  if (r.error) throw r.error;
  return latestTemplates((r.data ?? []) as TemplateRow[], sector, sources);
}

/** Grava nova versão. Repetir a mesma chave não cria segunda versão (conflito = já gravado). */
export async function saveCloudTemplate(t: SavedTemplate, sources: readonly BuilderSource[], idempotencyKey: string, archived = false): Promise<"gravado" | "ja-gravado"> {
  const p = prepareTemplate(t, sources);
  const r = await supabase.from("report_template_versions").insert({ sector: p.sector, name: p.name, choice: p.choice as never, archived, idempotency_key: idempotencyKey });
  if (r.error) { if (r.error.code === "23505") return "ja-gravado"; throw r.error; }
  return "gravado";
}
