import { operationalToday } from "@/lib/academic-date";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { governError } from "@/lib/observability/governed-errors";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/features/authority/session-authority";
import { toCsv, toPrintableHtml, toXlsx, cellText, type CellValue, type ReportResult } from "./report-engine";
import { BUILDER_SOURCES, sourceById } from "./builder-sources";
import { loadCloudTemplates, newIdempotencyKey, saveCloudTemplate, SHARE_DISABLED_REASON, SHARE_WITH_SECTOR_CAPABILITY } from "./report-templates-cloud";
import { SECTOR_LABEL, buildResult, collectAll, columnsOf, loadTemplates, previewSlice, provenance, saveTemplate, validateChoice, type BuilderChoice, type Collected, type SavedTemplate, type Sector } from "./report-builder";

const sel = "w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm";
const STEPS = ["Assunto", "Filtros", "Colunas", "Prévia", "Exportar"] as const;
const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];

function save(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

async function schoolNames(): Promise<Map<string, string>> {
  const r = await supabase.from("institutional_school_record_versions").select("school_id, official_name, version_number");
  const m = new Map<string, { n: string; v: number }>();
  for (const x of r.data ?? []) if (!m.has(x.school_id) || m.get(x.school_id)!.v < x.version_number) m.set(x.school_id, { n: x.official_name, v: x.version_number });
  return new Map([...m].map(([k, o]) => [k, o.n]));
}

export function ReportBuilder() {
  const { user } = useSessionUser();
  const account = user?.id ?? "anon";
  const [sector, setSector] = useState<Sector>("secretaria");
  const [step, setStep] = useState(0);
  const sources = BUILDER_SOURCES.filter((s) => s.sectors.includes(sector));
  const [choice, setChoice] = useState<BuilderChoice>({ sourceId: "", from: null, to: null, columns: [], filters: [], sort: [] });
  const src = sourceById(choice.sourceId);
  const [data, setData] = useState<Collected | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const cloud = !!user;
  const pendingKey = useRef<string | null>(null);
  const refreshTemplates = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!cloud) { setTemplates(loadTemplates(window.localStorage, account, sector, BUILDER_SOURCES)); return; }
    try { setTemplates(await loadCloudTemplates(sector, BUILDER_SOURCES)); } catch (e) { setTemplates([]); setErr(governError(e).userMessage); }
  }, [cloud, account, sector]);
  useEffect(() => { void refreshTemplates(); }, [refreshTemplates]);

  const result: ReportResult | null = useMemo(() => {
    if (!src || !data) return null;
    try { return buildResult(src, choice, data.rows); } catch { return null; }
  }, [src, data, choice]);
  const errors = src ? validateChoice(src, choice) : ["Escolha um assunto."];

  function pick(id: string) {
    const s = sourceById(id); setData(null); setErr(null);
    setChoice({ sourceId: id, from: null, to: null, columns: s ? columnsOf(s).map((c) => c.id) : [], filters: [], sort: [] });
  }
  async function read() {
    if (!src || busy) return; setBusy(true); setErr(null);
    try {
      let col = await collectAll(src, choice.from, choice.to);
      if (src.id.startsWith("nae-")) { const n = await schoolNames(); col = { ...col, rows: col.rows.map((r) => ({ ...r, school: n.get(String(r["school"])) ?? "Escola" })) }; }
      setData(col); setStep(3);
    } catch (e) { setErr(src.period && (!choice.from || !choice.to) && src.id.startsWith("nae-") ? "Informe o período (de e até)." : governError(e).userMessage); }
    finally { setBusy(false); }
  }
  async function exportAs(fmt: "csv" | "xlsx" | "pdf") {
    if (!src || !result || !data) return;
    const branding = { headerLines: ["SIGEM — Gerador de relatórios"], title: src.title };
    const meta = provenance(src, choice, data, SECTOR_LABEL[sector]);
    const base = `${src.definition.id}-${operationalToday()}`;
    if (fmt === "csv") save(`${base}.csv`, new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
    else if (fmt === "xlsx") save(`${base}.xlsx`, new Blob([await toXlsx(result, branding, meta)]));
    else { const w = window.open("", "_blank"); if (w) { w.document.write(toPrintableHtml(result, branding, meta)); w.document.close(); w.print(); } }
  }
  async function storeTemplate() {
    if (!src || !src.sectors.includes(sector) || errors.length) { setErr("Este modelo não pode ser salvo para o setor escolhido."); return; }
    const t = { name: tplName, sector, choice, savedAt: new Date().toISOString() };
    if (!cloud) { try { setTemplates(saveTemplate(window.localStorage, account, t, BUILDER_SOURCES)); setTplName(""); setErr(null); } catch (e) { setErr((e as Error).message); } return; }
    pendingKey.current ??= newIdempotencyKey();
    try { await saveCloudTemplate(t, BUILDER_SOURCES, pendingKey.current); pendingKey.current = null; setTplName(""); setErr(null); await refreshTemplates(); }
    catch (e) { setErr(e instanceof Error && !("code" in e) ? e.message : governError(e).userMessage); }
  }
  async function archiveTemplate(t: SavedTemplate) {
    if (!cloud) return;
    try { await saveCloudTemplate(t, BUILDER_SOURCES, newIdempotencyKey(), true); await refreshTemplates(); } catch (e) { setErr(governError(e).userMessage); }
  }

  const textCols = src ? columnsOf(src).filter((c) => src.filterable.includes(c.id)) : [];
  const distinct = (id: string) => [...new Set((data?.rows ?? []).map((r) => r[id] ?? null))].filter((x): x is string | number => x !== null).slice(0, 200);

  return (
    <section aria-label="Gerador de relatórios" className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Montar um relatório</h2>
          <p className="text-sm text-muted-foreground">Você só vê e exporta o que sua conta já pode ler na tela de origem.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">Setor
          <select className={sel} value={sector} onChange={(e) => { setSector(e.target.value as Sector); pick(""); setStep(0); }}>{SECTORS.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s]}</option>)}</select>
        </label>
      </div>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
        {STEPS.map((s, i) => <li key={s}><button type="button" aria-current={i === step ? "step" : undefined} disabled={i > 0 && !src || (i >= 3 && !data)} onClick={() => setStep(i)} className={`rounded px-2 py-1 ${i === step ? "bg-primary text-primary-foreground" : "border border-border"} disabled:opacity-50`}>{i + 1}. {s}</button></li>)}
      </ol>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

      {step === 0 && (
        <div className="space-y-3">
          {templates.length > 0 && <div className="text-sm"><p className="font-medium">Modelos salvos deste setor</p>
            <ul className="flex flex-wrap gap-2">{templates.map((t) => <li key={t.name}><Button variant="outline" size="sm" onClick={() => { setChoice(t.choice); setData(null); setStep(1); }}>{t.name}</Button></li>)}</ul></div>}
          <ul className="grid gap-2 md:grid-cols-2">
            {sources.map((s) => <li key={s.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{s.title}</p>
              {s.unavailable ? <p className="text-muted-foreground">Indisponível: {s.unavailable}</p>
                : <><p className="text-muted-foreground">{s.methodology}</p><Button size="sm" className="mt-2" onClick={() => { pick(s.id); setStep(1); }}>Escolher</Button></>}
            </li>)}
            {sources.length === 0 && <li className="text-sm text-muted-foreground">Ainda não há assunto com dados disponíveis para este setor.</li>}
          </ul>
        </div>)}

      {step === 1 && src && (
        <div className="space-y-3 text-sm">
          {src.period && <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">De<DateInput className={sel} value={choice.from ?? ""} onChange={(e) => setChoice({ ...choice, from: e.target.value || null })} /></label>
            <label className="flex flex-col gap-1">Até<DateInput className={sel} value={choice.to ?? ""} onChange={(e) => setChoice({ ...choice, to: e.target.value || null })} /></label>
          </div>}
          {data && textCols.length > 0 && <div className="flex flex-wrap gap-3">{textCols.map((c) => {
            const cur = choice.filters.find((f) => f.column === c.id);
            return <label key={c.id} className="flex flex-col gap-1">{c.label}
              <select className={sel} value={cur ? String(cur.equals) : ""} onChange={(e) => setChoice({ ...choice, filters: [...choice.filters.filter((f) => f.column !== c.id), ...(e.target.value ? [{ column: c.id, equals: e.target.value as CellValue }] : [])] })}>
                <option value="">Todos</option>{distinct(c.id).map((x) => <option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label>; })}</div>}
          {!data && textCols.length > 0 && <p className="text-muted-foreground">Os filtros por valor aparecem depois da primeira leitura.</p>}
          <Button onClick={() => setStep(2)}>Próximo: colunas</Button>
        </div>)}

      {step === 2 && src && (
        <div className="space-y-3 text-sm">
          <fieldset className="flex flex-wrap gap-3"><legend className="mb-1 font-medium">Colunas</legend>
            {columnsOf(src).map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={choice.columns.includes(c.id)} onChange={(e) => setChoice({ ...choice, columns: e.target.checked ? src.definition.columns.map((x) => x.id).filter((id) => id === c.id || choice.columns.includes(id)) : choice.columns.filter((x) => x !== c.id) })} />{c.label}</label>)}
          </fieldset>
          <label className="flex max-w-xs flex-col gap-1">Ordenar por
            <select className={sel} value={choice.sort[0]?.column ?? ""} onChange={(e) => setChoice({ ...choice, sort: e.target.value ? [{ column: e.target.value, dir: "asc" }] : [] })}><option value="">Ordem da fonte</option>{columnsOf(src).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          {errors.length > 0 && <ul className="text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <Button disabled={busy || errors.length > 0} onClick={read}>{busy ? "Lendo todas as páginas…" : "Ver prévia"}</Button>
        </div>)}

      {step === 3 && result && data && (
        <div className="space-y-2 text-sm">
          <p role="status">{result.rows.length} linha(s) após filtros · {data.rows.length} lidas em {data.pages} página(s){data.truncated ? " · INCOMPLETO: limite de linhas atingido; restrinja o período" : ""}. Prévia das 20 primeiras.</p>
          <div className="max-h-[60dvh] overflow-auto" role="region" aria-label="Prévia do relatório" tabIndex={0}><table className="w-full text-left text-xs">
            <caption className="sr-only">Prévia do relatório</caption>
            <thead className="sticky top-0 bg-muted"><tr>{result.columns.map((c) => <th key={c.id} scope="col" className="border-b p-1">{c.label}</th>)}</tr></thead>
            <tbody>{previewSlice(result).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className="border-b p-1">{cellText(x)}</td>)}</tr>)}</tbody>
          </table></div>
          {result.rows.length === 0 && <p className="text-muted-foreground">Nenhuma linha visível à sua conta com esses filtros.</p>}
          <Button onClick={() => setStep(4)}>Próximo: exportar</Button>
        </div>)}

      {step === 4 && result && data && src && (
        <div className="space-y-3 text-sm">
          <ul className="list-disc pl-5 text-muted-foreground">{provenance(src, choice, data, SECTOR_LABEL[sector]).map((l) => <li key={l}>{l}</li>)}</ul>
          <div className="flex flex-wrap gap-2">
            <Button disabled={result.rows.length === 0} onClick={() => exportAs("pdf")}>PDF</Button>
            <Button variant="outline" disabled={result.rows.length === 0} onClick={() => exportAs("xlsx")}>XLSX</Button>
            <Button variant="outline" disabled={result.rows.length === 0} onClick={() => exportAs("csv")}>CSV</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">Salvar como modelo do setor<input className={sel} value={tplName} maxLength={80} onChange={(e) => setTplName(e.target.value)} placeholder="Nome do modelo" /></label>
            <Button variant="outline" disabled={!tplName.trim()} onClick={storeTemplate}>Salvar modelo</Button>
          </div>
          <p className="text-xs text-muted-foreground">O modelo guarda só as escolhas (assunto, período, colunas, filtros){cloud ? ", na sua conta — vale em qualquer navegador e só você vê" : ", neste navegador (sem login)"}. Os dados são lidos de novo, com o seu acesso, toda vez.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="outline" size="sm" disabled={!SHARE_WITH_SECTOR_CAPABILITY} aria-describedby="share-reason">Compartilhar com o setor</Button>
            <span id="share-reason" className="text-muted-foreground">{SHARE_DISABLED_REASON}</span>
          </div>
          {cloud && templates.length > 0 && <ul className="text-xs">{templates.map((t) => <li key={t.name} className="flex items-center gap-2">{t.name}<Button variant="ghost" size="sm" onClick={() => archiveTemplate(t)}>Arquivar</Button></li>)}</ul>}
        </div>)}
    </section>
  );
}
