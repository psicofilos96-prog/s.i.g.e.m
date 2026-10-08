import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { inclusionMessage } from "./inclusion-model";
import { WEEKDAYS, aeeEligibilityNote, type AeeService, type AeeSession, type MediatedStudent, type NetworkRow } from "./aee-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await rpc(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
const today = () => operationalToday();
const br = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem término");
const field = "mt-1 block w-full rounded border bg-background p-2";
const db = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => PromiseLike<{ data: { value_id: string; label: string }[] | null }> } } } };

/** Estação do mediador: só educandos com vínculo vigente da própria atuação. Sem condição nem conteúdo. */
export function MyMediatedStudents() {
  const [rows, setRows] = useState<MediatedStudent[] | null>(null);
  useEffect(() => { call<MediatedStudent[]>("inclusion_my_mediated_students", { _on: today() }).then(setRows, () => setRows([])); }, []);
  if (!rows || rows.length === 0) return null;
  return (
    <section aria-labelledby="meus" className="space-y-2 rounded border p-3">
      <h2 id="meus" className="font-semibold">Meus alunos acompanhados (mediação vigente)</h2>
      <ul className="text-sm space-y-1">{rows.map((r) => (
        <li key={r.mediation_logical_id}>{r.student_name} · escola {r.school_id}{r.class_id ? ` · turma ${r.class_id}` : ""} · {br(r.valid_from)} a {br(r.valid_to)}</li>))}</ul>
      <p className="text-xs text-muted-foreground">Você vê só o que a escola marcou para a mediação, enquanto o vínculo estiver vigente.</p>
    </section>
  );
}

/** Visão de rede (NEI): contagens por escola, sem educando, sem conteúdo. Aparece só com capability de rede. */
export function NetworkOverview() {
  const [rows, setRows] = useState<NetworkRow[] | null>(null);
  useEffect(() => { call<NetworkRow[]>("inclusion_network_overview", { _on: today() }).then(setRows, () => setRows(null)); }, []);
  if (!rows) return null;
  return (
    <section aria-labelledby="rede" className="space-y-2 rounded border p-3">
      <h2 id="rede" className="font-semibold">Rede — atendimentos e mediações vigentes hoje</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum atendimento AEE ou mediação vigente registrado. Ausência de registro não significa ausência de necessidade.</p> : (
        <table className="text-sm"><thead><tr><th className="pr-4 text-left">Escola</th><th className="pr-4">AEE</th><th>Mediações</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.school_id}><td className="pr-4">{r.school_id}</td><td className="pr-4 text-center">{r.active_aee_services}</td><td className="text-center">{r.active_mediations}</td></tr>)}</tbody></table>)}
    </section>
  );
}

export function AeeSection({ school }: { school: string }) {
  const [rows, setRows] = useState<AeeService[] | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => call<AeeService[]>("aee_services_at", { _school: school, _student: null, _known_at: null })
    .then((r) => { setRows(r); setBlocked(null); }, (e: Error) => { setRows([]); setBlocked(inclusionMessage(e.message)); }), [school]);
  useEffect(() => { void load(); }, [load]);
  return (
    <section aria-labelledby="aee" className="space-y-2">
      <h2 id="aee" className="font-semibold">Atendimento Educacional Especializado (AEE)</h2>
      <StatePanel tone="warning" title="Elegibilidade: regra institucional pendente" description={aeeEligibilityNote} />
      {blocked ? <p className="text-sm text-muted-foreground">{blocked}</p>
        : !rows ? <SkeletonState label="Carregando" />
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum atendimento AEE registrado nesta escola.</p>
        : <ul className="text-sm space-y-1">{rows.map((a) => (
            <li key={a.id}>Estudante {a.student_id} · {br(a.valid_from)} a {br(a.valid_to)}{a.event_kind === "encerramento" ? " · encerrado" : ""}{a.version > 1 ? ` · versão ${a.version}` : ""}
              {" · "}{a.slots.length ? a.slots.map((s) => `${WEEKDAYS[s.weekday - 1]} ${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}`).join(", ") : "sem agenda"}
              {" "}<button className="underline" onClick={() => setOpen(open === a.logical_id ? null : a.logical_id)}>sessões</button>
              {open === a.logical_id && <Sessions service={a} />}</li>))}</ul>}
      {!blocked && <ServiceForm school={school} onDone={load} />}
    </section>
  );
}

function ServiceForm({ school, onDone }: { school: string; onDone: () => void }) {
  const [f, setF] = useState({ student: "", engagement: "", from: today(), to: "", weekday: "1", start: "", end: "" });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <details className="rounded border p-3 text-sm"><summary className="cursor-pointer">Organizar atendimento AEE</summary>
      <p className="mt-1 text-xs text-muted-foreground">Registra a decisão da escola. Nada é inferido de turma, matrícula ou histórico.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>Estudante<input className={field} value={f.student} onChange={(e) => setF({ ...f, student: e.target.value })} /></label>
        <label>Atuação responsável pelo atendimento<input className={field} value={f.engagement} onChange={(e) => setF({ ...f, engagement: e.target.value })} /></label>
        <label>Início<DateInput value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>Término (opcional)<DateInput value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label>Dia da agenda (opcional)<select className={field} value={f.weekday} onChange={(e) => setF({ ...f, weekday: e.target.value })}>{WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          <label>Das<input type="time" className={field} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
          <label>Até<input type="time" className={field} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        </div>
      </div>
      <Button className="mt-2" disabled={!f.student || !f.engagement} onClick={async () => {
        const slots = f.start && f.end ? [{ weekday: Number(f.weekday), starts_at: f.start, ends_at: f.end }] : [];
        try { await call("record_aee_service", { _base_id: null, _kind: "registro", _school: school, _student: f.student.trim(), _responsible_engagement: f.engagement.trim(),
          _valid_from: f.from, _valid_to: f.to || null, _slots: slots, _reason: null }); setMsg("Atendimento registrado."); onDone(); }
        catch (e) { setMsg(inclusionMessage((e as Error).message)); }
      }}>Registrar</Button>
      {msg && <p role="status" className="mt-1">{msg}</p>}
    </details>
  );
}

const PRESENCE_SCHEME = "presenca-no-aee";

function Sessions({ service }: { service: AeeService }) {
  const [rows, setRows] = useState<AeeSession[] | null>(null);
  const [opts, setOpts] = useState<{ value_id: string; label: string }[] | null>(null);
  const [f, setF] = useState({ date: today(), value: "", note: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => call<AeeSession[]>("aee_sessions_at", { _service_logical: service.logical_id, _known_at: null })
    .then(setRows, (e: Error) => { setRows([]); setMsg(inclusionMessage(e.message)); }), [service.logical_id]);
  useEffect(() => { void load(); void db.from("attribute_value_definitions").select("value_id, label").eq("scheme_id", PRESENCE_SCHEME).eq("status", "homologada").then((r) => setOpts(r.data ?? [])); }, [load]);
  return (
    <div className="mt-2 space-y-2 rounded border p-2">
      <p className="text-xs text-muted-foreground">Frequência do AEE é própria do atendimento e não altera a frequência da turma regular.</p>
      {!rows ? <SkeletonState label="Carregando" /> : rows.length === 0 ? <p className="text-muted-foreground">Nenhuma sessão registrada.</p> : (
        <ul className="space-y-1">{rows.map((s) => <li key={s.id}>{br(s.session_date)} · {s.event_kind === "anulacao" ? "anulada" : (opts?.find((o) => o.value_id === s.presence_value_id)?.label ?? s.presence_value_id)}{s.version > 1 ? ` · versão ${s.version}` : ""}{s.pedagogical_note ? ` · ${s.pedagogical_note}` : ""}</li>)}</ul>)}
      {opts && opts.length === 0 ? <p className="text-muted-foreground">Registro de sessão indisponível: o catálogo de presença no AEE ainda não foi homologado.</p> : (
        <div className="flex flex-wrap items-end gap-2">
          <label>Data<DateInput value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label>Presença<select className={field} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })}><option value="">Escolha…</option>{(opts ?? []).map((o) => <option key={o.value_id} value={o.value_id}>{o.label}</option>)}</select></label>
          <label className="min-w-64 flex-1">Registro pedagógico (opcional, sem dado clínico)<input maxLength={1000} className={field} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <Button disabled={!f.value} onClick={async () => {
            try { await call("record_aee_session", { _base_id: null, _kind: "registro", _service_logical: service.logical_id, _date: f.date, _presence_scheme: PRESENCE_SCHEME,
              _presence_value: f.value, _note: f.note || null, _reason: null }); setMsg("Sessão registrada."); void load(); }
            catch (e) { setMsg(inclusionMessage((e as Error).message)); }
          }}>Registrar sessão</Button>
        </div>)}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
