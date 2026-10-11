import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { toPdfFile, toXlsx, type ReportResult } from "@/features/reports/report-engine";
import { INDICATORS, share, totals, type IndicatorDef, type IndicatorRow } from "./nei-indicators";

const rpc = supabase.rpc as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const input = "rounded-md border border-input bg-background p-2 text-sm";
const BRANDING = { headerLines: ["Prefeitura Municipal — Secretaria de Educação", "Núcleo de Educação Inclusiva"], title: "Indicadores do NEI" };
const fmt = (v: unknown, d: IndicatorDef) => (v === null || v === undefined ? "sem dado" : d.unit ? `${v} ${d.unit}` : String(v));
const download = (b: Blob, n: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

export function NeiIndicatorsPage() {
  const [rows, setRows] = useState<IndicatorRow[] | null | undefined>(undefined);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [school, setSchool] = useState(""); const [metric, setMetric] = useState<IndicatorDef>(INDICATORS[0]!);
  const [drill, setDrill] = useState<{ school: string; def: IndicatorDef; rows: { student_name: string | null; situation: string; ref_date: string | null }[] } | null>(null);
  const [agg, setAgg] = useState<{ indicator: string; value: number | null; suppressed: boolean }[]>([]);
  useEffect(() => {
    void rpc("nei_indicators", { _school: null }).then((r) => setRows(r.error ? null : (r.data as IndicatorRow[])));
    void readCurrentSchoolNames().then(setNames);
    void rpc("nei_network_aggregate").then((r) => setAgg(r.error ? [] : (r.data as typeof agg)));
  }, []);
  const sel = useMemo(() => (rows ?? []).filter((r) => !school || r.school_id === school), [rows, school]);
  const tot = useMemo(() => totals(sel), [sel]);
  const nameOf = (id: string) => names.get(id) ?? id;
  const max = Math.max(1, ...sel.map((r) => Number(r[metric.key] ?? 0)));
  const openDrill = (sid: string, def: IndicatorDef) => void rpc("nei_indicator_drill", { _school: sid, _key: def.drill }).then((r) => setDrill({ school: sid, def, rows: r.error ? [] : (r.data as never) }));

  const result = (): ReportResult => ({
    definitionId: "nei-indicadores", definitionVersion: 1, params: { escola: school || "todas no escopo" }, groups: null, generatedAt: new Date().toISOString(), mode: "sync",
    columns: [{ key: "ind", label: "Indicador" }, { key: "val", label: "Valor" }, { key: "pct", label: "% do denominador" }, { key: "f", label: "Fórmula / denominador" }] as never,
    rows: INDICATORS.map((d) => { const p = share(d, tot); return [d.label, tot[d.key] === null ? null : Number(tot[d.key]), p === null ? null : `${p}%`, `${d.formula}${d.denominator ? ` ÷ ${d.denominator}` : ""}`]; }),
  });
  const meta = () => [`Recorte: ${school ? nameOf(school) : "todas as escolas no seu escopo"}`, `Gerado em ${new Date().toLocaleString("pt-BR")}`, "Somente contagens; sem nomes de estudantes nem dado clínico."];
  const xlsx = async () => download(new Blob([await toXlsx(result(), BRANDING, meta())], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "indicadores-nei.xlsx");
  const pdf = async () => download(await toPdfFile(result(), BRANDING, meta()), "indicadores-nei.pdf");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Indicadores do NEI" description="Calculados na hora a partir dos registros do NEI, dentro do seu escopo. Cada número mostra fórmula, denominador e fonte; sem registro aparece “sem dado”, nunca zero inventado." />
      {rows === undefined ? <StatePanel title="Carregando…" description="Calculando no servidor." /> : rows === null ? <EmptyState title="Não foi possível calcular" description="Tente novamente." /> : rows.length === 0 ? (
        <EmptyState title="Sem escolas no seu escopo" description="Só coordenação, técnicos do NEI e a conta do NEI veem indicadores. A tentativa foi registrada." />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Escola <select className={input} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Todas no escopo</option>{rows.map((r) => <option key={r.school_id} value={r.school_id}>{nameOf(r.school_id)}</option>)}</select></label>
            <Button size="sm" variant="outline" onClick={() => void xlsx()}>Exportar XLSX</Button>
            <Button size="sm" variant="outline" onClick={() => void pdf()}>Exportar PDF</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {INDICATORS.map((d) => { const p = share(d, tot); return (
              <div key={d.key} className="rounded-md border border-border p-3" title={`${d.formula}. Fonte: ${d.source}`}>
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-xl font-semibold tabular-nums">{fmt(tot[d.key], d)}{p !== null ? <span className="ml-1 text-xs font-normal text-muted-foreground">({p}% de {d.denominator?.toLowerCase()})</span> : null}</p>
                <p className="text-[11px] text-muted-foreground">{d.formula}{d.unit ? "" : ""}</p>
              </div>); })}
          </div>
          <section className="space-y-2">
            <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Por escola</h2>
              <select className={input} value={metric.key} onChange={(e) => setMetric(INDICATORS.find((d) => d.key === e.target.value)!)} aria-label="Indicador do gráfico">{INDICATORS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></div>
            <svg role="img" aria-label={`Gráfico: ${metric.label} por escola`} width="100%" height={sel.length * 22 + 4} viewBox={`0 0 600 ${sel.length * 22 + 4}`}>
              {sel.map((r, i) => { const v = r[metric.key]; const w = v === null ? 0 : (Number(v) / max) * 360; return (
                <g key={r.school_id} transform={`translate(0 ${i * 22})`}><text x="0" y="14" fontSize="11" className="fill-foreground">{nameOf(r.school_id).slice(0, 34)}</text>
                  <rect x="220" y="3" width={w} height="14" className="fill-primary" /><text x={226 + w} y="14" fontSize="11" className="fill-foreground">{fmt(v, metric)}</text></g>); })}
            </svg>
            <table className="w-full text-sm"><caption className="sr-only">Tabela equivalente ao gráfico</caption>
              <thead><tr className="text-left text-xs text-muted-foreground"><th>Escola</th><th>{metric.label}</th><th>Detalhe</th></tr></thead>
              <tbody>{sel.map((r) => <tr key={r.school_id} className="border-t border-border"><td>{nameOf(r.school_id)}</td><td className="tabular-nums">{fmt(r[metric.key], metric)}</td>
                <td>{metric.drill ? <button className="text-xs underline" onClick={() => openDrill(r.school_id, metric)}>Ver estudantes</button> : <span className="text-xs text-muted-foreground">só contagem</span>}</td></tr>)}</tbody></table>
          </section>
          {drill ? (
            <section className="space-y-1 rounded-md border border-border p-3 text-sm">
              <h2 className="font-semibold">{drill.def.label} — {nameOf(drill.school)}</h2>
              <p className="text-xs text-muted-foreground">Detalhe mínimo (nome, situação, data). A consulta foi registrada.</p>
              {drill.rows.length === 0 ? <p className="text-xs">Nenhum registro.</p> : <ul>{drill.rows.map((x, i) => <li key={i}>{x.student_name ?? "Estudante sem nome registrado"} — {x.situation}{x.ref_date ? ` · ${x.ref_date.split("-").reverse().join("/")}` : ""}</li>)}</ul>}
            </section>
          ) : null}
          {agg.length ? (
            <section className="space-y-1 text-sm"><h2 className="font-semibold">Agregado da rede (entrega ao CIECE)</h2>
              <p className="text-xs text-muted-foreground">Só totais da rede, sem escola nem pessoa; contagens de 1 a 4 são suprimidas.</p>
              <ul>{agg.map((a) => <li key={a.indicator}>{a.indicator}: {a.suppressed ? "suprimido (menos de 5)" : a.value}</li>)}</ul></section>
          ) : null}
        </>
      )}
    </div>
  );
}
