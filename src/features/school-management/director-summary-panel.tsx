import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { projectWorkflow } from "@/features/statistical-map/map-structures";
import { graveInMonth, type OccurrenceRow } from "./occurrences";
import { mapStageLabel, vacancySummary, type VacancyRow } from "./director-summary";

const db = supabase as unknown as { from: (t: string) => any };
const NA = "Não disponível";

async function readMap(school: string, y: number, m: number) {
  const [maps, freezes] = await Promise.all([
    db.from("statistical_maps").select("id").eq("school_id", school).eq("competence_year", y).eq("competence_month", m),
    db.from("statistical_map_freezes").select("id").eq("school_id", school).eq("year", y).eq("month", m),
  ]);
  if (maps.error || freezes.error) throw new Error("map:unreadable");
  const ids = (maps.data ?? []).map((x: { id: string }) => x.id);
  let events: { kind: string; recorded_at: string; payload: { reason?: string } | null }[] = [];
  if (ids.length) {
    const ev = await db.from("statistical_map_events").select("kind, recorded_at, payload").in("map_id", ids);
    if (ev.error) throw new Error("map:unreadable");
    events = ev.data ?? [];
  }
  const wf = projectWorkflow(ids.length > 0, events.map((e) => ({ kind: e.kind, at: e.recorded_at, reason: e.payload?.reason })) as never, 0);
  return mapStageLabel(wf.stage, ids.length > 0, (freezes.data ?? []).length > 0);
}

/** Cartões executivos da Direção sobre leituras já autorizadas; sem permissão = "Não disponível". */
export function DirectorSummaryPanel({ school, year, on }: { school: string; year: string; on: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const scope = [s?.user.id, s?.sessionRevision, school];
  const [y, m] = [Number(on.slice(0, 4)), Number(on.slice(5, 7))];
  const vac = useQuery({ queryKey: ["dir-vacancies", ...scope, year, on], enabled: !!s, retry: false,
    queryFn: () => callRpc<VacancyRow[]>("secretariat_class_vacancies_at", { _school: school, _year: year, _on: on }) });
  const map = useQuery({ queryKey: ["dir-map", ...scope, y, m], enabled: !!s, retry: false, queryFn: () => readMap(school, y, m) });
  const occ = useQuery({ queryKey: ["school-occurrences", ...scope], enabled: !!s, retry: false,
    queryFn: () => callRpc<OccurrenceRow[]>("school_occurrences_at", { _school: school }) });
  if (!s) return null;
  const v = vacancySummary(vac.isError ? null : vac.data ?? null);
  const grave = graveInMonth(occ.isError ? null : occ.data ?? null, on.slice(0, 7));
  const card = (title: string, value: string, detail: string, to: string, loading: boolean) => (
    <Link to={to as "/secretaria"} className="rounded-lg border bg-card p-4 space-y-1 hover:bg-accent">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="font-display text-xl font-semibold tabular-nums">{loading ? "…" : value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </Link>);
  return (
    <section aria-label="Resumo da Direção" className="grid gap-3 sm:grid-cols-3">
      {card("Mapa Estatístico do mês", map.isError ? NA : map.data ?? NA, `Competência ${String(m).padStart(2, "0")}/${y}`, "/mapa-estatistico", map.isLoading)}
      {card("Vagas nas turmas", v ? `${v.open} com vaga · ${v.full} lotadas · ${v.over} acima` : NA,
        v ? (v.unknown ? `${v.unknown} turma(s) sem capacidade informada` : `${v.total} turmas ativas`) : "Leitura não autorizada ou indisponível", "/turmas", vac.isLoading)}
      {card("Ocorrências graves no mês", grave == null ? NA : String(grave), "Graves e gravíssimas registradas no Histórico de ocorrências", "/gestao-escolar", occ.isLoading)}
    </section>
  );
}
