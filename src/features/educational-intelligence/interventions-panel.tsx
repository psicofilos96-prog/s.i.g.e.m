import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { ORIGIN_LABEL, STAGE_LABEL, projectInterventions, summarizeBySchool, validateNewIntervention,
  type InterventionEvent, type InterventionVersion } from "./interventions";

import { DateInput } from "@/components/sigem/date-input";
import { operationalToday } from "@/lib/academic-date";
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const EV_LABEL: Record<InterventionEvent["kind"], string> = { acao: "Ação", evidencia: "Evidência", devolutiva: "Devolutiva", progresso: "Progresso", reavaliacao: "Reavaliação", encerramento: "Encerramento" };
const PROG_LABEL = { "nao-avaliado": "Não avaliado", "sem-avanco": "Sem avanço", "avanco-parcial": "Avanço parcial", avancou: "Avançou" } as const;

export function InterventionsPanel() {
  const [data, setData] = useState<{ v: InterventionVersion[]; e: InterventionEvent[] } | { error: string } | null>(null);
  const [today] = useState(() => operationalToday());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ school_id: "", class_id: "", segment: "", is_infant: false, origin_kind: "sia-instrumento-aprovado", origin_ref: "", sipe: "", objective: "", responsible: "", due: "" });
  const [ev, setEv] = useState({ kind: "acao" as InterventionEvent["kind"], body: "", responsible: "", due: "", progress: "", reassessment: "" });

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("aa_intervention_versions").select("*").limit(1000),
      supabase.from("aa_intervention_events").select("*").limit(1000),
    ]);
    if (a.error || b.error) setData({ error: governError((a.error ?? b.error)!).userMessage });
    else setData({ v: a.data as unknown as InterventionVersion[], e: b.data as unknown as InterventionEvent[] });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const views = useMemo(() => (data && "v" in data ? projectInterventions(data.v, data.e, today) : []), [data, today]);
  const summary = useMemo(() => summarizeBySchool(views), [views]);

  async function create() {
    const errs = validateNewIntervention(form);
    if (errs.length) { setMsg(errs.join(" ")); return; }
    const r = await rpc("aa_record_intervention", { _logical: null, _expected_version: 0, _school: form.school_id, _class: form.class_id, _segment: form.segment,
      _is_infant: form.is_infant, _origin_kind: form.origin_kind, _origin_ref: form.origin_ref, _sipe: form.sipe || null, _objective: form.objective,
      _responsible: form.responsible, _due: form.due || null, _reason: null });
    setMsg(r.error ? governError(r.error).userMessage : "Plano registrado.");
    if (!r.error) void load();
  }
  async function addEvent(plan: string, seq: number) {
    const r = await rpc("aa_record_intervention_event", { _plan: plan, _expected_seq: seq, _kind: ev.kind, _body: ev.body, _responsible: ev.responsible,
      _due: ev.due || null, _progress: ev.progress || null, _reassessment: ev.reassessment });
    setMsg(r.error ? governError(r.error).userMessage : "Registro incluído no histórico.");
    if (!r.error) { setEv({ ...ev, body: "" }); void load(); }
  }

  if (!data) return <SkeletonState />;
  if ("error" in data) return <StatePanel tone="warning" title="Leitura indisponível" description={data.error} />;

  return (
    <div className="space-y-4">
      <StatePanel tone="info" title="Ciclo pedagógico" description="Prova SIA aprovada pela OP → aplicação/correção → resultado no A&A → plano de intervenção (ligado ao SIPE) → ações, evidências e devolutivas → reavaliação. Frequência e rendimento são referenciados do Diário, nunca copiados. Na Educação Infantil a intervenção não decide promoção nem retenção." />
      {summary.length > 0 && (
        <section aria-label="Consolidado por escola" className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th scope="col" className="p-2">Escola</th><th scope="col">Planos</th>{Object.values(STAGE_LABEL).map((l) => <th scope="col" key={l}>{l}</th>)}<th scope="col">Com prazo vencido</th></tr></thead>
            <tbody>{summary.map((s) => <tr key={s.school_id} className="border-t"><td className="p-2">{s.school_id}</td><td>{s.total}</td>{Object.keys(STAGE_LABEL).map((k) => <td key={k}>{s.byStage[k as keyof typeof s.byStage]}</td>)}<td>{s.overdue}</td></tr>)}</tbody></table>
          <p className="p-2 text-xs text-muted-foreground">Só escolas que esta conta pode ler; escolas fora do alcance não aparecem (não são zero).</p>
        </section>)}
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Novo plano de intervenção</summary>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className={field} placeholder="Escola (identificador)" value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })} />
          <input className={field} placeholder="Turma (opcional)" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} />
          <input className={field} placeholder="Etapa/segmento" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
          <select className={field} value={form.origin_kind} onChange={(e) => setForm({ ...form, origin_kind: e.target.value })}>
            {Object.entries(ORIGIN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className={field} placeholder="Referência da origem (versão da prova, edição, período)" value={form.origin_ref} onChange={(e) => setForm({ ...form, origin_ref: e.target.value })} />
          <input className={field} placeholder="Versão do plano SIPE (opcional)" value={form.sipe} onChange={(e) => setForm({ ...form, sipe: e.target.value })} />
          <input className={field} placeholder="Responsável (função)" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          <DateInput className={field} aria-label="Prazo" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_infant} onChange={(e) => setForm({ ...form, is_infant: e.target.checked })} />Educação Infantil</label>
          <textarea className="rounded-md border bg-background p-2 text-sm md:col-span-3" placeholder="Objetivo pedagógico" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
        </div>
        <Button size="sm" className="mt-2" onClick={() => void create()}>Registrar plano</Button>
      </details>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {views.length === 0 ? <StatePanel title="Nenhum plano de intervenção registrado" description="Nenhum registro visível para esta conta. Registrar exige a permissão de intervenção pedagógica na escola." /> : (
        <ul className="space-y-2">{views.map((v) => (
          <li key={v.current.logical_id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral">{STAGE_LABEL[v.stage]}</StatusBadge>
              <span className="font-medium">{v.current.objective}</span>
              <span className="text-xs text-muted-foreground">{v.current.school_id}{v.current.class_id ? ` · ${v.current.class_id}` : ""} · {v.current.segment} · {ORIGIN_LABEL[v.current.origin_kind]} ({v.current.origin_ref})</span>
              {v.lastProgress && <StatusBadge tone="info">{PROG_LABEL[v.lastProgress]}</StatusBadge>}
              {v.overdue.length > 0 && <StatusBadge tone="warning">Prazo</StatusBadge>}
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === v.current.logical_id ? null : v.current.logical_id)}>{open === v.current.logical_id ? "Fechar" : "Histórico"}</Button>
            </div>
            {[...v.overdue, ...v.issues].map((t) => <p key={t} className="text-xs text-muted-foreground">• {t}</p>)}
            {open === v.current.logical_id && (
              <div className="mt-2 space-y-2">
                <ol className="space-y-1 text-sm">{v.events.map((e) => <li key={e.seq}><strong>#{e.seq} {EV_LABEL[e.kind]}</strong> — {e.body}{e.responsible_label ? ` · ${e.responsible_label}` : ""}{e.due_date ? ` · prazo ${e.due_date}` : ""}{e.progress ? ` · ${PROG_LABEL[e.progress]}` : ""}{e.reassessment_ref ? ` · reavaliação ${e.reassessment_ref}` : ""} <span className="text-xs text-muted-foreground">{e.recorded_at.slice(0, 10)}</span></li>)}</ol>
                {v.stage !== "encerrado" && (
                  <div className="grid gap-2 md:grid-cols-3">
                    <select className={field} value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value as InterventionEvent["kind"] })}>{Object.entries(EV_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <input className={field} placeholder="Responsável" value={ev.responsible} onChange={(e) => setEv({ ...ev, responsible: e.target.value })} />
                    <DateInput className={field} aria-label="Prazo da ação" value={ev.due} onChange={(e) => setEv({ ...ev, due: e.target.value })} />
                    {(ev.kind === "progresso" || ev.kind === "reavaliacao") && <select className={field} value={ev.progress} onChange={(e) => setEv({ ...ev, progress: e.target.value })}><option value="">Progresso…</option>{Object.entries(PROG_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
                    {ev.kind === "reavaliacao" && <input className={field} placeholder="Referência da reavaliação" value={ev.reassessment} onChange={(e) => setEv({ ...ev, reassessment: e.target.value })} />}
                    <textarea className="rounded-md border bg-background p-2 text-sm md:col-span-3" placeholder="Descrição / evidência / devolutiva" value={ev.body} onChange={(e) => setEv({ ...ev, body: e.target.value })} />
                    <Button size="sm" onClick={() => void addEvent(v.current.logical_id, v.seq)}>Incluir no histórico</Button>
                  </div>)}
              </div>)}
          </li>))}</ul>)}
    </div>
  );
}
