import { operationalToday } from "@/lib/academic-date";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools } from "@/features/onboarding/onboarding-source";
import { supabase } from "@/integrations/supabase/client";
import { PROBLEM_VERSION, diff, suggest, type Lesson, type Placement, type Problem, type Slot } from "./optimizer-model";

type R = { data: unknown; error: unknown };
const rpc = (fn: string, a: Record<string, unknown>) => supabase.rpc(fn as never, a as never) as unknown as Promise<R>;

/** Snapshot do problema: tempos e blocos da grade vigente + pessoa da regência, um knownAt. */
async function loadProblem(schoolId: string, validOn: string): Promise<{ problem: Problem; current: Placement[] } | null> {
  const knownAt = new Date().toISOString();
  const cls = await supabase.from("institutional_classes").select("id").eq("school_id", schoolId);
  if (cls.error) return null;
  const slotsByClass: Record<string, Slot[]> = {}; const lessons: Lesson[] = []; const current: Placement[] = [];
  for (const { id } of cls.data ?? []) {
    const o = { _class_id: id, _on: validOn, _known_at: knownAt };
    const [sch, asg] = await Promise.all([rpc("class_schedule_at", o), rpc("teaching_assignments_at", o)]);
    if (sch.error || asg.error) return null;
    const rows = ((sch.data ?? []) as Record<string, unknown>[]).filter((x) => x["block_key"] && x["block_state"] === "utilizavel");
    const person = new Map(((asg.data ?? []) as Record<string, unknown>[]).filter((x) => x["assignment_state"] === "vigente").map((x) => [String(x["engagement_id"]), x["person_id"] as string | null]));
    slotsByClass[id] = rows.map((x) => ({ id: `${id}:${x["weekday"]}:${x["starts_at"]}`, weekday: Number(x["weekday"]), start: String(x["starts_at"]).slice(0, 5), end: String(x["ends_at"]).slice(0, 5) }));
    rows.forEach((x) => { const lid = `${id}:${x["block_key"]}`;
      lessons.push({ id: lid, classId: id, componentId: (x["component_id"] as string) ?? null, personIds: ((x["engagement_ids"] as string[]) ?? []).map((e) => person.get(e)).filter((p): p is string => !!p) });
      current.push({ lessonId: lid, slotId: `${id}:${x["weekday"]}:${x["starts_at"]}` }); });
  }
  return { problem: { version: PROBLEM_VERSION, snapshotKnownAt: knownAt, validOn, slotsByClass, lessons, availability: null }, current };
}

export function OptimizerPage() {
  const a = useSessionAuthority(); const uid = a.status === "signed-in" ? a.user.id : null;
  const [schoolId, setSchoolId] = useState<string | null>(null); const [run, setRun] = useState(0);
  const today = operationalToday();
  const schools = useQuery({ queryKey: ["opt-schools", uid], enabled: !!uid, queryFn: listSchools });
  const data = useQuery({ queryKey: ["opt", uid, schoolId, today, run], enabled: !!schoolId && run > 0, queryFn: async () => {
    const p = await loadProblem(schoolId!, today); return p && { ...p, outcome: suggest(p.problem) }; } });
  if (a.status !== "signed-in") return <EmptyState title="Entre para gerar sugestões" description="Sugestões usam só o que sua conta pode ler." />;
  const d = data.data;
  return (
    <div className="space-y-6">
      <div role="status" className="rounded-md border-2 border-dashed border-primary bg-accent p-3 text-center font-semibold">SUGESTÕES — nada é aplicado. Toda mudança passa pela tela oficial de horários.</div>
      <PageHeader title="Sugestões de horário" description="Alternativas de distribuição dos blocos da grade vigente, só com restrições que existem no sistema." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Escola <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || null)}>
          <option value="">Selecione</option>{(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <Button size="sm" disabled={!schoolId} onClick={() => setRun((n) => n + 1)}>Gerar sugestões</Button>
      </div>
      {data.isLoading ? <p role="status">Calculando…</p> : run > 0 && schoolId && !d ? <EmptyState title="Grade ou regência não puderam ser lidas" description="Sem leitura completa nenhuma sugestão é feita." /> : d && <>
        <section className="rounded-md border p-3 text-sm"><h2 className="font-medium">Restrições</h2>
          <ul>{d.outcome.constraints.map((c) => <li key={c.id}>{c.considered ? "Considerada" : "Não considerada"}: {c.id} — {c.source}</li>)}</ul></section>
        {d.outcome.impossible.map((v, i) => <p key={i} role="alert" className="text-sm text-destructive">{v.message}</p>)}
        {d.outcome.exhausted && <p className="text-sm">Busca interrompida no limite de passos; alternativas podem existir.</p>}
        {d.outcome.candidates.length === 0 && d.outcome.impossible.length === 0 && <EmptyState title="Nada a distribuir" description="Não há blocos utilizáveis na grade vigente." />}
        {d.outcome.candidates.map((c) => { const moves = diff(d.problem, d.current, c); return (
          <section key={c.id} className="rounded-md border p-3 text-sm"><h2 className="font-medium">{c.id}: viável pelas restrições consideradas · {moves.length} bloco(s) mudam</h2>
            <ul className="text-xs">{moves.map((m) => <li key={m.lessonId}>{m.lessonId}: {m.from ?? "—"} → {m.to}</li>)}</ul>
            <Button asChild size="sm" variant="outline" className="mt-2"><Link to={"/horarios" as never}>Aplicar pela tela oficial</Link></Button></section>); })}
      </>}
    </div>
  );
}
