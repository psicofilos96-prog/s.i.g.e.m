import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, StatePanel, EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { governError } from "@/lib/observability/governed-errors";
import { DATASETS, EI_BLOCKERS, EI_CAPABILITIES } from "./catalog";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

type Read<T> = { state: "loading" } | { state: "ok"; rows: T[] } | { state: "unknown"; message: string };
type Program = { id: string; name: string; origin_kind: string; application_responsibility: string; correction_responsibility: string; result_delivery: string; event_kind: string };
type Edition = { id: string; label: string; reference_date: string; program_logical_id: string; event_kind: string };
type Dash = { id: string; title: string; visibility: string; widgets: unknown[] };

function useRead<T>(fn: string, args: Record<string, unknown>, knownAt: string): Read<T> {
  const [s, setS] = useState<Read<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    rpc(fn, args).then(({ data, error }) => {
      if (!live) return;
      if (error) setS({ state: "unknown", message: governError(error).userMessage });
      else setS({ state: "ok", rows: (data as T[]) ?? [] });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, knownAt]);
  return s;
}

const count = (r: Read<unknown>) => (r.state === "ok" ? String(r.rows.length) : r.state === "loading" ? "…" : "Desconhecido");

export function IntelligenceStudioPage() {
  const [knownAt] = useState(() => new Date().toISOString());
  const programs = useRead<Program>("assessment_programs_at", { _known_at: knownAt }, knownAt);
  const editions = useRead<Edition>("assessment_editions_at", { _program: null, _known_at: knownAt }, knownAt);
  const dashboards = useRead<Dash>("intelligence_dashboards_visible", {}, knownAt);
  const live = <T extends { event_kind?: string }>(r: Read<T>) => (r.state === "ok" ? r.rows.filter((x) => x.event_kind !== "revogacao") : []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Acompanhamento e Avaliação" title="Estúdio de Inteligência Educacional"
        description="Resultados de avaliações externas e internas lidos das fontes canônicas, com proveniência, natureza do dado e comparabilidade declarada." />
      <Tabs defaultValue="visao">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {([["visao", "Visão Geral"], ["avaliacoes", "Avaliações"], ["evolucao", "Evolução Histórica"], ["habilidades", "Habilidades/Descritores"], ["escolas", "Escolas e Turmas"], ["alunos", "Alunos"], ["relatorios", "Relatórios"], ["paineis", "Painéis"], ["qualidade", "Qualidade dos Dados"]] as const).map(([v, l]) => (
            <TabsTrigger key={v} value={v}>{l}</TabsTrigger>))}
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <section aria-label="Indicadores do acervo" className="grid grid-cols-1 rounded-md border sm:grid-cols-3">
            <StatCard label="Programas avaliativos" value={count(programs)} helper="registrados por pessoa autorizada" />
            <StatCard label="Edições/ciclos" value={count(editions)} helper="com data de referência" />
            <StatCard label="Painéis visíveis" value={count(dashboards)} helper="pessoais, do perfil ou institucionais" />
          </section>
          {programs.state === "unknown" && <StatePanel tone="warning" title="Leitura indisponível (UNKNOWN)" description={`${programs.message} Sem permissão de leitura, os números aparecem como desconhecidos, nunca como zero.`} />}
          <section aria-label="Bloqueios" className="grid gap-3 md:grid-cols-3">
            {EI_BLOCKERS.map((b) => <StatePanel key={b.code} tone="info" title={b.code} description={b.text} />)}
          </section>
        </TabsContent>

        <TabsContent value="avaliacoes">
          {programs.state === "ok" && live(programs).length === 0 && <EmptyState title="Nenhum programa registrado" description="SAEB, AVALIA RJ, CAEd, Saber Ler e avaliações municipais entram como programa com origem, responsável pela aplicação e pela correção." />}
          <ul className="divide-y rounded-md border">
            {live(programs).map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{p.name}</h3><StatusBadge tone="neutral">{p.origin_kind}</StatusBadge><StatusBadge tone="info">{p.result_delivery}</StatusBadge></div>
                <p className="mt-1 text-sm text-muted-foreground">Aplicação: {p.application_responsibility} · Correção: {p.correction_responsibility}</p>
              </li>))}
          </ul>
        </TabsContent>

        <TabsContent value="evolucao"><StatePanel title="Séries só entre métricas comparáveis" description="A comparação entre edições exige declaração registrada (comparável, não comparável ou desconhecida). O nome do componente nunca decide." /></TabsContent>
        <TabsContent value="habilidades"><StatePanel tone="info" title="CONTENT_SOURCE_PENDING" description="Habilidades e descritores dependem da edição oficial da matriz importada no repositório curricular. Nenhuma correspondência é criada sem fonte homologada." /></TabsContent>
        <TabsContent value="escolas"><StatePanel title="Agregado por escola e turma" description="Disponível quando houver resultados importados e permissão de escola ou rede. Grupos pequenos só são suprimidos com política de divulgação registrada." /></TabsContent>
        <TabsContent value="alunos"><StatePanel tone="warning" title="Dado pessoal" description="Resultado por estudante só com permissão específica e dimensão sensível escolhida explicitamente. Painéis executivos usam agregado." /></TabsContent>
        <TabsContent value="relatorios">
          <ul className="divide-y rounded-md border">{DATASETS.map((d) => (
            <li key={d.id} className="p-4"><h3 className="font-semibold">{d.label}</h3><p className="text-sm text-muted-foreground">Fonte: {d.source} · Granularidade: {d.grain} · Exige {d.readCapability}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dimensões: {d.dimensions.map((x) => x.label).join(", ")}. Exportação pelo motor de relatórios, com notas metodológicas.</p></li>))}</ul>
        </TabsContent>
        <TabsContent value="paineis">
          {dashboards.state === "ok" && dashboards.rows.length === 0 && <EmptyState title="Nenhum painel salvo" description="Painéis guardam só referências a consultas, nunca cópias de dados." />}
          <ul className="divide-y rounded-md border">{dashboards.state === "ok" && dashboards.rows.map((d) => <li key={d.id} className="p-4"><span className="font-semibold">{d.title}</span> <StatusBadge tone="neutral">{d.visibility}</StatusBadge> <span className="text-sm text-muted-foreground">{d.widgets.length} widget(s)</span></li>)}</ul>
        </TabsContent>
        <TabsContent value="qualidade">
          <ul className="divide-y rounded-md border">{EI_CAPABILITIES.map((c) => <li key={c.id} className="p-3 text-sm"><code>{c.id}</code> <span className="text-muted-foreground">({c.scope}) — {c.note}</span></li>)}</ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
