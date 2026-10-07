/** N5.3.2 — vistas da composição (Secretaria, Mapa III, Diário) e da jornada; só readers canônicos. */
import { DateInput } from "@/components/sigem/date-input";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { classCompositionAt, positionCatalogs } from "./class-wizard-source";
import { POSITION_NOT_RECORDED, compositionBreakdown, compositionPhrase, positionKey } from "./class-composition-projection";
import { classJourneyAt, classSchoolOf, humanTeamError, recordJourney, studentPositionsAt } from "./class-team-source";
import { WEEKDAY_LABEL, journeyProblems, journeySummary, type JourneyInterval } from "./class-wizard-model";

export function useClassComposition(classId: string, on: string, schoolId?: string | null, enabled = true) {
  const comp = useQuery({ queryKey: ["class-composition", classId, on], enabled, queryFn: () => classCompositionAt(classId, on) });
  const cat = useQuery({ queryKey: ["wizard-positions", on], enabled, queryFn: () => positionCatalogs(on) });
  const school = useQuery({ queryKey: ["class-school", classId], enabled: enabled && !schoolId, queryFn: () => classSchoolOf(classId) });
  const sid = schoolId ?? school.data ?? null;
  const students = useQuery({ queryKey: ["class-student-positions", classId, on, sid], enabled: !!sid && !!comp.data, queryFn: () => studentPositionsAt(sid!, classId, on) });
  const label = (scheme: string, value: string) => cat.data?.get(scheme)?.find((p) => p.value === value)?.label ?? "Etapa sem rótulo homologado";
  const positions = comp.data?.positions ?? [];
  const breakdown = students.data ? compositionBreakdown(positions, students.data) : null;
  const phrase = comp.data ? compositionPhrase(positions.map((p) => label(p.scheme, p.value))) : null;
  return { comp, students, breakdown, phrase, label, kind: comp.data?.kind ?? null };
}

export function CompositionLine({ classId, on }: { classId: string; on: string }) {
  const c = useClassComposition(classId, on);
  if (!c.comp.data) return null;
  return <p className="text-xs text-muted-foreground">{c.kind === "multisseriada" ? "Turma multisseriada: " : ""}{c.phrase}</p>;
}

export function CompositionBreakdownTable({ classId, on, schoolId }: { classId: string; on: string; schoolId?: string | null }) {
  const c = useClassComposition(classId, on, schoolId);
  if (c.comp.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!c.comp.data) return <p className="text-sm text-muted-foreground">Composição não declarada para esta turma.</p>;
  const b = c.breakdown;
  return (
    <div className="grid gap-1 text-sm">
      <p className="font-medium">{c.kind === "multisseriada" ? "Turma multisseriada: " : ""}{c.phrase}</p>
      {!b ? <p className="text-muted-foreground">Carregando estudantes…</p> : (
        <table className="w-full max-w-md text-sm">
          <tbody>
            {b.rows.map((r) => <tr key={r.key}><td className="py-0.5">{c.label(r.position.scheme, r.position.value)}</td><td className="text-right tabular-nums">{r.count}</td></tr>)}
            {b.notRecorded > 0 ? <tr><td className="py-0.5 text-muted-foreground">{POSITION_NOT_RECORDED}</td><td className="text-right tabular-nums">{b.notRecorded}</td></tr> : null}
            <tr className="border-t border-border font-semibold"><td className="py-0.5">Total da turma (estudantes únicos)</td><td className="text-right tabular-nums">{b.total}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Posição individual de cada estudante (Diário): nunca herda o primeiro ano da composição. */
export function useStudentPositionLabel(classId: string, on: string, enabled = true) {
  const c = useClassComposition(classId, on, null, enabled);
  return (studentId: string): string | null => {
    if (!c.comp.data || !c.breakdown) return null;
    const k = c.breakdown.byStudent.get(studentId);
    if (!k) return c.kind === "multisseriada" ? POSITION_NOT_RECORDED : null;
    const p = c.comp.data.positions.find((x) => positionKey(x) === k);
    return p ? c.label(p.scheme, p.value) : POSITION_NOT_RECORDED;
  };
}

/** Mapa Estrutura III: composição de cada turma da escola com subtotais reais por posição. */
export function SchoolCompositionStructure({ schoolId, on }: { schoolId: string; on: string }) {
  const classes = useQuery({
    queryKey: ["map3-classes", schoolId, on],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutional_classes").select("id,name,valid_from,valid_until").eq("school_id", schoolId);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; name: string; valid_from: string; valid_until: string | null }[])
        .filter((c) => c.valid_from <= on && (!c.valid_until || c.valid_until >= on)).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-semibold">Composição das turmas</h3>
      <p className="mb-2 text-xs text-muted-foreground">Subtotais pela posição registrada de cada estudante; o total conta cada estudante uma vez.</p>
      {classes.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !classes.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma turma vigente nesta data.</p>
        : <ul className="grid gap-3 md:grid-cols-2">{classes.data.map((c) => <li key={c.id}><p className="text-sm font-medium">{c.name}</p><CompositionBreakdownTable classId={c.id} on={on} schoolId={schoolId} /></li>)}</ul>}
    </div>
  );
}

export function JourneyEditor({ value, onChange }: { value: JourneyInterval[]; onChange: (v: JourneyInterval[]) => void }) {
  const toggle = (d: number) => onChange(value.some((i) => i.weekday === d) ? value.filter((i) => i.weekday !== d)
    : [...value, { weekday: d, startsAt: value[0]?.startsAt ?? "07:00", endsAt: value[0]?.endsAt ?? "11:30" }].sort((a, b) => a.weekday - b.weekday));
  const upd = (d: number, f: "startsAt" | "endsAt", v: string) => onChange(value.map((i) => (i.weekday === d ? { ...i, [f]: v } : i)));
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6].map((d) => (
        <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={value.some((i) => i.weekday === d)} onChange={() => toggle(d)} />{WEEKDAY_LABEL[d]}</label>))}</div>
      {value.map((i) => (
        <div key={i.weekday} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2">
          <span>{WEEKDAY_LABEL[i.weekday]}</span>
          <Input type="time" aria-label={`Início ${WEEKDAY_LABEL[i.weekday]}`} value={i.startsAt} onChange={(e) => upd(i.weekday, "startsAt", e.target.value)} />
          <Input type="time" aria-label={`Fim ${WEEKDAY_LABEL[i.weekday]}`} value={i.endsAt} onChange={(e) => upd(i.weekday, "endsAt", e.target.value)} />
        </div>))}
      <p className="text-xs text-muted-foreground">{journeySummary(value)}</p>
    </div>
  );
}

export function JourneyPanel({ classId, on, canEdit }: { classId: string; on: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["class-journey", classId, on], queryFn: () => classJourneyAt(classId, on) });
  const [edit, setEdit] = useState<JourneyInterval[] | null>(null);
  const [from, setFrom] = useState(on); const [msg, setMsg] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const p = journeyProblems(edit ?? []); if (!edit?.length || p.length) throw new Error(p[0] ?? "Escolha ao menos um dia.");
      return recordJourney(classId, q.data?.versionId ?? null, from, edit, q.data ? "Alteração da jornada pela Secretaria" : null);
    },
    onSuccess: () => { setEdit(null); setMsg("Jornada salva. A versão anterior continua no histórico."); void qc.invalidateQueries({ queryKey: ["class-journey", classId] }); },
    onError: (e) => setMsg(e instanceof Error && !e.message.includes(":") ? e.message : humanTeamError(e)),
  });
  return (
    <section aria-labelledby="jr-title" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 id="jr-title" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" />Jornada</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a jornada.</p>
        : <p className="text-sm">{journeySummary(q.data?.intervals ?? [])}</p>}
      {canEdit && !edit ? <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { setMsg(null); setEdit(q.data?.intervals ?? []); }}>{q.data ? "Alterar jornada" : "Definir jornada"}</Button> : null}
      {edit ? (
        <div className="mt-3 grid gap-2">
          <JourneyEditor value={edit} onChange={setEdit} />
          <label className="text-sm">Vale a partir de<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <div className="flex gap-2"><Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar jornada</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEdit(null)}>Cancelar</Button></div>
        </div>) : null}
      {msg ? <p role="status" className="mt-2 text-sm">{msg}</p> : null}
    </section>
  );
}
