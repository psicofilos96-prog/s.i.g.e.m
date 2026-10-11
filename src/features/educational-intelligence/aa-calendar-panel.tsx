import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { projectCalendar, KIND_LABEL, type CalItem, type StatusEv, type CalView } from "./aa-calendar";

import { DateInput } from "@/components/sigem/date-input";
import { operationalToday } from "@/lib/academic-date";
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const STATE_LABEL = { planejado: "Planejado", "em-andamento": "Em andamento", concluido: "Concluído", "nao-realizado": "Não realizado" } as const;

export function AaCalendarPanel() {
  const [data, setData] = useState<{ items: CalItem[]; st: StatusEv[] } | { error: string } | null>(null);
  const [caps, setCaps] = useState({ manter: false, acompanhar: false });
  const [today] = useState(() => operationalToday());
  const [year, setYear] = useState(2026);
  const [warn, setWarn] = useState(7);
  const [seg, setSeg] = useState(""); const [kind, setKind] = useState(""); const [rel, setRel] = useState("DIRETA"); const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b, m, c] = await Promise.all([
      supabase.from("aa_calendar_items").select("*").limit(1000),
      supabase.from("aa_calendar_status_events").select("*").limit(1000),
      rpc("has_network_capability", { _capability: "manter-calendario-avaliacao" }),
      rpc("has_network_capability", { _capability: "acompanhar-calendario-avaliacao" }),
    ]);
    if (a.error || b.error) setData({ error: governError((a.error ?? b.error)!).userMessage });
    else setData({ items: a.data as unknown as CalItem[], st: b.data as unknown as StatusEv[] });
    setCaps({ manter: m.data === true, acompanhar: c.data === true || m.data === true });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const views = useMemo(() => (data && "items" in data ? projectCalendar(data.items, data.st, today, warn, year) : []), [data, today, warn, year]);
  const segments = useMemo(() => [...new Set(views.map((v) => v.current.segment))].sort(), [views]);
  const shown = views.filter((v) => (!seg || v.current.segment === seg) && (!kind || v.current.kind === kind) && (!rel || v.current.relation === rel) && (!onlyAlerts || v.alert));
  const byMonth = useMemo(() => {
    const m = new Map<string, CalView[]>();
    for (const v of shown) { const k = v.current.start_date?.slice(0, 7) ?? "sem data"; m.set(k, [...(m.get(k) ?? []), v]); }
    return [...m];
  }, [shown]);

  if (!data) return <SkeletonState />;
  if ("error" in data) return <StatePanel tone="warning" title="Calendário indisponível" description={data.error} />;
  const late = views.filter((v) => v.alert === "atrasado").length, soon = views.filter((v) => v.alert === "proximo").length;

  return (
    <div className="space-y-3">
      <StatePanel tone="info" title="Calendário operacional de Acompanhamento e Avaliação" description="Datas carregadas do Cronograma Unificado 2026 (1º semestre) e do Calendário Unificado do 2º semestre 2026, com arquivo e linha de origem. Valem só para a edição 2026 e não se repetem em outros anos. O tipo de ação foi classificado por palavra-chave e pode ser conferido na linha de origem." />
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="grid">Ano<select className={field} value={year} onChange={(e) => setYear(Number(e.target.value))}>{[2026, 2027].map((y) => <option key={y}>{y}</option>)}</select></label>
        <label className="grid">Segmento<select className={field} value={seg} onChange={(e) => setSeg(e.target.value)}><option value="">Todos</option>{segments.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="grid">Tipo<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="grid">Relação com A&A<select className={field} value={rel} onChange={(e) => setRel(e.target.value)}><option value="">Todas</option><option>DIRETA</option><option>ACOMPANHAMENTO</option><option>GERAL</option></select></label>
        <label className="grid">Avisar com (dias)<input type="number" min={0} max={60} className={`${field} w-20`} value={warn} onChange={(e) => setWarn(Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />Só com alerta</label>
      </div>
      <div className="flex flex-wrap gap-2 text-sm"><StatusBadge tone="neutral">{views.length} ações em {year}</StatusBadge><StatusBadge tone="danger">{late} atrasadas</StatusBadge><StatusBadge tone="warning">{soon} próximas</StatusBadge></div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {views.length === 0 && <StatePanel title={`Nenhuma ação registrada para ${year}`} description="As datas de outro ano não são copiadas. Uma nova edição precisa do seu próprio cronograma." />}
      {byMonth.map(([month, list]) => (
        <section key={month} className="rounded-md border">
          <h3 className="border-b bg-muted/40 px-3 py-1.5 text-sm font-semibold">{month === "sem data" ? "Sem data definida" : new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
          <ul className="divide-y">{list.map((v) => (
            <li key={v.current.logical_id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="w-28 shrink-0">{v.current.date_text}</strong><span className="w-32 shrink-0 text-muted-foreground">{v.current.segment}</span>
                <span className="min-w-0 flex-1">{v.current.action}</span>
                <StatusBadge tone="neutral">{KIND_LABEL[v.current.kind] ?? v.current.kind}</StatusBadge>
                {v.current.event_kind === "cancelamento" ? <StatusBadge tone="neutral">Cancelado</StatusBadge> : <StatusBadge tone={v.state === "concluido" ? "success" : "neutral"}>{STATE_LABEL[v.state]}</StatusBadge>}
                {v.reprogrammed && v.current.event_kind !== "cancelamento" && <StatusBadge tone="info">Reprogramado</StatusBadge>}
                {v.alert === "atrasado" && <StatusBadge tone="danger">Atrasado</StatusBadge>}
                {v.alert === "proximo" && <StatusBadge tone="warning">Próximo</StatusBadge>}
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === v.current.logical_id ? null : v.current.logical_id)}>{open === v.current.logical_id ? "Fechar" : "Detalhes"}</Button>
              </div>
              {open === v.current.logical_id && <ItemDetail v={v} caps={caps} onDone={(m) => { setMsg(m); void load(); }} />}
            </li>))}</ul>
        </section>))}
    </div>
  );
}

function ItemDetail({ v, caps, onDone }: { v: CalView; caps: { manter: boolean; acompanhar: boolean }; onDone: (m: string) => void }) {
  const [start, setStart] = useState(v.current.start_date ?? ""); const [end, setEnd] = useState(v.current.end_date ?? "");
  const [resp, setResp] = useState(v.current.responsible ?? ""); const [reason, setReason] = useState("");
  const [state, setState] = useState<StatusEv["state"]>("em-andamento"); const [evidence, setEvidence] = useState("");
  const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  const reprogram = async (k: "reprogramacao" | "cancelamento") => {
    const { error } = await rpc("aa_calendar_reprogram", { _logical: v.current.logical_id, _expected_version: v.current.version, _kind: k, _start: start || null, _end: end || start || null,
      _date_text: start ? (end && end !== start ? `${fmt(start)} a ${fmt(end)}` : fmt(start)) : null, _responsible: resp, _reason: reason });
    onDone(error ? governError(error).userMessage : k === "cancelamento" ? "Ação cancelada; o histórico foi mantido." : "Nova data registrada como nova versão.");
  };
  const status = async () => {
    const { error } = await rpc("aa_calendar_record_status", { _logical: v.current.logical_id, _expected_seq: v.seq, _state: state, _evidence: evidence });
    onDone(error ? governError(error).userMessage : "Situação registrada em seu nome.");
  };
  const closing = state === "concluido" || state === "nao-realizado";
  return (
    <div className="mt-2 grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2">
      <div className="space-y-1">
        <h4 className="font-semibold">Histórico</h4>
        <ul className="space-y-1 text-xs">{v.history.map((h) => (
          <li key={h.id}>v{h.version} · {h.event_kind} · {h.date_text}{h.responsible ? ` · resp.: ${h.responsible}` : ""}{h.reason ? ` · motivo: ${h.reason}` : ""} · {h.executor_label ? `carga técnica (linha ${h.source_line} da fonte)` : "registrado por pessoa"}</li>))}
          {v.statuses.map((s) => <li key={s.seq}>Situação {s.seq}: {STATE_LABEL[s.state]}{s.evidence ? ` · evidência: ${s.evidence}` : ""} · {new Date(s.recorded_at).toLocaleString("pt-BR")}</li>)}
        </ul>
      </div>
      <div className="space-y-3">
        {caps.manter && v.current.event_kind !== "cancelamento" ? (
          <div className="space-y-1"><h4 className="font-semibold">Reprogramar</h4>
            <div className="flex flex-wrap gap-1"><DateInput className={field} value={start} onChange={(e) => setStart(e.target.value)} /><DateInput className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
              <input className={field} placeholder="Responsável" value={resp} onChange={(e) => setResp(e.target.value)} /><input className={field} placeholder="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div className="flex gap-1"><Button size="sm" disabled={reason.trim().length < 5 || !start} onClick={() => void reprogram("reprogramacao")}>Registrar nova data</Button>
              <Button size="sm" variant="outline" disabled={reason.trim().length < 5} onClick={() => void reprogram("cancelamento")}>Cancelar ação</Button></div></div>
        ) : !caps.manter ? <p className="text-xs text-muted-foreground">Reprogramar exige a permissão de manter o calendário de avaliação.</p> : null}
        {caps.acompanhar && v.current.event_kind !== "cancelamento" ? (
          <div className="space-y-1"><h4 className="font-semibold">Situação</h4>
            <div className="flex flex-wrap gap-1"><select className={field} value={state} onChange={(e) => setState(e.target.value as StatusEv["state"])}>{Object.entries(STATE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input className={`${field} flex-1`} placeholder={closing ? "Evidência (obrigatória)" : "Evidência (opcional)"} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
              <Button size="sm" disabled={closing && evidence.trim().length < 5} onClick={() => void status()}>Registrar</Button></div></div>
        ) : !caps.acompanhar ? <p className="text-xs text-muted-foreground">Registrar situação exige a permissão de acompanhar o calendário de avaliação.</p> : null}
      </div>
    </div>
  );
}
