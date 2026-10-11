import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/features/authority/session-authority";
import { cellText, fingerprint, toCsv, toXlsx, type ReportResult } from "../report-engine";
import { listMyEmissions, recordEmission, reissueComparison, verificationBlock, type ReportEmission } from "../report-emissions";
import { INSTITUTIONAL_LOGOS } from "../report-analytics";
import {
  AGG_LABEL, AGG_NEEDS_FIELD, OPERATORS_BY_TYPE, OPERATOR_LABEL, aggregated, availableJoins, describeSpec, emptySpec, fieldLabel, fieldOf, fieldsInScope,
  gapsFor, isGroup, loadCatalog, pruneSpec, runAll, runPage, sourcesInQuery, toResult, validateSpec, customError,
  type Aggregate, type Catalog, type Condition, type CustomSpec, type Group, type Operator, type ServerPage,
} from "./custom-report";
import { defaultLayout, layoutProblems, renderCustomHtml, type CustomLayout } from "./custom-layout";
import { CUSTOM_SHARE_REASON, copyName, listCustomTemplates, saveCustomTemplate, type CustomTemplate } from "./custom-templates";

const inp = "min-h-9 rounded-md border border-input bg-background px-2 py-1 text-sm";
const box = "space-y-3 rounded-md border border-border bg-card p-4";
const PAGE = 50;
export const CUSTOM_REPORT_ID = "personalizado";

function download(name: string, blob: Blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export function CustomReportPage() {
  const { loading, user } = useSessionUser();
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Conferindo sua sessão…</p>;
  if (!user) return (
    <section className={box} aria-label="Gerador personalizado">
      <h2 className="font-semibold">Gerador personalizado</h2>
      <p className="text-sm">Entre com sua conta para montar relatórios. Sem login não há leitura de dados.</p>
      <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
    </section>
  );
  return <Builder />;
}

/** Colunas de saída na ordem que o servidor numera (c1, c2, …). */
function outputColumns(cat: Catalog, s: CustomSpec): { id: string; label: string }[] {
  const out = aggregated(s)
    ? [...s.groupBy.map((r) => s.labels[r] || fieldLabel(cat, r)), ...s.measures.map((m, i) => s.labels[`m${i}`] || `${AGG_LABEL[m.agg]}${m.field ? ` — ${fieldOf(cat, m.field)?.label}` : ""}`)]
    : s.columns.map((r) => s.labels[r] || fieldLabel(cat, r));
  return out.map((label, i) => ({ id: `c${i + 1}`, label }));
}

function Builder() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [spec, setSpecRaw] = useState<CustomSpec>(emptySpec());
  const [layout, setLayout] = useState<CustomLayout>(defaultLayout());
  const [page, setPage] = useState<ServerPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [emissions, setEmissions] = useState<ReportEmission[]>([]);

  useEffect(() => { loadCatalog().then(setCat).catch((e) => setErr(customError(e))); }, []);
  const refresh = useCallback(async () => {
    try { setTemplates(await listCustomTemplates()); } catch (e) { setErr((e as Error).message); }
    try { setEmissions((await listMyEmissions(100)).filter((e) => e.report_id === CUSTOM_REPORT_ID)); } catch { setEmissions([]); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const setSpec = (f: (s: CustomSpec) => CustomSpec) => { setSpecRaw((s) => (cat ? pruneSpec(cat, f(s)) : f(s))); setPage(null); setOffset(0); };
  const problems = useMemo(() => (cat && spec.source ? validateSpec(cat, spec) : []), [cat, spec]);
  const outs = useMemo(() => (cat ? outputColumns(cat, spec) : []), [cat, spec]);
  const result: ReportResult | null = useMemo(() => (cat && page ? toResult(cat, spec, page, page.rows) : null), [cat, spec, page]);

  async function preview(off = 0) {
    if (!cat || problems.length) return;
    setBusy(true); setErr(null);
    try { setPage(await runPage(cat, spec, PAGE, off)); setOffset(off); } catch (e) { setErr((e as Error).message); setPage(null); } finally { setBusy(false); }
  }

  async function exportAs(fmt: "pdf" | "xlsx" | "csv", reissue: ReportEmission | null = null) {
    if (!cat) return;
    const s = reissue ? ((reissue.params as unknown as { choice: { spec: CustomSpec; layout: CustomLayout } }).choice) : { spec, layout };
    const lp = layoutProblems(s.layout, outputColumns(cat, s.spec).length);
    if (fmt === "pdf" && lp.length) { setErr(lp.join(" ")); return; }
    setBusy(true); setErr(null); setNote(null);
    try {
      const all = await runAll(cat, s.spec);
      if (all.truncated) throw new Error("A consulta passa de 50.000 linhas; acrescente filtros ou agrupe antes de exportar.");
      const r = toResult(cat, s.spec, all.page, all.rows);
      const sha = await fingerprint(r);
      const em = await recordEmission({ reportId: CUSTOM_REPORT_ID, version: 1, title: s.layout.title || "Relatório personalizado", format: fmt, choice: s as never, sector: "personalizado", rows: r.rows.length, sha256: sha, reissueOf: reissue?.id ?? null, key: `rcq-${crypto.randomUUID()}` });
      const prov = [...describeSpec(cat, s.spec), `Linhas: ${r.rows.length}`, `Impressão digital SHA-256: ${sha}`, `Código de verificação: ${em.verification_code}`];
      const brand = { headerLines: s.layout.headerLines, title: s.layout.title || "Relatório personalizado" };
      const base = (s.layout.title || "relatorio").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 50);
      if (fmt === "csv") download(`${base}.csv`, new Blob([toCsv(r, brand, prov)], { type: "text/csv;charset=utf-8" }));
      else if (fmt === "xlsx") download(`${base}.xlsx`, new Blob([await toXlsx(r, brand, prov)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      else {
        const doc = renderCustomHtml(r, s.layout, prov, verificationBlock(em.verification_code, window.location.origin));
        const w = window.open("", "_blank"); if (w) { w.document.write(doc); w.document.close(); w.focus(); w.print(); } else setErr("O navegador bloqueou a janela de impressão; permita janelas para este site.");
      }
      const cmp = reissueComparison(reissue?.content_sha256 ?? null, sha);
      setNote(`Emitido (${fmt.toUpperCase()}, ${r.rows.length} linhas), código ${em.verification_code}.${reissue ? cmp === "identico" ? " Conteúdo idêntico ao original." : " Conteúdo DIFERENTE do original: os dados mudaram ou seu acesso mudou." : ""}`);
      void refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!cat) return <p role="status" className="text-sm text-muted-foreground">{err ?? "Carregando o catálogo de fontes…"}</p>;
  const scope = spec.source ? fieldsInScope(cat, spec) : [];
  const usable = scope.filter((f) => spec.includeSensitive || !f.def.sensitive);
  const joinsAvail = spec.source ? availableJoins(cat, spec) : [];
  const gaps = spec.source ? gapsFor(cat, spec) : [];
  const agg = aggregated(spec);

  return (
    <div className="space-y-4">
      {/* 1. Fonte e cruzamentos */}
      <section className={box} aria-label="Fontes">
        <h2 className="font-semibold">1. Fonte e cruzamentos</h2>
        <label className="block text-sm">Fonte principal{" "}
          <select aria-label="Fonte principal" className={inp} value={spec.source} onChange={(e) => { setSpecRaw(emptySpec(e.target.value)); setPage(null); }}>
            <option value="">— escolha —</option>
            {Object.entries(cat.sources).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </label>
        {spec.source && <p className="text-xs text-muted-foreground">Cada linha = {cat.sources[spec.source]?.grain}.</p>}
        {spec.joins.length > 0 && <ul className="space-y-1 text-sm">{spec.joins.map((id) => { const j = cat.joins.find((x) => x.id === id)!; return (
          <li key={id} className="flex items-center gap-2">{cat.sources[j.from]?.label} → {cat.sources[j.to]?.label} <span className="text-xs text-muted-foreground">({j.card}, por {j.on[0]})</span>
            <Button size="sm" variant="ghost" onClick={() => setSpec((s) => ({ ...s, joins: s.joins.filter((x) => x !== id) }))}>Remover</Button></li>); })}</ul>}
        {joinsAvail.length > 0 && <label className="block text-sm">Cruzar com{" "}
          <select aria-label="Acrescentar cruzamento" className={inp} value="" onChange={(e) => e.target.value && setSpec((s) => ({ ...s, joins: [...s.joins, e.target.value] }))}>
            <option value="">— escolha —</option>
            {joinsAvail.map((j) => <option key={j.id} value={j.id}>{cat.sources[j.from]?.label} → {cat.sources[j.to]?.label} ({j.card})</option>)}
          </select></label>}
        {gaps.length > 0 && <div className="rounded border border-border bg-muted/40 p-2 text-xs" aria-label="Ligações inexistentes"><p className="font-semibold">Ligações que não existem nos dados (o resto do gerador funciona):</p>
          <ul className="list-disc pl-4">{gaps.map((g) => <li key={g.from + g.to}>{cat.sources[g.from]?.label} × {cat.sources[g.to]?.label}: {g.reason}</li>)}</ul></div>}
        {spec.source && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spec.includeSensitive} onChange={(e) => setSpec((s) => ({ ...s, includeSensitive: e.target.checked }))} />
          Incluir dados pessoais (nomes, nascimento, matrícula) — só o que sua conta já pode ler; o QR público nunca mostra esses dados.</label>}
      </section>

      {/* Meus modelos */}
      <section className={box} aria-label="Modelos">
        <h2 className="font-semibold">Meus modelos</h2>
        <div className="flex flex-wrap gap-2"><input aria-label="Nome do modelo" className={inp} value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Nome do modelo" />
          <Button size="sm" disabled={busy || !spec.source || problems.length > 0 || !tplName.trim()} onClick={async () => { try { await saveCustomTemplate(tplName, spec, layout); setNote(`Modelo "${tplName.trim()}" salvo (nova versão).`); void refresh(); } catch (e) { setErr((e as Error).message); } }}>Salvar versão</Button>
          <Button size="sm" variant="outline" disabled title={CUSTOM_SHARE_REASON}>Compartilhar</Button></div>
        <p className="text-xs text-muted-foreground">{CUSTOM_SHARE_REASON}</p>
        <ul className="space-y-1 text-sm" aria-label="Meus modelos">{templates.map((t) => <li key={t.name} className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><span className="text-xs text-muted-foreground">v{t.version}</span>
          <Button size="sm" variant="outline" onClick={() => { setSpecRaw(pruneSpec(cat, { ...emptySpec(), ...t.spec })); setLayout({ ...defaultLayout(), ...t.layout }); setTplName(t.name); setPage(null); setNote(`Modelo "${t.name}" v${t.version} aberto.`); }}>Abrir</Button>
          <Button size="sm" variant="ghost" onClick={async () => { try { await saveCustomTemplate(copyName(t.name, templates), t.spec, t.layout); void refresh(); } catch (e) { setErr((e as Error).message); } }}>Duplicar</Button>
          <Button size="sm" variant="ghost" onClick={async () => { try { await saveCustomTemplate(t.name, t.spec, t.layout, true); void refresh(); } catch (e) { setErr((e as Error).message); } }}>Arquivar</Button></li>)}
          {!templates.length && <li className="text-muted-foreground">Nenhum modelo salvo.</li>}</ul>
      </section>

      {spec.source && <>
      {/* 2. Colunas */}
      <section className={box} aria-label="Colunas">
        <h2 className="font-semibold">2. Colunas {agg && <span className="text-xs font-normal text-muted-foreground">(com agrupamento, as colunas são os grupos e os cálculos)</span>}</h2>
        {!agg && <>
          <select aria-label="Acrescentar coluna" className={inp} value="" onChange={(e) => e.target.value && setSpec((s) => ({ ...s, columns: [...s.columns, e.target.value] }))}>
            <option value="">+ coluna…</option>
            {usable.filter((f) => !spec.columns.includes(f.ref)).map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
          </select>
          <ol className="space-y-1">{spec.columns.map((r, i) => (
            <li key={r} className="flex flex-wrap items-center gap-2 text-sm"><span className="w-6 text-muted-foreground">{i + 1}.</span>
              <input aria-label={`Título da coluna ${i + 1}`} className={inp} value={spec.labels[r] ?? ""} placeholder={fieldLabel(cat, r)} onChange={(e) => setSpec((s) => ({ ...s, labels: { ...s.labels, [r]: e.target.value } }))} />
              <Button size="sm" variant="ghost" disabled={i === 0} aria-label="Subir" onClick={() => setSpec((s) => { const c = [...s.columns]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; return { ...s, columns: c }; })}>↑</Button>
              <Button size="sm" variant="ghost" disabled={i === spec.columns.length - 1} aria-label="Descer" onClick={() => setSpec((s) => { const c = [...s.columns]; [c[i + 1], c[i]] = [c[i]!, c[i + 1]!]; return { ...s, columns: c }; })}>↓</Button>
              <Button size="sm" variant="ghost" onClick={() => setSpec((s) => ({ ...s, columns: s.columns.filter((x) => x !== r) }))}>Remover</Button></li>))}</ol>
        </>}
      </section>

      {/* 3. Filtros */}
      <section className={box} aria-label="Filtros">
        <h2 className="font-semibold">3. Filtros</h2>
        <FilterGroup cat={cat} fields={usable.map((f) => f.ref)} group={spec.filter} depth={0} onChange={(g) => setSpec((s) => ({ ...s, filter: g }))} />
      </section>

      {/* 4. Agrupamento e cálculos */}
      <section className={box} aria-label="Agrupamento e cálculos">
        <h2 className="font-semibold">4. Agrupamento e cálculos</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">Agrupar por:
          {spec.groupBy.map((r, i) => <span key={r} className="flex items-center gap-1 rounded border border-border px-2 py-0.5">{i + 1}. <input aria-label={`Título do grupo ${i + 1}`} className={inp} value={spec.labels[r] ?? ""} placeholder={fieldLabel(cat, r)} onChange={(e) => setSpec((s) => ({ ...s, labels: { ...s.labels, [r]: e.target.value } }))} />
            <button type="button" aria-label="Remover grupo" onClick={() => setSpec((s) => ({ ...s, groupBy: s.groupBy.filter((x) => x !== r) }))}>×</button></span>)}
          <select aria-label="Acrescentar agrupamento" className={inp} value="" onChange={(e) => e.target.value && setSpec((s) => ({ ...s, groupBy: [...s.groupBy, e.target.value], measures: s.measures.length ? s.measures : [{ agg: "count" }] }))}>
            <option value="">+ agrupar…</option>{usable.filter((f) => !spec.groupBy.includes(f.ref)).map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}
          </select>
        </div>
        <ul className="space-y-1">{spec.measures.map((m, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <select aria-label={`Cálculo ${i + 1}`} className={inp} value={m.agg} onChange={(e) => setSpec((s) => ({ ...s, measures: s.measures.map((x, k) => (k === i ? { ...x, agg: e.target.value as Aggregate } : x)) }))}>
              {(Object.keys(AGG_LABEL) as Aggregate[]).map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}</select>
            {AGG_NEEDS_FIELD[m.agg] !== "none" && <select aria-label={`Campo do cálculo ${i + 1}`} className={inp} value={m.field ?? ""} onChange={(e) => setSpec((s) => ({ ...s, measures: s.measures.map((x, k) => (k === i ? { ...x, field: e.target.value } : x)) }))}>
              <option value="">— campo —</option>{usable.filter((f) => AGG_NEEDS_FIELD[m.agg] === "any" || f.def.type === "number").map((f) => <option key={f.ref} value={f.ref}>{fieldLabel(cat, f.ref)}</option>)}</select>}
            <input aria-label={`Título do cálculo ${i + 1}`} className={inp} placeholder="Título (opcional)" value={spec.labels[`m${i}`] ?? ""} onChange={(e) => setSpec((s) => ({ ...s, labels: { ...s.labels, [`m${i}`]: e.target.value } }))} />
            <Button size="sm" variant="ghost" onClick={() => setSpec((s) => ({ ...s, measures: s.measures.filter((_, k) => k !== i) }))}>Remover</Button></li>))}</ul>
        <div className="flex flex-wrap gap-3 text-sm">
          <Button size="sm" variant="outline" onClick={() => setSpec((s) => ({ ...s, measures: [...s.measures, { agg: "count" }] }))}>+ cálculo</Button>
          <label className="flex items-center gap-2"><input type="checkbox" checked={spec.subtotals} disabled={!spec.groupBy.length} onChange={(e) => setSpec((s) => ({ ...s, subtotals: e.target.checked }))} />Subtotais e total geral</label>
        </div>
      </section>

      {/* 5. Ordenação */}
      <section className={box} aria-label="Ordenação">
        <h2 className="font-semibold">5. Ordenação</h2>
        <ul className="space-y-1 text-sm">{spec.sort.map((s, i) => <li key={i} className="flex items-center gap-2">{outs.find((o) => o.id === s.col)?.label ?? s.col}
          <select aria-label={`Direção ${i + 1}`} className={inp} value={s.dir} onChange={(e) => setSpec((x) => ({ ...x, sort: x.sort.map((y, k) => (k === i ? { ...y, dir: e.target.value as "asc" | "desc" } : y)) }))}><option value="asc">crescente</option><option value="desc">decrescente</option></select>
          <Button size="sm" variant="ghost" onClick={() => setSpec((x) => ({ ...x, sort: x.sort.filter((_, k) => k !== i) }))}>Remover</Button></li>)}</ul>
        <select aria-label="Ordenar por" className={inp} value="" onChange={(e) => e.target.value && setSpec((s) => ({ ...s, sort: [...s.sort, { col: e.target.value, dir: "asc" }] }))}>
          <option value="">+ ordenar por…</option>{outs.filter((o) => !spec.sort.some((s) => s.col === o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
      </section>

      {/* 6. Prévia */}
      <section className={box} aria-label="Prévia">
        <h2 className="font-semibold">6. Prévia</h2>
        {problems.length > 0 && <ul className="list-disc pl-4 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button disabled={busy || problems.length > 0} onClick={() => preview(0)}>{busy ? "Consultando…" : "Executar prévia"}</Button>
        {result && page && <>
          <p className="text-sm" aria-live="polite">{page.total} linha(s) no total · mostrando {page.total ? offset + 1 : 0}–{Math.min(offset + PAGE, page.total)}</p>
          <div className="overflow-x-auto"><table className="w-full border-collapse text-sm" aria-label="Resultado da prévia">
            <thead><tr>{result.columns.map((c) => <th key={c.id} scope="col" className="border border-border bg-muted px-2 py-1 text-left">{c.label}</th>)}</tr></thead>
            <tbody>{result.rows.map((r, i) => <tr key={i} className={r.some((v) => v === "SUBTOTAL" || v === "TOTAL GERAL") ? "font-semibold bg-muted/50" : ""}>{r.map((v, k) => <td key={k} className={`border border-border px-2 py-1 ${result.columns[k]?.kind === "number" ? "text-right" : ""}`}>{cellText(v)}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || offset === 0} onClick={() => preview(Math.max(0, offset - PAGE))}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={busy || offset + PAGE >= page.total} onClick={() => preview(offset + PAGE)}>Próxima</Button></div>
        </>}
      </section>

      {/* 7. Layout */}
      <section className={box} aria-label="Layout">
        <h2 className="font-semibold">7. Página e identidade</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <label>Título <input aria-label="Título do relatório" className={`${inp} w-full`} value={layout.title} onChange={(e) => setLayout({ ...layout, title: e.target.value })} /></label>
          <label>Subtítulo <input aria-label="Subtítulo" className={`${inp} w-full`} value={layout.subtitle} onChange={(e) => setLayout({ ...layout, subtitle: e.target.value })} /></label>
          <label>Papel <select aria-label="Papel" className={inp} value={layout.paper} onChange={(e) => setLayout({ ...layout, paper: e.target.value as "A4" | "A3" })}><option>A4</option><option>A3</option></select></label>
          <label>Orientação <select aria-label="Orientação" className={inp} value={layout.orientation} onChange={(e) => setLayout({ ...layout, orientation: e.target.value as "retrato" | "paisagem" })}><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></select></label>
          <label>Margem (mm) <input aria-label="Margem" type="number" className={inp} value={layout.marginMm} onChange={(e) => setLayout({ ...layout, marginMm: Number(e.target.value) })} /></label>
          <label>Fonte (pt) <input aria-label="Tamanho da fonte" type="number" className={inp} value={layout.fontPt} onChange={(e) => setLayout({ ...layout, fontPt: Number(e.target.value) })} /></label>
          <label>Brasão / logo <select aria-label="Logo" className={inp} value={layout.logoUrl ?? ""} onChange={(e) => setLayout({ ...layout, logoUrl: e.target.value || null })}><option value="">Sem logo</option>{INSTITUTIONAL_LOGOS.map((l) => <option key={l.id} value={l.url}>{l.label}</option>)}</select></label>
          <label>Rodapé <input aria-label="Rodapé" className={`${inp} w-full`} value={layout.footer} onChange={(e) => setLayout({ ...layout, footer: e.target.value })} /></label>
          <label className="sm:col-span-2">Cabeçalho (uma linha por linha) <textarea aria-label="Cabeçalho" className={`${inp} w-full`} rows={2} value={layout.headerLines.join("\n")} onChange={(e) => setLayout({ ...layout, headerLines: e.target.value.split("\n").slice(0, 5) })} /></label>
          <label className="sm:col-span-2">Assinaturas (uma por linha, até 4) <textarea aria-label="Assinaturas" className={`${inp} w-full`} rows={2} value={layout.signatures.join("\n")} onChange={(e) => setLayout({ ...layout, signatures: e.target.value.split("\n").filter((x, i, a) => x.trim() || i < a.length - 1).slice(0, 4) })} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={layout.pageNumbers} onChange={(e) => setLayout({ ...layout, pageNumbers: e.target.checked })} />Numerar páginas</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={layout.showProvenance} onChange={(e) => setLayout({ ...layout, showProvenance: e.target.checked })} />Mostrar fontes e filtros</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={layout.breakOnFirstColumn} onChange={(e) => setLayout({ ...layout, breakOnFirstColumn: e.target.checked })} />Nova página quando muda a 1ª coluna</label>
        </div>
        {layoutProblems(layout, outs.length).map((p) => <p key={p} className="text-sm text-destructive">{p}</p>)}
      </section>

      {/* 9. Exportar */}
      <section className={box} aria-label="Exportar">
        <h2 className="font-semibold">9. Exportar e emitir</h2>
        <p className="text-xs text-muted-foreground">O arquivo usa a mesma consulta da prévia, relida inteira no servidor com seu acesso, e é registrado com código e QR de verificação (sem dados pessoais no QR).</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || problems.length > 0} onClick={() => exportAs("pdf")}>PDF (imprimir)</Button>
          <Button variant="outline" disabled={busy || problems.length > 0} onClick={() => exportAs("xlsx")}>XLSX</Button>
          <Button variant="outline" disabled={busy || problems.length > 0} onClick={() => exportAs("csv")}>CSV</Button></div>
        {emissions.length > 0 && <ul className="space-y-1 text-sm" aria-label="Minhas emissões">{emissions.slice(0, 10).map((e) => <li key={e.id} className="flex flex-wrap items-center gap-2">
          <span>{e.title} · {e.format.toUpperCase()} · {e.row_count} linhas · {new Date(e.issued_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {e.verification_code}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => exportAs(e.format, e)}>Reprocessar</Button></li>)}</ul>}
      </section>
      </>}
      {note && <p role="status" className="rounded border border-border bg-muted p-2 text-sm">{note}</p>}
      {err && <p role="alert" className="rounded border border-destructive p-2 text-sm text-destructive">{err}</p>}
      {spec.source && <p className="text-xs text-muted-foreground">Fontes nesta consulta: {sourcesInQuery(cat, spec).map((s) => cat.sources[s]?.label).join(" + ")}.</p>}
    </div>
  );
}

function FilterGroup({ cat, fields, group, depth, onChange }: { cat: Catalog; fields: string[]; group: Group; depth: number; onChange: (g: Group) => void }) {
  const upd = (i: number, n: Condition | Group | null) => onChange({ ...group, items: n === null ? group.items.filter((_, k) => k !== i) : group.items.map((x, k) => (k === i ? n : x)) });
  return (
    <div className={`space-y-2 ${depth ? "rounded border border-dashed border-border p-2" : ""}`}>
      <label className="text-sm">Combinar condições com{" "}
        <select aria-label={`Combinação do grupo ${depth}`} className={inp} value={group.op} onChange={(e) => onChange({ ...group, op: e.target.value as "and" | "or" })}><option value="and">E (todas)</option><option value="or">OU (qualquer)</option></select></label>
      {group.items.map((n, i) => isGroup(n)
        ? <div key={i} className="flex items-start gap-2"><FilterGroup cat={cat} fields={fields} group={n} depth={depth + 1} onChange={(g) => upd(i, g)} /><Button size="sm" variant="ghost" onClick={() => upd(i, null)}>Remover grupo</Button></div>
        : <ConditionRow key={i} cat={cat} fields={fields} c={n} onChange={(c) => upd(i, c)} />)}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!fields.length} onClick={() => onChange({ ...group, items: [...group.items, { field: fields[0]!, operator: OPERATORS_BY_TYPE[fieldOf(cat, fields[0]!)!.type][0]!, value: "" }] })}>+ condição</Button>
        {depth < 2 && <Button size="sm" variant="outline" onClick={() => onChange({ ...group, items: [...group.items, { op: group.op === "and" ? "or" : "and", items: [] }] })}>+ grupo {group.op === "and" ? "OU" : "E"}</Button>}
      </div>
    </div>
  );
}

function ConditionRow({ cat, fields, c, onChange }: { cat: Catalog; fields: string[]; c: Condition | null; onChange: (c: Condition | null) => void }) {
  if (!c) return null;
  const t = fieldOf(cat, c.field)?.type ?? "text";
  const ops = OPERATORS_BY_TYPE[t];
  const kind = t === "number" ? "number" : t === "date" ? "date" : "text";
  const two = Array.isArray(c.value) ? (c.value as string[]) : ["", ""];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select aria-label="Campo do filtro" className={inp} value={c.field} onChange={(e) => { const nt = fieldOf(cat, e.target.value)?.type ?? "text"; onChange({ field: e.target.value, operator: OPERATORS_BY_TYPE[nt].includes(c.operator) ? c.operator : OPERATORS_BY_TYPE[nt][0]!, value: "" }); }}>
        {fields.map((f) => <option key={f} value={f}>{fieldLabel(cat, f)}</option>)}</select>
      <select aria-label="Operador" className={inp} value={c.operator} onChange={(e) => onChange({ ...c, operator: e.target.value as Operator, value: e.target.value === "between" ? ["", ""] : "" })}>
        {ops.map((o) => <option key={o} value={o}>{OPERATOR_LABEL[o]}</option>)}</select>
      {c.operator === "between" ? <>
        <input aria-label="Valor inicial" type={kind} className={inp} value={two[0] ?? ""} onChange={(e) => onChange({ ...c, value: [e.target.value, two[1] ?? ""] })} />
        <input aria-label="Valor final" type={kind} className={inp} value={two[1] ?? ""} onChange={(e) => onChange({ ...c, value: [two[0] ?? "", e.target.value] })} /></>
        : c.operator === "is_null" || c.operator === "not_null" ? null
        : t === "boolean" ? <select aria-label="Valor do filtro" className={inp} value={String(c.value ?? "")} onChange={(e) => onChange({ ...c, value: e.target.value })}><option value="">—</option><option value="true">sim</option><option value="false">não</option></select>
        : <input aria-label="Valor do filtro" type={c.operator === "in" ? "text" : kind} className={inp} value={String(c.value ?? "")} onChange={(e) => onChange({ ...c, value: e.target.value })} />}
      <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Remover</Button>
    </div>
  );
}
