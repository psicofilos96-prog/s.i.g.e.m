import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { projectWorkflow } from "@/features/statistical-map/map-structures";
import { mapStageLabel, vacancySummary, type VacancyRow } from "./director-summary";
import type { Block } from "./management-panel";
import { Button } from "@/components/ui/button";

const db = supabase as unknown as { from: (t: string) => any };

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

/** Quatro indicadores prioritários; cada número mantém sua fonte e estado original. */
export function DirectorSummaryPanel({ school, year, on, blocks }: { school: string; year: string; on: string; blocks: readonly Block[] }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const scope = [s?.user.id, s?.sessionRevision, school];
  const [y, m] = [Number(on.slice(0, 4)), Number(on.slice(5, 7))];
  const vac = useQuery({ queryKey: ["dir-vacancies", ...scope, year, on], enabled: !!s, retry: false,
    queryFn: () => callRpc<VacancyRow[]>("secretariat_class_vacancies_at", { _school: school, _year: year, _on: on }) });
  const map = useQuery({ queryKey: ["dir-map", ...scope, y, m], enabled: !!s, retry: false, queryFn: () => readMap(school, y, m) });
  if (!s) return null;
  const v = vacancySummary(vac.isError ? null : vac.data ?? null);
  const card = (title: string, value: string, detail: string, to: string, loading: boolean, action: string | null = "Consultar") => (
    <article className="flex min-h-36 flex-col rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className={`mt-2 font-semibold tabular-nums ${["Aguardando preenchimento", "Não disponível", "Consulta indisponível"].includes(value) ? "text-xs text-muted-foreground" : "text-lg"}`}>{loading ? "Carregando…" : value}</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{detail}</p>
      {action && <Button asChild size="sm" variant="outline" className="mt-3 self-start"><Link to={to as "/secretaria"}>{action}</Link></Button>}
    </article>);
  const active = blocks.find((b) => b.id === "matriculas");
  const classes = blocks.find((b) => b.id === "alocacoes");
  const metric = (b: Block | undefined) => !b ? "Aguardando preenchimento" : b.value === null ? (b.state === "UNAVAILABLE" ? "Não disponível" : "Aguardando preenchimento") : String(b.value);
  const detail = (b: Block | undefined) => b?.state === "UNKNOWN" ? "O dado ainda não foi confirmado." : b?.state === "UNAVAILABLE" ? "A informação não está disponível neste perfil." : b?.detail ?? "Consulte o módulo responsável.";
  return (
    <section aria-label="Indicadores principais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {card("Matrículas ativas", metric(active), detail(active), "/secretaria", false, active?.state === "UNAVAILABLE" ? null : active?.state === "UNKNOWN" ? "Preencher" : "Ver matrículas")}
      {card("Turmas com estudantes", metric(classes), detail(classes), "/turmas", false, classes?.state === "UNAVAILABLE" ? null : classes?.state === "UNKNOWN" ? "Preencher" : "Ver turmas")}
      {card("Vagas nas turmas", v ? `${v.open} com vaga · ${v.full} lotadas · ${v.over} acima` : vac.isError ? "Consulta indisponível" : "Carregando…", v ? (v.unknown ? `${v.unknown} turma(s) aguardando capacidade; ${v.total} turmas ativas.` : `${v.total} turmas ativas.`) : vac.isError ? "Não foi possível ler as capacidades nesta consulta. Confira a tela de turmas." : "A capacidade das turmas precisa estar registrada para calcular vagas.", "/turmas", vac.isLoading, v?.unknown ? "Conferir capacidades" : "Ver vagas")}
      {card("Mapa Estatístico do mês", map.isError ? "Consulta indisponível" : map.data ?? "Aguardando preenchimento", map.isError ? `Não foi possível consultar o mapa da competência ${String(m).padStart(2, "0")}/${y}. Abra o módulo para verificar a fonte.` : `Competência ${String(m).padStart(2, "0")}/${y}. O estado reflete o fluxo oficial do mapa.`, "/mapa-estatistico", map.isLoading, "Abrir mapa")}
    </section>
  );
}
