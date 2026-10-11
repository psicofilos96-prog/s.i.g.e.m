/**
 * Painéis salvos: versões append-only em `report_template_versions` (dono = auth.uid(), setor "painel").
 * Guardam só a ESPECIFICAÇÃO (consultas + tipo de gráfico + filtros); nunca linhas, porque o dado é relido com o acesso de quem abre.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Condition, CustomSpec } from "../custom/custom-report";
import type { ChartKind } from "./chart-model";

export const DASHBOARD_SECTOR = "painel";
export type Widget = { id: string; title: string; kind: ChartKind; spec: CustomSpec; raw?: string | undefined; wide?: boolean | undefined };
export type Dashboard = { widgets: Widget[]; filters: Condition[] };
export type SavedDashboard = { name: string; version: number; recordedAt: string; board: Dashboard };
type Row = { name: string; version: number; archived: boolean; choice: unknown; recorded_at: string };

/** Remove campos vazios para caber no limite de 8 KB por versão. */
export function compact(d: Dashboard): Dashboard {
  return { filters: d.filters, widgets: d.widgets.map((w) => ({ ...w, spec: { ...w.spec, labels: {}, sort: w.spec.sort.slice(0, 2) } })) };
}
export function latestBoards(rows: readonly Row[]): SavedDashboard[] {
  const head = new Map<string, Row>();
  for (const r of rows) { const c = head.get(r.name); if (!c || c.version < r.version) head.set(r.name, r); }
  return [...head.values()].filter((r) => !r.archived && (r.choice as { kind?: string })?.kind === "dashboard-v1")
    .map((r) => ({ name: r.name, version: r.version, recordedAt: r.recorded_at, board: (r.choice as { board: Dashboard }).board }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export async function listBoards(): Promise<SavedDashboard[]> {
  const r = await supabase.from("report_template_versions").select("name,version,archived,choice,recorded_at").eq("sector", DASHBOARD_SECTOR).limit(1000);
  if (r.error) throw new Error("Não foi possível ler seus painéis.");
  return latestBoards((r.data ?? []) as Row[]);
}
export async function saveBoard(name: string, board: Dashboard, archived = false): Promise<void> {
  const n = name.trim().slice(0, 80);
  if (!n) throw new Error("Dê um nome ao painel.");
  const choice = { kind: "dashboard-v1", board: compact(board) };
  if (JSON.stringify(choice).length > 7800) throw new Error("Painel grande demais para salvar: reduza gráficos ou filtros (máx. ~8 KB).");
  const r = await supabase.from("report_template_versions").insert({ sector: DASHBOARD_SECTOR, name: n, choice: choice as never, archived, idempotency_key: `dash-${crypto.randomUUID()}` });
  if (r.error) throw new Error("Não foi possível salvar o painel.");
}
