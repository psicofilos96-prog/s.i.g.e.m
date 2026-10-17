import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { INFREQUENCY_MESSAGES, infrequencyNoticePdf, type InfrequencyRow } from "./infrequency-notice";

const today = () => new Date().toISOString().slice(0, 10);
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
  const [rows, setRows] = useState<InfrequencyRow[] | null>(null);
  const [school, setSchool] = useState("Escola");
  const [msg, setMsg] = useState<string | null>(null);
  async function load() {
    setRows(null); setMsg(null);
    const { data, error } = await supabase.rpc("secretariat_own_infrequency", { _from: from, _to: to });
    if (error) { setMsg(msgOf(error)); setRows([]); return; }
    setRows((data ?? []) as InfrequencyRow[]);
  }
  useEffect(() => {
    void load();
    void supabase.rpc("secretariat_own_school_id").then(async ({ data }) => {
      if (!data) return;
      const r = await supabase.from("institutional_schools").select("name").eq("id", data).maybeSingle();
      if (r.data?.name) setSchool(r.data.name);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const notify = async (r: InfrequencyRow) => {
    setMsg(null);
    try {
      await callRpc("secretariat_record_infrequency_notice", { _student: r.student_id, _from: from, _to: to });
      const blob = await infrequencyNoticePdf(r, from, to, school);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `aviso-infrequencia-${r.student_name}.pdf`; a.click();
      void load();
    } catch (e) { setMsg(msgOf(e)); }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <PageHeader eyebrow="Secretaria" title="Aviso de infrequência" description="Alunos abaixo da frequência mínima no período, conforme a chamada do Diário. O limite é o de Parâmetros." />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button onClick={() => void load()}>Atualizar</Button>
      </div>
      {msg && <p role="status" className="text-sm text-destructive">{msg}</p>}
      {rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
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
