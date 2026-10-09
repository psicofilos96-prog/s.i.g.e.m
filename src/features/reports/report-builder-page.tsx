import { operationalToday } from "@/lib/academic-date";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { governError } from "@/lib/observability/governed-errors";
import { useSessionUser } from "@/features/authority/session-authority";
import { toCsv, cellText, type CellValue, type ReportResult } from "./report-engine";
import { BUILDER_SOURCES, sourceById } from "./builder-sources";
import {
  INSTITUTIONAL_DISABLED_REASON, INSTITUTIONAL_TEMPLATE_CAPABILITY, SHARE_DISABLED_REASON, SHARE_WITH_SECTOR_CAPABILITY,
  deleteCloudTemplate, duplicateCloudTemplate, favoriteCloudTemplate, isFavorite, loadCloudTemplates, newIdempotencyKey, renameCloudTemplate, saveCloudTemplate,
  type CloudTemplate,
} from "./report-templates-cloud";
import { SECTOR_LABEL, buildResult, collectAll, columnsOf, provenance, validateChoice, type BuilderChoice, type Collected, type Sector } from "./report-builder";
import { AGGREGATIONS, CHART_KINDS, DERIVED, previewNotice, REPORT_VERIFICATION_ENDPOINT, type Aggregation, type ChartKind, type Derived, type Organization, type ReportLayout } from "./report-analytics";
import { PACK_SECTOR_LABEL, SECTOR_PACKS, packsFor, type PackSector } from "./sector-packs";
import { analyze, chartSvg, emptySpec, openPack, packDescription, specOf, svgDataUri, toStudioHtml, toStudioXlsx, withSpec, type StudioSpec } from "./report-studio";

const sel = "w-full min-w-0 min-h-9 pointer-coarse:min-h-11 rounded-md border border-input bg-background px-2 py-1 text-sm";
export const BUILDER_STEPS = ["Assunto", "Filtros", "Colunas", "Agrupamentos", "Cálculos", "Gráficos", "Layout", "Prévia", "Salvar", "Exportar"] as const;
const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];
const AGG_LABEL: Record<Aggregation, string> = { count: "Contagem", distinct: "Distintos", sum: "Soma", avg: "Média", min: "Mínimo", max: "Máximo" };
const DER_LABEL: Record<Derived, string> = { percentual: "Percentual (a / b)", diferenca: "Diferença (a − b)", variacao: "Variação % ((a − b) / b)", razao: "Razão (a / b)" };
const CHART_LABEL: Record<ChartKind, string> = { barras: "Barras", "barras-horizontais": "Barras horizontais", "barras-empilhadas": "Barras empilhadas", linha: "Linha", area: "Área", donut: "Rosca (composição)", dispersao: "Dispersão", ranking: "Ranking (descritivo)" };
const emptyOrg = (): Organization => ({ groupBy: [], measures: [{ id: "n", label: "Quantidade", agg: "count", column: null }], derived: [], sort: [], subtotals: false, grandTotal: true });

function save(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export function ReportBuilder() {
  const { user } = useSessionUser();
  const cloud = !!user;
  const [sector, setSector] = useState<Sector>("secretaria");
  const [step, setStep] = useState(0);
  const sources = BUILDER_SOURCES.filter((s) => s.sectors.includes(sector));
  const [choice, setChoice] = useState<BuilderChoice>({ sourceId: "", from: null, to: null, columns: [], filters: [], sort: [] });
  const [spec, setSpec] = useState<StudioSpec>(emptySpec());
  const src = sourceById(choice.sourceId);
  const [data, setData] = useState<Collected | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [loadedTpl, setLoadedTpl] = useState<string | null>(null);
  const [packSector, setPackSector] = useState<PackSector>("secretaria");
  const pendingKey = useRef<string | null>(null);
  const readSeq = useRef(0);

  const refreshTemplates = useCallback(async () => {
    if (!cloud) { setTemplates([]); return; }
    try { setTemplates(await loadCloudTemplates(sector, BUILDER_SOURCES)); } catch (e) { setTemplates([]); setErr(governError(e).userMessage); }
  }, [cloud, sector]);
  useEffect(() => { void refreshTemplates(); }, [refreshTemplates]);

  const result: ReportResult | null = useMemo(() => {
    if (!src || !data) return null;
    try { return buildResult(src, choice, data.rows); } catch { return null; }
  }, [src, data, choice]);
  const analysis = useMemo(() => (result && src ? analyze(result, spec, src.definition.source) : null), [result, spec, src]);
  const errors = src ? validateChoice(src, choice) : ["Escolha um assunto."];
  const org = spec.organization ?? emptyOrg();
  const setOrg = (o: Organization) => setSpec({ ...spec, organization: o });
  const setLayout = (l: Partial<ReportLayout>) => setSpec({ ...spec, layout: { ...spec.layout, ...l } });
  const cols = src ? columnsOf(src).filter((c) => choice.columns.includes(c.id)) : [];
  const numCols = cols.filter((c) => c.kind === "number");
  const valueIds = [...org.measures.map((m) => ({ id: m.id, label: m.label })), ...org.derived.map((d) => ({ id: d.id, label: d.label }))];

  function pick(id: string, keep?: { choice: BuilderChoice; spec: StudioSpec }) {
    const s = sourceById(id); setData(null); setErr(null); setLoadedTpl(null);
    if (keep) { setChoice(keep.choice); setSpec(keep.spec); return; }
    setChoice({ sourceId: id, from: null, to: null, columns: s ? columnsOf(s).map((c) => c.id) : [], filters: [], sort: [] });
    setSpec(emptySpec(s?.title ?? ""));
  }
  function openPackById(id: string) {
    const p = SECTOR_PACKS.find((x) => x.id === id); if (!p) return;
    try {
      const opened = openPack(p);
      const s = sourceById(opened.choice.sourceId);
      if (s && !s.sectors.includes(sector)) setSector(s.sectors[0]!);
      pick(opened.choice.sourceId, opened); setStep(1);
    } catch (e) { setErr(governError(e).userMessage); }
  }
  async function read() {
    if (!src || busy) return;
    const seq = ++readSeq.current; setBusy(true); setErr(null);
    try {
      let col = await collectAll(src, choice.from, choice.to);
      const sc = src.schoolIdColumn ?? (src.id.startsWith("nae-") ? "school" : null);
      if (sc) {
        const n = await readCurrentSchoolNames().catch(() => new Map<string, string>());
        col = { ...col, rows: col.rows.map((r) => ({ ...r, [sc]: r[sc] === null ? null : n.get(String(r[sc])) ?? "Escola sem nome visível" })) };
      }
      if (seq === readSeq.current) setData(col);
    } catch (e) { if (seq === readSeq.current) setErr(src.period && (!choice.from || !choice.to) && src.id.startsWith("nae-") ? "Informe o período (de e até)." : governError(e).userMessage); }
    finally { if (seq === readSeq.current) setBusy(false); }
  }
  const methodology = () => src ? [`Assunto: ${src.title} (v${src.definition.version})`, `Fonte: ${src.definition.source}`, `Metodologia: ${src.methodology}`, `Acesso: ${src.acl}`, ...(analysis?.chart ? [analysis.chart.methodology] : [])] : [];
  async function exportAs(fmt: "csv" | "xlsx" | "pdf") {
    if (!src || !result || !data || !analysis) return;
    if (data.truncated) { setErr("Leitura incompleta (limite de linhas atingido): restrinja o período antes de exportar."); return; }
    const meta = provenance(src, choice, data, SECTOR_LABEL[sector]);
    const base = `${src.definition.id}-${operationalToday()}`;
    if (fmt === "csv") save(`${base}.csv`, new Blob([toCsv(result, { headerLines: spec.layout.headerLines, title: spec.layout.title || src.title }, meta)], { type: "text/csv;charset=utf-8" }));
    else if (fmt === "xlsx") save(`${base}.xlsx`, new Blob([await toStudioXlsx(result, spec, meta, analysis, methodology())]));
    else { const w = window.open("", "_blank"); if (w) { w.document.write(toStudioHtml(result, spec, meta, analysis, methodology())); w.document.close(); w.focus(); w.print(); } else setErr("O navegador bloqueou a janela de impressão; permita janelas para este site."); }
  }
  async function act(f: () => Promise<unknown>) { try { await f(); setErr(null); await refreshTemplates(); } catch (e) { setErr(governError(e).userMessage); } }
  async function storeTemplate() {
    if (!src || !src.sectors.includes(sector) || errors.length) { setErr("Este modelo não pode ser salvo para o setor escolhido."); return; }
    pendingKey.current ??= newIdempotencyKey();
    const t = { name: tplName, sector, choice: withSpec(choice, spec), savedAt: new Date().toISOString() };
    await act(async () => { await saveCloudTemplate(t, BUILDER_SOURCES, pendingKey.current!); pendingKey.current = null; setLoadedTpl(tplName.trim()); });
  }
  const sortedTpl = [...templates].sort((a, b) => Number(isFavorite(b)) - Number(isFavorite(a)) || a.name.localeCompare(b.name, "pt-BR"));
  const canOpen = (i: number) => i === 0 || (!!src && (i < 7 || errors.length === 0));

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
        {BUILDER_STEPS.map((s, i) => <li key={s}><button type="button" aria-current={i === step ? "step" : undefined} disabled={!canOpen(i)} onClick={() => { setStep(i); if (i === 7 && !data) void read(); }} className={`min-h-9 rounded px-2 py-1 pointer-coarse:min-h-11 ${i === step ? "bg-primary text-primary-foreground" : "border border-border"} disabled:opacity-50`}>{i + 1}. {s}</button></li>)}
      </ol>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {src && step > 0 && <p className="text-xs text-muted-foreground">Assunto: <strong>{src.title}</strong>{spec.fromPack ? ` · aberto do pacote "${SECTOR_PACKS.find((p) => p.id === spec.fromPack)?.title}" (cópia; o pacote original não muda)` : ""}{loadedTpl ? ` · modelo "${loadedTpl}"` : ""}</p>}

      {step === 0 && (
        <div className="space-y-4">
          {cloud && sortedTpl.length > 0 && <div className="text-sm"><p className="font-medium">Seus modelos deste setor</p>
            <ul className="flex flex-wrap gap-2">{sortedTpl.map((t) => <li key={t.name}><Button variant="outline" size="sm" onClick={() => { pick(t.choice.sourceId, { choice: t.choice, spec: specOf(t.choice, t.name) }); setLoadedTpl(t.name); setTplName(t.name); setStep(1); }}>{isFavorite(t) ? "★ " : ""}{t.name} · v{t.version}</Button></li>)}</ul></div>}
          <div>
            <p className="mb-2 text-sm font-medium">Assuntos</p>
            <ul className="grid gap-2 md:grid-cols-2">
              {sources.map((s) => <li key={s.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{s.title}</p>
                {s.unavailable ? <p className="text-muted-foreground">Indisponível: {s.unavailable}</p>
                  : <><p className="text-muted-foreground">{s.methodology}</p><Button size="sm" className="mt-2" onClick={() => { pick(s.id); setStep(1); }}>Escolher</Button></>}
              </li>)}
              {sources.length === 0 && <li className="text-sm text-muted-foreground">Ainda não há assunto com dados disponíveis para este setor.</li>}
            </ul>
          </div>
          <PacksPanel sector={packSector} onSector={setPackSector} onOpen={openPackById} />
        </div>)}

      {step === 1 && src && (
        <div className="space-y-3 text-sm">
          {src.period && <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">De<DateInput className={sel} value={choice.from ?? ""} onChange={(e) => { setChoice({ ...choice, from: e.target.value || null }); setData(null); }} /></label>
            <label className="flex flex-col gap-1">Até<DateInput className={sel} value={choice.to ?? ""} onChange={(e) => { setChoice({ ...choice, to: e.target.value || null }); setData(null); }} /></label>
          </div>}
          <FilterValues src={src} choice={choice} data={data} onChange={setChoice} />
          {!data && src.filterable.length > 0 && <Button variant="outline" disabled={busy} onClick={read}>{busy ? "Lendo todas as páginas…" : "Ler dados para filtrar por valor"}</Button>}
          <div><Button onClick={() => setStep(2)}>Próximo: colunas</Button></div>
        </div>)}

      {step === 2 && src && (
        <div className="space-y-3 text-sm">
          <fieldset className="flex flex-wrap gap-3"><legend className="mb-1 font-medium">Colunas</legend>
            {columnsOf(src).map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={choice.columns.includes(c.id)} onChange={(e) => setChoice({ ...choice, columns: e.target.checked ? src.definition.columns.map((x) => x.id).filter((id) => id === c.id || choice.columns.includes(id)) : choice.columns.filter((x) => x !== c.id) })} />{c.label}</label>)}
          </fieldset>
          <label className="flex max-w-xs flex-col gap-1">Ordenar linhas por
            <select className={sel} value={choice.sort[0]?.column ?? ""} onChange={(e) => setChoice({ ...choice, sort: e.target.value ? [{ column: e.target.value, dir: choice.sort[0]?.dir ?? "asc" }] : [] })}><option value="">Ordem da fonte</option>{columnsOf(src).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          {choice.sort[0] && <label className="flex max-w-xs flex-col gap-1">Direção<select className={sel} value={choice.sort[0].dir} onChange={(e) => setChoice({ ...choice, sort: [{ column: choice.sort[0]!.column, dir: e.target.value as "asc" | "desc" }] })}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label>}
          {errors.length > 0 && <ul className="text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <Button disabled={errors.length > 0} onClick={() => setStep(3)}>Próximo: agrupamentos</Button>
        </div>)}

      {step === 3 && src && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Até 4 níveis. Sem agrupamento, o relatório sai só como lista.</p>
          {[0, 1, 2, 3].map((lvl) => (lvl === 0 || org.groupBy[lvl - 1]) && <label key={lvl} className="flex max-w-xs flex-col gap-1">Nível {lvl + 1}
            <select className={sel} value={org.groupBy[lvl] ?? ""} onChange={(e) => { const g = org.groupBy.slice(0, lvl); if (e.target.value) g.push(e.target.value); setOrg({ ...org, groupBy: g, subtotals: g.length > 1 && org.subtotals }); }}>
              <option value="">— nenhum —</option>{cols.filter((c) => !org.groupBy.slice(0, lvl).includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>)}
          <label className="flex items-center gap-2"><input type="checkbox" checked={org.subtotals} disabled={org.groupBy.length < 2} onChange={(e) => setOrg({ ...org, subtotals: e.target.checked })} />Subtotais por nível</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={org.grandTotal} onChange={(e) => setOrg({ ...org, grandTotal: e.target.checked })} />Total geral</label>
          {org.groupBy.length === 2 && <p className="text-xs text-muted-foreground">Com 2 níveis a prévia também mostra a tabela cruzada (pivot) da primeira medida.</p>}
          <Button onClick={() => setStep(4)}>Próximo: cálculos</Button>
        </div>)}

      {step === 4 && src && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Cálculos só da lista fechada. Ausência nunca vira zero: é contada à parte.</p>
          <ul className="space-y-2">{org.measures.map((m, i) => <li key={m.id} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">Nome<input className={sel} value={m.label} maxLength={60} onChange={(e) => setOrg({ ...org, measures: org.measures.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /></label>
            <label className="flex flex-col gap-1">Cálculo<select className={sel} value={m.agg} onChange={(e) => { const agg = e.target.value as Aggregation; setOrg({ ...org, measures: org.measures.map((x, j) => j === i ? { ...x, agg, column: agg === "count" ? null : agg === "distinct" ? (x.column ?? cols[0]?.id ?? null) : (numCols.some((c) => c.id === x.column) ? x.column : numCols[0]?.id ?? null) } : x) }); }}>{AGGREGATIONS.map((a) => <option key={a} value={a} disabled={!["count", "distinct"].includes(a) && numCols.length === 0}>{AGG_LABEL[a]}</option>)}</select></label>
            {m.agg !== "count" && <label className="flex flex-col gap-1">Coluna<select className={sel} value={m.column ?? ""} onChange={(e) => setOrg({ ...org, measures: org.measures.map((x, j) => j === i ? { ...x, column: e.target.value } : x) })}>{(m.agg === "distinct" ? cols : numCols).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
            {org.measures.length > 1 && <Button variant="ghost" size="sm" onClick={() => setOrg({ ...org, measures: org.measures.filter((_, j) => j !== i), derived: org.derived.filter((d) => d.a !== m.id && d.b !== m.id) })}>Remover</Button>}
          </li>)}</ul>
          <Button variant="outline" size="sm" disabled={org.measures.length >= 8} onClick={() => { let k = org.measures.length + 1; while (org.measures.some((m) => m.id === `m${k}`)) k++; setOrg({ ...org, measures: [...org.measures, { id: `m${k}`, label: `Medida ${k}`, agg: "count", column: null }] }); }}>Adicionar medida</Button>
          <p className="pt-2 font-medium">Cálculos derivados</p>
          <ul className="space-y-2">{org.derived.map((d, i) => <li key={d.id} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">Nome<input className={sel} value={d.label} maxLength={60} onChange={(e) => setOrg({ ...org, derived: org.derived.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /></label>
            <label className="flex flex-col gap-1">Operação<select className={sel} value={d.op} onChange={(e) => setOrg({ ...org, derived: org.derived.map((x, j) => j === i ? { ...x, op: e.target.value as Derived } : x) })}>{DERIVED.map((o) => <option key={o} value={o}>{DER_LABEL[o]}</option>)}</select></label>
            <label className="flex flex-col gap-1">a<select className={sel} value={d.a} onChange={(e) => setOrg({ ...org, derived: org.derived.map((x, j) => j === i ? { ...x, a: e.target.value } : x) })}>{org.measures.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <label className="flex flex-col gap-1">b<select className={sel} value={d.b ?? ""} onChange={(e) => setOrg({ ...org, derived: org.derived.map((x, j) => j === i ? { ...x, b: e.target.value || null } : x) })}>{org.measures.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <Button variant="ghost" size="sm" onClick={() => setOrg({ ...org, derived: org.derived.filter((_, j) => j !== i) })}>Remover</Button>
          </li>)}</ul>
          <Button variant="outline" size="sm" onClick={() => setOrg({ ...org, derived: [...org.derived, { id: `d${org.derived.length + 1}`, label: `Cálculo ${org.derived.length + 1}`, op: "percentual", a: org.measures[0]!.id, b: org.measures[1]?.id ?? org.measures[0]!.id }] })}>Adicionar cálculo derivado</Button>
          <label className="flex max-w-xs flex-col gap-1 pt-2">Ordenar grupos por
            <select className={sel} value={org.sort[0] ? `${org.sort[0].key}|${org.sort[0].dir}` : ""} onChange={(e) => { const [key, dir] = e.target.value.split("|"); setOrg({ ...org, sort: key ? [{ key: key!, dir: dir as "asc" | "desc" }] : [] }); }}>
              <option value="">Nome do grupo</option>{valueIds.flatMap((v) => [<option key={v.id + "d"} value={`${v.id}|desc`}>{v.label} (maior primeiro)</option>, <option key={v.id + "a"} value={`${v.id}|asc`}>{v.label} (menor primeiro)</option>])}</select></label>
          <Button onClick={() => setStep(5)}>Próximo: gráficos</Button>
        </div>)}

      {step === 5 && src && (
        <div className="space-y-3 text-sm">
          {org.groupBy.length === 0 ? <p className="text-muted-foreground">Gráfico exige ao menos um agrupamento (etapa 4).</p> : <>
            <label className="flex max-w-xs flex-col gap-1">Tipo<select className={sel} value={spec.chart?.kind ?? ""} onChange={(e) => setSpec({ ...spec, chart: e.target.value ? { kind: e.target.value as ChartKind, category: spec.chart?.category ?? org.groupBy[0]!, series: spec.chart?.series ?? (e.target.value === "barras-empilhadas" ? org.groupBy[1] ?? null : null), measures: spec.chart?.measures.length ? spec.chart.measures : [valueIds[0]!.id], title: spec.chart?.title || spec.layout.title || src.title } : null })}><option value="">Sem gráfico</option>{CHART_KINDS.map((k) => <option key={k} value={k}>{CHART_LABEL[k]}</option>)}</select></label>
            {spec.chart && <>
              <label className="flex max-w-xs flex-col gap-1">Título do gráfico<input className={sel} value={spec.chart.title} maxLength={100} onChange={(e) => setSpec({ ...spec, chart: { ...spec.chart!, title: e.target.value } })} /></label>
              <label className="flex max-w-xs flex-col gap-1">Categoria<select className={sel} value={spec.chart.category} onChange={(e) => setSpec({ ...spec, chart: { ...spec.chart!, category: e.target.value } })}>{org.groupBy.map((g) => <option key={g} value={g}>{cols.find((c) => c.id === g)?.label ?? g}</option>)}</select></label>
              {org.groupBy.length > 1 && <label className="flex max-w-xs flex-col gap-1">Série<select className={sel} value={spec.chart.series ?? ""} onChange={(e) => setSpec({ ...spec, chart: { ...spec.chart!, series: e.target.value || null } })}><option value="">Nenhuma</option>{org.groupBy.filter((g) => g !== spec.chart!.category).map((g) => <option key={g} value={g}>{cols.find((c) => c.id === g)?.label ?? g}</option>)}</select></label>}
              <fieldset className="flex flex-wrap gap-3"><legend className="mb-1">Medidas</legend>{valueIds.map((v) => <label key={v.id} className="flex items-center gap-1"><input type="checkbox" checked={spec.chart!.measures.includes(v.id)} onChange={(e) => setSpec({ ...spec, chart: { ...spec.chart!, measures: e.target.checked ? [...spec.chart!.measures, v.id] : spec.chart!.measures.filter((x) => x !== v.id) } })} />{v.label}</label>)}</fieldset>
              <p className="text-xs text-muted-foreground">Todo gráfico sai acompanhado da tabela equivalente. Rosca só para composição até 8 fatias; linha/área só para série temporal.</p>
            </>}
          </>}
          <Button onClick={() => setStep(6)}>Próximo: layout</Button>
        </div>)}

      {step === 6 && src && (
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <label className="flex flex-col gap-1">Título<input className={sel} value={spec.layout.title} maxLength={120} onChange={(e) => setLayout({ title: e.target.value })} /></label>
          <label className="flex flex-col gap-1">Subtítulo<input className={sel} value={spec.layout.subtitle ?? ""} maxLength={160} onChange={(e) => setLayout({ subtitle: e.target.value || null })} /></label>
          <label className="flex flex-col gap-1">Papel<select className={sel} value={spec.layout.paper} onChange={(e) => setLayout({ paper: e.target.value as "A4" | "A3" })}><option>A4</option><option>A3</option></select></label>
          <label className="flex flex-col gap-1">Orientação<select className={sel} value={spec.layout.orientation} onChange={(e) => setLayout({ orientation: e.target.value as "retrato" | "paisagem" })}><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></select></label>
          <label className="flex flex-col gap-1 md:col-span-2">Cabeçalho (uma linha por linha)<textarea className={sel} rows={2} value={spec.layout.headerLines.join("\n")} onChange={(e) => setLayout({ headerLines: e.target.value.split("\n").slice(0, 4) })} /></label>
          <label className="flex flex-col gap-1">Logo (endereço https, opcional)<input className={sel} value={spec.layout.logoUrl ?? ""} onChange={(e) => setLayout({ logoUrl: e.target.value || null })} /></label>
          <label className="flex flex-col gap-1">Rodapé<input className={sel} value={spec.layout.footer ?? ""} maxLength={120} onChange={(e) => setLayout({ footer: e.target.value || null })} /></label>
          <label className="flex flex-col gap-1 md:col-span-2">Observações<textarea className={sel} rows={2} maxLength={1000} value={spec.layout.observations ?? ""} onChange={(e) => setLayout({ observations: e.target.value || null })} /></label>
          <label className="flex flex-col gap-1 md:col-span-2">Assinaturas (até 4, uma por linha)<textarea className={sel} rows={2} value={spec.layout.signatures.join("\n")} onChange={(e) => setLayout({ signatures: e.target.value.split("\n").filter((x, i, a) => x.trim() || i < a.length - 1).slice(0, 4) })} /></label>
          <div className="flex flex-wrap gap-4 md:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={spec.layout.cover} onChange={(e) => setLayout({ cover: e.target.checked })} />Capa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={spec.layout.showFilters} onChange={(e) => setLayout({ showFilters: e.target.checked })} />Mostrar filtros</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={spec.layout.showMethodology} onChange={(e) => setLayout({ showMethodology: e.target.checked })} />Mostrar metodologia</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={spec.layout.pageNumbers} onChange={(e) => setLayout({ pageNumbers: e.target.checked })} />Numerar páginas</label>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">{REPORT_VERIFICATION_ENDPOINT ? "" : "QR de verificação não é oferecido: ainda não existe endereço público de verificação de relatório."}</p>
          <div className="md:col-span-2"><Button onClick={() => { setStep(7); if (!data) void read(); }}>Próximo: prévia</Button></div>
        </div>)}

      {step === 7 && src && (
        <div className="space-y-3 text-sm">
          {busy && <p role="status">Lendo todas as páginas com o seu acesso…</p>}
          {!busy && !data && <Button onClick={read}>Ler dados e ver prévia</Button>}
          {data && result && analysis && <>
            <p role="status">{previewNotice(Math.min(20, result.rows.length), result.rows.length, data.truncated)} {data.rows.length} lidas em {data.pages} página(s).</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={read}>Ler de novo</Button></div>
            {analysis.issues.length > 0 && <ul className="text-destructive" role="alert">{analysis.issues.map((e) => <li key={e}>{e}</li>)}</ul>}
            {analysis.chart && <figure className="space-y-1"><img className="h-auto max-w-full rounded border border-border bg-background" src={svgDataUri(chartSvg(analysis.chart))} alt={`Gráfico: ${analysis.chart.spec.title}. Tabela equivalente abaixo.`} />
              <SimpleTable caption="Tabela equivalente ao gráfico" headers={analysis.chart.table.headers} rows={analysis.chart.table.rows} />
              {analysis.chart.notes.map((n) => <figcaption key={n} className="text-xs text-muted-foreground">{n}</figcaption>)}</figure>}
            {analysis.summary && <SimpleTable caption="Resumo: agrupamentos e cálculos" headers={analysis.summary.headers} rows={analysis.summary.rows.slice(0, 200)} />}
            {analysis.pivot && <SimpleTable caption="Tabela cruzada (pivot)" headers={analysis.pivot.headers} rows={analysis.pivot.rows.slice(0, 200)} />}
            <SimpleTable caption="Dados (20 primeiras linhas)" headers={result.columns.map((c) => c.label)} rows={result.rows.slice(0, 20).map((r) => r.map(cellText))} />
            {result.rows.length === 0 && <p className="text-muted-foreground">Nenhuma linha visível à sua conta com esses filtros.</p>}
            <Button onClick={() => setStep(8)}>Próximo: salvar</Button>
          </>}
        </div>)}

      {step === 8 && src && (
        <div className="space-y-3 text-sm">
          {!cloud ? <p className="text-muted-foreground">Entre na sua conta para salvar modelos. Os modelos ficam na conta, não no navegador.</p> : <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">Nome do modelo<input className={sel} value={tplName} maxLength={80} onChange={(e) => setTplName(e.target.value)} placeholder="Ex.: Turmas por etapa" /></label>
              <Button disabled={!tplName.trim() || errors.length > 0} onClick={storeTemplate}>{templates.some((t) => t.name === tplName.trim()) ? "Salvar nova versão" : "Salvar modelo"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">O modelo guarda só as escolhas (assunto, período, colunas, filtros, agrupamentos, cálculos, gráfico e layout). Cada gravação é uma nova versão; os dados são relidos com o seu acesso toda vez.</p>
            {sortedTpl.length > 0 && <ul className="divide-y divide-border rounded-md border border-border">{sortedTpl.map((t) => <TemplateRowView key={t.name} t={t} onOpen={() => { pick(t.choice.sourceId, { choice: t.choice, spec: specOf(t.choice, t.name) }); setLoadedTpl(t.name); setTplName(t.name); setStep(1); }}
              onDuplicate={() => act(() => duplicateCloudTemplate(t, templates, BUILDER_SOURCES))}
              onRename={(n) => act(() => renameCloudTemplate(t, n, templates, BUILDER_SOURCES))}
              onFavorite={() => act(() => favoriteCloudTemplate(t, !isFavorite(t), BUILDER_SOURCES))}
              onDelete={() => act(() => deleteCloudTemplate(t, BUILDER_SOURCES))} />)}</ul>}
          </>}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="outline" size="sm" disabled={!SHARE_WITH_SECTOR_CAPABILITY} aria-describedby="share-reason">Compartilhar com o setor</Button>
            <span id="share-reason" className="text-muted-foreground">{SHARE_DISABLED_REASON}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="outline" size="sm" disabled={!INSTITUTIONAL_TEMPLATE_CAPABILITY} aria-describedby="inst-reason">Publicar como modelo institucional</Button>
            <span id="inst-reason" className="text-muted-foreground">{INSTITUTIONAL_DISABLED_REASON}</span>
          </div>
          <Button onClick={() => setStep(9)}>Próximo: exportar</Button>
        </div>)}

      {step === 9 && src && (
        <div className="space-y-3 text-sm">
          {!data ? <Button onClick={read} disabled={busy}>{busy ? "Lendo…" : "Ler dados"}</Button> : <>
            <ul className="list-disc pl-5 text-muted-foreground">{provenance(src, choice, data, SECTOR_LABEL[sector]).map((l) => <li key={l}>{l}</li>)}</ul>
            {data.truncated && <p role="alert" className="text-destructive">Leitura incompleta: a exportação é recusada. Restrinja o período.</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!result?.rows.length || data.truncated} onClick={() => exportAs("pdf")}>PDF (imprimir)</Button>
              <Button variant="outline" disabled={!result?.rows.length || data.truncated} onClick={() => exportAs("xlsx")}>XLSX</Button>
              <Button variant="outline" disabled={!result?.rows.length || data.truncated} onClick={() => exportAs("csv")}>CSV</Button>
            </div>
            <p className="text-xs text-muted-foreground">XLSX sai com abas Relatório, Filtros, Metodologia e fonte{analysis?.summary ? ", Resumo" : ""}{analysis?.chart ? ", Dados do gráfico" : ""}. PDF sai em {spec.layout.paper} {spec.layout.orientation}, sem menus do sistema.</p>
          </>}
        </div>)}
    </section>
  );
}

function SimpleTable({ caption, headers, rows }: { caption: string; headers: readonly string[]; rows: readonly (readonly string[])[] }) {
  return <div className="max-h-[50dvh] overflow-auto rounded border border-border" role="region" aria-label={caption} tabIndex={0}><table className="w-full text-left text-xs">
    <caption className="p-1 text-left font-medium">{caption}</caption>
    <thead className="sticky top-0 bg-muted"><tr>{headers.map((h, i) => <th key={i} scope="col" className="border-b p-1">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className="border-b p-1">{x}</td>)}</tr>)}</tbody>
  </table></div>;
}

function FilterValues({ src, choice, data, onChange }: { src: NonNullable<ReturnType<typeof sourceById>>; choice: BuilderChoice; data: Collected | null; onChange: (c: BuilderChoice) => void }) {
  const textCols = columnsOf(src).filter((c) => src.filterable.includes(c.id));
  if (!data || textCols.length === 0) return null;
  const distinct = (id: string) => [...new Set(data.rows.map((r) => r[id] ?? null))].filter((x): x is string | number => x !== null).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")).slice(0, 300);
  return <div className="flex flex-wrap gap-3">{textCols.map((c) => {
    const cur = choice.filters.find((f) => f.column === c.id);
    return <label key={c.id} className="flex flex-col gap-1">{c.label}
      <select className={sel} value={cur ? String(cur.equals) : ""} onChange={(e) => { const raw = distinct(c.id).find((x) => String(x) === e.target.value); onChange({ ...choice, filters: [...choice.filters.filter((f) => f.column !== c.id), ...(e.target.value ? [{ column: c.id, equals: (raw ?? e.target.value) as CellValue }] : [])] }); }}>
        <option value="">Todos</option>{distinct(c.id).map((x) => <option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label>;
  })}</div>;
}

function TemplateRowView({ t, onOpen, onDuplicate, onRename, onFavorite, onDelete }: { t: CloudTemplate; onOpen: () => void; onDuplicate: () => void; onRename: (n: string) => void; onFavorite: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false); const [n, setN] = useState(t.name); const [confirm, setConfirm] = useState(false);
  return <li className="flex flex-wrap items-center gap-2 p-2 text-xs">
    {editing ? <><input className={sel + " max-w-xs"} value={n} maxLength={80} aria-label="Novo nome" onChange={(e) => setN(e.target.value)} /><Button size="sm" disabled={!n.trim()} onClick={() => { onRename(n); setEditing(false); }}>Confirmar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></>
      : <span className="font-medium">{isFavorite(t) ? "★ " : ""}{t.name} <span className="text-muted-foreground">· versão {t.version}</span></span>}
    <span className="ml-auto flex flex-wrap gap-1">
      <Button size="sm" variant="outline" onClick={onOpen}>Abrir</Button>
      <Button size="sm" variant="ghost" aria-pressed={isFavorite(t)} onClick={onFavorite}>{isFavorite(t) ? "Desfavoritar" : "Favoritar"}</Button>
      <Button size="sm" variant="ghost" onClick={onDuplicate}>Duplicar</Button>
      <Button size="sm" variant="ghost" onClick={() => { setN(t.name); setEditing(true); }}>Renomear</Button>
      {confirm ? <><Button size="sm" variant="destructive" onClick={() => { onDelete(); setConfirm(false); }}>Confirmar exclusão</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Manter</Button></>
        : <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Excluir rascunho</Button>}
    </span>
  </li>;
}

function PacksPanel({ sector, onSector, onOpen }: { sector: PackSector; onSector: (s: PackSector) => void; onOpen: (id: string) => void }) {
  const list = packsFor(sector);
  const ready = SECTOR_PACKS.filter((p) => !p.blockedBy).length;
  return <section aria-label="Pacotes por setor" className="space-y-2">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="text-sm font-medium">Pacotes prontos por setor</p><p className="text-xs text-muted-foreground">{SECTOR_PACKS.length} pacotes · {ready} disponíveis. Abrir um pacote cria uma cópia editável; o pacote original não muda.</p></div>
      <label className="flex flex-col gap-1 text-sm">Setor do pacote<select className={sel} value={sector} onChange={(e) => onSector(e.target.value as PackSector)}>{(Object.keys(PACK_SECTOR_LABEL) as PackSector[]).map((s) => <option key={s} value={s}>{PACK_SECTOR_LABEL[s]} ({packsFor(s).length})</option>)}</select></label>
    </div>
    <ul className="grid gap-2 md:grid-cols-2">{list.map((p) => <li key={p.id} className="rounded-md border border-border p-3 text-sm">
      <p className="font-medium">{p.title} <span className={`ml-1 rounded px-1 text-xs ${p.blockedBy ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{p.blockedBy ? "Indisponível" : "Disponível"}</span></p>
      <p className="text-xs text-muted-foreground">{p.blockedBy ? `Motivo: ${p.blockedBy}` : packDescription(p, sourceById(p.sourceId)?.title ?? null)}</p>
      {!p.blockedBy && <Button size="sm" className="mt-2" onClick={() => onOpen(p.id)}>Abrir no assistente</Button>}
    </li>)}</ul>
  </section>;
}
