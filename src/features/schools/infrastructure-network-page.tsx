import { operationalToday } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { infrastructureQueueFromCoverage, infrastructureReportRows, INFRAESTRUTURA_COBERTURA, type InfraQueueRow } from "./infrastructure-network-queue";
import { ExportButtons } from "@/features/performance/station-sections";
import { runReport, toCsv, toPrintableHtml } from "@/features/reports/report-engine";
import type { InfraAttributeRow } from "./school-infrastructure";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const today = () => operationalToday();

/** Lê só o que a RLS já libera à conta: escolas fora do escopo simplesmente não chegam. */
export function InfrastructureNetworkPage() {
  const [on, setOn] = useState(today());
  const [data, setData] = useState<{ rows: InfraQueueRow[]; names: Map<string, string> } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setData(null); setErr(false);
    // PERF.LOADING.3 — cobertura agregada no servidor (55 linhas) em vez de todas as observações; troca de data cancela a anterior.
    const ctl = new AbortController();
    Promise.all([
      db.from("school_infrastructure_attribute_versions").select("id, attribute_id, version_number, label, value_type, catalog_values, unit_label, source_field").abortSignal(ctl.signal),
      db.rpc("infrastructure_coverage_at", { _on: on }).abortSignal(ctl.signal),
      db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false }).abortSignal(ctl.signal),
    ]).then(([a, o, s]: any[]) => {
      if (ctl.signal.aborted) return;
      if (a.error || o.error || s.error) return setErr(true);
      const names = new Map<string, string>(); for (const r of s.data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
      setData({ rows: infrastructureQueueFromCoverage([...names.keys()], a.data as InfraAttributeRow[], o.data ?? []), names });
    }, () => { if (!ctl.signal.aborted) setErr(true); });
    return () => ctl.abort();
  }, [on]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rede" title="Infraestrutura das escolas" description="O que cada escola já informou e o que falta informar. O SIGEM não avalia condição nem define prioridade de obra: isso depende de regra institucional." />
      <label className="block max-w-xs text-sm print:hidden">Situação na data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      {data && data.rows.length > 0 && data.rows[0]!.total > 0 && <div className="print:hidden"><ExportButtons name={`infraestrutura-cobertura-${on}`} make={() => { const b = { headerLines: ["SIGEM — Infraestrutura"], title: `${INFRAESTRUTURA_COBERTURA.title} — ${on}` }; const r = runReport(INFRAESTRUTURA_COBERTURA, { params: { on } }, infrastructureReportRows(data.rows, data.names)); const m = ["Só o que foi informado; não avalia condição nem prioridade de obra."]; return { ok: true as const, csv: toCsv(r, b, m), html: toPrintableHtml(r, b, m) }; }} /></div>}
      {err ? <StatePanel tone="danger" title="Não foi possível consultar" description="Nenhum dado substituto é exibido. Tente de novo em instantes." />
        : !data ? <SkeletonState label="Carregando infraestrutura da rede" />
        : data.rows.length === 0 || data.rows[0]!.total === 0 ? <EmptyState title="Nada a mostrar" description="Nenhuma escola visível para sua conta ou nenhum item de infraestrutura cadastrado na rede." />
        : <table className="w-full text-sm">
            <caption className="sr-only">Cobertura da infraestrutura por escola</caption>
            <thead><tr className="text-left"><th scope="col">Escola</th><th scope="col">Informados</th><th scope="col">Falta informar</th></tr></thead>
            <tbody>{data.rows.map((r) => (
              <tr key={r.schoolId} className="border-t align-top">
                <td className="py-1">{data.names.get(r.schoolId) ?? "Escola sem nome registrado"}</td>
                <td>{r.informed} de {r.total}</td>
                <td>{r.missing.length === 0 ? "—" : <details><summary>{r.missing.length} item(ns)</summary><ul className="list-disc pl-5">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul></details>}</td>
              </tr>))}</tbody>
          </table>}
    </div>
  );
}
