import { civilDateOf } from "@/lib/academic-date";
import { readPages } from "@/lib/list-paging";
// Séries agregadas lidas com o cliente do PRÓPRIO usuário (RLS). Fonte recusada ⇒ série ausente, nunca zeros.
import { supabase } from "@/integrations/supabase/client";
import type { Series } from "./anomaly-core";

export type SourceResult = { series: Series[]; unavailable: string[] };

export async function loadSeries(): Promise<SourceResult> {
  const series: Series[] = [];
  const unavailable: string[] = [];

  const imp = await readPages<{ adapter_id: string; row_count: number | null; received_at: string }>((f, t) => supabase.from("import_batches").select("adapter_id, row_count, received_at").order("received_at").order("id").range(f, t), 20000);
  if (imp.error || imp.truncated) unavailable.push("Linhas por lote de importação");
  else {
    const by = new Map<string, { key: string; value: number | null }[]>();
    for (const r of imp.data ?? []) {
      const list = by.get(r.adapter_id) ?? [];
      list.push({ key: String(r.received_at).slice(0, 16).replace("T", " "), value: typeof r.row_count === "number" ? r.row_count : null });
      by.set(r.adapter_id, list);
    }
    for (const [adapter, points] of by) series.push({ id: `importacao:${adapter}`, title: `Linhas por lote (${adapter})`, population: `Lotes do importador ${adapter} visíveis para você`, unit: "linhas", points });
  }

  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const req = await readPages<{ status: number | string; created_at: string }>((f, t) => supabase.from("integration_requests").select("status, created_at").gte("created_at", since).order("created_at").order("id").range(f, t), 50000);
  if (req.error || req.truncated) unavailable.push("Falhas técnicas da API de integração");
  else {
    const days = new Map<string, number>();
    for (const r of req.data ?? []) {
      const d = civilDateOf(String(r.created_at));
      days.set(d, (days.get(d) ?? 0) + (Number(r.status) >= 500 ? 1 : 0));
    }
    const keys = [...days.keys()].sort();
    series.push({ id: "integracao:falhas-5xx", title: "Falhas técnicas por dia", population: "Chamadas à API de integração visíveis para você (dias sem chamada não entram)", unit: "falhas", points: keys.map((k) => ({ key: k, value: days.get(k)! })) });
  }
  return { series, unavailable };
}
