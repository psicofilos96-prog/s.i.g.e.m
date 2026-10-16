import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { governError } from "@/lib/observability/governed-errors";
import { operationalToday } from "@/lib/academic-date";
import { EI_FIELDS, MODALITY_LABEL, developmentByField, validateFollowup, type EiFollowup, type EiModality } from "./infant-followup";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
type Roster = { student_id: string; class_id: string; school_id: string; class_label_snapshot: string | null };
type Fb = { id: string; student_id: string; kind: string; text_body: string; sipe_ref: string | null; family_visible: boolean; recorded_at: string };

export function InfantFollowupPanel() {
  const [data, setData] = useState<{ fu: EiFollowup[]; fb: Fb[]; roster: Roster[] } | { error: string } | null>(null);
  const [student, setStudent] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [d, setD] = useState({ modality: "regular" as EiModality, field: "eu-outro-nos", objective: "", observed: operationalToday(), observation: "", evidence: "", adaptation: "", family: false });
  const [fb, setFb] = useState({ kind: "devolutiva-equipe", text: "", sipe: "" });

  const load = useCallback(async () => {
    const [a, b, r] = await Promise.all([supabase.from("ei_followup_versions").select("*").limit(1000), supabase.from("ei_feedback_events").select("*").order("recorded_at").limit(1000),
      supabase.from("class_enrollment_episodes").select("student_id, class_id, school_id, class_label_snapshot").limit(1000)]);
    const err = a.error ?? b.error;
    if (err) { setData({ error: governError(err).userMessage }); return; }
    setData({ fu: (a.data ?? []) as unknown as EiFollowup[], fb: (b.data ?? []) as unknown as Fb[], roster: (r.data ?? []) as Roster[] });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ok = data && "fu" in data ? data : null;
  const students = useMemo(() => [...new Map((ok?.roster ?? []).map((r) => [r.student_id, r])).values()], [ok]);
  const sel = students.find((s) => s.student_id === student) ?? null;
  const dev = useMemo(() => (ok && sel ? developmentByField(ok.fu, sel.student_id) : []), [ok, sel]);

  if (data == null) return <SkeletonState label="Carregando acompanhamento da Educação Infantil" />;
  if (!ok) return <StatePanel tone="warning" title="Acompanhamento não disponível" description={(data as { error: string }).error} />;

  const problems = validateFollowup({ field_key: d.field, observation: d.observation, adaptation_note: d.adaptation, objective_code: d.objective || null, observed_on: d.observed });
  const save = async () => {
    if (!sel) return;
    const { error } = await rpc("ei_record_followup", { _logical: null, _expected_version: 0, _school: sel.school_id, _class: sel.class_id, _student: sel.student_id, _modality: d.modality,
      _field: d.field, _objective: d.objective, _observed: d.observed, _observation: d.observation, _evidence: d.evidence.split("\n").map((x) => x.trim()).filter(Boolean),
      _adaptation: d.adaptation, _family_visible: d.family, _reason: null });
    setMsg(error ? governError(error).userMessage : "Observação registrada."); if (!error) { setD({ ...d, observation: "", evidence: "", adaptation: "" }); void load(); }
  };
  const saveFb = async () => {
    if (!sel) return;
    const { error } = await rpc("ei_record_feedback", { _school: sel.school_id, _class: sel.class_id, _student: sel.student_id, _kind: fb.kind, _text: fb.text, _sipe: fb.sipe, _family_visible: fb.kind === "devolutiva-familia" });
    setMsg(error ? governError(error).userMessage : "Devolutiva registrada."); if (!error) { setFb({ ...fb, text: "", sipe: "" }); void load(); }
  };

  return (
    <div className="space-y-4">
      <StatePanel tone="info" title="Acompanhamento da Educação Infantil" description="Observações descritivas por campo de experiência (BNCC), evidências e devolutivas. Não há nota, promoção nem retenção. Adaptações para AEE/NEI são descritas em termos pedagógicos; dado clínico fica no NEI. A família vê só o que for marcado para ela, e apenas com autorização vigente que inclua a seção de avaliação." />
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <label className="text-sm">Criança <select className={field} value={student} onChange={(e) => setStudent(e.target.value)}>
        <option value="">Escolha…</option>{students.map((s) => <option key={s.student_id} value={s.student_id}>{s.class_label_snapshot ?? "Turma"} · {s.student_id.slice(0, 8)}</option>)}</select></label>
      {students.length === 0 && <StatePanel title="Nenhuma criança visível" description="Esta conta não tem enturmações visíveis nas escolas em que atua." />}
      {sel && (<>
        <table className="w-full text-sm"><caption className="sr-only">Desenvolvimento por campo de experiência</caption>
          <thead><tr><th scope="col" className="text-left">Campo de experiência</th><th scope="col" className="text-left">Observações</th><th scope="col" className="text-left">Última</th></tr></thead>
          <tbody>{dev.map((f) => <tr key={f.key}><td>{f.label}</td><td>{f.gap ? <StatusBadge tone="neutral">Sem observação</StatusBadge> : f.observations}</td><td>{br(f.last)}</td></tr>)}</tbody></table>
        <section aria-label="Histórico" className="space-y-1 text-sm"><h3 className="font-semibold">Histórico</h3>
          <ol className="space-y-1">{ok.fu.filter((r) => r.student_id === sel.student_id).sort((a, b) => a.observed_on.localeCompare(b.observed_on) || a.version - b.version).map((r) => (
            <li key={r.id}>{br(r.observed_on)} · {EI_FIELDS.find((x) => x.key === r.field_key)?.label}{r.objective_code ? ` (${r.objective_code})` : ""} · {MODALITY_LABEL[r.modality]} · v{r.version}{r.family_visible ? " · visível à família" : ""}: {r.observation}
              {r.adaptation_note && <> — Adaptação: {r.adaptation_note}</>}{r.evidence.length > 0 && <> — Evidências: {r.evidence.join("; ")}</>}{r.reason && <> — Motivo: {humanizeForScreen(r.reason)}</>}</li>))}
            {ok.fb.filter((x) => x.student_id === sel.student_id).map((x) => <li key={x.id}>{br(x.recorded_at)} · {x.kind}{x.sipe_ref ? ` (SIPE ${x.sipe_ref})` : ""}: {x.text_body}</li>)}</ol></section>
        <fieldset className="space-y-2 rounded-md border p-3"><legend className="text-sm font-medium">Nova observação</legend>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs">Modalidade<select className={`${field} block`} value={d.modality} onChange={(e) => setD({ ...d, modality: e.target.value as EiModality })}>{Object.entries(MODALITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-xs">Campo de experiência<select className={`${field} block`} value={d.field} onChange={(e) => setD({ ...d, field: e.target.value })}>{EI_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
            <label className="text-xs">Objetivo BNCC (opcional)<input className={`${field} block`} placeholder="EI02EO01" value={d.objective} onChange={(e) => setD({ ...d, objective: e.target.value.toUpperCase() })} /></label>
            <label className="text-xs">Data<DateInput className={`${field} block`} value={d.observed} onChange={(e) => setD({ ...d, observed: e.target.value })} /></label>
          </div>
          <label className="block text-xs">Observação descritiva<textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={3} value={d.observation} onChange={(e) => setD({ ...d, observation: e.target.value })} /></label>
          <label className="block text-xs">Evidências (uma por linha: foto, produção, registro)<textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={2} value={d.evidence} onChange={(e) => setD({ ...d, evidence: e.target.value })} /></label>
          {d.modality !== "regular" && <label className="block text-xs">Adaptação pedagógica (sem dado clínico)<input className={`${field} w-full`} value={d.adaptation} onChange={(e) => setD({ ...d, adaptation: e.target.value })} /></label>}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={d.family} onChange={(e) => setD({ ...d, family: e.target.checked })} />Mostrar à família (com autorização vigente)</label>
          {problems.length > 0 && d.observation && <ul className="text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <Button size="sm" disabled={problems.length > 0} onClick={() => void save()}>Registrar observação</Button>
        </fieldset>
        <fieldset className="space-y-2 rounded-md border p-3"><legend className="text-sm font-medium">Devolutiva ou encaminhamento</legend>
          <select className={field} aria-label="Tipo" value={fb.kind} onChange={(e) => setFb({ ...fb, kind: e.target.value })}><option value="devolutiva-equipe">Devolutiva à equipe</option><option value="devolutiva-familia">Devolutiva à família</option><option value="encaminhamento-sipe">Encaminhamento ao SIPE</option></select>
          {fb.kind === "encaminhamento-sipe" && <input className={`${field} ml-2`} placeholder="Referência do plano SIPE" value={fb.sipe} onChange={(e) => setFb({ ...fb, sipe: e.target.value })} />}
          <textarea aria-label="Texto da devolutiva" className="w-full rounded-md border bg-background p-2 text-sm" rows={2} value={fb.text} onChange={(e) => setFb({ ...fb, text: e.target.value })} />
          <Button size="sm" disabled={fb.text.trim().length < 10} onClick={() => void saveFb()}>Registrar</Button>
        </fieldset>
      </>)}
    </div>
  );
}
