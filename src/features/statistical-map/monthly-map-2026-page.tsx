import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegistryHero, registryTd, registryTh, registryRow } from "@/components/sigem/registry-layout";
import { brand } from "@/config/branding";
import { exportMap } from "./census-map-2026";
import { operationalToday } from "@/lib/academic-date";
import {
  MEASURES, MONTHS, MONTHLY_REPORT, STATUS_LABEL, compareMonths, effectiveRow, latestClosures, monthlyCells, networkMonth, normalizeMonthly,
  referenceDate, canFreeze, provenance, type Closure,
} from "./monthly-map-2026";
import { EXPECTED_MONTHS, IDENTITY_NOTICE, SECTION_LABEL, STATE_LABEL, compareDeclared, declaredCoverage, projectAll, projectDeclared, type DeclaredMap } from "./declared-monthly-map";
import { CATEGORY_LABEL, NETWORK_FILTERS, type NetworkFilter, NETWORK_FILTER_LABEL, classifySchool, declaredOccurrences, matchesNetwork, networkLabel, type SchoolClassification } from "./declared-inconsistencies";
import type { ReportDefinition } from "@/features/reports/report-engine";

type Rpc = (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;

async function loadMonth(month: number) {
  const [live, cl] = await Promise.all([
    rpc("monthly_map_2026_live_v2", { _month: month }),
    supabase.from("monthly_map_2026_closures").select("*").eq("map_year", 2026).eq("map_month", month),
  ]);
  if (live.error) throw new Error(live.error.message);
  const closures = latestClosures(((cl.data ?? []) as unknown) as Closure[]);
  const rows = normalizeMonthly((live.data ?? []) as Record<string, unknown>[])
    .map((r) => effectiveRow(r, closures.get(`${r.school_id}:${month}`)))
    .sort((a, b) => (a.school_name ?? "").localeCompare(b.school_name ?? "", "pt-BR"));
  return { rows, history: ((cl.data ?? []) as unknown) as Closure[] };
}

function refusal(m: string): string {
  if (/capacidade/.test(m)) return "Apuração recusada: sua conta não tem a competência de oficializar o mapa desta escola.";
  if (/não encerrado/.test(m)) return "Apuração recusada: o mês ainda não terminou (mapa provisório).";
  if (/evidência datada/.test(m)) return "Apuração recusada: o mês não tem evidência datada suficiente (estimativa parcial).";
  if (/justificativa/.test(m)) return "Apuração recusada: escreva uma justificativa com pelo menos 10 caracteres.";
  return "Apuração recusada pelo banco. Nada foi gravado.";
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

  const [rede, setRede] = useState<string>("");
  const clsQ = useSchoolClassification();
  const rows = useMemo(() => (cur.data?.rows ?? []).filter((r) => (!school || r.school_id === school)
    && (!rede || matchesNetwork(clsQ.data?.get(r.school_id), rede as NetworkFilter))
    && (!q || `${r.school_name} ${r.inep}`.toLowerCase().includes(q.toLowerCase()))), [cur.data, school, q, rede, clsQ.data]);
  const byCategory = useMemo(() => clsQ.data ? networkMonthByCategory(cur.data?.rows ?? [], clsQ.data) : null, [cur.data, clsQ.data]);
  const prevRows = useMemo(() => (prev.data?.rows ?? []).filter((r) => !school || r.school_id === school), [prev.data, school]);
  const net = networkMonth(rows);
  const comparison = compareMonths(networkMonth(prevRows).totals, net.totals);
  const selected = school ? rows[0] : undefined;

  if (cur.isLoading) return <LoadingState label="Lendo o mapa do mês" />;
  if (cur.error) return <div role="alert" className="p-6">Não foi possível ler o mapa deste mês. Verifique sua sessão e tente novamente.</div>;

  const meta = [`Ano letivo 2026 · Mês de referência: ${MONTHS[month - 1]} · Data de referência: ${dateBr(referenceDate(month))} (último dia do mês; regra do Mapa sem versão homologada)`,
    selected ? `Escola: ${selected.school_name ?? ""} · INEP ${selected.inep ?? "não informado"}` : `Recorte: ${rows.length} escolas visíveis · ${net.apuradas} apuradas · ${net.estimadas} estimativa parcial · ${net.provisorias} provisórias`];
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
    setMsg(error ? refusal(error.message) : "Apuração registrada e congelada.");
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
        <label className="text-sm">Rede
          <select className="ml-2 rounded border border-input bg-background px-2 py-1" value={rede} onChange={(e) => setRede(e.target.value)} disabled={!clsQ.data}>
            <option value="">Todas</option>
            {NETWORK_FILTERS.map((f) => <option key={f} value={f}>{NETWORK_FILTER_LABEL[f]}</option>)}
          </select></label>
        <Input className="max-w-xs" placeholder="Buscar por nome ou INEP" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar escola" />
        <div className="flex gap-2">{(["pdf", "xlsx", "csv"] as const).map((f) => <Button key={f} size="sm" variant="outline" onClick={() => download(f)}>{f === "pdf" ? "PDF (A4 paisagem)" : f.toUpperCase()}</Button>)}</div>
      </div>

      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Data de referência: <strong>{dateBr(referenceDate(month))}</strong>. {net.apuradas} de {net.schools} escolas apuradas por evidência datada
        {net.estimadas ? ` · ${net.estimadas} em estimativa parcial (fotografia de carga, sem movimentos datados)` : ""}
        {net.provisorias ? ` · ${net.provisorias} provisórias (mês não encerrado; nunca congeladas automaticamente)` : ""}
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

      {mode === "rede" && (
        <section aria-labelledby="cat-h" className="overflow-x-auto">
          <h2 id="cat-h" className="mb-2 font-display text-lg">Consolidado por categoria — {MONTHS[month - 1]}</h2>
          {clsQ.error ? <p role="alert" className="text-sm">Não foi possível ler a classificação das escolas; o consolidado por categoria não é exibido (nunca zero).</p>
            : !byCategory ? <p className="text-sm text-muted-foreground">Lendo classificação das escolas…</p> : (
            <table className="w-full text-sm"><thead><tr>
              <th scope="col" className={registryTh}>Categoria</th><th scope="col" className={registryTh}>Escolas</th><th scope="col" className={registryTh}>Situação</th>
              {MEASURES.map(([k, l]) => <th key={k} scope="col" className={registryTh}>{l}</th>)}</tr></thead>
              <tbody>{byCategory.map((c) => <tr key={c.key} className={registryRow}>
                <td className={registryTd}>{c.label}</td><td className={registryTd}>{c.net.schools}</td>
                <td className={registryTd}>{c.net.apuradas} apuradas · {c.net.estimadas} estimativa · {c.net.provisorias} provisórias · {c.net.naoApuradas} não apuradas</td>
                {MEASURES.map(([k]) => <td key={k} className={registryTd}>{fmt(c.net.totals[k])}</td>)}</tr>)}</tbody>
            </table>)}
          <p className="mt-1 text-xs text-muted-foreground">A conveniada rural conta em "Conveniada" e em "Zona rural"; por isso as linhas de zona não somam com as de dependência. Estimativa parcial não é mês apurado.</p>
        </section>
      )}

      <section aria-labelledby="esc-h" className="overflow-x-auto">
        <h2 id="esc-h" className="mb-2 font-display text-lg">Escolas no mês</h2>
        <table className="w-full text-sm"><thead><tr>
          <th scope="col" className={registryTh}>Escola</th><th scope="col" className={registryTh}>Situação</th>
          {MEASURES.map(([k, l]) => <th key={k} scope="col" className={registryTh}>{l}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.school_id} className={registryRow}>
            <td className={registryTd}>{r.school_name}<div className="text-xs text-muted-foreground">INEP {r.inep ?? "não informado"}</div></td>
            <td className={registryTd}>{r.frozen ? `Apuração v${r.frozen.version} congelada` : STATUS_LABEL[r.status]}
              {!r.frozen && r.status !== "nao-apurado" ? <div className="text-xs text-muted-foreground">Cobertura datada: {r.coverage_pct ?? "—"}% · {provenance(r)}</div> : null}
              {r.driftFromFrozen.length ? <div className="text-xs text-muted-foreground">Registros mudaram após a apuração</div> : null}</td>
            {MEASURES.map(([k]) => <td key={k} className={registryTd}>{fmt(r[k])}</td>)}</tr>)}</tbody>
        </table>
      </section>

      {selected && <DeclaredPanel schoolId={selected.school_id} month={month} sigem={selected} registryInep={selected.inep ?? null} />}
      {mode === "rede" && <DeclaredCoveragePanel names={new Map((cur.data?.rows ?? []).map((r) => [r.school_id, { name: r.school_name ?? r.school_id, inep: r.inep ?? null }]))} />}

      {selected && (
        <section aria-labelledby="ap-h" className="space-y-2 rounded-md border border-border p-4">
          <h2 id="ap-h" className="font-display text-lg">Apuração do mês — {selected.school_name}</h2>
          <p className="text-sm text-muted-foreground">Só mês encerrado e apurado por evidência datada pode ser congelado; estimativa parcial e mês provisório não. Apuração e revisão exigem justificativa; revisão cria nova versão. Só contas com a competência de oficializar o mapa nesta escola conseguem registrar.</p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justificativa (mín. 10 caracteres)" aria-label="Justificativa da apuração" />
          <Button size="sm" disabled={!canFreeze(selected, operationalToday()) || reason.trim().length < 10} onClick={record}>{selected.frozen ? "Registrar revisão" : "Apurar e congelar o mês"}</Button>
          {msg && <p role="status" className="text-sm">{msg}</p>}
          {history.length > 0 && <ul className="text-sm">{history.map((h) => <li key={h.version}>v{h.version} · {h.kind === "apuracao" ? "apuração" : "revisão"} · {new Date(h.created_at).toLocaleString("pt-BR")}{h.reason ? ` · ${h.reason}` : ""}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}

const DECLARED_COLS = "school_id,inep_declared,year,month,source_file,source_sheet,shifts,previous_month_enrollment,transfers_in,new_students,transfers_out,dropouts,withdrawn_cancelled,total_ii,declared_classes,total_iii,classes,consistency_issues,originating_act_ref";
const VERDICT: Record<string, string> = { coincide: "Coincide", diverge: "Diverge", indisponivel: "Sem dado para comparar", "referencia-nao-apurada": "Sem veredito: o mês do SIGEM não está apurado" };

function DeclaredPanel({ schoolId, month, sigem, registryInep }: { schoolId: string; month: number; registryInep: string | null; sigem: { distinct_students: number | null; classes_with_students: number | null; status: string } }) {
  const q = useQuery({
    queryKey: ["mapa-declarado-2026", schoolId, month],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_declared_monthly_maps" as never).select(DECLARED_COLS).eq("school_id", schoolId).eq("year", 2026).in("month", [month - 1, month]);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown) as DeclaredMap[];
    },
  });
  if (q.isLoading) return <LoadingState label="Lendo o mapa declarado pela escola" />;
  if (q.error) return <p role="alert" className="text-sm">Não foi possível ler o mapa declarado pela escola.</p>;
  const all = q.data ?? [];
  const prevs = all.filter((d) => d.month === month - 1);
  const list = all.filter((d) => d.month === month);
  return (
    <section aria-labelledby="dec-h" className="space-y-2 rounded-md border border-border p-4">
      <h2 id="dec-h" className="font-display text-lg">Mapa declarado pela escola — {MONTHS[month - 1]}</h2>
      <p className="text-xs text-muted-foreground">Declaração documental da escola, preservada como enviada. Não é o mapa calculado pelo SIGEM nem mapa homologado.</p>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">A escola não enviou planilha deste mês.</p> : list.map((d) => {
        const p = projectDeclared(d, registryInep, prevs.length === 1 ? prevs[0] : null);
        return (
          <div key={d.source_sheet + d.source_file} className="space-y-2 text-sm">
            <p><strong>{STATE_LABEL[p.state]}</strong> · Seção I {SECTION_LABEL[p.section_i]} · Seção II {SECTION_LABEL[p.section_ii]} · Seção III {SECTION_LABEL[p.section_iii]}</p>
            {p.identity !== "confirmada" && <div role="alert" className="rounded border border-border bg-muted/40 p-2"><strong>Identidade não confirmada.</strong> {IDENTITY_NOTICE} (planilha: {p.inep_declared ?? "sem INEP"}; cadastro: {registryInep ?? "não informado"})</div>}
            <p className="text-muted-foreground">Fonte: planilha "{d.source_file}", aba {d.source_sheet}.</p>
            <p>Anterior {fmt(d.previous_month_enrollment)} · recebidas {fmt(d.transfers_in)} · novos {fmt(d.new_students)} · expedidas {fmt(d.transfers_out)} · evadidos {fmt(d.dropouts)} · desistentes/cancelados {fmt(d.withdrawn_cancelled)} → total declarado {fmt(d.total_ii)}{p.balance !== null && p.balance !== d.total_ii ? ` (a conta dá ${p.balance})` : ""}</p>
            <table className="w-full"><thead><tr><th scope="col" className={registryTh}>Medida</th><th scope="col" className={registryTh}>Declarado</th><th scope="col" className={registryTh}>SIGEM ({STATUS_LABEL[sigem.status as keyof typeof STATUS_LABEL] ?? sigem.status})</th><th scope="col" className={registryTh}>Situação</th></tr></thead>
              <tbody>{compareDeclared(d, sigem).map((c) => <tr key={c.field} className={registryRow}><td className={registryTd}>{c.field}</td><td className={registryTd}>{fmt(c.declared)}</td><td className={registryTd}>{fmt(c.sigem)}</td>
                <td className={registryTd}>{VERDICT[c.status]}</td></tr>)}</tbody></table>
            {p.class_groups.length > 0 && <details><summary>Turmas declaradas ({p.class_groups.length} turmas em {p.class_lines} linhas)</summary><ul>{p.class_groups.map((c, i) => <li key={i}>{c.multisseriada ? "Multisseriada · " : ""}{c.etapas.join(" + ") || "etapa não informada"} · {c.turma}: {c.alunos}</li>)}</ul></details>}
            {p.issues.length > 0 && <div role="note" className="rounded border border-border bg-muted/40 p-2"><strong>Ressalvas:</strong><ul className="list-disc pl-5">{p.issues.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          </div>
        );
      })}
    </section>
  );
}

const DECLARED_REPORT: ReportDefinition = {
  id: "mapas-declarados-2026", version: 1, title: "Mapas mensais declarados 2026 — cobertura", description: "Declaração documental das escolas; não é apuração nem homologação.",
  source: "school_declared_monthly_maps", params: [], formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
  columns: [
    { id: "inep", label: "INEP cadastro", kind: "text" }, { id: "school", label: "Escola", kind: "text" }, { id: "mes", label: "Mês", kind: "text" },
    { id: "inep_planilha", label: "INEP planilha", kind: "text" }, { id: "identidade", label: "Identidade", kind: "text" }, { id: "estado", label: "Estado", kind: "text" },
    { id: "s1", label: "Seção I", kind: "text" }, { id: "s2", label: "Seção II", kind: "text" }, { id: "s3", label: "Seção III", kind: "text" },
    { id: "anterior", label: "Mês anterior", kind: "text" }, { id: "total", label: "Total declarado", kind: "number" }, { id: "turmas", label: "Turmas (agrupadas)", kind: "number" },
  ],
};

function DeclaredCoveragePanel({ names }: { names: Map<string, { name: string; inep: string | null }> }) {
  const q = useQuery({
    queryKey: ["mapas-declarados-cobertura-2026"],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_declared_monthly_maps" as never).select(DECLARED_COLS).eq("year", 2026).order("school_id").order("month").range(0, 4999);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown) as DeclaredMap[];
    },
  });
  if (q.isLoading) return <LoadingState label="Lendo a cobertura dos mapas declarados" />;
  if (q.error) return <p role="alert" className="text-sm">Não foi possível ler os mapas declarados.</p>;
  const maps = q.data ?? [];
  const projs = projectAll(maps, (s) => names.get(s)?.inep ?? null);
  const cov = declaredCoverage(projs, names.size || 55);
  const totals = new Map(maps.map((m) => [`${m.school_id}:${m.month}`, m.total_ii]));
  async function download(format: "csv" | "xlsx" | "pdf") {
    const cells = projs.map((p) => ({ inep: p.registry_inep, school: names.get(p.school_id)?.name ?? p.school_id, mes: MONTHS[p.month - 1] ?? String(p.month),
      inep_planilha: p.inep_declared, identidade: p.identity === "confirmada" ? "confirmada" : "associada por nome — reconciliação documental pendente",
      estado: STATE_LABEL[p.state], s1: SECTION_LABEL[p.section_i], s2: SECTION_LABEL[p.section_ii], s3: SECTION_LABEL[p.section_iii],
      anterior: p.previous_month_check, total: totals.get(`${p.school_id}:${p.month}`) ?? null, turmas: p.class_groups.length }));
    const blob = await exportMap(DECLARED_REPORT, cells, format, { headerLines: [brand.name, "Mapas mensais declarados 2026"], title: DECLARED_REPORT.title },
      ["Ano letivo 2026 · meses de fevereiro a setembro", "Declaração documental; não é apuração do SIGEM nem homologação", `${cov.schools_declared}/${cov.schools_total} escolas · ${cov.competences} competências`]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mapas-declarados-2026.${format === "pdf" ? "html" : format}`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <section aria-labelledby="cov-h" className="space-y-2 rounded-md border border-border p-4">
      <h2 id="cov-h" className="font-display text-lg">Mapas declarados pelas escolas — cobertura 2026</h2>
      <p className="text-sm">{cov.schools_declared}/{cov.schools_total} escolas · {cov.competences} meses declarados · {cov.with_ressalvas} com ressalvas · {cov.unconfirmed_identity.length} escola(s) com identidade não confirmada{cov.duplicated.length ? ` · ${cov.duplicated.length} mês(es) duplicado(s)` : ""}</p>
      <div className="flex gap-2">{(["pdf", "xlsx", "csv"] as const).map((f) => <Button key={f} size="sm" variant="outline" onClick={() => void download(f)}>{f.toUpperCase()}</Button>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th scope="col" className={registryTh}>Escola</th><th scope="col" className={registryTh}>Meses declarados</th><th scope="col" className={registryTh}>Faltam (fev–set)</th><th scope="col" className={registryTh}>Com ressalvas</th><th scope="col" className={registryTh}>Identidade</th></tr></thead>
        <tbody>{cov.per_school.map((s) => <tr key={s.school_id} className={registryRow}><td className={registryTd}>{names.get(s.school_id)?.name ?? s.school_id}</td><td className={registryTd}>{s.months.map((m) => MONTHS[m - 1]?.slice(0, 3)).join(", ")}</td>
          <td className={registryTd}>{s.missing.map((m) => MONTHS[m - 1]?.slice(0, 3)).join(", ") || "nenhum"}</td><td className={registryTd}>{s.ressalvas}</td>
          <td className={registryTd}>{s.identity === "confirmada" ? "Confirmada" : "Associada por nome — exige reconciliação documental"}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Escolas sem nenhuma planilha não aparecem na tabela. Novos lotes entram sem duplicar: a mesma aba do mesmo arquivo é gravada uma única vez, e as declarações gravadas não podem ser alteradas.</p>
      <InconsistencyPanel maps={maps} projs={projs} names={names} />
    </section>
  );
}

const OCC_REPORT: ReportDefinition = {
  id: "inconsistencias-mapas-2026", version: 1, title: "Inconsistências dos mapas mensais declarados 2026", description: "Ocorrências pendentes de conferência; não alteram o valor declarado.",
  source: "school_declared_monthly_maps", params: [], formats: ["xlsx", "csv", "pdf"], reproducible: false, syncRowLimit: 5000,
  columns: [
    { id: "id", label: "ID", kind: "text" }, { id: "rede", label: "Rede", kind: "text" }, { id: "school", label: "Escola", kind: "text" }, { id: "inep", label: "INEP", kind: "text" }, { id: "mes", label: "Mês", kind: "text" },
    { id: "categoria", label: "Categoria", kind: "text" }, { id: "secao", label: "Seção", kind: "text" }, { id: "campo", label: "Campo", kind: "text" },
    { id: "declarado", label: "Declarado", kind: "text" }, { id: "esperado", label: "Esperado/calculado", kind: "text" }, { id: "regra", label: "Regra", kind: "text" },
    { id: "descricao", label: "Descrição", kind: "text" }, { id: "gravidade", label: "Gravidade", kind: "text" }, { id: "certeza", label: "Certeza", kind: "text" },
    { id: "arquivo", label: "Arquivo", kind: "text" }, { id: "aba", label: "Aba", kind: "text" }, { id: "status", label: "Status", kind: "text" }, { id: "sugestao", label: "Sugestão", kind: "text" },
  ],
};

function useSchoolClassification() {
  return useQuery({
    queryKey: ["classificacao-escolas-cadastro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutional_school_record_versions").select("school_id,version_number,location_kind,administrative_dependency").order("version_number", { ascending: false }).range(0, 4999);
      if (error) throw new Error(error.message);
      const m = new Map<string, SchoolClassification>();
      for (const r of data ?? []) if (!m.has(r.school_id)) m.set(r.school_id, classifySchool(r));
      return m;
    },
  });
}

function InconsistencyPanel({ maps, projs, names }: { maps: DeclaredMap[]; projs: ReturnType<typeof projectAll>; names: Map<string, { name: string; inep: string | null }> }) {
  const [fs, setFs] = useState(""); const [fc, setFc] = useState<string>(""); const [fm, setFm] = useState<string>(""); const [fr, setFr] = useState<string>("");
  const all = useMemo(() => declaredOccurrences(maps, projs, EXPECTED_MONTHS), [maps, projs]);
  const cls = useSchoolClassification();
  const redeOf = cls.data ?? new Map<string, SchoolClassification>();
  const declaredSchools = [...new Set(maps.map((m) => m.school_id))];
  const rows = all.filter((o) => (!fs || o.school_id === fs) && (!fc || o.category === fc) && (!fm || String(o.month) === fm) && (!fr || matchesNetwork(redeOf.get(o.school_id), fr as (typeof NETWORK_FILTERS)[number])));
  const byRede = NETWORK_FILTERS.map((r) => { const sc = declaredSchools.filter((k) => matchesNetwork(redeOf.get(k), r));
    const comp = new Set(maps.filter((m) => sc.includes(m.school_id) && (EXPECTED_MONTHS as readonly number[]).includes(m.month)).map((m) => `${m.school_id}:${m.month}`)).size;
    return { r, escolas: sc.length, comp, faltam: sc.length * EXPECTED_MONTHS.length - comp, occ: all.filter((o) => sc.includes(o.school_id)).length }; });
  const unclassified = declaredSchools.filter((k) => networkLabel(redeOf.get(k)) === "Não classificada").length;
  const nm = (s: string) => names.get(s)?.name ?? s;
  async function download(format: "csv" | "xlsx" | "pdf") {
    const cells = rows.map((o) => ({ id: o.id, rede: networkLabel(redeOf.get(o.school_id)), school: nm(o.school_id), inep: names.get(o.school_id)?.inep ?? null, mes: MONTHS[o.month - 1] ?? String(o.month), categoria: CATEGORY_LABEL[o.category],
      secao: o.section, campo: o.field, declarado: o.declared, esperado: o.expected, regra: o.rule, descricao: o.description, gravidade: o.severity, certeza: o.certainty, arquivo: o.source_file, aba: o.source_sheet, status: o.status, sugestao: o.suggestion }));
    const blob = await exportMap(OCC_REPORT, cells, format, { headerLines: [brand.name, OCC_REPORT.title], title: OCC_REPORT.title }, ["Ano letivo 2026", `${rows.length} ocorrência(s) · todas pendentes de conferência`]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `inconsistencias-mapas-2026.${format === "pdf" ? "html" : format}`; a.click(); URL.revokeObjectURL(a.href);
  }
  const schools = [...new Set(all.map((o) => o.school_id))].sort((a, b) => nm(a).localeCompare(nm(b)));
  return (
    <div className="space-y-2 pt-4">
      <h3 className="font-display text-base">Inconsistências {fs ? "da escola" : "da rede"} ({rows.length} de {all.length})</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>Escola <select className="rounded border border-border bg-background px-2 py-1" value={fs} onChange={(e) => setFs(e.target.value)}><option value="">Rede (todas)</option>{schools.map((s) => <option key={s} value={s}>{nm(s)}</option>)}</select></label>
        <label>Rede <select className="rounded border border-border bg-background px-2 py-1" value={fr} onChange={(e) => setFr(e.target.value)}><option value="">Todas</option>{NETWORK_FILTERS.map((r) => <option key={r} value={r}>{NETWORK_FILTER_LABEL[r]}</option>)}</select></label>
        <label>Categoria <select className="rounded border border-border bg-background px-2 py-1" value={fc} onChange={(e) => setFc(e.target.value)}><option value="">Todas</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Mês <select className="rounded border border-border bg-background px-2 py-1" value={fm} onChange={(e) => setFm(e.target.value)}><option value="">Todos</option>{EXPECTED_MONTHS.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}</select></label>
        {(["xlsx", "csv", "pdf"] as const).map((f) => <Button key={f} size="sm" variant="outline" onClick={() => void download(f)}>{f.toUpperCase()}</Button>)}
      </div>
      <table className="w-full text-sm"><thead><tr>{["Rede", "Escolas", "Meses declarados (fev–set)", "Meses ausentes (fev–set)", "Ocorrências"].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}</tr></thead>
        <tbody>{byRede.map((b) => <tr key={b.r} className={registryRow}><td className={registryTd}>{NETWORK_FILTER_LABEL[b.r]}</td><td className={registryTd}>{b.escolas}</td><td className={registryTd}>{b.comp}</td><td className={registryTd}>{b.faltam}</td><td className={registryTd}>{b.occ}</td></tr>)}
          <tr className={registryRow}><td className={registryTd}>Consolidado da rede</td><td className={registryTd}>{declaredSchools.length}</td><td className={registryTd}>{new Set(maps.filter((m) => (EXPECTED_MONTHS as readonly number[]).includes(m.month)).map((m) => `${m.school_id}:${m.month}`)).size}</td><td className={registryTd}>{declaredSchools.length * EXPECTED_MONTHS.length - new Set(maps.filter((m) => (EXPECTED_MONTHS as readonly number[]).includes(m.month)).map((m) => `${m.school_id}:${m.month}`)).size}</td><td className={registryTd}>{all.length}</td></tr></tbody></table>
      {cls.error ? <p role="alert" className="text-xs">Classificação das escolas indisponível: as linhas por rede não foram calculadas (não significa zero).</p> : cls.isLoading ? <p className="text-xs">Lendo a classificação das escolas…</p> : <p className="text-xs text-muted-foreground">Localização e dependência vêm do cadastro da escola, em duas dimensões: uma conveniada rural aparece em "Conveniada" e em "Zona rural". As linhas por rede se sobrepõem; o consolidado não é a soma delas.{unclassified ? ` ${unclassified} escola(s) sem classificação no cadastro.` : ""}</p>}
      <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr>{["Escola", "Mês", "Categoria", "Seção/campo", "Declarado", "Esperado", "Gravidade", "Descrição"].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 300).map((o) => <tr key={o.id} className={registryRow}><td className={registryTd}>{nm(o.school_id)}</td><td className={registryTd}>{MONTHS[o.month - 1]}</td><td className={registryTd}>{CATEGORY_LABEL[o.category]}</td>
          <td className={registryTd}>{o.section} · {o.field}</td><td className={registryTd}>{o.declared}</td><td className={registryTd}>{o.expected}</td><td className={registryTd}>{o.severity}</td><td className={registryTd}>{o.description}</td></tr>)}</tbody></table></div>
      {rows.length > 300 && <p className="text-xs">Mostrando 300 de {rows.length}; a exportação inclui todas.</p>}
      <p className="text-xs text-muted-foreground">Leitura com as mesmas permissões da tela. A conferência nominal de pessoal não fica no sistema: está só na planilha restrita da auditoria.</p>
    </div>
  );
}
