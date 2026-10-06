/**
 * Frente AM — inteligência avançada sobre o catálogo AD. Projeção pura, sem tabela nem cache persistido:
 * séries só comparam leituras compatíveis, qualidade é separada de desempenho, capacidade/demanda e
 * território declaram o parâmetro/fonte ausente em vez de inventá-lo.
 */
import { NETWORK_INDICATORS, type IndicatorDefinition } from "./network-indicator-catalog";
import type { IndicatorReading, NetworkReading } from "./network-indicator-runtime";
import type { CellValue } from "@/features/reports/report-engine";

export const BLOCKS = {
  contractual: "CONTRACTUAL_BALANCE — BLOCKED_BY_FUNCTIONAL_SOURCE",
  capacity: "MAX_CAPACITY — PARAMETER_PENDING",
  territory: "TERRITORIAL_DATA_PENDING",
} as const;

/** 2026 é histórico importado; 2027 é o primeiro ano operacional; ano sem estado fica desconhecido. */
export type YearNature = "historico-importado" | "operacional" | "sem-estado";
export function yearNature(year: string | null, operationalState: string | null): YearNature {
  if (year === "2026") return "historico-importado";
  if (year === "2027" && operationalState) return "operacional";
  return "sem-estado";
}
export const YEAR_LABEL: Record<YearNature, string> = {
  "historico-importado": "Histórico (importado)", operacional: "Operacional", "sem-estado": "Sem estado operacional",
};

export type SeriesPoint = Readonly<{ reading: NetworkReading; yearNature: YearNature; definitionVersion: number }>;
export type Comparison =
  | { kind: "comparavel"; delta: number }
  | { kind: "nao-comparavel"; reason: string };

/** Compara dois pontos de um indicador; incompatibilidade é dita por extenso, nunca resolvida em silêncio. */
export function compare(def: IndicatorDefinition, a: SeriesPoint, b: SeriesPoint): Comparison {
  const ia = a.reading.indicators.find((i) => i.key === def.key);
  const ib = b.reading.indicators.find((i) => i.key === def.key);
  if (!ia || !ib) return { kind: "nao-comparavel", reason: "Indicador ausente em uma das leituras." };
  if (a.definitionVersion !== b.definitionVersion) return { kind: "nao-comparavel", reason: "Versões diferentes da definição." };
  if ((a.reading.school ?? "") !== (b.reading.school ?? "")) return { kind: "nao-comparavel", reason: "Recortes diferentes (escola/rede)." };
  if (a.yearNature !== b.yearNature) return { kind: "nao-comparavel", reason: `Naturezas diferentes: ${YEAR_LABEL[a.yearNature]} × ${YEAR_LABEL[b.yearNature]}.` };
  if (ia.source !== ib.source) return { kind: "nao-comparavel", reason: "Proveniências diferentes." };
  const va = valueOf(ia), vb = valueOf(ib);
  if (va == null || vb == null) return { kind: "nao-comparavel", reason: "Valor desconhecido ou indisponível; ausência não vira zero." };
  return { kind: "comparavel", delta: vb - va };
}
const valueOf = (i: IndicatorReading): number | null => (i.state === "zero" ? 0 : i.state === "available" ? i.value : null);

/** Qualidade dos dados: categorias de lacuna das fontes, sem nota, ranking ou julgamento de escola/pessoa. */
export type QualityKind = "incompleto" | "ambiguo" | "conflito" | "fonte-pendente" | "nao-homologado" | "reconferencia";
export type QualitySignal = Readonly<{ kind: QualityKind; key: string; text: string }>;
export function qualityPanel(r: NetworkReading, extra: readonly QualitySignal[] = []): Record<QualityKind, QualitySignal[]> {
  const out: Record<QualityKind, QualitySignal[]> = { incompleto: [], ambiguo: [], conflito: [], "fonte-pendente": [], "nao-homologado": [], reconferencia: [] };
  for (const i of r.indicators) {
    if (i.state === "available" || i.state === "zero") continue;
    const d = NETWORK_INDICATORS.find((x) => x.key === i.key)!;
    const reason = i.reason ?? "";
    const kind: QualityKind = /homolog/i.test(reason) ? "nao-homologado" : /ambígu|ambigu/i.test(reason) ? "ambiguo"
      : /reconfer|desatualiz/i.test(reason) ? "reconferencia" : /incoerente|conflit/i.test(reason) ? "conflito"
      : i.state === "unavailable" ? "fonte-pendente" : "incompleto";
    out[kind].push({ kind, key: i.key, text: `${d.name}: ${reason || "motivo não informado"}` });
  }
  for (const s of extra) out[s.kind].push(s);
  return out;
}

/** Capacidade/oferta/demanda: só fatos; lotação máxima/dimensionamento sem parâmetro ⇒ PARAMETER_PENDING. */
export type CapacityView = Readonly<{ demand: number | null; offeredBlocks: number | null; capacity: number | null; status: string }>;
export function capacityView(r: NetworkReading, maxCapacityParam: number | null): CapacityView {
  const get = (k: string) => { const i = r.indicators.find((x) => x.key === k); return i ? valueOf(i) : null; };
  return { demand: get("matriculas-vigentes"), offeredBlocks: get("blocos-ofertados"),
    capacity: maxCapacityParam, status: maxCapacityParam == null ? BLOCKS.capacity : "parametro-declarado" };
}

/** Professores: consome X (necessidade/cobertura); carga contratual só com fonte funcional real. */
export function teacherView(r: NetworkReading, functionalSourceLoaded: boolean) {
  const cov = r.indicators.find((i) => i.key === "cobertura-docente");
  return { coverage: cov ? valueOf(cov) : null, coverageReason: cov?.reason ?? null,
    contractualBalance: functionalSourceLoaded ? "fonte-funcional-disponivel" : BLOCKS.contractual };
}

/** Território: mapa só com coordenada canônica; endereço textual não é geocodificado. */
export function territoryStatus(schools: readonly { latitude?: number | null; longitude?: number | null }[]) {
  const ok = schools.length > 0 && schools.every((s) => s.latitude != null && s.longitude != null);
  return ok ? "coordenadas-canonicas" : BLOCKS.territory;
}

/** Metadados obrigatórios de toda exportação analítica. */
export function exportMetadata(r: NetworkReading, yn: YearNature): Record<string, CellValue>[] {
  return [
    { campo: "Situação em", valor: r.asOf }, { campo: "Conhecido até", valor: r.knownAt },
    { campo: "Recorte", valor: r.school ? `escola ${r.school}` : "rede" }, { campo: "Ano", valor: r.year },
    { campo: "Natureza do ano", valor: YEAR_LABEL[yn] }, { campo: "Fonte", valor: "network_indicators_at (INVOKER, RLS)" },
    { campo: "Documento oficial", valor: "não — projeção dinâmica" },
  ];
}
