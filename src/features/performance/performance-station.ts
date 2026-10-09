/**
 * N6.2.4 — fechamento técnico da estação Avaliação (sem BNCC↔SAEB).
 * Tudo é projeção pura sobre o motor existente (performance-model) e exportação só pelo report-engine.
 * Nada ordena, classifica ou decide: sem ranking, sem "melhor/pior", sem ação automática.
 */
import { runReport, toCsv, toPrintableHtml, type CellValue, type ReportDefinition } from "@/features/reports/report-engine";
import {
  compareSeries, computeMetric, FORMULA_LABEL, heatmap,
  type AssessmentVersion, type Comparison, type Disclosure, type MetricValue, type MetricVersion, type ResultRow,
} from "./performance-model";

export const EXPORT_BLOCKED_NO_POLICY = "Exportação bloqueada: não existe política de divulgação registrada para suprimir grupos pequenos.";
export const NOT_RANKING_NOTE = "Comparação descritiva; não é ranking nem classificação de escolas, turmas ou estudantes.";
const branding = (title: string) => ({ headerLines: ["SIGEM — Avaliação e Desempenho"], title });
const valueText = (v: MetricValue | null): CellValue => (!v ? null : v.status === "calculada" ? v.value : null);
const stateText = (v: MetricValue | null, disclosed = true) =>
  !disclosed ? "suprimido" : !v ? "sem dado" : v.status === "calculada" ? "calculada" : v.status === "sem-base" ? "sem base" : "fórmula incompatível";

// ---------- Heatmap → CSV/PDF ----------
export const HEATMAP_REPORT: ReportDefinition = {
  id: "avaliacao-heatmap", version: 1, title: "Habilidade × escola", description: "Mapa de calor exportado da tela, mesmas células e supressão.",
  source: "inst_assessment_results_at + performance_metrics_at", params: [],
  columns: [
    { id: "habilidade", label: "Habilidade", kind: "text" }, { id: "escola", label: "Escola", kind: "text" },
    { id: "valor", label: "Valor", kind: "number" }, { id: "base", label: "Base", kind: "number" }, { id: "situacao", label: "Situação", kind: "text" },
  ],
  formats: ["csv", "pdf"], reproducible: false, syncRowLimit: 50_000,
};

export function heatmapRows(rows: readonly ResultRow[], metric: MetricVersion, a: AssessmentVersion, disclosure: Disclosure) {
  const h = heatmap(rows, metric.formula, a.scale, disclosure);
  const label = (it: string) => (it === "__nao-informado__" ? "Não informado" : a.items.find((x) => x.item_id === it)?.label ?? it);
  // ordem = ordem do motor (itens × escolas), nunca por valor
  return h.items.flatMap((it) => h.schools.map((s) => {
    const c = h.cells.find((x) => x.item === it && x.school === s)!;
    return {
      habilidade: label(it), escola: s,
      valor: c.disclosed ? valueText(c.metric) : null,
      base: c.disclosed && c.metric?.status === "calculada" ? c.metric.base : null,
      situacao: stateText(c.metric, c.disclosed),
    } as Record<string, CellValue>;
  }));
}

export type ExportOut = { ok: true; csv: string; html: string } | { ok: false; reason: string };
function exportOf(def: ReportDefinition, title: string, rows: readonly Record<string, CellValue>[], meta: readonly string[], disclosure: Disclosure, now: Date): ExportOut {
  if (!disclosure) return { ok: false, reason: EXPORT_BLOCKED_NO_POLICY };
  const r = runReport(def, { params: {} }, rows, now);
  const m = [...meta, `Política de divulgação: grupos com menos de ${disclosure.min_group_size} estudantes suprimidos (${disclosure.source_note}).`, NOT_RANKING_NOTE];
  return { ok: true, csv: toCsv(r, branding(title), m), html: toPrintableHtml(r, branding(title), m) };
}

export function exportHeatmap(rows: readonly ResultRow[], metric: MetricVersion, a: AssessmentVersion, disclosure: Disclosure, now = new Date()): ExportOut {
  return exportOf(HEATMAP_REPORT, `${HEATMAP_REPORT.title} — ${a.title} — ${metric.label}`, heatmapRows(rows, metric, a, disclosure),
    [`Métrica: ${metric.label} (v${metric.version}) — ${FORMULA_LABEL(metric.formula)}. Fonte: ${metric.source_note}.`, "\"sem dado\" = nenhum resultado registrado; não é zero."], disclosure, now);
}

// ---------- Evolução com 3+ edições ----------
export type EvolutionInput = { assessment: AssessmentVersion; metrics: readonly MetricVersion[]; results: readonly ResultRow[] };
export type EvolutionPoint = { assessment: AssessmentVersion; metric: MetricVersion | null; value: MetricValue | null };
export type Evolution = { points: EvolutionPoint[]; steps: (Comparison | { comparable: false; reason: string })[]; enough: boolean };
export const MIN_EVOLUTION_EDITIONS = 3;

/** Ordena por data de aplicação (cronologia, não desempenho); métrica do ponto = mesma lógica da referência, senão mesma population_key. */
export function evolutionSeries(reference: MetricVersion, editions: readonly EvolutionInput[]): Evolution {
  const sorted = [...editions].sort((x, y) => x.assessment.applied_from.localeCompare(y.assessment.applied_from) || x.assessment.logical_id.localeCompare(y.assessment.logical_id));
  const points: EvolutionPoint[] = sorted.map((e) => {
    const m = e.metrics.find((x) => x.logical_id === reference.logical_id) ?? e.metrics.find((x) => x.population_key === reference.population_key) ?? null;
    return { assessment: e.assessment, metric: m, value: m ? computeMetric(m.formula, e.assessment.scale, e.results) : null };
  });
  const steps = points.slice(1).map((p, i) => {
    const prev = points[i]!;
    if (!prev.metric || !p.metric || !prev.value || !p.value) return { comparable: false as const, reason: "Uma das edições não tem métrica correspondente registrada." };
    return compareSeries([{ metric: prev.metric, assessment: prev.assessment, value: prev.value }, { metric: p.metric, assessment: p.assessment, value: p.value }])[0]!;
  });
  return { points, steps, enough: points.length >= MIN_EVOLUTION_EDITIONS };
}

export const EVOLUTION_REPORT: ReportDefinition = {
  id: "avaliacao-evolucao", version: 1, title: "Evolução entre edições", description: "Série cronológica da métrica; ruptura de comparabilidade explícita.",
  source: "inst_assessments_at + performance_metrics_at + inst_assessment_results_at", params: [],
  columns: [
    { id: "edicao", label: "Edição", kind: "text" }, { id: "aplicacao", label: "Aplicação", kind: "date" }, { id: "valor", label: "Valor", kind: "number" },
    { id: "variacao", label: "Variação", kind: "number" }, { id: "variacao_pct", label: "Variação %", kind: "number" }, { id: "observacao", label: "Observação", kind: "text" },
  ],
  formats: ["csv", "pdf"], reproducible: false, syncRowLimit: 1000,
};
export function evolutionRows(ev: Evolution): Record<string, CellValue>[] {
  return ev.points.map((p, i) => {
    const s = i === 0 ? null : ev.steps[i - 1]!;
    return {
      edicao: `${p.assessment.title} (v${p.assessment.version})`, aplicacao: p.assessment.applied_from.slice(0, 10),
      valor: valueText(p.value),
      variacao: s && s.comparable ? s.delta : null,
      variacao_pct: s && s.comparable && s.deltaPercent !== null ? Math.round(s.deltaPercent * 10) / 10 : null,
      observacao: !p.metric ? "Sem métrica correspondente." : i === 0 ? "Ponto inicial." : s && !s.comparable ? `Sem comparação: ${s.reason}` : s && s.comparable && s.percentReason ? s.percentReason : "Comparável com a edição anterior.",
    };
  });
}
export function exportEvolution(ev: Evolution, reference: MetricVersion, disclosure: Disclosure, now = new Date()): ExportOut {
  return exportOf(EVOLUTION_REPORT, `${EVOLUTION_REPORT.title} — ${reference.label}`, evolutionRows(ev), [`Métrica de referência: ${reference.label} — ${FORMULA_LABEL(reference.formula)}.`], disclosure, now);
}

// ---------- Home real da estação ----------
export type StationHome = {
  total: number; byOrigin: { institucional: number; externa: number }; latestApplication: string | null;
  policy: "registrada" | "ausente"; nextSteps: string[];
};
/** Só contagens factuais das avaliações lidas; nenhuma nota, ranking ou alerta sobre desempenho. */
export function stationHome(assessments: readonly AssessmentVersion[], disclosure: Disclosure): StationHome {
  const live = assessments.filter((a) => a.event_kind !== "revogacao");
  const latest = live.map((a) => a.applied_from).filter(Boolean).sort().at(-1) ?? null;
  const steps: string[] = [];
  if (!disclosure) steps.push("Registrar a política de divulgação para liberar exportações de agregados.");
  if (live.length === 0) steps.push("Cadastrar uma avaliação institucional ou externa.");
  else steps.push("Escolher uma avaliação para ver dado observado, métricas e mapa por habilidade.");
  if (live.length >= MIN_EVOLUTION_EDITIONS) steps.push("Comparar três ou mais edições na evolução.");
  return {
    total: live.length,
    byOrigin: { institucional: live.filter((a) => a.origin !== "externa").length, externa: live.filter((a) => a.origin === "externa").length },
    latestApplication: latest, policy: disclosure ? "registrada" : "ausente", nextSteps: steps,
  };
}

/** Relatórios da estação: só os que têm fonte e motor; demais ficam catalogados com dependência. */
export const STATION_REPORTS: readonly ReportDefinition[] = [
  HEATMAP_REPORT, EVOLUTION_REPORT,
  { id: "avaliacao-bncc-saeb", version: 1, title: "Correspondência BNCC × SAEB", description: "Leitura por habilidade entre matrizes.", source: "—", params: [], columns: [], formats: [], reproducible: false, syncRowLimit: 0, dependency: "DEPENDE_DADO: sem fonte homologada de equivalência BNCC↔SAEB." },
];
export const IMPORT_ADAPTER_ID = "resultado-avaliacao-institucional";

/** NAVAL.UX — leitura textual do gráfico: mesma ordem dos dados (não é ranking), sem recalcular. */
export function chartTextSummary(data: readonly { label: string; value: number; base: number }[], unit: string | null | undefined): string {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return data.map((d) => `${d.label}: ${n(d.value)}${unit ? ` ${unit}` : ""} (base ${d.base})`).join("; ") + ".";
}

/** NAVAL.UX — frase da comparação: a diferença já calculada pelo motor, com sentido explícito. */
export function comparisonText(delta: number | null, otherTitle: string): string {
  if (delta === null) return "Comparação possível, mas um dos lados não tem base.";
  const n = Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (delta === 0) return `Igual a ${otherTitle}.`;
  return `${delta > 0 ? "Acima" : "Abaixo"} de ${otherTitle} em ${n}.`;
}

export const RESULT_STATUS_LABEL: Record<string, string> = { observado: "Com resultado", ausente: "Ausente", "nao-aplicado": "Não aplicado" };
