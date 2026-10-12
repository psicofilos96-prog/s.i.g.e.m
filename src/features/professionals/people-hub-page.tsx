/** L21 — Gestão de Pessoas: painel, quadro, ficha por abas, lotação, cobertura, atribuições e necessidades. Só dado institucional lido com a sessão. */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { FactValue } from "@/components/sigem/states";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { projectClass } from "@/features/staffing/staffing-model";
import { loadStaffingInputs } from "@/features/staffing/staffing-source";
import { functionalMessage, functionalPicture, functionalTimeline, VALIDITY_LABEL, type PersonPicture } from "./functional-life";
import { coverageGrid, dashboard, filterRoster, type RosterFilter } from "./people-hub-model";
import { loadPeopleSources, peopleSchools } from "./people-hub-source";

const TABS = [["painel", "Painel"], ["quadro", "Quadro de pessoal"], ["lotacao", "Mapa de lotação"], ["cobertura", "Cobertura"], ["atribuicoes", "Atribuições"], ["necessidades", "Necessidades"]] as const;
type Tab = (typeof TABS)[number][0];
const COVER_LABEL = { integral: "Integral", parcial: "Parcial", ausente: "Ausente", indeterminada: "Indeterminada" } as const;
const COVER_TONE = { integral: "border-primary/40", parcial: "border-accent", ausente: "border-destructive", indeterminada: "border-dashed border-muted-foreground" } as const;

export function PeopleHubPage() {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const [school, setSchool] = useState("");
  const [tab, setTab] = useState<Tab>("painel");
  const on = operationalToday();
  const schools = useQuery({ queryKey: ["ph-schools", uid], enabled: !!uid, queryFn: peopleSchools });
  const people = useQuery({ queryKey: ["ph-people", uid, school], enabled: !!uid && !!school, queryFn: () => loadPeopleSources(school), retry: false });
  const classes = useQuery({ queryKey: ["ph-classes", uid, school, on], enabled: !!uid && !!school, retry: false,
    queryFn: async () => { const i = await loadStaffingInputs(school, on, new Date().toISOString()); return i ? i.map(projectClass) : null; } });
  const picture = useMemo(() => (people.data ? functionalPicture(people.data.src, school, on, null) : null), [people.data, school, on]);

  if (a.status === "signed-out") return <SignInRequired title="Gestão de Pessoas" what="o quadro de pessoal, lotação e cobertura" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  if (schools.isError) return <StatePanel tone="danger" title="Permissões não puderam ser lidas" description={functionalMessage((schools.error as Error).message)} />;
  if (schools.isLoading) return <SkeletonState label="Carregando escolas do seu alcance" />;
  if (!schools.data?.length) return <EmptyState title="Sem escola no seu alcance" description="Sua conta não tem a permissão de consultar registro funcional em nenhuma escola." />;

  const names = people.data?.names ?? new Map<string, string>();
  const dash = dashboard("institucional", picture, classes.data ?? null);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gestão de Pessoas" title="Pessoal, lotação e atribuição de aulas" description="Projeção do registro funcional e da grade oficial, lida com a sua conta. Nada aqui grava, aprova ou formaliza; ausência de dado nunca vira zero." />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 text-sm">Escola
          <select className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">Selecione</option>{schools.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <p className="text-xs text-muted-foreground">Data de referência: {on}</p>
      </div>
      {!school ? <EmptyState title="Escolha uma escola" description="Os números são calculados na hora a partir dos registros oficiais." /> : <>
        <div role="tablist" aria-label="Seções da Gestão de Pessoas" className="flex gap-1 overflow-x-auto border-b">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`min-h-11 shrink-0 px-3 text-sm ${tab === id ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"}`}>{label}</button>))}
        </div>
        <div role="tabpanel">
          {people.isError ? <StatePanel tone="danger" title="Registro funcional indisponível" description={functionalMessage((people.error as Error).message)} />
            : tab === "painel" ? <Dashboard dash={dash} loading={people.isLoading || classes.isLoading} />
            : tab === "quadro" ? (picture ? <Roster people={picture} names={names} /> : <SkeletonState label="Carregando quadro de pessoal" />)
            : tab === "lotacao" ? (picture ? <PlacementMap people={picture} names={names} /> : <SkeletonState label="Carregando lotações" />)
            : tab === "cobertura" ? <Coverage loading={classes.isLoading} data={classes.data} />
            : tab === "atribuicoes" ? <Assignments />
            : <Needs loading={classes.isLoading} data={classes.data} />}
        </div>
      </>}
    </div>
  );
}

function Dashboard({ dash, loading }: { dash: ReturnType<typeof dashboard>; loading: boolean }) {
  if (loading) return <SkeletonState label="Calculando indicadores" />;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{dash.indicators.map((i) => (
        <div key={i.id} className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="text-xl"><FactValue value={i.value} /></dd>{i.note && <dd className="text-xs text-muted-foreground">{i.note}</dd>}</div>))}</dl>
      <section aria-labelledby="ph-alerts" className="rounded-md border p-4">
        <h2 id="ph-alerts" className="font-medium">Alertas ({dash.alerts.length})</h2>
        {dash.alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum alerta nas fontes lidas.</p>
          : <ul className="mt-2 space-y-1 text-sm">{dash.alerts.slice(0, 50).map((x) => <li key={x.id} className="rounded border-l-4 border-accent pl-2">{x.text}</li>)}</ul>}
        <p className="mt-2 text-xs text-muted-foreground">Alertas apontam fatos lidos; a correção é feita na tela competente, nunca aqui.</p>
      </section>
    </div>
  );
}

function Roster({ people, names }: { people: PersonPicture[]; names: ReadonlyMap<string, string> }) {
  const [f, setF] = useState<RosterFilter>({ text: "", situation: "todos" });
  const [open, setOpen] = useState<string | null>(null);
  const rows = filterRoster(people, names, f);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Buscar por nome<input className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
        <label className="text-sm">Situação<select className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" value={f.situation} onChange={(e) => setF({ ...f, situation: e.target.value as RosterFilter["situation"] })}>
          <option value="todos">Todos</option><option value="vigente">Com vínculo vigente</option><option value="sem-lotacao">Sem lotação vigente</option><option value="sem-atuacao">Sem atuação no SIGEM</option></select></label>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} de {people.length} pessoa(s)</p>
      {rows.length === 0 ? <EmptyState title="Nenhum resultado" description="Nenhuma pessoa corresponde aos filtros." /> :
        <ul className="space-y-2">{rows.map((p) => (
          <li key={p.personId} className="rounded-md border p-3">
            <button className="min-h-11 w-full text-left" aria-expanded={open === p.personId} onClick={() => setOpen(open === p.personId ? null : p.personId)}>
              <span className="font-medium">{names.get(p.personId) ?? "Nome não declarado"}</span>
              <span className="block text-xs text-muted-foreground">{p.links.length} vínculo(s) · {p.engagements.length} atuação(ões)</span></button>
            {open === p.personId && <Ficha p={p} />}
          </li>))}</ul>}
    </div>
  );
}

const FICHA_TABS = [["vinculos", "Vínculos"], ["lotacoes", "Lotações"], ["exercicio", "Exercício"], ["habilitacoes", "Habilitações"], ["historico", "Histórico"]] as const;
function Ficha({ p }: { p: PersonPicture }) {
  const [t, setT] = useState<(typeof FICHA_TABS)[number][0]>("vinculos");
  return (
    <div className="mt-2 border-t pt-2">
      <div role="tablist" aria-label="Ficha funcional" className="flex gap-1 overflow-x-auto">{FICHA_TABS.map(([id, l]) => (
        <button key={id} role="tab" aria-selected={t === id} onClick={() => setT(id)} className={`min-h-11 shrink-0 rounded px-2 text-sm ${t === id ? "bg-muted font-medium" : "text-muted-foreground"}`}>{l}</button>))}</div>
      <div role="tabpanel" className="mt-2 text-sm">
        {t === "vinculos" && <ul className="space-y-1">{p.links.map((l) => <li key={l.link.logical_id}>Vínculo v{l.link.version} · {VALIDITY_LABEL[l.validity]} · início {l.link.valid_from ?? "não informado"}</li>)}</ul>}
        {t === "lotacoes" && <ul className="space-y-1">{p.links.flatMap((l) => l.postings).map(({ posting, validity }) => <li key={posting.logical_id}>Lotação · {VALIDITY_LABEL[validity]} · {posting.valid_from ?? "início não informado"} → {posting.valid_until ?? "sem fim"}</li>)}</ul>}
        {t === "exercicio" && (p.links.some((l) => l.exercises.length) ? <ul>{p.links.flatMap((l) => l.exercises).map((e) => <li key={e.logical_id}>{e.function_id} · desde {e.valid_from}</li>)}</ul> : <p className="text-muted-foreground">Nenhum exercício vigente registrado.</p>)}
        {t === "habilitacoes" && (p.qualifications.length ? <ul>{p.qualifications.map((q) => <li key={q.logical_id}>{q.qualification_id}</li>)}</ul> : <p className="text-muted-foreground">Nenhuma habilitação registrada. Não significa ausência de formação.</p>)}
        {t === "historico" && <ol className="space-y-1">{functionalTimeline(p).map((e, i) => <li key={i}>{e.date ?? "data não informada"} — {e.label}</li>)}</ol>}
        <p className="mt-2"><Link to="/profissionais/$id" params={{ id: p.personId }} className="text-primary underline">Abrir cadastro completo</Link></p>
      </div>
    </div>
  );
}

function PlacementMap({ people, names }: { people: PersonPicture[]; names: ReadonlyMap<string, string> }) {
  const rows = people.map((p) => ({ p, posted: p.links.some((l) => l.postings.some((x) => x.validity === "vigente")), exercising: p.links.some((l) => l.exercises.length > 0) }));
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Lotação (ato do DP) e exercício (atuação na unidade) são fatos distintos; divergências só são sinalizadas.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Lotação e exercício por pessoa</caption>
        <thead><tr className="text-left"><th scope="col">Pessoa</th><th scope="col">Lotação vigente</th><th scope="col">Exercício vigente</th><th scope="col">Situação</th></tr></thead>
        <tbody>{rows.map(({ p, posted, exercising }) => <tr key={p.personId} className="border-t">
          <td className="py-2">{names.get(p.personId) ?? "Nome não declarado"}</td><td>{posted ? "Sim" : "Não"}</td><td>{exercising ? "Sim" : "Não"}</td>
          <td>{posted === exercising ? "Coerente" : "Divergência a conferir"}</td></tr>)}</tbody></table></div>
    </div>
  );
}

function Coverage({ loading, data }: { loading: boolean; data: ReturnType<typeof projectClass>[] | null | undefined }) {
  if (loading) return <SkeletonState label="Lendo grade e regências" />;
  if (!data) return <EmptyState title="Turmas não puderam ser lidas" description="Sem leitura, nenhuma cobertura é mostrada." />;
  const grid = coverageGrid(data);
  if (!grid.length) return <EmptyState title="Sem grade vigente" description="Nenhuma turma tem blocos de horário registrados nesta data." />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Aula atribuída não é aula ministrada: a execução vem só do Diário de Classe.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{grid.map((c) => (
        <li key={`${c.classId}:${c.componentId}`} className={`rounded-md border-2 p-3 text-sm ${COVER_TONE[c.state]}`}>
          <span className="font-medium">{c.label}</span><span className="block">{c.componentId ?? "Componente não informado"} · {c.lessons} aula(s)</span>
          <span className="block text-xs">Cobertura: {COVER_LABEL[c.state]}</span></li>))}</ul>
    </div>
  );
}

function Assignments() {
  return (
    <StatePanel title="Atribuições" description="O quadro visual de propostas ainda não está ligado a um registro institucional; nenhuma atribuição é exibida para não parecer oficial. Atribuições vigentes aparecem em Cobertura (regência registrada)." />
  );
}

function Needs({ loading, data }: { loading: boolean; data: ReturnType<typeof projectClass>[] | null | undefined }) {
  if (loading) return <SkeletonState label="Calculando necessidades" />;
  if (!data) return <EmptyState title="Turmas não puderam ser lidas" description="Sem leitura, nenhuma necessidade é calculada." />;
  const open = coverageGrid(data).filter((c) => c.state === "ausente" || c.state === "parcial");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Necessidade = aulas sem regência por turma e componente. O número de professores nunca é estimado dividindo aulas por jornada.</p>
      {open.length === 0 ? <p className="text-sm">Nenhuma aula descoberta nas turmas lidas.</p> :
        <ul className="space-y-1 text-sm">{open.map((c) => <li key={`${c.classId}:${c.componentId}`} className="rounded border p-2">{c.label} — {c.componentId ?? "componente não informado"} ({COVER_LABEL[c.state]})</li>)}</ul>}
      <p className="text-xs"><Link to="/quadro-docente" className="text-primary underline">Ver detalhamento no Quadro docente</Link></p>
    </div>
  );
}
