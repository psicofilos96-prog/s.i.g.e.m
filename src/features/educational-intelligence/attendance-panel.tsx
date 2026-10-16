import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { operationalToday } from "@/lib/academic-date";
import { DECLARED_2026, compareDeclared, outreachState, type AttendanceResult, type OutreachEvent } from "./attendance-performance";
import { INFREQ_REPORT, canOpenCase, countBy, infreqReportRows, infrequencyAlerts, periodOrder, type InfrequencyRow } from "./infrequency-source";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const pct = (x: number | null) => (x == null ? "não apurado" : `${x.toFixed(1)}%`);
const save = (b: Blob, n: string) => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); };
type Case = { id: string; school_id: string; class_id: string; student_id: string; enrollment_id: string | null; basis_mode: string; basis_period: string; basis_presence_pct: number; responsible_label: string | null };
type Ev = { id: string; case_id: string; seq: number; kind: string; guardian_label: string | null; channel: string | null; destination: string | null; due_date: string | null; note: string; author_user_id: string; recorded_at: string };

export function AttendancePanel() {
  const [rows, setRows] = useState<InfrequencyRow[] | { error: string } | null>(null);
  const [cases, setCases] = useState<{ c: Case[]; e: Ev[] }>({ c: [], e: [] });
  const [names, setNames] = useState(new Map<string, string>());
  const [period, setPeriod] = useState(1);
  const [ALERT_THRESHOLD_PCT, setThreshold] = useState(75);
  useEffect(() => { void rpc("aa_infrequency_threshold").then((r) => { if (!r.error && typeof r.data === "number") setThreshold(r.data); }); }, []);
  const [mode, setMode] = useState<"periodo" | "acumulado">("periodo");
  const [msg, setMsg] = useState<string | null>(null);
  const [ev, setEv] = useState<Record<string, { kind: string; guardian: string; channel: string; destination: string; due: string; note: string }>>({});

  const load = useCallback(async () => {
    const [a, c, e] = await Promise.all([rpc("aa_infrequency_at", { _school: null, _from: null, _to: null }),
      supabase.from("aa_outreach_cases").select("*").limit(1000), supabase.from("aa_outreach_events").select("*").order("seq").limit(1000)]);
    if (a.error) { setRows({ error: governError(a.error).userMessage }); return; }
    setRows((a.data ?? []) as InfrequencyRow[]);
    setCases({ c: (c.data ?? []) as unknown as Case[], e: (e.data ?? []) as unknown as Ev[] });
    try { setNames(await readCurrentSchoolNames()); } catch { /* código no lugar do nome */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const periods = useMemo(() => Array.isArray(rows) ? periodOrder(rows) : [], [rows]);
  const res = useMemo(() => Array.isArray(rows) ? infrequencyAlerts(rows, period, ALERT_THRESHOLD_PCT) : null, [rows, period, ALERT_THRESHOLD_PCT]);
  const cmp = compareDeclared(DECLARED_2026[0]!, DECLARED_2026[1]!);
  const school = (id: string) => names.get(id) ?? id;

  const declared = (
    <section aria-label="Totais declarados" className="rounded-md border p-3 text-sm space-y-2">
      <h3 className="font-semibold">Totais históricos declarados — 2026</h3>
      <ul className="space-y-1">{DECLARED_2026.map((d) => (
        <li key={d.period} className="flex flex-wrap items-center gap-2"><span>{d.label} {d.period}: <strong>{d.total}</strong></span>
          <StatusBadge tone="warning">Não auditado</StatusBadge><StatusBadge tone="neutral">Não deduplicado</StatusBadge></li>))}</ul>
      <p className="text-muted-foreground">{cmp.note}</p>
    </section>);

  if (rows == null) return <SkeletonState label="Carregando frequência" />;
  if (!Array.isArray(rows)) return <div className="space-y-3"><StatePanel tone="warning" title="Frequência não disponível para esta conta" description={`${rows.error} É preciso a permissão "acompanhar-infrequencia" na escola ou na rede.`} />{declared}</div>;

  const list = res ? (mode === "periodo" ? res.periodo : res.acumulado) : [];
  const counts = countBy(list);
  const alerts = list.filter((r) => r.status === "alerta").sort((a, b) => (a.presencePct ?? 0) - (b.presencePct ?? 0));
  const bySchool = [...alerts.reduce((m, r) => m.set(r.schoolId, (m.get(r.schoolId) ?? 0) + 1), new Map<string, number>())].map(([k, v]) => ({ escola: school(k), alertas: v }));
  const label = `${mode === "periodo" ? "Período" : "Acumulado até o período"} ${period}`;
  const caseOf = (r: AttendanceResult) => cases.c.find((c) => c.student_id === r.studentId && c.class_id === r.classId && c.basis_mode === mode && c.basis_period === String(period));

  const open = async (r: AttendanceResult) => {
    const { error } = await rpc("aa_open_outreach_case", { _school: r.schoolId, _class: r.classId, _student: r.studentId, _enrollment: r.enrollmentId, _mode: mode, _period: String(period), _pct: r.presencePct, _responsible: null });
    setMsg(error ? governError(error).userMessage : "Caso de busca ativa aberto."); if (!error) void load();
  };
  const record = async (c: Case, seq: number) => {
    const f = ev[c.id]; if (!f) return;
    const { error } = await rpc("aa_record_outreach_event", { _case: c.id, _expected_seq: seq, _kind: f.kind, _guardian: f.guardian, _channel: f.channel, _destination: f.destination, _due: f.due || null, _note: f.note });
    setMsg(error ? governError(error).userMessage : "Registro incluído no histórico."); if (!error) { setEv({ ...ev, [c.id]: { ...f, note: "" } }); void load(); }
  };
  const exportAs = async (fmt: "pdf" | "xlsx") => {
    const r = runReport(INFREQ_REPORT, { params: {} }, infreqReportRows(alerts.map((x) => ({ mode: label, r: x })), school, (id) => id.slice(0, 8)));
    const branding = { headerLines: ["Secretaria Municipal de Educação", "Acompanhamento e Avaliação"], title: `${INFREQ_REPORT.title} — ${label}` };
    const meta = [`Gerado em ${new Date().toLocaleString("pt-BR")}`, `Alerta somente abaixo de ${ALERT_THRESHOLD_PCT}%; não indica reprovação. Base: chamadas concluídas no Diário.`];
    if (fmt === "xlsx") save(new Blob([await toXlsx(r, branding, meta)]), "infrequencia.xlsx");
    else save(await toPdfFile(r, branding, meta, { landscape: true, signatures: ["Coordenação de Acompanhamento e Avaliação"] }), "infrequencia.pdf");
  };

  return (
    <div className="space-y-4">
      <StatePanel tone="info" title="Infrequência a partir do Diário" description={`Conta as aulas com chamada concluída enquanto o estudante estava enturmado. Aula sem marcação fica fora da conta e aparece à parte. Alerta somente abaixo de ${ALERT_THRESHOLD_PCT}%; exatamente ${ALERT_THRESHOLD_PCT}% fica fora. O alerta não reprova ninguém.`} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">Período <select className={field} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
          {(periods.length ? periods : [{ index: 1, id: "", start: "" }]).map((p) => <option key={p.index} value={p.index}>{p.index}º{p.start ? ` (desde ${p.start.split("-").reverse().join("/")})` : ""}</option>)}</select></label>
        <label className="text-sm">Recorte <select className={field} value={mode} onChange={(e) => setMode(e.target.value as "periodo" | "acumulado")}><option value="periodo">Só o período</option><option value="acumulado">Acumulado</option></select></label>
        <Button size="sm" variant="outline" onClick={() => void exportAs("pdf")}>PDF</Button>
        <Button size="sm" variant="outline" onClick={() => void exportAs("xlsx")}>XLSX</Button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {rows.length === 0 ? <StatePanel title="Nenhuma chamada concluída visível" description="Ainda não há chamadas concluídas no Diário para as turmas que esta conta acompanha." /> : (<>
        <p className="text-sm">{label}: <strong>{counts.alerta}</strong> em alerta · {counts.semAlerta} sem alerta · {counts.naoApurado} não apurados
          {res && res.transferred.length > 0 && ` · ${res.transferred.length} estudante(s) em mais de uma turma (linhas separadas, não somadas)`}
          {res && res.withoutPeriod > 0 && ` · ${res.withoutPeriod} registro(s) de aula sem período (fora da conta)`}</p>
        {bySchool.length > 0 && <div className="h-56" aria-hidden="true"><ResponsiveContainer><BarChart data={bySchool}><XAxis dataKey="escola" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="alertas" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></div>}
        <table className="w-full text-sm"><caption className="sr-only">Estudantes em alerta — {label}</caption>
          <thead><tr>{["Escola", "Turma", "Estudante", "Aulas", "Faltas", "Presença", "Sem marcação", "Busca ativa"].map((h) => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
          <tbody>{alerts.map((r) => { const c = caseOf(r); return (
            <tr key={`${r.enrollmentId}|${r.classId}`}><td>{school(r.schoolId)}</td><td>{r.classId.slice(0, 8)}</td><td>{r.studentId.slice(0, 8)}</td><td>{r.planned}</td><td>{r.absences}</td><td>{pct(r.presencePct)}</td>
              <td>{res?.unmarked.get(`${r.enrollmentId}|${r.classId}`) ?? 0}</td>
              <td>{c ? "Caso aberto" : canOpenCase(r, ALERT_THRESHOLD_PCT) && <Button size="sm" variant="ghost" onClick={() => void open(r)}>Abrir caso</Button>}</td></tr>); })}</tbody></table>
      </>)}
      <section aria-label="Casos de busca ativa" className="space-y-2">
        <h3 className="font-semibold">Casos de busca ativa</h3>
        {cases.c.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum caso aberto.</p> : cases.c.map((c) => {
          const evs = cases.e.filter((e) => e.case_id === c.id);
          const st = outreachState(evs.map((e): OutreachEvent => ({ at: e.recorded_at, kind: e.kind === "resolucao" ? "encerramento" : e.kind === "responsavel" ? "contato" : e.kind as OutreachEvent["kind"], author: e.author_user_id, guardian: e.guardian_label ?? (e.kind === "responsavel" ? "-" : null), destination: e.destination, due: e.due_date, note: e.note })), operationalToday());
          const f = ev[c.id] ?? { kind: "contato", guardian: "", channel: "", destination: "", due: "", note: "" };
          const setF = (k: keyof typeof f) => (e: { target: { value: string } }) => setEv({ ...ev, [c.id]: { ...f, [k]: e.target.value } });
          return (
            <details key={c.id} className="rounded-md border p-2 text-sm"><summary className="cursor-pointer">{school(c.school_id)} · estudante {c.student_id.slice(0, 8)} · {c.basis_mode} {c.basis_period} · {pct(Number(c.basis_presence_pct))} — <strong>{st.state}</strong>{st.overdue && <StatusBadge tone="danger">Prazo vencido</StatusBadge>}</summary>
              <ol className="my-2 space-y-1">{evs.map((e) => <li key={e.id}>{e.seq}. {e.recorded_at.slice(0, 10).split("-").reverse().join("/")} — {e.kind}{e.guardian_label ? ` · ${e.guardian_label}` : ""}{e.channel ? ` (${e.channel})` : ""}{e.destination ? ` → ${e.destination}` : ""}{e.due_date ? ` · prazo ${e.due_date.split("-").reverse().join("/")}` : ""}: {e.note}</li>)}</ol>
              {st.state !== "encerrado" && <div className="flex flex-wrap gap-2">
                <select className={field} value={f.kind} onChange={setF("kind")} aria-label="Tipo de registro"><option value="responsavel">Responsável pelo caso</option><option value="contato">Contato com responsável</option><option value="encaminhamento">Encaminhamento</option><option value="retorno">Retorno</option><option value="resolucao">Resolução</option></select>
                {(f.kind === "contato" || f.kind === "responsavel") && <input className={field} placeholder={f.kind === "contato" ? "Responsável contatado" : "Responsável pelo caso"} value={f.guardian} onChange={setF("guardian")} />}
                {f.kind === "contato" && <input className={field} placeholder="Meio (telefone, visita…)" value={f.channel} onChange={setF("channel")} />}
                {f.kind === "encaminhamento" && <><input className={field} placeholder="Destino (Conselho Tutelar, CRAS…)" value={f.destination} onChange={setF("destination")} /><DateInput className={field} aria-label="Prazo" value={f.due} onChange={setF("due")} /></>}
                <input className={`${field} min-w-64`} placeholder="Descrição (mín. 5 caracteres)" value={f.note} onChange={setF("note")} />
                <Button size="sm" onClick={() => void record(c, evs.length)}>Registrar</Button>
              </div>}
            </details>);
        })}
      </section>
      {declared}
    </div>
  );
}
