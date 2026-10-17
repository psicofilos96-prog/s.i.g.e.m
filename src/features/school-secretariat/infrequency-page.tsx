import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { operationalToday } from "@/lib/academic-date";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { INFREQUENCY_MESSAGES, infrequencyNoticePdf, type InfrequencyRow } from "./infrequency-notice";

const today = () => operationalToday();
const monthStart = () => `${today().slice(0, 7)}-01`;
const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(INFREQUENCY_MESSAGES).find((x) => m.includes(x));
  return (k && INFREQUENCY_MESSAGES[k]) || "Não foi possível concluir. Tente de novo.";
};

/** Alunos abaixo da frequência mínima (parâmetro editável) no período, com aviso ao responsável. */
export function InfrequencyPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const own = useOwnSchoolId();
  const nameQ = useQuery({ queryKey: ["own-school-name", own], queryFn: () => readCurrentSchoolNames(own ? [own] : []), enabled: !!own, staleTime: 600_000 });
  const school = (own && nameQ.data?.get(own)) || "Escola";
  const [msg, setMsg] = useState<string | null>(null);
  const rowsQ = useQuery({
    queryKey: ["secretariat-infrequency", own, period.from, period.to], enabled: !!own,
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("secretariat_own_infrequency", { _from: period.from, _to: period.to }).abortSignal(AbortSignal.timeout(15000));
      if (error) throw new Error(error.message);
      return parseBoundary(z.array(z.object({ student_id: z.string(), student_name: z.string(), present: z.number(), absent: z.number(), rate: z.number(), threshold: z.number(), last_notice: z.string().nullable() })), data, "secretariat_own_infrequency");
    },
  });
  const rows = rowsQ.data;
  const notify = async (r: InfrequencyRow) => {
    setMsg(null);
    try {
      await callRpc("secretariat_record_infrequency_notice", { _student: r.student_id, _from: period.from, _to: period.to });
      const blob = await infrequencyNoticePdf(r, period.from, period.to, school);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `aviso-infrequencia-${r.student_name}.pdf`; a.click(); URL.revokeObjectURL(a.href);
      void rowsQ.refetch();
    } catch (e) { setMsg(msgOf(e)); }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <PageHeader eyebrow="Secretaria" title="Aviso de infrequência" description="Alunos abaixo da frequência mínima no período, conforme a chamada do Diário. O limite é o de Parâmetros." />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button disabled={!own || rowsQ.isFetching} onClick={() => { setMsg(null); if (period.from === from && period.to === to) void rowsQ.refetch(); else setPeriod({ from, to }); }}>Atualizar</Button>
      </div>
      {msg && <p role="status" className="text-sm text-destructive">{msg}</p>}
      {rowsQ.isError ? <p role="alert" className="text-sm text-destructive">{msgOf(rowsQ.error)}</p> : !rows ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aluno abaixo da frequência mínima neste período.</p>
        : <ul className="space-y-2">{rows.map((r) => (
          <li key={r.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
            <span><b>{r.student_name}</b> · {String(r.rate).replace(".", ",")}% ({r.absent} faltas, {r.present} presenças){r.last_notice ? ` · último aviso em ${r.last_notice.split("-").reverse().join("/")}` : ""}</span>
            <Button size="sm" onClick={() => void notify(r)}>Emitir aviso</Button>
          </li>))}</ul>}
      <p className="text-xs text-muted-foreground">Cada aviso emitido fica registrado com data e autor. O texto é modelo do sistema até a rede adotar o oficial.</p>
    </div>
  );
}
