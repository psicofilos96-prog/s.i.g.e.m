import { DateInput } from "@/components/sigem/date-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { operationalToday } from "@/lib/academic-date";
import { projectInterventions, type InterventionEvent, type InterventionVersion } from "./interventions";
import { countOf, dailyTasks, draftIssues, parseDraft, DRAFT_KEY, type PlanDraft, type Read } from "./aa-daily-operation";

type Loaded = { v: Read<InterventionVersion>; e: Read<InterventionEvent>; imp: Read<{ id: string; recorded_at: string }>; ext: Read<{ id: string }> };
const read = async <T,>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Read<T>> => {
  const r = await q;
  if (r.error) return { ok: false, reason: governError(r.error).userMessage };
  const rows = (r.data ?? []) as T[];
  return { ok: true, rows, truncated: rows.length >= 1000 };
};
const EMPTY: PlanDraft = { objective: "", skills: "", strategies: "", responsibles: "", due: "" };
const field = "w-full rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AaDailyPanel({ onGo }: { onGo: (tab: string) => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [today] = useState(() => operationalToday());
  const [draft, setDraft] = useState<PlanDraft>(EMPTY);
  const [tried, setTried] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    const [v, e, imp, ext] = await Promise.all([
      read<InterventionVersion>(supabase.from("aa_intervention_versions").select("*").limit(1000)),
      read<InterventionEvent>(supabase.from("aa_intervention_events").select("*").limit(1000)),
      read<{ id: string; recorded_at: string }>(supabase.from("aa_import_batches").select("id,recorded_at").order("recorded_at", { ascending: false }).limit(1000)),
      read<{ id: string }>(supabase.from("ext_result_versions").select("id").limit(1000)),
    ]);
    setData({ v, e, imp, ext });
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setDraft(parseDraft(sessionStorage.getItem(DRAFT_KEY)) ?? EMPTY); }, []);
  const save = (d: PlanDraft) => { setDraft(d); sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); };

  const views = useMemo(() => (data && data.v.ok && data.e.ok ? projectInterventions(data.v.rows, data.e.rows, today) : null), [data, today]);
  const tasks = useMemo(() => (data ? dailyTasks(views, data.imp, today) : []), [data, views, today]);
  if (!data) return <SkeletonState />;

  const counts = [
    { ...countOf(data.v, "Versões de planos de intervenção"), tab: "intervencoes" },
    { ...countOf(data.imp, "Lotes de importação"), tab: "importacao" },
    { ...countOf(data.ext, "Resultados externos registrados"), tab: "externas" },
  ];
  const issues = draftIssues(draft);

  return (
    <div className="space-y-6">
      <section aria-labelledby="aa-counts" className="space-y-2">
        <div className="flex items-center justify-between gap-2"><h2 id="aa-counts" className="text-base font-semibold">Registros disponíveis para você</h2>
          <Button variant="outline" size="sm" onClick={() => void load()}>Atualizar</Button></div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {counts.map((c) => (
            <li key={c.label} className="rounded-lg border bg-card p-3">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold">{c.value ?? "—"}</p>
              {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
              <Button variant="link" className="h-auto px-0" onClick={() => onGo(c.tab)}>Abrir</Button>
            </li>))}
        </ul>
      </section>

      <section aria-labelledby="aa-tasks" className="space-y-2">
        <h2 id="aa-tasks" className="text-base font-semibold">O que pede atenção hoje</h2>
        {!views ? <StatePanel tone="warning" title="Intervenções indisponíveis" description="Não foi possível ler os planos com a sua permissão. Nada foi presumido." />
          : tasks.length === 0 ? <StatePanel title="Nenhuma pendência derivada dos registros lidos" description="Isso não afirma que está tudo bem: só reflete o que sua permissão permite ler." />
          : <ul className="space-y-2" aria-live="polite">{tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="font-medium"><StatusBadge tone={t.tone}>{t.tone === "warning" ? "Atenção" : "Pendente"}</StatusBadge> {t.title}</p>
                  <p className="break-words text-sm text-muted-foreground">{t.detail}</p></div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => onGo(t.tab)}>Resolver</Button>
              </li>))}</ul>}
      </section>

      <section aria-labelledby="aa-draft" className="space-y-3 rounded-lg border p-4">
        <h2 id="aa-draft" className="text-base font-semibold">Rascunho de plano de intervenção</h2>
        <p className="text-sm text-muted-foreground">Fica só nesta aba do navegador e não registra nada. Não escreva nomes de estudantes. O registro oficial é feito em Intervenções.</p>
        {([["objective", "Objetivo"], ["skills", "Habilidades (separe por vírgula)"], ["strategies", "Estratégias"], ["responsibles", "Responsável"]] as const).map(([k, l]) => (
          <label key={k} className="block space-y-1 text-sm"><span>{l}</span>
            <textarea className={field} rows={k === "objective" ? 2 : 1} value={draft[k]} onChange={(e) => save({ ...draft, [k]: e.target.value })} /></label>))}
        <label className="block space-y-1 text-sm"><span>Prazo</span>
          <DateInput className={field} value={draft.due} onChange={(e) => save({ ...draft, due: e.target.value })} /></label>
        {tried && issues.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-destructive">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setTried(true); if (!issues.length) onGo("intervencoes"); }}>Conferir e ir para registro</Button>
          <Button variant="ghost" onClick={() => { save(EMPTY); setTried(false); }}>Descartar rascunho</Button>
        </div>
      </section>
    </div>
  );
}
