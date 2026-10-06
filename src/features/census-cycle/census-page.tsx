import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import {
  CATEGORY_LABEL, EDUCACENSO_LAYOUT_STATUS, MEASURE_LABEL, STAGE_LABEL, censusMessage, coverage, measureText, nextStage, ruleLabel,
  summarizeCompare, type CompareRow, type CycleView, type SnapshotContent,
} from "./census-cycle";
import {
  advanceStage, conferSnapshot, openCycle, readCompare, readCycles, readLivePreview, readSchoolPending, readSnapshot, sha256Hex, stageSource, takeSnapshot,
} from "./census-cycle-source";

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
      {cycles === null ? <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
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
            <ul className="max-h-60 overflow-auto">{data.live_items.slice(0, 200).map((i) => <li key={i.enrollment_id}>{ruleLabel(i.rule)} — vínculo {i.institutional_number ?? i.enrollment_id}</li>)}</ul>
          </div>}
    </section>
  );
}

function NetworkView({ cycles, years, onChanged }: { cycles: CycleView[]; years: YearOption[]; onChanged: () => void }) {
  const [year, setYear] = useState(""); const [ref, setRef] = useState(""); const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const free = years.filter((y) => !cycles.some((c) => c.academic_year_id === y.id));
  return (
    <div className="space-y-6">
      {cycles.length === 0 ? <EmptyState title="Nenhum ciclo do Censo aberto" description="Abra o ciclo do ano com a data de referência oficial. O SIGEM não abre ciclos sozinho." /> : null}
      {cycles.map((c) => <CycleCard key={c.id} c={c} onChanged={onChanged} />)}
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

function CycleCard({ c, onChanged }: { c: CycleView; onChanged: () => void }) {
  const head = c.snapshots.find((s) => s.current) ?? null;
  const last = c.events[c.events.length - 1];
  const next = nextStage(last?.stage);
  const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [content, setContent] = useState<SnapshotContent | null>(null); const [live, setLive] = useState<string | null>(null);
  const [cmp, setCmp] = useState<CompareRow[] | null>(null);
  useEffect(() => { if (head) readSnapshot(head.id).then(setContent, () => setContent(null)); readLivePreview(c.id).then((p) => setLive(p.fingerprint), () => setLive(null)); }, [head?.id]);
  const run = (f: () => Promise<unknown>, ok: string) => { setMsg(null); f().then(() => { setMsg(ok); setReason(""); onChanged(); }, (e) => setMsg(errText(e))); };
  const cov = content ? coverage(content) : null;
  async function upload(file: File) {
    const text = await file.text();
    let rows: unknown; try { rows = JSON.parse(text); } catch { setMsg("Arquivo não é JSON válido."); return; }
    run(async () => stageSource({ cycle: c.id, origin: file.name, editionLayout: "agregado-por-escola", sha256: await sha256Hex(text), rows }), "Fonte recebida; veja as rejeições abaixo.");
  }
  return (
    <section aria-label={`Ciclo ${c.id}`} className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Ciclo {c.academic_year_id}</h2>
        <StatusBadge tone={c.nature === "nativo" ? "info" : "neutral"}>{c.nature === "nativo" ? "Operação nativa" : "Observado/importado (histórico)"}</StatusBadge>
        <span className="text-sm text-muted-foreground">Referência {c.reference_date} · etapa: {last ? STAGE_LABEL[last.stage] : "—"}</span>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs">{c.events.map((e) => <li key={e.seq} className="rounded border border-border px-2 py-1">{e.seq}. {STAGE_LABEL[e.stage]} · {new Date(e.created_at).toLocaleDateString("pt-BR")} · {e.reason}</li>)}</ol>

      <div className="space-y-1 text-sm">
        <h3 className="font-medium">Fotografias</h3>
        {c.snapshots.length === 0 ? <p className="text-muted-foreground">Nenhuma fotografia.</p>
          : <ul>{c.snapshots.map((s) => <li key={s.id} className={s.current ? "" : "text-muted-foreground"}>v{s.version} · {short(s.fingerprint)} · {s.conferences} conferência(s){s.current ? " · vigente" : " · substituída"}{s.reason ? ` · ${s.reason}` : ""}</li>)}</ul>}
        {head && live && live !== head.fingerprint ? <p className="text-warning">Os fatos mudaram depois da fotografia vigente; gere nova versão para conferir.</p> : null}
      </div>

      {content && cov ? (
        <div className="space-y-2 text-sm">
          <p>Cobertura: {cov.known} medidas comprovadas · {cov.unknown} desconhecidas (nunca contadas como zero).</p>
          <details><summary className="cursor-pointer font-medium">Medidas por escola ({content.schools.length})</summary>
            <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Escola</th>{Object.keys(MEASURE_LABEL).map((k) => <th key={k} className="text-left">{MEASURE_LABEL[k]}</th>)}</tr></thead>
              <tbody>{content.schools.map((s) => <tr key={s.school_id} className="border-t border-border"><td>{s.school_id}</td>{Object.keys(MEASURE_LABEL).map((k) => <td key={k}>{measureText(s.measures[k])}</td>)}</tr>)}</tbody></table></div>
          </details>
          <div><h3 className="font-medium">Inconsistências estruturais ({content.rule_set})</h3>
            {content.findings.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p>
              : <ul>{content.findings.map((f) => <li key={`${f.rule}|${f.school_id}`}>{ruleLabel(f.rule)} — {f.school_id}: {f.count}</li>)}</ul>}</div>
          <p className="text-xs text-muted-foreground">Fora da fotografia: {content.domains_unavailable.map((d) => `${d.domain} (${d.reason})`).join("; ")}</p>
        </div>) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input aria-label="Motivo" placeholder="Motivo / observação" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => run(() => takeSnapshot(c.id, head?.id ?? null, reason.trim() || null), "Fotografia gerada.")}>{head ? "Nova versão da fotografia" : "Gerar fotografia"}</Button>
        <Button size="sm" variant="outline" disabled={!head} onClick={() => head && run(() => conferSnapshot(head.id, head.fingerprint, reason.trim() || null), "Conferência registrada.")}>Conferir {short(head?.fingerprint)}</Button>
        <Button size="sm" disabled={!next || !reason.trim()} onClick={() => next && last && run(() => advanceStage(c.id, last.seq, next, reason.trim()), "Etapa registrada.")}>{next ? `Avançar: ${STAGE_LABEL[next]}` : "Ciclo concluído"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Homologação do Censo: indisponível até existir regra e competência homologadas.</p>

      <div className="space-y-2 text-sm">
        <h3 className="font-medium">Fonte externa (staging)</h3>
        <p className="text-xs text-muted-foreground">Formato aceito: JSON com linhas agregadas {"{school_id, measure, value}"}, sem dados pessoais. Arquivos do Educacenso são recusados até haver layout homologado. Nada é corrigido automaticamente.</p>
        <input type="file" accept="application/json" aria-label="Arquivo da fonte" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        {c.imports.map((i) => (
          <div key={i.id} className="rounded border border-border p-2">
            <p>{i.origin} · {i.parser} · hash {short(i.source_sha256)} · {i.accepted} aceitas · {i.rejections.length} rejeitadas</p>
            {i.rejections.length ? <p className="text-xs text-muted-foreground">Rejeições: {i.rejections.slice(0, 20).map((r) => `linha ${r.row}: ${r.reason}`).join("; ")}</p> : null}
            {head ? <Button size="sm" variant="outline" onClick={() => readCompare(head.id, i.id).then(setCmp, (e) => setMsg(errText(e)))}>Comparar com fotografia v{head.version}</Button> : null}
          </div>))}
        {cmp ? <div><p>{Object.entries(summarizeCompare(cmp)).map(([k, n]) => `${CATEGORY_LABEL[k] ?? k}: ${n}`).join(" · ")}</p>
          <ul className="max-h-60 overflow-auto text-xs">{cmp.filter((r) => r.category !== "igual" && r.category !== "ausente-na-fonte").slice(0, 200).map((r) => (
            <li key={`${r.school_id}|${r.measure}`}>{r.school_id} · {MEASURE_LABEL[r.measure] ?? r.measure}: SIGEM {r.sigem_value ?? "desconhecido"} × fonte {r.source_value ?? "sem valor"} — {CATEGORY_LABEL[r.category]}</li>))}</ul></div> : null}
      </div>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    </section>
  );
}
