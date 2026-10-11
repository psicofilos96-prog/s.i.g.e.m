/**
 * Construtor de painéis: cada gráfico é uma consulta do catálogo fechado executada por `report_custom_query`
 * (SECURITY INVOKER, RLS de quem vê). Filtros do painel e drill-down viram condições na própria consulta, no servidor.
 */
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,   Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Legend, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, Treemap,
  XAxis, YAxis, ZAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/features/authority/session-authority";
import { neutralize, ABSENT } from "../report-engine";
import {
  AGG_LABEL, AGG_NEEDS_FIELD, availableJoins, customError, emptySpec, fieldLabel, fieldOf, fieldsInScope, gapsFor, loadCatalog, runAll,
  type Aggregate, type Catalog, type Condition, type CustomSpec,
} from "../custom/custom-report";
import { CHARTS, boxplot, categorySeries, compatibleKinds, drillCondition, heatmap, histogram, incompatibility, label, num, percentStack, pivot, waterfall, type ChartKind, type Row } from "./chart-model";
import { listBoards, saveBoard, type Dashboard, type SavedDashboard, type Widget } from "./dashboard-store";

const inp = "min-h-9 rounded-md border border-input bg-background px-2 py-1 text-sm";
const box = "space-y-3 rounded-md border border-border bg-card p-4";
const col = (i: number) => `var(--chart-${(i % 6) + 1})`;
const CAP = 5000;
const say = (e: unknown) => (e instanceof Error && /^[A-ZÀ-Ú]/.test(e.message) && !/SQLSTATE|permission denied/i.test(e.message) ? e.message : "Não foi possível concluir. Tente de novo.");
function download(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const uid = () => Math.random().toString(36).slice(2, 10);

export function DashboardPage() {
  const { loading, user } = useSessionUser();
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Conferindo sua sessão…</p>;
  if (!user) return (
    <section className={box} aria-label="Painéis">
      <h2 className="font-semibold">Painéis e gráficos</h2>
      <p className="text-sm">Entre com sua conta para montar painéis. Sem login não há leitura de dados.</p>
      <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
    </section>
  );
  return <Builder />;
}

/** Aplica filtros do painel só aos gráficos cuja consulta contém o campo (os demais ficam como estão, e isso é dito). */
export function withBoardFilters(cat: Catalog, spec: CustomSpec, filters: readonly Condition[]): { spec: CustomSpec; applied: number } {
  const scope = new Set(fieldsInScope(cat, spec).map((f) => f.ref));
  const extra = filters.filter((f) => scope.has(f.field));
  if (!extra.length) return { spec, applied: 0 };
  return { spec: { ...spec, filter: { op: "and", items: [spec.filter, ...extra] } }, applied: extra.length };
}

type Loaded = { rows: Row[]; truncated: boolean; applied: number; error?: string | undefined };

function Builder() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [board, setBoard] = useState<Dashboard>({ widgets: [], filters: [] });
  const [data, setData] = useState<Record<string, Loaded | "loading">>({});
  const [editing, setEditing] = useState<Widget | null>(null);
  const [saved, setSaved] = useState<SavedDashboard[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCatalog().then(setCat).catch((e) => setErr(customError(e))); listBoards().then(setSaved).catch(() => setSaved([])); }, []);

  const load = useCallback(async (w: Widget, filters: readonly Condition[]) => {
    if (!cat) return;
    setData((d) => ({ ...d, [w.id]: "loading" }));
    try {
      const { spec, applied } = withBoardFilters(cat, w.spec, filters);
      const r = await runAll(cat, spec, CAP);
      setData((d) => ({ ...d, [w.id]: { rows: r.rows, truncated: r.truncated, applied } }));
    } catch (e) { setData((d) => ({ ...d, [w.id]: { rows: [], truncated: false, applied: 0, error: say(e) } })); }
  }, [cat]);
  const reloadAll = useCallback((b: Dashboard) => { for (const w of b.widgets) void load(w, b.filters); }, [load]);

  const setFilters = (filters: Condition[]) => { const b = { ...board, filters }; setBoard(b); reloadAll(b); };
  const drill = (field: string, category: string) => setFilters([...board.filters.filter((f) => f.field !== field), drillCondition(field, category)]);

  if (err) return <p role="alert" className="text-sm text-destructive">{err}</p>;
  if (!cat) return <p role="status" className="text-sm text-muted-foreground">Carregando catálogo de dados…</p>;

  const dateFields = [...new Map(board.widgets.flatMap((w) => fieldsInScope(cat, w.spec)).filter((f) => f.def.type === "date").map((f) => [f.ref, f])).values()];

  async function exportXlsx() {
    const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook();
    for (const w of board.widgets) {
      const d = data[w.id]; if (!d || d === "loading") continue;
      const ws = wb.addWorksheet(neutralize(w.title || CHARTS[w.kind].label).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Gráfico");
      ws.addRow([neutralize(w.title)]); ws.addRow([`Tipo: ${CHARTS[w.kind].label}`]);
      ws.addRow([`Filtros do painel aplicados: ${d.applied}`, d.truncated ? `Limitado às primeiras ${CAP} linhas` : ""]); ws.addRow([]);
      const cols = columnLabels(cat!, w); ws.addRow(cols.map((c) => c.label)).font = { bold: true };
      for (const r of d.rows) ws.addRow(cols.map((c) => { const v = r[c.id]; return v === null || v === undefined ? ABSENT : typeof v === "number" ? v : neutralize(String(v)); }));
    }
    download(`painel-${(name || "sem-nome").replace(/\W+/g, "-")}.xlsx`, new Blob([await wb.xlsx.writeBuffer()]));
  }

  return (
    <div className="space-y-4">
      <section className={`${box} print:hidden`} aria-labelledby="pn-ctl">
        <h2 id="pn-ctl" className="font-semibold">Painel</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Abrir painel salvo
            <select className={`${inp} block`} aria-label="Abrir painel salvo" value="" onChange={(e) => { const s = saved.find((x) => x.name === e.target.value); if (s) { setBoard(s.board); setName(s.name); reloadAll(s.board); } }}>
              <option value="">{saved.length ? "Escolha…" : "Nenhum painel salvo"}</option>
              {saved.map((s) => <option key={s.name} value={s.name}>{s.name} (v{s.version})</option>)}
            </select></label>
          <label className="text-sm">Nome<input className={`${inp} block`} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do painel" /></label>
          <Button size="sm" onClick={async () => { setNote(null); try { await saveBoard(name, board); setNote("Painel salvo (nova versão)."); setSaved(await listBoards()); } catch (e) { setNote(say(e)); } }}>Salvar painel</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing({ id: uid(), title: "", kind: "bar", spec: emptySpec() })}>Adicionar gráfico</Button>
          <Button size="sm" variant="outline" disabled={!board.widgets.length} onClick={exportXlsx}>Exportar XLSX</Button>
          <Button size="sm" variant="outline" disabled={!board.widgets.length} onClick={() => window.print()}>Imprimir / PDF</Button>
        </div>
        {note ? <p role="status" className="text-sm">{note}</p> : null}
        <p className="text-xs text-muted-foreground">O painel guarda só as escolhas; os dados são relidos no servidor com o acesso de quem abre. Compartilhar com outras contas ainda não tem permissão definida.</p>
        <BoardFilters cat={cat} filters={board.filters} dateFields={dateFields} onChange={setFilters} />
      </section>

      {editing ? <WidgetEditor cat={cat} initial={editing} onCancel={() => setEditing(null)} onSave={(w) => {
        const exists = board.widgets.some((x) => x.id === w.id);
        const b = { ...board, widgets: exists ? board.widgets.map((x) => (x.id === w.id ? w : x)) : [...board.widgets, w] };
        setBoard(b); setEditing(null); void load(w, b.filters);
      }} /> : null}

      {board.widgets.length === 0 && !editing ? <p className="text-sm text-muted-foreground">Nenhum gráfico ainda. Use “Adicionar gráfico”.</p> : null}
      <div ref={boardRef} className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        {board.widgets.map((w) => (
          <WidgetCard key={w.id} cat={cat} w={w} d={data[w.id]} onDrill={drill}
            onEdit={() => setEditing(w)} onRemove={() => setBoard({ ...board, widgets: board.widgets.filter((x) => x.id !== w.id) })}
            onMove={(dir) => { const i = board.widgets.indexOf(w), j = i + dir; if (j < 0 || j >= board.widgets.length) return; const ws = [...board.widgets]; [ws[i], ws[j]] = [ws[j]!, ws[i]!]; setBoard({ ...board, widgets: ws }); }} />
        ))}
      </div>
    </div>
  );
}

function BoardFilters({ cat, filters, dateFields, onChange }: { cat: Catalog; filters: Condition[]; dateFields: { ref: string }[]; onChange: (f: Condition[]) => void }) {
  const [field, setField] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  return (
    <div className="space-y-2" aria-label="Filtros do painel" role="group">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Período por
          <select className={`${inp} block`} value={field} onChange={(e) => setField(e.target.value)} aria-label="Campo de data do período">
            <option value="">{dateFields.length ? "Escolha o campo de data" : "Nenhum gráfico tem campo de data"}</option>
            {dateFields.map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
          </select></label>
        <label className="text-sm">De<input type="date" className={`${inp} block`} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Período de" /></label>
        <label className="text-sm">Até<input type="date" className={`${inp} block`} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Período até" /></label>
        <Button size="sm" variant="outline" disabled={!field || !from || !to} onClick={() => onChange([...filters.filter((f) => f.field !== field), { field, operator: "between", value: [from, to] }])}>Aplicar período</Button>
      </div>
      {filters.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {filters.map((f) => (
            <li key={f.field} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
              {fieldLabel(cat, f.field)}: {f.operator === "is_null" ? "sem registro" : Array.isArray(f.value) ? f.value.join(" a ") : String(f.value)}
              <button type="button" aria-label={`Remover filtro ${fieldLabel(cat, f.field)}`} className="ml-1 underline" onClick={() => onChange(filters.filter((x) => x !== f))}>×</button>
            </li>
          ))}
          <li><button type="button" className="text-xs underline" onClick={() => onChange([])}>Limpar filtros</button></li>
        </ul>
      ) : null}
    </div>
  );
}

function columnLabels(cat: Catalog, w: Widget): { id: string; label: string }[] {
  const s = w.spec;
  const labels = s.groupBy.length || s.measures.length
    ? [...s.groupBy.map((r) => fieldLabel(cat, r)), ...s.measures.map((m) => `${AGG_LABEL[m.agg]}${m.field ? ` — ${fieldOf(cat, m.field)?.label}` : ""}`)]
    : s.columns.map((r) => fieldLabel(cat, r));
  return labels.map((label, i) => ({ id: `c${i + 1}`, label }));
}
const shapeOf = (cat: Catalog, w: Widget) => ({ dims: w.spec.groupBy.length, measures: w.spec.measures.length, raw: !w.spec.groupBy.length && !w.spec.measures.length,
  numericColumns: w.spec.columns.filter((c) => fieldOf(cat, c)?.type === "number").length });

function WidgetEditor({ cat, initial, onSave, onCancel }: { cat: Catalog; initial: Widget; onSave: (w: Widget) => void; onCancel: () => void }) {
  const [w, setW] = useState<Widget>(initial);
  const spec = w.spec; const set = (s: Partial<CustomSpec>) => setW((x) => ({ ...x, spec: { ...x.spec, ...s } }));
  const scope = fieldsInScope(cat, spec).filter((f) => !f.def.sensitive && f.def.type !== "id");
  const numeric = fieldsInScope(cat, spec).filter((f) => f.def.type === "number");
  const raw = CHARTS[w.kind].raw !== undefined;
  const shape = shapeOf(cat, w); const problem = spec.source ? incompatibility(w.kind, shape) : "Escolha a fonte.";
  const fits = compatibleKinds(shape);
  return (
    <section className={`${box} print:hidden`} aria-labelledby="ed-w">
      <h2 id="ed-w" className="font-semibold">Gráfico</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Título<input className={`${inp} block w-full`} value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} aria-label="Título do gráfico" /></label>
        <label className="text-sm">Fonte principal
          <select className={`${inp} block w-full`} aria-label="Fonte principal" value={spec.source} onChange={(e) => setW({ ...w, spec: emptySpec(e.target.value) })}>
            <option value="">Escolha…</option>
            {Object.entries(cat.sources).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select></label>
        <label className="text-sm">Tipo de gráfico
          <select className={`${inp} block w-full`} aria-label="Tipo de gráfico" value={w.kind} onChange={(e) => {
            const kind = e.target.value as ChartKind; const toRaw = CHARTS[kind].raw !== undefined;
            setW((x) => ({ ...x, kind, spec: toRaw ? { ...x.spec, groupBy: [], measures: [], columns: x.spec.columns } : { ...x.spec, columns: [] } }));
          }}>
            {(Object.keys(CHARTS) as ChartKind[]).map((k) => <option key={k} value={k}>{CHARTS[k].label}{spec.source && !fits.includes(k) ? " (ajuste a consulta)" : ""}</option>)}
          </select></label>
      </div>
      {spec.source ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Cruzar com
              <select className={`${inp} block`} aria-label="Cruzar com" value="" onChange={(e) => e.target.value && set({ joins: [...spec.joins, e.target.value] })}>
                <option value="">{availableJoins(cat, spec).length ? "Escolha…" : "Sem cruzamentos disponíveis"}</option>
                {availableJoins(cat, spec).map((j) => <option key={j.id} value={j.id}>{cat.sources[j.to]?.label} (por {j.on[0]})</option>)}
              </select></label>
            {spec.joins.length ? <span className="text-xs text-muted-foreground">Cruzado com: {spec.joins.map((id) => cat.sources[cat.joins.find((j) => j.id === id)!.to]?.label).join(", ")}
              <button type="button" className="ml-2 underline" onClick={() => set({ joins: [], groupBy: [], measures: [], columns: [] })}>desfazer</button></span> : null}
          </div>
          {gapsFor(cat, spec).length ? <ul className="text-xs text-muted-foreground">{gapsFor(cat, spec).map((g, i) => <li key={i}>Sem ligação {g.from} × {g.to}: {g.reason}</li>)}</ul> : null}
          {raw ? (
            <div className="flex flex-wrap gap-2">
              <label className="text-sm">Valor numérico
                <select className={`${inp} block`} aria-label="Valor numérico" value={spec.columns.find((c) => fieldOf(cat, c)?.type === "number") ?? ""} onChange={(e) => set({ columns: [e.target.value, ...spec.columns.filter((c) => fieldOf(cat, c)?.type !== "number")].filter(Boolean) })}>
                  <option value="">Escolha…</option>{numeric.map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
                </select></label>
              {w.kind === "boxplot" ? <label className="text-sm">Separar por (opcional)
                <select className={`${inp} block`} aria-label="Separar por" value={spec.columns.find((c) => fieldOf(cat, c)?.type !== "number") ?? ""} onChange={(e) => set({ columns: [...spec.columns.filter((c) => fieldOf(cat, c)?.type === "number"), e.target.value].filter(Boolean) })}>
                  <option value="">—</option>{scope.filter((f) => f.def.type !== "number").map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
                </select></label> : null}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Agrupar por (até {Math.max(2, CHARTS[w.kind].dims[1])})</p>
                {spec.groupBy.map((g, i) => <p key={g} className="text-sm">{i + 1}. {fieldLabel(cat, g)} <button type="button" className="underline" onClick={() => set({ groupBy: spec.groupBy.filter((x) => x !== g) })}>remover</button></p>)}
                <select className={inp} aria-label="Acrescentar agrupamento" value="" onChange={(e) => e.target.value && set({ groupBy: [...spec.groupBy, e.target.value] })}>
                  <option value="">Acrescentar…</option>{scope.filter((f) => !spec.groupBy.includes(f.ref)).map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Cálculos</p>
                {spec.measures.map((m, i) => <p key={i} className="text-sm">{AGG_LABEL[m.agg]}{m.field ? ` — ${fieldLabel(cat, m.field)}` : ""} <button type="button" className="underline" onClick={() => set({ measures: spec.measures.filter((_, j) => j !== i) })}>remover</button></p>)}
                <MeasureAdder cat={cat} spec={spec} onAdd={(agg, field) => set({ measures: [...spec.measures, { agg, field }] })} />
              </div>
            </div>
          )}
        </>
      ) : null}
      {problem ? <p role="status" className="text-sm text-warning">{problem}{spec.source && fits.length ? ` Compatíveis com a consulta atual: ${fits.map((k) => CHARTS[k].label).join(", ")}.` : ""}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!!problem} onClick={() => onSave({ ...w, title: w.title.trim() || CHARTS[w.kind].label })}>Pôr no painel</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </section>
  );
}

function MeasureAdder({ cat, spec, onAdd }: { cat: Catalog; spec: CustomSpec; onAdd: (a: Aggregate, f?: string) => void }) {
  const [agg, setAgg] = useState<Aggregate>("count"); const [field, setField] = useState("");
  const need = AGG_NEEDS_FIELD[agg];
  const opts = fieldsInScope(cat, spec).filter((f) => !f.def.sensitive && (need === "number" ? f.def.type === "number" : true));
  return (
    <div className="flex flex-wrap gap-2">
      <select className={inp} aria-label="Cálculo" value={agg} onChange={(e) => { setAgg(e.target.value as Aggregate); setField(""); }}>
        {(Object.keys(AGG_LABEL) as Aggregate[]).map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
      </select>
      {need !== "none" ? <select className={inp} aria-label="Campo do cálculo" value={field} onChange={(e) => setField(e.target.value)}>
        <option value="">Campo…</option>{opts.map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
      </select> : null}
      <Button size="sm" variant="outline" disabled={need !== "none" && !field} onClick={() => onAdd(agg, need === "none" ? undefined : field)}>Acrescentar cálculo</Button>
    </div>
  );
}

function svgOf(el: HTMLElement | null): string | null {
  const svg = el?.querySelector("svg.recharts-surface, svg[data-chart]") as SVGSVGElement | null; if (!svg) return null;
  const c = svg.cloneNode(true) as SVGSVGElement; c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // cores vêm de variáveis CSS: resolve para valores literais para o arquivo funcionar fora do sistema
  const cs = getComputedStyle(document.documentElement);
  return new XMLSerializer().serializeToString(c).replace(/var\((--chart-\d)\)/g, (_, v: string) => cs.getPropertyValue(v).trim() || "#333");
}
async function pngOf(svg: string, w: number, h: number): Promise<Blob> {
  const img = new Image(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; await img.decode();
  const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2; const g = cv.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.scale(2, 2); g.drawImage(img, 0, 0, w, h);
  return await new Promise((r) => cv.toBlob((b) => r(b!), "image/png"));
}

function WidgetCard({ cat, w, d, onDrill, onEdit, onRemove, onMove }: { cat: Catalog; w: Widget; d: Loaded | "loading" | undefined; onDrill: (field: string, cat: string) => void; onEdit: () => void; onRemove: () => void; onMove: (dir: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const file = (w.title || w.kind).replace(/\W+/g, "-");
  async function exp(kind: "svg" | "png") {
    const s = svgOf(ref.current); if (!s) return;
    if (kind === "svg") download(`${file}.svg`, new Blob([s], { type: "image/svg+xml" }));
    else { const r = ref.current!.querySelector("svg")!.getBoundingClientRect(); download(`${file}.png`, await pngOf(s, r.width, r.height)); }
  }
  const hasSvg = w.kind !== "table" && w.kind !== "kpi";
  return (
    <article className={`${box} break-inside-avoid ${w.wide ? "md:col-span-2" : ""}`} aria-label={w.title}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-semibold">{w.title}</h3><p className="text-xs text-muted-foreground">{CHARTS[w.kind].label} · {cat.sources[w.spec.source]?.label}</p></div>
        <div className="flex flex-wrap gap-1 print:hidden">
          <Button size="sm" variant="ghost" onClick={() => onMove(-1)} aria-label="Mover para antes">↑</Button>
          <Button size="sm" variant="ghost" onClick={() => onMove(1)} aria-label="Mover para depois">↓</Button>
          {hasSvg ? <><Button size="sm" variant="outline" onClick={() => exp("png")}>PNG</Button><Button size="sm" variant="outline" onClick={() => exp("svg")}>SVG</Button></> : null}
          <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>Remover</Button>
        </div>
      </header>
      <div ref={ref} className="overflow-hidden">
        {d === undefined || d === "loading" ? <p role="status" className="text-sm text-muted-foreground">Carregando dados…</p>
        : d.error ? <p role="alert" className="text-sm text-destructive">{d.error}</p>
        : d.rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum dado visível com o seu acesso para esta consulta.</p>
        : <><ChartBody cat={cat} w={w} rows={d.rows} onDrill={onDrill} />
          {w.kind !== "table" && w.kind !== "pivot" ? <details className="mt-2 text-xs print:hidden"><summary className="cursor-pointer">Ver dados do gráfico em tabela</summary><ChartBody cat={cat} w={{ ...w, kind: "table" }} rows={d.rows} onDrill={onDrill} /></details> : null}</>}
      </div>
      {d && d !== "loading" && !d.error ? <p className="text-xs text-muted-foreground">{d.rows.length} linha(s){d.truncated ? ` — limitado às primeiras ${CAP}` : ""}{d.applied ? ` · ${d.applied} filtro(s) do painel aplicado(s)` : ""}</p> : null}
    </article>
  );
}

function ChartBody({ cat, w, rows, onDrill }: { cat: Catalog; w: Widget; rows: Row[]; onDrill: (field: string, cat: string) => void }) {
  const cols = columnLabels(cat, w); const dims = w.spec.groupBy.length;
  const measureIds = cols.slice(dims).map((c) => c.id); const mName = (id: string) => cols.find((c) => c.id === id)?.label ?? id;
  const dimField = w.spec.groupBy[0]; const H = 280;
  const cs = useMemo(() => (dims ? categorySeries(rows, "c1", measureIds, dims === 2 && !["heatmap", "scatter", "bubble", "pivot"].includes(w.kind) ? "c2" : undefined) : null), [rows, dims, w.kind, measureIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const click = (p: { categoria?: string; payload?: { categoria?: string }; name?: string } | undefined) => {
    const c = p?.categoria ?? p?.payload?.categoria ?? p?.name; if (dimField && typeof c === "string") onDrill(dimField, c);
  };
  const excludedNote = (n: number) => (n ? <p className="text-xs text-muted-foreground">{n} valor(es) sem registro numérico ficaram fora do gráfico (não contados como zero).</p> : null);
  const seriesName = (k: string) => (dims === 2 ? k : mName(k));
  switch (w.kind) {
    case "kpi": { const v = num(rows[0]?.["c1"]); return <p className="text-4xl font-semibold" aria-label={mName("c1")}>{v === null ? <span className="text-base text-muted-foreground">sem registro</span> : v.toLocaleString("pt-BR")}</p>; }
    case "gauge": {
      const v = num(rows[0]?.["c1"]); if (v === null) return <p className="text-sm text-muted-foreground">sem registro</p>;
      const pct = /percent/.test(w.spec.measures[0]?.agg ?? "") ? Math.max(0, Math.min(100, v)) : null;
      return pct === null ? <p className="text-sm text-muted-foreground">O medidor só mostra percentuais (0–100%). Valor: {v.toLocaleString("pt-BR")}. Use o cálculo “Percentual”.</p> : (
        <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={[{ v: pct }, { v: 100 - pct }]} dataKey="v" startAngle={180} endAngle={0} innerRadius="60%" outerRadius="90%" cy="80%">
          <Cell fill={col(0)} /><Cell fill="var(--muted)" /></Pie><text x="50%" y="75%" textAnchor="middle" fontSize={22}>{pct.toLocaleString("pt-BR")}%</text></PieChart></ResponsiveContainer>);
    }
    case "table": return (
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr>{cols.map((c) => <th key={c.id} scope="col" className="text-left">{c.label}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 200).map((r, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c.id}>{r[c.id] === null || r[c.id] === undefined ? <span className="text-muted-foreground">sem registro</span> : String(r[c.id])}</td>)}</tr>)}</tbody></table>
        {rows.length > 200 ? <p className="text-xs text-muted-foreground">Mostrando 200 de {rows.length}; a exportação XLSX traz todas.</p> : null}</div>);
    case "histogram": { const h = histogram(rows.map((r) => r["c1"])); return <>{excludedNote(h.excluded)}<ResponsiveContainer width="100%" height={H}><BarChart data={h.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="faixa" fontSize={11} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="quantidade" name="Quantidade" fill={col(0)} /></BarChart></ResponsiveContainer></>; }
    case "boxplot": { const b = boxplot(rows, "c1", w.spec.columns.length > 1 ? "c2" : undefined); return <>{excludedNote(b.excluded)}<BoxPlot data={b.data} /></>; }
    case "pivot": { const p = pivot(rows, "c1", "c2", "c3"); return <>{excludedNote(p.excluded)}<div className="max-h-80 overflow-auto"><table className="w-full text-sm" data-chart="pivot"><caption className="sr-only">{`${mName("c1")} por ${mName("c2")}`}</caption>
      <thead><tr><th scope="col" className="text-left">{mName("c1")}</th>{p.cols.map((c) => <th key={c} scope="col" className="text-right">{c}</th>)}<th scope="col" className="text-right">Total</th></tr></thead>
      <tbody>{p.rows.map((r) => <tr key={r} className="border-t border-border"><th scope="row" className="text-left font-normal">{r}</th>{p.cols.map((c) => { const v = p.cell(r, c); return <td key={c} className="text-right">{v === null ? <span className="text-muted-foreground">—</span> : v.toLocaleString("pt-BR")}</td>; })}
        <td className="text-right font-medium">{p.rowTotal(r)?.toLocaleString("pt-BR") ?? <span className="text-muted-foreground" title="Há célula sem registro">—</span>}</td></tr>)}</tbody></table>
      <p className="text-xs text-muted-foreground">“—” = sem registro; total só aparece quando todas as células têm valor.</p></div></>; }
    case "map": return <p className="text-sm text-muted-foreground">{incompatibility("map", { dims: 0, measures: 0, numericColumns: 0, raw: true })}</p>;
    case "heatmap": { const h = heatmap(rows, "c1", "c2", "c3"); return <>{excludedNote(h.excluded)}<HeatMap h={h} xLabel={mName("c1")} yLabel={mName("c2")} /></>; }
    case "scatter": case "bubble": {
      const pts = rows.map((r) => ({ categoria: label(r["c1"]), x: num(r["c2"]), y: num(r["c3"]), z: w.kind === "bubble" ? num(r["c4"]) : 1 })).filter((p) => p.x !== null && p.y !== null && p.z !== null);
      return <>{excludedNote(rows.length - pts.length)}<ResponsiveContainer width="100%" height={H}><ScatterChart><CartesianGrid /><XAxis type="number" dataKey="x" name={mName("c2")} /><YAxis type="number" dataKey="y" name={mName("c3")} />
        {w.kind === "bubble" ? <ZAxis type="number" dataKey="z" range={[40, 600]} name={mName("c4")} /> : null}<Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={pts} fill={col(0)} onClick={click} /></ScatterChart></ResponsiveContainer></>;
    }
  }
  if (!cs) return null;
  const data = cs.data;
  switch (w.kind) {
    case "pie": case "donut": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><PieChart><Pie data={data} dataKey="c2" nameKey="categoria" innerRadius={w.kind === "donut" ? "50%" : 0} outerRadius="80%" onClick={click} label>
      {data.map((_, i) => <Cell key={i} fill={col(i)} />)}</Pie><Tooltip />{data.length <= 12 ? <Legend /> : null}</PieChart></ResponsiveContainer></>;
    case "treemap": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><Treemap data={data.map((d) => ({ name: d["categoria"], size: (d["c2"] as number) ?? 0 }))} dataKey="size" nameKey="name" stroke="var(--background)" fill={col(0)} onClick={click} /></ResponsiveContainer></>;
    case "funnel": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><FunnelChart><Tooltip /><Funnel data={[...data].sort((a, b) => ((b["c2"] as number) ?? 0) - ((a["c2"] as number) ?? 0)).map((d, i) => ({ ...d, fill: col(i) }))} dataKey="c2" nameKey="categoria" onClick={click}>
      <LabelList position="right" dataKey="categoria" fontSize={11} /></Funnel></FunnelChart></ResponsiveContainer></>;
    case "radar": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><RadarChart data={data}><PolarGrid /><PolarAngleAxis dataKey="categoria" fontSize={11} /><PolarRadiusAxis />
      {cs.series.map((k, i) => <Radar key={k} dataKey={k} name={seriesName(k)} stroke={col(i)} fill={col(i)} fillOpacity={0.3} />)}<Legend /><Tooltip /></RadarChart></ResponsiveContainer></>;
    case "waterfall": { const wf = waterfall(data, "c2"); return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><BarChart data={wf}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis /><Tooltip />
      <Bar dataKey="base" stackId="w" fill="transparent" /><Bar dataKey="valor" stackId="w" name={mName("c2")} onClick={click}>{wf.map((s, i) => <Cell key={i} fill={s.categoria === "Total" ? col(4) : s.sinal > 0 ? col(2) : col(3)} />)}</Bar></BarChart></ResponsiveContainer></>; }
    case "barh": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={Math.max(H, data.length * 22 + 60)}><BarChart data={data} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="categoria" width={160} fontSize={10} /><Tooltip /><Legend />
      {cs.series.map((k, i) => <Bar key={k} dataKey={k} name={seriesName(k)} fill={col(i)} {...(dims === 2 ? { stackId: "b" } : {})} onClick={click} cursor="pointer" />)}</BarChart></ResponsiveContainer></>;
    case "stacked100": { const pd = percentStack(data, cs.series); return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><BarChart data={pd} stackOffset="expand"><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} /><Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR")}%`} /><Legend />
      {cs.series.map((k, i) => <Bar key={k} dataKey={k} name={seriesName(k)} fill={col(i)} stackId="p" onClick={click} cursor="pointer" />)}</BarChart></ResponsiveContainer></>; }
    case "combo": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" /><Tooltip /><Legend />
      <Bar yAxisId="l" dataKey="c2" name={mName("c2")} fill={col(0)} onClick={click} cursor="pointer" /><Line yAxisId="r" dataKey="c3" name={mName("c3")} stroke={col(1)} connectNulls={false} /></ComposedChart></ResponsiveContainer></>;
    case "line": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><LineChart data={data} onClick={(e) => click({ categoria: e?.activeLabel as string })}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis /><Tooltip /><Legend />
      {cs.series.map((k, i) => <Line key={k} dataKey={k} name={seriesName(k)} stroke={col(i)} connectNulls={false} />)}</LineChart></ResponsiveContainer></>;
    case "area": return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><AreaChart data={data} onClick={(e) => click({ categoria: e?.activeLabel as string })}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis /><Tooltip /><Legend />
      {cs.series.map((k, i) => <Area key={k} dataKey={k} name={seriesName(k)} stroke={col(i)} fill={col(i)} fillOpacity={0.3} {...(dims === 2 ? { stackId: "a" } : {})} />)}</AreaChart></ResponsiveContainer></>;
    default: return <>{excludedNote(cs.excluded)}<ResponsiveContainer width="100%" height={H}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" fontSize={11} /><YAxis /><Tooltip /><Legend />
      {cs.series.map((k, i) => <Bar key={k} dataKey={k} name={seriesName(k)} fill={col(i)} {...(dims === 2 ? { stackId: "b" } : {})} onClick={click} cursor="pointer" />)}</BarChart></ResponsiveContainer></>;
  }
}

function BoxPlot({ data }: { data: ReturnType<typeof boxplot>["data"] }) {
  const W = 520, H = 260, pad = 40; if (!data.length) return null;
  const lo = Math.min(...data.map((d) => d.min)), hi = Math.max(...data.map((d) => d.max)); const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const bw = Math.min(60, (W - 2 * pad) / data.length / 2);
  return (
    <svg data-chart="boxplot" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Boxplot">
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="currentColor" />
      <text x={pad - 4} y={y(hi)} fontSize={10} textAnchor="end">{hi.toLocaleString("pt-BR")}</text><text x={pad - 4} y={y(lo)} fontSize={10} textAnchor="end">{lo.toLocaleString("pt-BR")}</text>
      {data.map((d, i) => { const cx = pad + ((i + 0.5) * (W - 2 * pad)) / data.length; return (
        <g key={d.grupo}><title>{`${d.grupo}: n=${d.n}, mín ${d.min}, Q1 ${d.q1}, mediana ${d.mediana}, Q3 ${d.q3}, máx ${d.max}`}</title>
          <line x1={cx} x2={cx} y1={y(d.max)} y2={y(d.min)} stroke="currentColor" />
          <rect x={cx - bw / 2} width={bw} y={y(d.q3)} height={Math.max(1, y(d.q1) - y(d.q3))} fill="var(--chart-1)" fillOpacity={0.4} stroke="var(--chart-1)" />
          <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(d.mediana)} y2={y(d.mediana)} stroke="currentColor" strokeWidth={2} />
          <text x={cx} y={H - pad + 14} fontSize={10} textAnchor="middle">{d.grupo.slice(0, 18)}</text></g>); })}
    </svg>
  );
}

function HeatMap({ h, xLabel, yLabel }: { h: ReturnType<typeof heatmap>; xLabel: string; yLabel: string }) {
  const cw = 46, ch = 24, left = 200, top = 90; const W = left + h.xs.length * cw + 10, H = top + h.ys.length * ch + 10;
  return (
    <div className="overflow-auto"><svg data-chart="heatmap" width={W} height={H} role="img" aria-label={`Mapa de calor: ${xLabel} × ${yLabel}`}>
      {h.xs.map((x, i) => <text key={x} x={left + i * cw + cw / 2} y={top - 6} fontSize={9} transform={`rotate(-45 ${left + i * cw + cw / 2} ${top - 6})`}>{x.slice(0, 16)}</text>)}
      {h.ys.map((y, j) => <g key={y}><text x={left - 4} y={top + j * ch + ch / 2 + 3} fontSize={10} textAnchor="end">{y.slice(0, 30)}</text>
        {h.xs.map((x, i) => { const v = h.cell(x, y); const t = v === null ? 0 : (v - h.min) / (h.max - h.min || 1); return (
          <g key={x}><rect x={left + i * cw} y={top + j * ch} width={cw - 2} height={ch - 2} fill={v === null ? "var(--muted)" : "var(--chart-1)"} fillOpacity={v === null ? 1 : 0.15 + 0.85 * t}><title>{`${x} × ${y}: ${v === null ? "sem registro" : v.toLocaleString("pt-BR")}`}</title></rect>
            {v !== null ? <text x={left + i * cw + cw / 2 - 1} y={top + j * ch + ch / 2 + 3} fontSize={9} textAnchor="middle">{v.toLocaleString("pt-BR")}</text> : null}</g>); })}</g>)}
    </svg></div>
  );
}
