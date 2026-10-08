import { operationalToday } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { infrastructureQueue, type InfraQueueRow } from "./infrastructure-network-queue";
import type { InfraAttributeRow, InfraObservationRow } from "./school-infrastructure";

const db = supabase as unknown as { from: (t: string) => any };
const today = () => operationalToday();

/** Lê só o que a RLS já libera à conta: escolas fora do escopo simplesmente não chegam. */
export function InfrastructureNetworkPage() {
  const [on, setOn] = useState(today());
  const [data, setData] = useState<{ rows: InfraQueueRow[]; names: Map<string, string> } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setData(null); setErr(false);
    Promise.all([
      db.from("school_infrastructure_attribute_versions").select("*"),
      db.from("school_infrastructure_observations").select("*").limit(20000),
      db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false }),
    ]).then(([a, o, s]: any[]) => {
      if (a.error || o.error || s.error) return setErr(true);
      const names = new Map<string, string>(); for (const r of s.data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
      setData({ rows: infrastructureQueue([...names.keys()], a.data as InfraAttributeRow[], o.data as InfraObservationRow[], on), names });
    }, () => setErr(true));
  }, [on]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rede" title="Infraestrutura das escolas" description="O que cada escola já informou e o que falta informar. O SIGEM não avalia condição nem define prioridade de obra: isso depende de regra institucional." />
      <label className="block max-w-xs text-sm print:hidden">Situação na data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
      {err ? <StatePanel tone="danger" title="Não foi possível consultar" description="Nenhum dado substituto é exibido. Tente de novo em instantes." />
        : !data ? <SkeletonState label="Carregando infraestrutura da rede" />
        : data.rows.length === 0 || data.rows[0]!.total === 0 ? <EmptyState title="Nada a mostrar" description="Nenhuma escola visível para sua conta ou nenhum item de infraestrutura cadastrado na rede." />
        : <table className="w-full text-sm">
            <caption className="sr-only">Cobertura da infraestrutura por escola</caption>
            <thead><tr className="text-left"><th>Escola</th><th>Informados</th><th>Falta informar</th></tr></thead>
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
