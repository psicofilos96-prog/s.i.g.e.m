import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { OFFER_LABEL, WEEKDAY, conflictLabel, offerNext, offerProblem, type OfferStatus } from "./nei-aee";

import { DateInput } from "@/components/sigem/date-input";
import { operationalToday } from "@/lib/academic-date";
const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";
const human = (m: string) => m.includes("stale") ? "Outra pessoa registrou antes. Recarregue." : m.includes("invalid-transition") ? "Essa situação não segue a atual." : m.includes("date-before-last") ? "A data não pode ser anterior à última situação." : m.includes("future-date") ? "Não se registra atividade em data futura." : m.includes("not-authorized") ? "Seu papel não permite esta ação." : "Não foi possível concluir.";

type Row = { service_logical_id: string; student_name: string | null; responsible_name: string | null; weekday: number; starts_at: string; ends_at: string; status: OfferStatus | "sem-registro"; room: string | null; last_seq: number; conflict_professional: boolean; conflict_room: boolean; sessions_30d: number };

export function NeiAeePage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]); const [school, setSchool] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null); const [sel, setSel] = useState<Row | null>(null);
  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m))); }, []);
  const load = () => { if (school) void rpc("nei_aee_agenda", { _school: school }).then((r) => setRows(r.error ? [] : (r.data as Row[]))); };
  useEffect(() => { setRows(null); setSel(null); load(); }, [school]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Oferta e agenda do AEE" description="Os atendimentos e horários vêm do cadastro de AEE da escola. Aqui o NEI registra a situação da oferta (planejada, iniciada, interrompida), a sala, as atividades e os recursos. Conflitos são calculados só sobre horários registrados." />
      <label className="text-sm">Escola <select className={input + " w-auto"} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {!school ? null : rows === null ? <StatePanel title="Carregando agenda…" description="Lendo no servidor dentro do seu papel." /> : rows.length === 0 ? (
        <EmptyState title="Nenhum horário de AEE visível" description="Não há atendimento AEE vigente com horário nesta escola, ou sua conta não tem papel do NEI aqui. Isso não indica ausência de estudantes público do AEE." />
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Agenda AEE</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="p-2">Dia</th><th scope="col" className="p-2">Horário</th><th scope="col" className="p-2">Estudante</th><th scope="col" className="p-2">Profissional</th><th scope="col" className="p-2">Sala</th><th scope="col" className="p-2">Situação</th><th scope="col" className="p-2">Sessões 30d</th><th scope="col" className="p-2"></th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-t border-border"><td className="p-2">{WEEKDAY[r.weekday] ?? r.weekday}</td><td className="p-2 tabular-nums">{r.starts_at.slice(0, 5)}–{r.ends_at.slice(0, 5)}</td>
              <td className="p-2">{r.student_name ?? "—"}</td><td className="p-2">{r.responsible_name ?? "—"}</td><td className="p-2">{r.room ?? "—"}</td>
              <td className="p-2"><StatusBadge tone={r.status === "interrompida" ? "warning" : r.status === "iniciada" || r.status === "retomada" ? "success" : "neutral"}>{OFFER_LABEL[r.status]}</StatusBadge>
                {conflictLabel(r) ? <p className="text-xs text-destructive">{conflictLabel(r)}</p> : null}</td>
              <td className="p-2 tabular-nums">{r.sessions_30d}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => setSel(r)}>Abrir</Button></td></tr>))}</tbody>
        </table></div>
      )}
      {sel ? <ServiceDetail row={sel} onSaved={() => { load(); }} key={sel.service_logical_id + sel.last_seq} /> : null}
    </div>
  );
}

function ServiceDetail({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [d, setD] = useState<{ events: { seq: number; status: OfferStatus; room: string | null; cause: string | null; effective_on: string; note: string | null }[]; activities: { session_date: string; activities: string; resources: string | null }[] } | null | undefined>(undefined);
  const load = () => void rpc("nei_aee_service_detail", { _service: row.service_logical_id }).then((r) => setD(r.error ? null : (r.data as typeof d)));
  useEffect(load, [row.service_logical_id]);
  const last = d?.events[d.events.length - 1];
  const cur: OfferStatus | "sem-registro" = last?.status ?? "sem-registro";
  const opts = offerNext(cur);
  const today = operationalToday();
  const [to, setTo] = useState<OfferStatus>(opts[0] ?? "encerrada"); const [eff, setEff] = useState(today); const [room, setRoom] = useState(""); const [cause, setCause] = useState(""); const [note, setNote] = useState("");
  const [date, setDate] = useState(today); const [acts, setActs] = useState(""); const [res, setRes] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (opts[0]) setTo(opts[0]); }, [cur]);
  if (d === undefined) return <StatePanel title="Carregando atendimento…" description="" />;
  if (d === null) return <StatePanel tone="danger" title="Sem acesso a este atendimento" description="A tentativa foi registrada." />;
  const problem = opts.length ? offerProblem(cur, to, cause) : "A oferta está encerrada.";
  const sendStatus = () => void rpc("record_nei_aee_offer_event", { _service: row.service_logical_id, _expected_seq: last?.seq ?? 0, _status: to, _effective: eff, _room: room || null, _cause: cause || null, _note: note || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setCause(""); setNote(""); setMsg(null); load(); onSaved(); } });
  const sendAct = () => void rpc("record_nei_aee_activity", { _service: row.service_logical_id, _date: date, _activities: acts, _resources: res || null })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setActs(""); setRes(""); setMsg(null); load(); } });
  return (
    <section className="space-y-4 rounded-md border border-border p-4 text-sm">
      <h2 className="font-semibold">{row.student_name ?? "Estudante"} — situação atual: {OFFER_LABEL[cur]}</h2>
      <ol className="space-y-0.5 text-xs">{d.events.map((e) => <li key={e.seq}>#{e.seq} {e.effective_on.split("-").reverse().join("/")} · {OFFER_LABEL[e.status]}{e.room ? ` · sala ${e.room}` : ""}{e.cause ? ` · causa: ${e.cause}` : ""}{e.note ? ` · ${e.note}` : ""}</li>)}</ol>
      {opts.length ? <div className="space-y-1"><p className="text-xs font-medium">Registrar situação da oferta</p>
        <div className="grid gap-1 sm:grid-cols-3">
          <select className={input} value={to} onChange={(e) => setTo(e.target.value as OfferStatus)} aria-label="Nova situação">{opts.map((s) => <option key={s} value={s}>{OFFER_LABEL[s]}</option>)}</select>
          <DateInput className={input} aria-label="Data efetiva" value={eff} onChange={(e) => setEff(e.target.value)} />
          <input className={input} placeholder="Sala (mantém a anterior se vazio)" value={room} onChange={(e) => setRoom(e.target.value)} /></div>
        {to === "interrompida" || to === "encerrada" ? <input className={input} placeholder="Causa (obrigatória)" value={cause} onChange={(e) => setCause(e.target.value)} /> : null}
        <input className={input} placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={!!problem} onClick={sendStatus}>Registrar situação</Button>{problem ? <span className="ml-2 text-xs text-muted-foreground">{problem}</span> : null}</div> : null}
      <div className="space-y-1"><p className="text-xs font-medium">Atividades e recursos do atendimento</p>
        <p className="text-xs text-muted-foreground">A presença continua no registro de sessões AEE da escola; aqui ficam atividades e recursos usados.</p>
        <div className="grid gap-1 sm:grid-cols-3"><DateInput className={input} max={today} aria-label="Data do atendimento" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={input + " sm:col-span-2"} placeholder="Recursos (opcional)" value={res} onChange={(e) => setRes(e.target.value)} /></div>
        <textarea className={input} rows={2} placeholder="Atividades realizadas" value={acts} onChange={(e) => setActs(e.target.value)} />
        <Button size="sm" disabled={acts.trim().length < 3} onClick={sendAct}>Registrar atividade</Button>
        <ul className="space-y-0.5 text-xs">{d.activities.map((a, i) => <li key={i}>{a.session_date.split("-").reverse().join("/")}: {a.activities}{a.resources ? ` · recursos: ${a.resources}` : ""}</li>)}</ul></div>
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </section>
  );
}
