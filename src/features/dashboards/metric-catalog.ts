import { readPages } from "@/lib/list-paging";
/**
 * Catálogo de métricas: só entram métricas definíveis por fatos existentes.
 * Perspectivas sem métrica definível (CIECE, Supervisão, Avaliação, Administração) apontam para
 * suas superfícies próprias em vez de inventar KPI.
 */
import { supabase } from "@/integrations/supabase/client";
import { functionalPicture, type Sources } from "@/features/professionals/functional-life";
import { notAvailable, servedTotal, type Ctx, type MetricDefinition, type MetricResult } from "./metric-engine";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };
const school = (c: Ctx) => (c.scope.kind === "escola" ? c.scope.schoolId : "");
const firstOfMonth = (d: string) => `${d.slice(0, 8)}01`;

const enrollments: MetricDefinition = {
  id: "matriculas-vigentes", version: 1, label: "Matrículas vigentes", perspective: "secretaria",
  definition: "Matrículas da escola abertas até a data e sem encerramento registrado até a data.",
  formula: "contagem(cabeças de school_enrollments conhecidas em knownAt; opened_on ≤ data; sem school_enrollment_endings com ended_on ≤ data)",
  source: "school_enrollments + school_enrollment_endings", granularity: "escola × dia", scope: "escola",
  capabilities: ["consultar-matricula-e-movimentacao"], freshnessMs: 5 * 60_000, drillRoute: "/secretaria",
  async compute(c): Promise<MetricResult> {
    // PERF.LOADING.3 — calculado no servidor (active_enrollments_at, RLS da sessão): mesma regra de
    // activeEnrollments, sem trazer as matrículas ao navegador e sem recusa acima de 1000.
    const rows = await must<{ active_ids: string[] | null; undated_count: number | null }[]>(db.rpc("active_enrollments_at", { _school: school(c), _on: c.validOn, _known_at: c.knownAt ?? null }));
    const active = rows[0]?.active_ids ?? []; const undated = Number(rows[0]?.undated_count ?? 0);
    return { status: "disponivel", value: active.length, unit: "matrículas", refs: active, note: undated ? `${undated} matrícula(s) sem data de abertura não entram na contagem.` : null };
  },
};

const postings: MetricDefinition = {
  id: "lotacoes-vigentes", version: 1, label: "Pessoas com lotação vigente", perspective: "departamento-pessoal",
  definition: "Pessoas com ao menos uma lotação vigente na escola na data (vínculos múltiplos contam uma vez).",
  formula: "contagem distinta de pessoas em functionalPicture(escola, data, knownAt) com lotação 'vigente'",
  source: "professional_functional_links + professional_postings", granularity: "escola × dia", scope: "escola",
  capabilities: ["consultar-registro-funcional"], freshnessMs: 5 * 60_000, drillRoute: "/departamento-pessoal",
  async compute(c) {
    const pr = await readPages<any>((a, b) => db.from("professional_postings").select("*").eq("school_id", school(c)).order("id").range(a, b), 20000);
    if (pr.error) throw new Error(pr.error.message);
    if (pr.truncated) return notAvailable("Volume acima do limite de leitura desta tela.");
    const ps = pr.data ?? [];
    const linkIds = [...new Set(ps.map((p) => p.functional_link_logical_id))];
    const links = linkIds.length ? await must<any[]>(db.from("professional_functional_links").select("*").in("logical_id", linkIds)) : [];
    const src: Sources = { links, postings: ps, exercises: [], qualifications: [], events: [], processes: [], engagements: [] };
    const people = functionalPicture(src, school(c), c.validOn, c.knownAt).filter((p) => p.links.some((l) => l.postings.some((x) => x.validity === "vigente")));
    return { status: "disponivel", value: people.length, unit: "pessoas", refs: people.map((p) => p.personId), note: null };
  },
};

const meals: MetricDefinition = {
  id: "refeicoes-servidas-mes", version: 1, label: "Refeições servidas no mês (informadas)", perspective: "alimentacao",
  definition: "Soma das refeições servidas registradas do 1º dia do mês até a data, apenas onde o servido foi informado.",
  formula: "soma(served_count) em meal_services_at(escola, 1º do mês, data, knownAt); não informados contados à parte",
  source: "meal_service_records via meal_services_at", granularity: "escola × mês", scope: "escola",
  capabilities: ["consultar-alimentacao-escolar"], freshnessMs: 5 * 60_000, drillRoute: "/alimentacao-escolar",
  async compute(c) {
    const rows = await must<any[]>(db.rpc("meal_services_at", { _school: school(c), _from: firstOfMonth(c.validOn), _to: c.validOn, _known_at: c.knownAt }));
    const s = servedTotal(rows);
    if (s.records === 0) return notAvailable("Nenhum registro de refeição no período; isso não significa zero refeições.");
    if (s.informedRefs.length === 0) return notAvailable("Há registros, mas nenhum com quantidade servida informada.");
    return { status: "disponivel", value: s.total, unit: "refeições", refs: s.informedRefs, note: s.notInformed ? `${s.notInformed} registro(s) sem servido informado não entram na soma.` : null };
  },
};

const unread: MetricDefinition = {
  id: "avisos-nao-lidos", version: 1, label: "Meus avisos não lidos", perspective: "pessoal",
  definition: "Avisos entregues a você, não cancelados nem expirados, ainda não abertos.",
  formula: "my_unread_notification_count()", source: "notification_deliveries (próprio destinatário)", granularity: "conta × agora",
  scope: "pessoal", capabilities: [], freshnessMs: 60_000, drillRoute: "/avisos",
  async compute() { const n = await must<number>(db.rpc("my_unread_notification_count")); return { status: "disponivel", value: n, unit: "avisos", refs: [], note: null }; },
};

export const METRIC_CATALOG: readonly MetricDefinition[] = [enrollments, postings, meals, unread];

/** Perspectivas sem métrica definível hoje: apenas encaminhamento à superfície própria, com o motivo. */
export const LINKED_SURFACES: readonly { label: string; route: string; capabilities: readonly string[]; why: string }[] = [
  { label: "CIECE — Mapa Estatístico da rede", route: "/mapa-estatistico-rede", capabilities: [], why: "Os totais da rede vêm do motor de indicadores e da política de divulgação do CIECE; não são recalculados aqui." },
  { label: "Avaliação e Desempenho", route: "/avaliacao-desempenho", capabilities: ["consultar-desempenho-educacional"], why: "Só há indicador quando a métrica com fórmula e fonte foi registrada na própria área." },
  { label: "Supervisão — matrizes e calendário", route: "/matrizes-curriculares", capabilities: [], why: "Conformidade pedagógica não tem métrica homologada; o estado aparece nas próprias telas." },
  { label: "Direção / Orientação", route: "/direcao", capabilities: ["consultar-acompanhamento-pedagogico"], why: "O painel da escola já deriva turmas, matrículas e pendências com drill-down." },
];
