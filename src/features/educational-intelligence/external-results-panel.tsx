import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { EXT_PROGRAMS, EXT_REPORT, extReportRows, historicalSeries, participationRate, validateExtResult, type ExtProgram, type ExtResult } from "./external-results";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const save = (b: Blob, n: string) => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); };

export function ExternalResultsPanel() {
  const [rows, setRows] = useState<ExtResult[] | { error: string } | null>(null);
  const [names, setNames] = useState(new Map<string, string>());
  const [program, setProgram] = useState<ExtProgram>("saeb");
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ year: "2025", stage: "", area: "LP", scope: "rede", school: "", sample: "censitaria", scale: "saeb-", matrix: "", expected: "", present: "", prof: "", p: "", n: "", ideb: "", target: "", source: "" });

  const load = useCallback(async () => {
    const [a, h] = await Promise.all([supabase.from("ext_result_versions").select("*").limit(1000), supabase.from("ext_result_homologations").select("*").order("recorded_at").limit(1000)]);
    const err = a.error ?? h.error;
    if (err) { setRows({ error: governError(err).userMessage }); return; }
    const last = new Map<string, string>(); for (const x of (h.data ?? []) as { result_version_id: string; decision: string }[]) last.set(x.result_version_id, x.decision);
    setRows(((a.data ?? []) as unknown as ExtResult[]).map((r) => ({ ...r, homologated: last.get(r.id) === "homologado" })));
    try { setNames(await readCurrentSchoolNames()); } catch { /* nomes indisponíveis: mostra código */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => Array.isArray(rows) ? rows.filter((r) => r.program_key === program).sort((a, b) => a.edition_year - b.edition_year) : [], [rows, program]);
  const base = list.find((r) => r.id === sel) ?? null;
  const series = useMemo(() => base && Array.isArray(rows) ? historicalSeries(rows, base) : null, [rows, base]);

  if (rows == null) return <SkeletonState label="Carregando avaliações externas" />;
  if (!Array.isArray(rows)) return <StatePanel tone="danger" title="Não foi possível ler" description={rows.error} />;

  const input = { program_key: program, edition_year: Number(f.year), stage: f.stage, area: f.area, scope: f.scope as "rede" | "escola", school_id: f.scope === "escola" ? f.school.trim() : null,
    sample_kind: f.sample as "censitaria" | "amostral", scale_key: program === "ideb" ? "ideb-inep" : f.scale, matrix_ref: f.matrix, expected_count: num(f.expected), present_count: num(f.present),
    proficiency: num(f.prof), levels: null, flow_p: num(f.p), perf_n: num(f.n), ideb: num(f.ideb), target: num(f.target), source_ref: f.source };
  const problems = validateExtResult(input);
  const submit = async () => {
    const { error } = await rpc("ext_record_result", { _logical: null, _expected_version: 0, _program: program, _year: input.edition_year, _stage: f.stage, _area: f.area, _scope: f.scope, _school: input.school_id,
      _sample: f.sample, _scale: input.scale_key, _matrix: f.matrix, _expected: input.expected_count, _present: input.present_count, _proficiency: input.proficiency, _levels: null,
      _flow_p: input.flow_p, _perf_n: input.perf_n, _ideb: input.ideb, _target: input.target, _source: f.source, _source_hash: null, _reason: null });
    setMsg(error ? governError(error).userMessage : "Resultado registrado; aguarda homologação por outra pessoa."); if (!error) void load();
  };
  const homologate = async (id: string) => {
    const { error } = await rpc("ext_homologate_result", { _version: id, _decision: "homologado", _reason: "Conferido com a fonte oficial" });
    setMsg(error ? governError(error).userMessage : "Homologado."); if (!error) void load();
  };
  const exportAs = async (fmt: "pdf" | "xlsx") => {
    const res = runReport(EXT_REPORT, { params: {} }, extReportRows(list.filter((r) => r.homologated), names));
    const branding = { headerLines: ["Secretaria Municipal de Educação", "Acompanhamento e Avaliação"], title: `${EXT_REPORT.title} — ${EXT_PROGRAMS[program].label}` };
    const meta = [`Gerado em ${new Date().toLocaleString("pt-BR")}`, "Somente resultados homologados. Ausência = não disponível, nunca zero."];
    if (fmt === "xlsx") save(new Blob([await toXlsx(res, branding, meta)]), `avaliacoes-externas-${program}.xlsx`);
    else save(await toPdfFile(res, branding, meta, { landscape: true, signatures: ["Coordenação de Acompanhamento e Avaliação"] }), `avaliacoes-externas-${program}.pdf`);
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const chart = series?.included.map((r) => ({ ano: r.edition_year, valor: r.program_key === "ideb" ? r.ideb : r.proficiency })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">Programa <select className={field} value={program} onChange={(e) => { setProgram(e.target.value as ExtProgram); setSel(""); setF({ ...f, scale: EXT_PROGRAMS[e.target.value as ExtProgram].scalePrefix }); }}>
          {Object.entries(EXT_PROGRAMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <Button size="sm" variant="outline" onClick={() => void exportAs("pdf")}>PDF institucional</Button>
        <Button size="sm" variant="outline" onClick={() => void exportAs("xlsx")}>XLSX</Button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {list.length === 0 ? <StatePanel title="Nenhum resultado oficial registrado" description="Os resultados só aparecem depois de registrados a partir da fonte oficial (INEP, SEEDUC/AVALIA RJ, CAEd)." /> : (
        <table className="w-full text-sm"><caption className="sr-only">Resultados de {EXT_PROGRAMS[program].label}</caption>
          <thead><tr>{["Edição", "Etapa", "Área", "Unidade", "Escala", "Matriz", "Amostra", "Participação", "Valor", "Meta", "Situação", ""].map((h) => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
          <tbody>{list.map((r) => { const pr = participationRate(r); return (
            <tr key={r.id} className={r.id === sel ? "bg-muted" : ""}>
              <td>{r.edition_year} v{r.version}</td><td>{r.stage}</td><td>{r.area}</td><td>{r.school_id ? names.get(r.school_id) ?? r.school_id : "Rede"}</td>
              <td>{r.scale_key}</td><td>{r.matrix_ref}</td><td>{r.sample_kind}</td><td>{pr == null ? "não disponível" : `${(pr * 100).toFixed(1)}%`}</td>
              <td>{(r.program_key === "ideb" ? r.ideb : r.proficiency) ?? "não disponível"}{r.program_key === "ideb" && r.flow_p != null ? ` (N ${r.perf_n} × P ${r.flow_p})` : ""}</td>
              <td>{r.target ?? "—"}</td><td>{r.homologated ? "Homologado" : "Aguardando homologação"}</td>
              <td className="space-x-1"><Button size="sm" variant="ghost" onClick={() => setSel(r.id)}>Série</Button>{!r.homologated && <Button size="sm" variant="ghost" onClick={() => void homologate(r.id)}>Homologar</Button>}</td>
            </tr>); })}</tbody></table>)}
      {series && (
        <section aria-label="Série histórica" className="space-y-2">
          <h3 className="font-medium">Série histórica comparável</h3>
          {chart.length > 1 ? <div className="h-56"><ResponsiveContainer><LineChart data={chart}><XAxis dataKey="ano" /><YAxis /><Tooltip /><Line dataKey="valor" stroke="hsl(var(--primary))" /></LineChart></ResponsiveContainer></div>
            : <p className="text-sm text-muted-foreground">Menos de duas edições comparáveis homologadas.</p>}
          <table className="text-sm"><caption className="sr-only">Tabela equivalente ao gráfico</caption><thead><tr><th scope="col">Edição</th><th scope="col">Valor</th></tr></thead>
            <tbody>{chart.map((c) => <tr key={c.ano}><td>{c.ano}</td><td>{c.valor ?? "não disponível"}</td></tr>)}</tbody></table>
          {series.excluded.length > 0 && <ul className="text-sm text-muted-foreground">{series.excluded.map((x) => <li key={x.row.id}>{x.row.edition_year}: fora da série — {humanizeForScreen(x.reason)}</li>)}</ul>}
        </section>)}
      <details><summary className="cursor-pointer text-sm font-medium">Registrar resultado oficial</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {([["year", "Edição (ano)"], ["stage", "Etapa"], ["area", "Área"], ["school", "Escola (código, se escopo escola)"], ["scale", "Escala oficial"], ["matrix", "Matriz"], ["expected", "Previstos"], ["present", "Participantes"],
            ...(program === "ideb" ? [["n", "N (desempenho)"], ["p", "P (fluxo)"], ["ideb", "IDEB"]] : [["prof", "Proficiência (TRI/escala oficial)"]]), ["target", "Meta"], ["source", "Fonte (documento oficial)"]] as [keyof typeof f, string][])
            .map(([k, l]) => <label key={k} className="text-xs">{l}<input className={`${field} w-full`} value={f[k]} disabled={k === "scale" && program === "ideb"} onChange={set(k)} /></label>)}
          <label className="text-xs">Escopo<select className={`${field} w-full`} value={f.scope} onChange={set("scope")}><option value="rede">Rede</option><option value="escola">Escola</option></select></label>
          <label className="text-xs">Amostra<select className={`${field} w-full`} value={f.sample} onChange={set("sample")}><option value="censitaria">Censitária</option><option value="amostral">Amostral</option></select></label>
        </div>
        {problems.length > 0 && <ul className="mt-2 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button size="sm" className="mt-2" disabled={problems.length > 0} onClick={() => void submit()}>Registrar</Button>
      </details>
    </div>
  );
}
