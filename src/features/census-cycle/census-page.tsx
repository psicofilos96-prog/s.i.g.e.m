import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runReport, toCsv, toPrintableHtml, type ReportDefinition, type CellValue } from "@/features/reports/report-engine";
import {
  CENSUS_DOMAINS, CENSUS_RECONCILIATION_REPORT, CENSUS_SNAPSHOT_REPORT, DOMAIN_LABEL, DOMAIN_MEASURES, domainCoverage, isRepeatedImport,
  reconciliationRows, ruleDomain, snapshotReportRows,
} from "./census-domains";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import {
  CATEGORY_LABEL, EDUCACENSO_LAYOUT_STATUS, MEASURE_LABEL, STAGE_LABEL, censusMessage, coverage, measureText, nextStage, ruleLabel,
  summarizeCompare, type CompareRow, type CycleView, type SnapshotContent,
} from "./census-cycle";
import {
  advanceStage, conferSnapshot, openCycle, readCompare, readCycles, readLivePreview, readSchoolPending, readSnapshot, sha256Hex, stageSource, takeSnapshot,
} from "./census-cycle-source";
import { formatDateTime } from "@/lib/academic-date";

const errText = (e: unknown) => censusMessage(e instanceof Error ? e.message : String(e));
const short = (h: string | null | undefined) => (h ? `${h.slice(0, 12)}…` : "—");

export function CensusPage() {
  const [cycles, setCycles] = useState<CycleView[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [years, setYears] = useState<YearOption[]>([]);
  const load = () => readCycles().then((c) => { setCycles(c); setDenied(false); }, () => { setDenied(true); setCycles([]); });
  useEffect(() => { void load(); readYears().then(setYears).catch(() => setYears([])); }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="CIECE" title="Censo Escolar"
        description="Preparação, consistência e conferência anual a partir dos registros oficiais do SIGEM. Cada fotografia é imutável e tem impressão digital." />
      <StatePanel tone="warning" title={EDUCACENSO_LAYOUT_STATUS}
        description="Não há layout oficial do Educacenso homologado. Nenhum arquivo oficial é gerado e nenhuma regra do MEC/INEP é aplicada; só regras estruturais do próprio modelo." />
      {cycles === null ? <SkeletonState label="Carregando" />
        : denied ? <SchoolView years={years} />
        : <NetworkView cycles={cycles} years={years} onChanged={load} />}
    </div>
  );
}

function SchoolView({ years }: { years: YearOption[] }) {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState(""); const [year, setYear] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof readSchoolPending>> | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false })
      .then(({ data: d }) => { const m = new Map<string, string>(); for (const r of (d ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name); setSchools([...m].map(([id, name]) => ({ id, name }))); });
  }, []);
  useEffect(() => {
    setData(null); setErr(null);
    if (school && year) readSchoolPending(`censo-${year}`, school).then(setData, (e) => setErr(errText(e)));
  }, [school, year]);
  return (
    <section aria-labelledby="esc" className="space-y-3">
      <h2 id="esc" className="font-semibold">Pendências do Censo da sua escola</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Escola<select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Ano<select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Escolha</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label>
      </div>
      {err ? <StatePanel tone="warning" title="Indisponível" description={err} />
        : !data ? <EmptyState compact title="Escolha escola e ano" description="Você vê só a sua escola. Não há visão da rede nem alteração da fotografia." />
        : <div className="space-y-2 text-sm">
            {data.snapshot?.school ? <ul>{Object.entries(data.snapshot.school.measures).map(([k, m]) => <li key={k}>{MEASURE_LABEL[k] ?? k}: {measureText(m)}</li>)}</ul>
              : <p className="text-muted-foreground">Ainda não há fotografia deste ciclo.</p>}
            {data.snapshot?.findings.length ? <ul>{data.snapshot.findings.map((f) => <li key={f.rule}>{ruleLabel(f.rule)}: {f.count}</li>)}</ul> : null}
            <p>Itens pendentes agora: {data.live_items.length}</p>
            <ul className="max-h-60 overflow-auto">{data.live_items.slice(0, 200).map((i) => <li key={i.enrollment_id}>{ruleLabel(i.rule)} — vínculo {i.institutional_number ?? "sem número institucional"}</li>)}</ul>
          </div>}
    </section>
  );
}

function NetworkView({ cycles, years, onChanged }: { cycles: CycleView[]; years: YearOption[]; onChanged: () => void }) {
  const [year, setYear] = useState(""); const [ref, setRef] = useState(""); const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const free = years.filter((y) => !cycles.some((c) => c.academic_year_id === y.id));
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false })
      .then(({ data: d }) => { const m = new Map<string, string>(); for (const r of (d ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name); setNames(m); });
  }, []);
  return (
    <div className="space-y-6">
      {cycles.length === 0 ? <EmptyState title="Nenhum ciclo do Censo aberto" description="Abra o ciclo do ano com a data de referência oficial. O SIGEM não abre ciclos sozinho." /> : null}
      {cycles.map((c) => <CycleCard key={c.id} c={c} names={names} onChanged={onChanged} />)}
      <section aria-labelledby="novo" className="space-y-2 border-t border-border pt-4">
        <h2 id="novo" className="font-semibold">Abrir ciclo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Ano<select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Escolha</option>{free.map((y) => <option key={y.id} value={y.id}>{y.label}{y.state === "historico-importado" ? " (histórico importado)" : ""}</option>)}</select></label>
          <label className="text-sm">Data de referência<DateInput value={ref} onChange={(e) => setRef(e.target.value)} /></label>
          <label className="text-sm">Motivo<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        </div>
        <Button disabled={!year || !ref || !reason.trim()} onClick={() => openCycle(year, ref, reason.trim()).then(() => { setMsg("Ciclo aberto."); onChanged(); }, (e) => setMsg(errText(e)))}>Abrir ciclo</Button>
        {msg ? <p role="status" className="text-sm">{msg}</p> : null}
      </section>
    </div>
  );
}

const schoolName = (names: Map<string, string>, id: string) => names.get(id) ?? "Escola sem nome registrado";

function exportReport(def: ReportDefinition, rows: Record<string, CellValue>[], kind: "csv" | "pdf", meta: string[]) {
  const result = runReport(def, { params: {} }, rows);
  const branding = { headerLines: [], title: def.title };
  if (kind === "csv") {
    const url = URL.createObjectURL(new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${def.id}.csv`; a.click(); URL.revokeObjectURL(url);
  } else {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(toPrintableHtml(result, branding, meta)); w.document.close(); w.focus(); w.print();
  }
}

function CycleCard({ c, names, onChanged }: { c: CycleView; names: Map<string, string>; onChanged: () => void }) {
  const head = c.snapshots.find((s) => s.current) ?? null;
  const last = c.events[c.events.length - 1];
  const next = nextStage(last?.stage);
  const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [content, setContent] = useState<SnapshotContent | null>(null); const [live, setLive] = useState<string | null>(null);
  const [cmp, setCmp] = useState<CompareRow[] | null>(null);
  useEffect(() => { if (head) readSnapshot(head.id).then(setContent, () => setContent(null)); readLivePreview(c.id).then((p) => setLive(p.fingerprint), () => setLive(null)); }, [head?.id]);
  const run = (f: () => Promise<unknown>, ok: string) => { setMsg(null); f().then(() => { setMsg(ok); setReason(""); onChanged(); }, (e) => setMsg(errText(e))); };
  const cov = content ? coverage(content) : null;
  const meta = [`Ciclo ${c.academic_year_id} · referência ${c.reference_date}`, head ? `Fotografia v${head.version} · ${head.fingerprint}` : "Sem fotografia"];
  async function upload(file: File) {
    const text = await file.text();
    let rows: unknown; try { rows = JSON.parse(text); } catch { setMsg("Arquivo não é JSON válido. Nada foi recebido."); return; }
    const sha = await sha256Hex(text);
    if (isRepeatedImport(c.imports, sha)) { setMsg("Este mesmo arquivo já foi recebido; o registro anterior foi mantido."); return; }
    run(async () => stageSource({ cycle: c.id, origin: file.name, editionLayout: "agregado-por-escola", sha256: sha, rows }), "Fonte recebida; veja as rejeições abaixo. Nada do SIGEM foi alterado.");
  }
  const domainTable = (d: (typeof CENSUS_DOMAINS)[number]) => {
    if (!content) return <EmptyState compact title="Sem fotografia" description="Gere a fotografia para ver este domínio." />;
    const ms = DOMAIN_MEASURES[d];
    const finds = content.findings.filter((f) => ruleDomain(f.rule) === d);
    return (
      <div className="space-y-3 text-sm">
        <div className="max-h-96 overflow-auto"><table className="w-full text-xs">
          <caption className="sr-only">{DOMAIN_LABEL[d]} por escola</caption>
          <thead><tr><th className="text-left">Escola</th>{d === "escolas" ? <th className="text-left">Cadastro ativo</th> : ms.map((k) => <th key={k} className="text-left">{MEASURE_LABEL[k] ?? k}</th>)}</tr></thead>
          <tbody>{content.schools.map((s) => <tr key={s.school_id} className="border-t border-border"><td>{schoolName(names, s.school_id)}</td>
            {d === "escolas" ? <td>{s.active ? "sim" : "não"}</td> : ms.map((k) => <td key={k}>{measureText(s.measures[k])}</td>)}</tr>)}</tbody>
        </table></div>
        <div><h4 className="font-medium">Inconsistências deste domínio</h4>
          {finds.length === 0 ? <p className="text-muted-foreground">Nenhuma inconsistência estrutural encontrada.</p>
            : <ul>{finds.map((f) => <li key={`${f.rule}|${f.school_id}`}>{ruleLabel(f.rule)} — {schoolName(names, f.school_id)}: {f.count}</li>)}</ul>}</div>
      </div>);
  };
  return (
    <section aria-label={`Ciclo ${c.academic_year_id}`} className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Ciclo {c.academic_year_id}</h2>
        <StatusBadge tone={c.nature === "nativo" ? "info" : "neutral"}>{c.nature === "nativo" ? "Operação nativa" : "Observado/importado (histórico)"}</StatusBadge>
        <span className="text-sm text-muted-foreground">Referência {c.reference_date} · etapa: {last ? STAGE_LABEL[last.stage] : "—"}</span>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs">{c.events.map((e) => <li key={e.seq} className="rounded border border-border px-2 py-1">{e.seq}. {STAGE_LABEL[e.stage]} · {new Date(e.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {e.reason}</li>)}</ol>
      {head && live && live !== head.fingerprint ? <StatePanel tone="warning" title="Os fatos mudaram" description="Os registros mudaram depois da fotografia vigente; gere nova versão para conferir." /> : null}

      <Tabs defaultValue="cobertura">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
          {CENSUS_DOMAINS.map((d) => <TabsTrigger key={d} value={d}>{DOMAIN_LABEL[d]}</TabsTrigger>)}
          <TabsTrigger value="importacoes">Importações e reconciliação</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
        <TabsContent value="cobertura" className="space-y-2 text-sm">
          {!content || !cov ? <EmptyState compact title="Sem fotografia" description="Gere a fotografia do ciclo para ver cobertura e inconsistências." />
            : <>
                <p>{cov.known} medidas comprovadas · {cov.unknown} desconhecidas (nunca contadas como zero).</p>
                <table className="w-full text-xs"><caption className="sr-only">Cobertura por domínio</caption>
                  <thead><tr><th className="text-left">Domínio</th><th className="text-left">Conhecidas</th><th className="text-left">Desconhecidas</th><th className="text-left">Inconsistências</th></tr></thead>
                  <tbody>{domainCoverage(content).map((d) => <tr key={d.domain} className="border-t border-border"><td>{DOMAIN_LABEL[d.domain]}</td><td>{d.known}</td><td>{d.unknown}</td><td>{d.findings}</td></tr>)}</tbody></table>
                <p className="text-xs text-muted-foreground">Fora da fotografia: {content.domains_unavailable.map((d) => `${d.domain} (${d.reason})`).join("; ") || "nenhum"}</p>
              </>}
          <div className="space-y-1"><h3 className="font-medium">Fotografias</h3>
            {c.snapshots.length === 0 ? <p className="text-muted-foreground">Nenhuma fotografia.</p>
              : <ul>{c.snapshots.map((s) => <li key={s.id} className={s.current ? "" : "text-muted-foreground"}>v{s.version} · {short(s.fingerprint)} · {s.conferences} conferência(s){s.current ? " · vigente" : " · substituída"}{s.reason ? ` · ${s.reason}` : ""}</li>)}</ul>}</div>
        </TabsContent>
        {CENSUS_DOMAINS.map((d) => <TabsContent key={d} value={d}>{domainTable(d)}</TabsContent>)}
        <TabsContent value="importacoes" className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">Formato aceito: JSON com linhas agregadas {"{school_id, measure, value}"}, sem dados pessoais. Arquivos do Educacenso e planilhas do GPE são recusados até haver layout oficial. O mesmo arquivo nunca é recebido duas vezes. Nada do SIGEM é corrigido automaticamente.</p>
          <input type="file" accept="application/json" aria-label="Arquivo da fonte" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          {c.imports.length === 0 ? <p className="text-muted-foreground">Nenhuma fonte recebida neste ciclo.</p> : null}
          <ol className="space-y-2">{c.imports.map((i) => (
            <li key={i.id} className="rounded border border-border p-2">
              <p>{formatDateTime(i.created_at)} · {i.origin} · {i.accepted} linha(s) aceitas · {i.rejections.length} rejeitada(s) · hash {short(i.source_sha256)}</p>
              {i.rejections.length ? <details className="text-xs"><summary>Ver rejeições</summary><ul>{i.rejections.slice(0, 200).map((r) => <li key={r.row}>linha {r.row}: {r.reason}</li>)}</ul></details> : null}
              {head ? <Button size="sm" variant="outline" onClick={() => readCompare(head.id, i.id).then(setCmp, (e) => setMsg(errText(e)))}>Comparar com fotografia v{head.version}</Button> : null}
            </li>))}</ol>
          {cmp ? <div><p>{Object.entries(summarizeCompare(cmp)).map(([k, n]) => `${CATEGORY_LABEL[k] ?? k}: ${n}`).join(" · ")}</p>
            <ul className="max-h-60 overflow-auto text-xs">{cmp.filter((r) => r.category !== "igual" && r.category !== "ausente-na-fonte").slice(0, 200).map((r) => (
              <li key={`${r.school_id}|${r.measure}`}>{schoolName(names, r.school_id)} · {MEASURE_LABEL[r.measure] ?? r.measure}: SIGEM {r.sigem_value ?? "desconhecido"} × fonte {r.source_value ?? "sem valor"} — {CATEGORY_LABEL[r.category]}</li>))}</ul></div> : null}
        </TabsContent>
        <TabsContent value="relatorios" className="space-y-3 text-sm">
          {!content ? <EmptyState compact title="Sem fotografia" description="Os relatórios saem da fotografia vigente." />
            : <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => exportReport(CENSUS_SNAPSHOT_REPORT, snapshotReportRows(content, names), "csv", meta)}>Fotografia por escola (CSV)</Button>
                <Button size="sm" variant="outline" onClick={() => exportReport(CENSUS_SNAPSHOT_REPORT, snapshotReportRows(content, names), "pdf", meta)}>Fotografia por escola (PDF)</Button>
                {cmp ? <>
                  <Button size="sm" variant="outline" onClick={() => exportReport(CENSUS_RECONCILIATION_REPORT, reconciliationRows(cmp, names, MEASURE_LABEL, CATEGORY_LABEL), "csv", meta)}>Reconciliação (CSV)</Button>
                  <Button size="sm" variant="outline" onClick={() => exportReport(CENSUS_RECONCILIATION_REPORT, reconciliationRows(cmp, names, MEASURE_LABEL, CATEGORY_LABEL), "pdf", meta)}>Reconciliação (PDF)</Button>
                </> : <p className="text-muted-foreground">Para o relatório de reconciliação, compare uma fonte na aba de importações.</p>}
              </div>}
          <p className="text-xs text-muted-foreground">Arquivo oficial do Educacenso: indisponível até haver layout homologado.</p>
        </TabsContent>
      </Tabs>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input aria-label="Motivo" placeholder="Motivo / observação" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => run(() => takeSnapshot(c.id, head?.id ?? null, reason.trim() || null), "Fotografia gerada.")}>{head ? "Nova versão da fotografia" : "Gerar fotografia"}</Button>
        <Button size="sm" variant="outline" disabled={!head} onClick={() => head && run(() => conferSnapshot(head.id, head.fingerprint, reason.trim() || null), "Conferência registrada.")}>Conferir {short(head?.fingerprint)}</Button>
        <Button size="sm" disabled={!next || !reason.trim()} onClick={() => next && last && run(() => advanceStage(c.id, last.seq, next, reason.trim()), "Etapa registrada.")}>{next ? `Avançar: ${STAGE_LABEL[next]}` : "Ciclo concluído"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Homologação do Censo: indisponível até existir regra e competência homologadas.</p>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    </section>
  );
}
