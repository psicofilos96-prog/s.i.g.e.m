/**
 * Frente AM — inteligência avançada sobre o catálogo AD. Projeção pura, sem tabela nem cache persistido:
 * séries só comparam leituras compatíveis, qualidade é separada de desempenho, capacidade/demanda e
 * território declaram o parâmetro/fonte ausente em vez de inventá-lo.
 */
import { NETWORK_INDICATORS, type IndicatorDefinition } from "./network-indicator-catalog";
import type { IndicatorReading, IndicatorState, NetworkReading } from "./network-indicator-runtime";
import { runReport, toCsv, type CellValue } from "@/features/reports/report-engine";
import { INDICADORES_REDE, indicatorRows } from "./network-indicator-runtime";

export const BLOCKS = {
  contractual: "CONTRACTUAL_BALANCE — BLOCKED_BY_FUNCTIONAL_SOURCE",
  capacity: "MAX_CAPACITY — PARAMETER_PENDING",
  territory: "TERRITORIAL_DATA_PENDING",
} as const;

/**
 * Natureza do ano vem SÓ do estado operacional registrado (`academic_year_operational_states`), nunca do rótulo:
 * 2026 é `historico-importado`; 2027 só vira operacional depois do ato humano de abertura.
 */
export type YearNature = "historico-importado" | "em-preparacao" | "operacional" | "encerrado" | "sem-estado";
export function yearNature(operationalState: string | null | undefined): YearNature {
  return operationalState === "historico-importado" || operationalState === "em-preparacao" || operationalState === "operacional" || operationalState === "encerrado"
    ? operationalState : "sem-estado";
}
export const YEAR_LABEL: Record<YearNature, string> = {
  "historico-importado": "Histórico (importado)", "em-preparacao": "Em preparação", operacional: "Operacional",
  encerrado: "Encerrado", "sem-estado": "Sem estado operacional",
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

/** Estado apresentado: ZERO, UNKNOWN, UNAVAILABLE e BLOCKED nunca se confundem; só ZERO/AVAILABLE mostram número. */
export type DisplayState = "AVAILABLE" | "ZERO" | "UNKNOWN" | "UNAVAILABLE" | "BLOCKED";
const DISPLAY: Record<IndicatorState, DisplayState> = { available: "AVAILABLE", zero: "ZERO", unknown: "UNKNOWN", unavailable: "UNAVAILABLE" };
export const displayState = (i: IndicatorReading): DisplayState => DISPLAY[i.state];
export const displayValue = (i: IndicatorReading): string => (i.state === "available" || i.state === "zero" ? (i.value ?? 0).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

/** Bloqueios reais da análise da rede: dependem de fonte/parâmetro externo; nunca são calculados nem zerados. */
export const ANALYTICS_BLOCKS: readonly Readonly<{ code: string; label: string; reason: string }>[] = [
  { code: "CONTRACTUAL_BALANCE", label: "Saldo de carga contratual", reason: "Depende da futura planilha oficial do DP externo (DP_FILE_CONTRACT_PENDING)." },
  { code: "MAX_CAPACITY", label: "Lotação máxima / dimensionamento", reason: "PARAMETER_PENDING — parâmetro não homologado." },
  { code: "TERRITORIAL_DATA_PENDING", label: "Mapa territorial", reason: "Sem coordenadas canônicas das unidades; endereço não é geocodificado." },
  { code: "CONTENT_SOURCE_PENDING", label: "Indicadores BNCC/SAEB", reason: "Sem fonte oficial carregada." },
  { code: "EDUCACENSO_LAYOUT", label: "Comparação com o Educacenso", reason: "Layout oficial ainda não fornecido." },
];

/** Comparação de todos os indicadores entre duas leituras, com motivo explícito quando não comparáveis. */
export function compareAll(a: SeriesPoint, b: SeriesPoint) {
  return NETWORK_INDICATORS.map((d) => ({ key: d.key, name: d.name, result: compare(d, a, b) }));
}
export const pointOf = (reading: NetworkReading, yn: YearNature, key = "matriculas-vigentes"): SeriesPoint =>
  ({ reading, yearNature: yn, definitionVersion: NETWORK_INDICATORS.find((d) => d.key === key)?.version ?? 1 });

/** Exportação pelo motor de relatórios, com as mesmas linhas da tela (mesma ACL do reader) e metadados obrigatórios. */
export function analyticsCsv(r: NetworkReading, yn: YearNature, schoolName: (id: string) => string = (x) => x, now = new Date()): string {
  const res = runReport(INDICADORES_REDE, { params: {} }, indicatorRows(r), now);
  const meta = exportMetadata(r, yn).map((m) => `${m["campo"]}: ${m["campo"] === "Recorte" && r.school ? `escola ${schoolName(r.school)}` : m["valor"] ?? "não disponível"}`);
  return toCsv(res, { headerLines: ["SIGEM"], title: INDICADORES_REDE.title }, [...meta, "Rótulo: projeção dinâmica; não é documento oficial."]);
}
