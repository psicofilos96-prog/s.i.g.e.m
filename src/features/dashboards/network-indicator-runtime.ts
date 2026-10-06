// AD.1 — disponibilidade em tempo de execução: o catálogo declara dependências,
// e cada dependência é resolvida lendo a fonte canônica com a sessão (RLS).
// Nenhuma tabela "frente pronta"; leitura negada ou erro ⇒ indisponível com motivo.
import type { DependencyState } from "./network-indicator-catalog";
import { NETWORK_INDICATORS, type IndicatorDefinition } from "./network-indicator-catalog";
import type { CellValue, ColumnDef, ReportDefinition } from "@/features/reports/report-engine";

export type DependencyProbe = Readonly<{ front: string; table: string; requireRows?: string }>;

/** Fonte canônica de cada dependência. `requireRows`: motivo quando ler é possível mas não há fato que sustente o indicador. */
export const DEPENDENCY_SOURCES: Readonly<Record<string, DependencyProbe>> = {
  cadastro: { front: "Cadastro das escolas", table: "institutional_school_record_versions" },
  infraestrutura: { front: "Infraestrutura", table: "school_infrastructure_attribute_versions" },
  matricula: { front: "Matrículas", table: "school_enrollments" },
  movimentacao: { front: "Movimentações", table: "student_movement_events" },
  mapa: { front: "Mapa Estatístico", table: "statistical_map_versions", requireRows: "Nenhuma versão oficializada do Mapa." },
  curriculo: { front: "Posição curricular", table: "allocation_curricular_positions" },
  oferta: { front: "Grade", table: "class_schedule_blocks" },
  docente: { front: "Atribuição docente", table: "teaching_assignment_versions" },
  diario: { front: "Diário", table: "lesson_record_versions" },
  frequencia: { front: "Frequência", table: "attendance_record_versions" },
  avaliacao: { front: "Avaliação", table: "assessment_instrument_status_events" },
  acompanhamento: { front: "Acompanhamento", table: "school_pedagogical_records" },
};

export type CountReader = (table: string) => Promise<{ count: number | null; error: string | null }>;

/** Resolve o estado das dependências pelas fontes; nunca lê de constante. */
export async function resolveDependencies(read: CountReader, keys: readonly string[] = Object.keys(DEPENDENCY_SOURCES)) {
  const out: Record<string, DependencyState & { count: number | null }> = {};
  await Promise.all(keys.map(async (k) => {
    const p = DEPENDENCY_SOURCES[k];
    if (!p) { out[k] = { front: k, ready: false, reason: "Dependência sem fonte declarada.", count: null }; return; }
    const r = await read(p.table).catch((e: unknown) => ({ count: null, error: String(e) }));
    if (r.error || r.count == null) { out[k] = { front: p.front, ready: false, reason: "Fonte não legível com esta sessão.", count: null }; return; }
    if (p.requireRows && r.count === 0) { out[k] = { front: p.front, ready: false, reason: p.requireRows, count: 0 }; return; }
    out[k] = { front: p.front, ready: true, reason: r.count === 0 ? "Fonte legível; nenhum registro no recorte." : "Fonte legível.", count: r.count };
  }));
  return out;
}

// ── AD.2 — valores reais pelo reader canônico `network_indicators_at` ──────────

export type IndicatorState = "available" | "zero" | "unknown" | "unavailable";
export type IndicatorReading = Readonly<{
  key: string; state: IndicatorState; value: number | null; reason: string | null; source: string;
  breakdown: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
}>;
export type NetworkReading = Readonly<{ asOf: string; knownAt: string; school: string | null; year: string | null; indicators: readonly IndicatorReading[] }>;

const STATES: readonly IndicatorState[] = ["available", "zero", "unknown", "unavailable"];

/** Converte a resposta do banco. Estado desconhecido, valor ausente ou incoerente falham fechado: nunca viram zero. */
export function parseNetworkReading(raw: unknown): NetworkReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ind = (r["indicators"] ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const indicators = NETWORK_INDICATORS.map((d): IndicatorReading => {
    const x = ind[d.key];
    const source = typeof x?.["source"] === "string" ? x["source"] : "não declarada";
    if (!x) return { key: d.key, state: "unavailable", value: null, reason: "O leitor não devolveu este indicador.", source, breakdown: null };
    const st = STATES.includes(x["state"] as IndicatorState) ? (x["state"] as IndicatorState) : "unknown";
    const v = typeof x["value"] === "number" && Number.isFinite(x["value"]) ? x["value"] : null;
    const reason = typeof x["reason"] === "string" ? x["reason"] : null;
    if (st === "available" && (v == null || v === 0)) return { key: d.key, state: "unknown", value: null, reason: "Valor incoerente com o estado devolvido.", source, breakdown: null };
    if (st === "zero" && v !== 0) return { key: d.key, state: "unknown", value: null, reason: "Zero não comprovado pelo leitor.", source, breakdown: null };
    if ((st === "unknown" || st === "unavailable")) return { key: d.key, state: st, value: null, reason: reason ?? "Motivo não informado.", source, breakdown: null };
    return { key: d.key, state: st, value: v, reason, source, breakdown: (x["breakdown"] as IndicatorReading["breakdown"]) ?? null };
  });
  return { asOf: String(r["as_of"] ?? ""), knownAt: String(r["known_at"] ?? ""), school: (r["school"] as string) ?? null, year: (r["year"] as string) ?? null, indicators };
}

/** Rótulo de natureza: "Oficial" só para indicador de natureza oficial cujo valor veio de versão oficializada. */
export function natureLabel(def: IndicatorDefinition, reading: IndicatorReading): string {
  if (def.nature === "oficial") return reading.state === "available" ? "Oficial" : "Oficial (sem versão oficializada)";
  return def.nature === "operacional" ? "Operacional (dinâmico)" : def.nature === "derivado" ? "Derivado" : "Observado/importado";
}

export const STATE_LABEL: Record<IndicatorState, string> = { available: "Disponível", zero: "Zero comprovado", unknown: "Desconhecido", unavailable: "Indisponível" };

/** Qualidade dos dados ≠ desempenho: só lista lacunas das fontes, sem julgar escola ou pessoa. */
export type QualityFinding = Readonly<{ key: string; kind: "ausencia" | "nao-autorizado" | "pendente-oficializacao" | "fonte-nao-constituida"; text: string }>;
export function qualityFindings(r: NetworkReading): QualityFinding[] {
  return r.indicators.flatMap((i): QualityFinding[] => {
    if (i.state === "available" || i.state === "zero") return [];
    const def = NETWORK_INDICATORS.find((d) => d.key === i.key)!;
    const reason = i.reason ?? "";
    const kind: QualityFinding["kind"] = /autoriza|atuação|capacidade/i.test(reason) ? "nao-autorizado"
      : def.nature === "oficial" ? "pendente-oficializacao"
      : i.state === "unavailable" ? "fonte-nao-constituida" : "ausencia";
    return [{ key: i.key, kind, text: `${def.name}: ${reason}` }];
  });
}

const COLS: readonly ColumnDef[] = [
  { id: "indicador", label: "Indicador", kind: "text" }, { id: "definicao", label: "Definição", kind: "text" },
  { id: "unidade", label: "Unidade", kind: "text" }, { id: "natureza", label: "Natureza", kind: "text" },
  { id: "estado", label: "Estado", kind: "text" }, { id: "valor", label: "Valor", kind: "number" },
  { id: "motivo", label: "Motivo", kind: "text" }, { id: "fonte", label: "Proveniência", kind: "text" },
  { id: "asOf", label: "Situação em", kind: "date" }, { id: "knownAt", label: "Conhecido até", kind: "text" },
  { id: "recorte", label: "Recorte", kind: "text" },
];

export const INDICADORES_REDE: ReportDefinition = {
  id: "indicadores-da-rede", version: 1, title: "Indicadores da rede (CIECE)",
  description: "Mesmos valores e estados da tela: definição, unidade, natureza, estado, motivo e proveniência; nenhum valor dinâmico é rotulado oficial.",
  source: "network_indicators_at (SECURITY INVOKER, RLS + capability)",
  params: [], columns: COLS, formats: ["csv"], reproducible: false, syncRowLimit: 200,
};

export function indicatorRows(r: NetworkReading): Record<string, CellValue>[] {
  return r.indicators.map((i) => {
    const d = NETWORK_INDICATORS.find((x) => x.key === i.key)!;
    return { indicador: d.name, definicao: d.definition, unidade: d.unit, natureza: natureLabel(d, i), estado: STATE_LABEL[i.state],
      valor: i.value, motivo: i.reason, fonte: i.source, asOf: r.asOf, knownAt: r.knownAt, recorte: r.school ? `escola ${r.school}` : "rede" };
  });
}
