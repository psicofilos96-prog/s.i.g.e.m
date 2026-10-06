import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import { yearStateLabel } from "@/features/school-secretariat/secretariat";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { GESTAO_ESCOLAR } from "@/features/reports/report-registry";
import { STATE_LABEL, buildPanel, managementRows, type Block, type BlockState, type Pending } from "./management-panel";
import { readManagementInputs } from "./management-source";

const field = "mt-1 block w-full rounded-md border border-input bg-background p-2";
const today = () => new Date().toISOString().slice(0, 10);
const TONE: Record<BlockState, string> = { AVAILABLE: "border-border", ZERO: "border-border", UNKNOWN: "border-dashed", UNAVAILABLE: "border-dashed opacity-80", BLOCKED: "border-destructive/50" };

export function ManagementPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);
  const [f, setF] = useState({ school: "", year: "", on: today(), knownAt: "" });
  useEffect(() => {
    void supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false }).then(({ data }) => {
      const m = new Map<string, string>();
      for (const r of (data ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name);
      setSchools([...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    readYears().then(setYears).catch(() => setYears([]));
  }, []);
  const ready = f.school && f.year && f.on;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Direção" title="Estação da gestão escolar"
        description="Situação operacional da escola montada na hora a partir dos registros oficiais que sua atuação alcança. Não é documento oficial nem nota da escola." />
      <section aria-label="Contexto" className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Escola<select className={field} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })}>
          <option value="">{schools === null ? "Carregando…" : "Escolha a escola"}</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Ano letivo<select className={field} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
          <option value="">Escolha o ano</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label} — {yearStateLabel(y.state)}</option>)}</select></label>
        <label className="text-sm">Data de referência<DateInput value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></label>
        <label className="text-sm">Conhecido até (opcional)<input type="datetime-local" className={field} value={f.knownAt} onChange={(e) => setF({ ...f, knownAt: e.target.value })} /></label>
      </section>
      {ready ? <Station key={JSON.stringify(f)} {...f} schoolName={schools?.find((s) => s.id === f.school)?.name ?? f.school} />
        : <EmptyState title="Escolha escola, ano e data" description="A estação mostra uma escola por vez; o que sua atuação não alcança aparece como não disponível." />}
    </div>
  );
}

function Station({ school, year, on, knownAt, schoolName }: { school: string; year: string; on: string; knownAt: string; schoolName: string }) {
  const [res, setRes] = useState<{ blocks: Block[]; pending: Pending[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const k = knownAt ? new Date(knownAt).toISOString() : null;
  useEffect(() => { readManagementInputs(school, year, on, k).then((i) => setRes(buildPanel(i)), (e: Error) => setErr(e.message)); }, [school, year, on, k]);
  if (err) return <StatePanel tone="danger" title="Não foi possível montar a estação" description="Tente novamente em instantes." />;
  if (!res) return <p role="status" className="text-sm text-muted-foreground">Lendo as fontes…</p>;
  const exportCsv = () => {
    const r = runReport(GESTAO_ESCOLAR, { params: { school, on } }, managementRows(res.blocks));
    const meta = [`Escola: ${schoolName}`, `Data de referência: ${on}`, `Conhecido até: ${k ?? "momento da geração"}`, "Projeção dinâmica — não é documento oficial."];
    const blob = new Blob([toCsv(r, { headerLines: ["SIGEM"], title: GESTAO_ESCOLAR.title }, meta)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `gestao-escolar-${on}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-6">
      {k && <StatePanel tone="info" title="Visão histórica" description="Blocos marcados com “conhecido até” reproduzem o que estava registrado naquele momento; os demais mostram o estado atual da fonte." />}
      <section aria-label="Blocos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {res.blocks.map((b) => (
          <Link key={b.id} to={b.link as "/secretaria"} className={`rounded-lg border bg-card p-4 space-y-1 hover:bg-accent ${TONE[b.state]}`}>
            <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">{b.title}</h2><span className="text-xs text-muted-foreground">{STATE_LABEL[b.state]}</span></div>
            <p className="font-display text-2xl font-semibold tabular-nums">{b.value ?? "—"}</p>
            <p className="text-xs">{b.detail}</p>
            {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
            {k && !b.supportsKnownAt && <p className="text-xs text-muted-foreground">Esta fonte não reproduz “conhecido até”.</p>}
          </Link>))}
      </section>
      <section aria-label="Pendências" className="space-y-2">
        <h2 className="font-semibold">Pendências ({res.pending.length})</h2>
        {res.pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência derivável das fontes que você alcança. Isso não afirma que a escola está em ordem.</p>
          : <ul className="space-y-1 text-sm">{res.pending.map((p) => <li key={p.id}><Link to={p.link as "/secretaria"} className="underline">{p.text}</Link> <span className="text-xs text-muted-foreground">({p.source})</span></li>)}</ul>}
      </section>
      <Button variant="outline" onClick={exportCsv}>Exportar situação operacional (CSV)</Button>
    </div>
  );
}
