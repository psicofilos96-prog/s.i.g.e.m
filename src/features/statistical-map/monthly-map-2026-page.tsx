import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegistryHero, registryTd, registryTh, registryRow } from "@/components/sigem/registry-layout";
import { brand } from "@/config/branding";
import { exportMap } from "./census-map-2026";
import {
  MEASURES, MONTHS, MONTHLY_REPORT, STATUS_LABEL, compareMonths, effectiveRow, latestClosures, monthlyCells, networkMonth, normalizeMonthly,
  referenceDate, type Closure,
} from "./monthly-map-2026";

type Rpc = (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;

async function loadMonth(month: number) {
  const [live, cl] = await Promise.all([
    rpc("monthly_map_2026_live", { _month: month }),
    supabase.from("monthly_map_2026_closures").select("*").eq("map_year", 2026).eq("map_month", month),
  ]);
  if (live.error) throw new Error(live.error.message);
  const closures = latestClosures(((cl.data ?? []) as unknown) as Closure[]);
  const rows = normalizeMonthly((live.data ?? []) as Record<string, unknown>[])
    .map((r) => effectiveRow(r, closures.get(`${r.school_id}:${month}`)))
    .sort((a, b) => (a.school_name ?? "").localeCompare(b.school_name ?? "", "pt-BR"));
  return { rows, history: ((cl.data ?? []) as unknown) as Closure[] };
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "não apurado" : v.toLocaleString("pt-BR"));
const dateBr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");

export function MonthlyMap2026Page({ mode = "escola" }: { mode?: "escola" | "rede" }) {
  const nowMonth = new Date().getFullYear() === 2026 ? new Date().getMonth() + 1 : 12;
  const [month, setMonth] = useState(Math.max(1, nowMonth - 1));
  const [cmp, setCmp] = useState(Math.max(1, nowMonth - 2));
  const [school, setSchool] = useState<string>("");
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const qc = useQueryClient();
  const cur = useQuery({ queryKey: ["mapa-mensal-2026", month], queryFn: () => loadMonth(month) });
  const prev = useQuery({ queryKey: ["mapa-mensal-2026", cmp], queryFn: () => loadMonth(cmp) });

  const rows = useMemo(() => (cur.data?.rows ?? []).filter((r) => (!school || r.school_id === school)
    && (!q || `${r.school_name} ${r.inep}`.toLowerCase().includes(q.toLowerCase()))), [cur.data, school, q]);
  const prevRows = useMemo(() => (prev.data?.rows ?? []).filter((r) => !school || r.school_id === school), [prev.data, school]);
  const net = networkMonth(rows);
  const comparison = compareMonths(networkMonth(prevRows).totals, net.totals);
  const selected = school ? rows[0] : undefined;

  if (cur.isLoading) return <LoadingState label="Lendo o mapa do mês" />;
  if (cur.error) return <div role="alert" className="p-6">Não foi possível ler o mapa: {(cur.error as Error).message}</div>;

  const meta = [`Ano letivo 2026 · Mês de referência: ${MONTHS[month - 1]} · Data de referência: ${dateBr(referenceDate(month))} (último dia do mês; regra do Mapa sem versão homologada)`,
    selected ? `Escola: ${selected.school_name ?? ""} · INEP ${selected.inep ?? "não informado"}` : `Recorte: ${rows.length} escolas visíveis · ${net.apuradas} apuradas`];
  const download = async (format: "csv" | "xlsx" | "pdf") => {
    const blob = await exportMap(MONTHLY_REPORT, monthlyCells(rows), format, { headerLines: [brand.name, "Mapa Estatístico mensal 2026"], title: `${MONTHLY_REPORT.title} — ${MONTHS[month - 1]}` }, meta);
    const url = URL.createObjectURL(blob);
    if (format === "pdf") { const w = window.open(url, "_blank"); w?.addEventListener("load", () => w.print()); }
    else { const a = document.createElement("a"); a.href = url; a.download = `mapa-mensal-2026-${String(month).padStart(2, "0")}.${format}`; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const record = async () => {
    setMsg(null);
    const { error } = await rpc("record_monthly_map_2026", { _school: school, _month: month, _reason: reason || null });
    setMsg(error ? `Apuração recusada: ${error.message}` : "Apuração registrada e congelada.");
    if (!error) { setReason(""); qc.invalidateQueries({ queryKey: ["mapa-mensal-2026", month] }); }
  };
  const history = (cur.data?.history ?? []).filter((h) => h.school_id === school).sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <RegistryHero eyebrow={mode === "rede" ? "SEMED · Consolidado mensal" : "Escolas"} title={`Mapa Estatístico mensal — ${MONTHS[month - 1]} de 2026`}
        lede="Cada mês é lido na sua data de referência a partir das enturmações, matrículas e saídas registradas. O Censo é referência, não prova da situação de cada mês." />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Mês de referência
          <select className="ml-2 rounded border border-input bg-background px-2 py-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}/2026</option>)}
          </select></label>
        <label className="text-sm">Comparar com
          <select className="ml-2 rounded border border-input bg-background px-2 py-1" value={cmp} onChange={(e) => setCmp(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}/2026</option>)}
          </select></label>
        <label className="text-sm">Escola
          <select className="ml-2 max-w-xs rounded border border-input bg-background px-2 py-1" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">{mode === "rede" ? "Rede (todas visíveis)" : "Todas visíveis"}</option>
            {(cur.data?.rows ?? []).map((r) => <option key={r.school_id} value={r.school_id}>{r.school_name} · {r.inep}</option>)}
          </select></label>
        <Input className="max-w-xs" placeholder="Buscar por nome ou INEP" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar escola" />
        <div className="flex gap-2">{(["pdf", "xlsx", "csv"] as const).map((f) => <Button key={f} size="sm" variant="outline" onClick={() => download(f)}>{f === "pdf" ? "PDF (A4 paisagem)" : f.toUpperCase()}</Button>)}</div>
      </div>

      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Data de referência: <strong>{dateBr(referenceDate(month))}</strong>. {net.apuradas} de {net.schools} escolas apuradas
        {net.naoApuradas ? ` · ${net.naoApuradas} sem histórico suficiente para este mês` : ""}{net.complete ? "" : " · consolidação parcial"}.
        Alunos distintos são contados por escola; a soma não equivale a alunos distintos da rede.
      </p>

      <section aria-labelledby="cmp-h" className="overflow-x-auto">
        <h2 id="cmp-h" className="mb-2 font-display text-lg">Comparativo {MONTHS[cmp - 1]} × {MONTHS[month - 1]}</h2>
        <table className="w-full text-sm"><thead><tr>
          <th scope="col" className={registryTh}>Medida</th><th scope="col" className={registryTh}>{MONTHS[cmp - 1]}</th>
          <th scope="col" className={registryTh}>{MONTHS[month - 1]}</th><th scope="col" className={registryTh}>Diferença</th></tr></thead>
          <tbody>{comparison.map((c) => <tr key={c.key} className={registryRow}><td className={registryTd}>{c.label}</td><td className={registryTd}>{fmt(c.a)}</td>
            <td className={registryTd}>{fmt(c.b)}</td><td className={registryTd}>{c.delta === null ? "indisponível" : c.delta.toLocaleString("pt-BR")}</td></tr>)}</tbody>
        </table>
      </section>

      <section aria-labelledby="esc-h" className="overflow-x-auto">
        <h2 id="esc-h" className="mb-2 font-display text-lg">Escolas no mês</h2>
        <table className="w-full text-sm"><thead><tr>
          <th scope="col" className={registryTh}>Escola</th><th scope="col" className={registryTh}>Situação</th>
          {MEASURES.map(([k, l]) => <th key={k} scope="col" className={registryTh}>{l}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.school_id} className={registryRow}>
            <td className={registryTd}>{r.school_name}<div className="text-xs text-muted-foreground">INEP {r.inep ?? "não informado"}</div></td>
            <td className={registryTd}>{r.frozen ? `Apuração v${r.frozen.version} congelada` : STATUS_LABEL[r.status]}
              {r.driftFromFrozen.length ? <div className="text-xs text-muted-foreground">Registros mudaram após a apuração</div> : null}</td>
            {MEASURES.map(([k]) => <td key={k} className={registryTd}>{fmt(r[k])}</td>)}</tr>)}</tbody>
        </table>
      </section>

      {selected && (
        <section aria-labelledby="ap-h" className="space-y-2 rounded-md border border-border p-4">
          <h2 id="ap-h" className="font-display text-lg">Apuração do mês — {selected.school_name}</h2>
          <p className="text-sm text-muted-foreground">Apurar congela os números do mês; alterações futuras não mudam a apuração. Revisão cria nova versão e exige motivo. Só contas com a competência de oficializar o mapa nesta escola conseguem registrar.</p>
          {selected.frozen && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo da revisão (mín. 10 caracteres)" aria-label="Motivo da revisão" />}
          <Button size="sm" disabled={selected.status !== "apurado" && !selected.frozen} onClick={record}>{selected.frozen ? "Registrar revisão" : "Apurar e congelar o mês"}</Button>
          {msg && <p role="status" className="text-sm">{msg}</p>}
          {history.length > 0 && <ul className="text-sm">{history.map((h) => <li key={h.version}>v{h.version} · {h.kind === "apuracao" ? "apuração" : "revisão"} · {new Date(h.created_at).toLocaleString("pt-BR")}{h.reason ? ` · ${h.reason}` : ""}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}
