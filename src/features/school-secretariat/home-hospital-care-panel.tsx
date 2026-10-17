import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric } from "@/lib/academic-date";
import { CARE_KINDS, CARE_MESSAGES, careKindLabel, projectCare, type CareEpisode, type CareEvent } from "./home-hospital-care";

const d = (s: string) => formatAcademicDateNumeric(s as never);
const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(CARE_MESSAGES).find((x) => m.includes(x));
  return (k && CARE_MESSAGES[k]) || "Não foi possível registrar. Tente de novo.";
};
const blank = { kind: "", on: "", end: "", place: "", prof: "", note: "" };

/** Atendimento domiciliar/hospitalar na ficha do aluno: abrir, registrar atividades e encerrar. Nada é apagado. */
export function HomeHospitalCarePanel({ school, student }: { school: string; student: string }) {
  const [list, setList] = useState<CareEpisode[] | null>(null);
  const [form, setForm] = useState<{ mode: "abrir" | "registrar" | "encerrar"; care: string | null } | null>(null);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<string | null>(null);
  async function load() {
    const { data, error } = await supabase.from("student_home_hospital_care_events")
      .select("care_id,act,care_kind,occurred_on,expected_end,place,professional,note,recorded_at").eq("school_id", school).eq("student_id", student);
    setList(error ? [] : projectCare((data ?? []) as CareEvent[]));
  }
  useEffect(() => { void load(); }, [school, student]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return null;
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if (!form) return; setMsg(null);
    try {
      await callRpc("secretariat_home_hospital_care_act", { _school: school, _student: student, _care: form.care, _act: form.mode, _kind: f.kind || null, _on: f.on, _expected_end: f.end || null, _place: f.place || null, _professional: f.prof || null, _note: f.note });
      setForm(null); setF(blank); void load();
    } catch (e) { setMsg(msgOf(e)); }
  };
  const open = (mode: "abrir" | "registrar" | "encerrar", care: string | null) => { setF(blank); setForm({ mode, care }); };
  const hasOpen = list.some((e) => !e.closedOn);
  const ready = f.on && f.note.trim().length >= 5 && (form?.mode !== "abrir" || f.kind);
  return (
    <details className="rounded-md border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Atendimento domiciliar / hospitalar{hasOpen ? " (em andamento)" : ""}</summary>
      <div className="mt-2 space-y-2">
        {list.length === 0 && <p className="text-muted-foreground">Nenhum atendimento registrado.</p>}
        <ul className="space-y-2">{list.map((e) => (
          <li key={e.id} className="rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><b>{careKindLabel(e.kind)}</b> · desde {d(e.startsOn)}{e.expectedEnd ? ` · previsão até ${d(e.expectedEnd)}` : ""}{e.place ? ` · ${e.place}` : ""}{e.closedOn ? ` · encerrado em ${d(e.closedOn)}` : " · em andamento"}</span>
              {!e.closedOn && <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => open("registrar", e.id)}>Registrar atividade</Button>
                <Button size="sm" variant="ghost" onClick={() => open("encerrar", e.id)}>Encerrar</Button></span>}
            </div>
            <p className="text-muted-foreground">Motivo: {e.reason}</p>
            {e.entries.length > 0 && <ul className="mt-1 list-disc pl-5">{e.entries.map((x, i) => <li key={i}>{d(x.on)}{x.professional ? ` · ${x.professional}` : ""}: {x.note}</li>)}</ul>}
            {e.closeNote && <p className="mt-1">Encerramento: {e.closeNote}</p>}
          </li>))}</ul>
        {!hasOpen && !form && <Button size="sm" onClick={() => open("abrir", null)}>Abrir atendimento</Button>}
        {form && (
          <div className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-3">
            {form.mode === "abrir" && <label>Tipo
              <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.kind} onChange={set("kind")}>
                <option value="">Escolha</option>{CARE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>}
            <label>{form.mode === "abrir" ? "Início" : form.mode === "encerrar" ? "Data do encerramento" : "Data"}<DateInput value={f.on} onChange={set("on")} /></label>
            {form.mode === "abrir" && <label>Previsão de término<DateInput value={f.end} onChange={set("end")} /></label>}
            {form.mode === "abrir" && <label className="sm:col-span-2">Local (casa, hospital)<Input className="mt-1" maxLength={300} value={f.place} onChange={set("place")} /></label>}
            {form.mode === "registrar" && <label>Professor(a)<Input className="mt-1" maxLength={200} value={f.prof} onChange={set("prof")} /></label>}
            <label className="sm:col-span-3">{form.mode === "abrir" ? "Motivo (sem diagnóstico)" : form.mode === "encerrar" ? "Motivo do encerramento" : "O que foi feito"}
              <Input className="mt-1" maxLength={2000} value={f.note} onChange={set("note")} /></label>
            <div className="flex gap-2 sm:col-span-3"><Button size="sm" disabled={!ready} onClick={() => void save()}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button></div>
          </div>)}
        {msg && <p role="status" className="text-destructive">{msg}</p>}
        <p className="text-xs text-muted-foreground">Não registre diagnóstico nem código de doença. Cada registro fica no histórico e não pode ser apagado.</p>
      </div>
    </details>
  );
}
