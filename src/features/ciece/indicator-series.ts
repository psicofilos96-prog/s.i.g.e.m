/**
 * CIECE Lote 15 — Indicadores, séries e painéis (núcleo puro, nunca grava valor).
 * Reaproveita: indicadores = `NETWORK_INDICATORS` via `indicatorCatalog` (L05, motor 14.2);
 * comparação de anos = `network-analytics.compare`. Aqui: biblioteca metodológica por tema
 * (com indicadores externos só com proveniência), séries por periodicidade VERSIONADAS sobre
 * períodos declarados (nunca calendário inventado), comparabilidade escola×período com notas e
 * painéis temáticos com drill-down e controle de acesso por capacidade.
 */
import { indicatorCatalog } from "./data-dictionary";

export type Theme = "matricula" | "fluxo" | "frequencia" | "oferta" | "cobertura-docente" | "qualidade-de-dados" | "externo";
export type MethodEntry = { key: string; version: number; theme: Theme; title: string; formula: string; source: string; provenance: { kind: "sigem" | "externo"; publisher?: string; doc?: string; sha256?: string; referenceYear?: string } ; limitations: string[] };

/** Externo só entra com publicador, documento e hash; senão é recusado (nunca número sem origem). */
export function methodLibrary(themeOf: (key: string) => Theme | null, external: MethodEntry[]) {
  const internal: MethodEntry[] = indicatorCatalog().flatMap((c) => {
    const t = themeOf(c.code); if (!t) return [];
    return [{ key: c.code, version: c.version, theme: t, title: c.name, formula: String((c as { formula?: unknown }).formula ?? c.definition), source: c.source.join(","), provenance: { kind: "sigem" as const }, limitations: c.limitations }];
  });
  const refused: { key: string; reason: string }[] = [];
  const ext = external.filter((e) => {
    const p = e.provenance;
    if (e.theme !== "externo" || p.kind !== "externo") { refused.push({ key: e.key, reason: "externo-mal-classificado" }); return false; }
    if (!p.publisher || !p.doc || !p.sha256 || !p.referenceYear) { refused.push({ key: e.key, reason: "externo-sem-proveniencia" }); return false; }
    return true;
  });
  return { entries: [...internal, ...ext], refused };
}

export type Periodicity = "mensal" | "bimestral" | "semestral" | "anual";
export type Period = { id: string; periodicity: Periodicity; from: string; to: string; source: string };
export type Observation = { indicator: string; version: number; schoolId: string | null; periodId: string; value: number | null; state: "disponivel" | "zero-observado" | "desconhecido" | "bloqueado"; knownAt: string; refs: string[] };
export type Series = { indicator: string; version: number; periodicity: Periodicity; schoolId: string | null; points: { period: Period; obs: Observation | null }[]; notes: string[] };

/** Períodos só declarados (calendário/regra); sem período declarado não existe série. */
export function buildSeries(indicator: string, version: number, periodicity: Periodicity, schoolId: string | null, periods: Period[], obs: Observation[]): Series {
  const ps = periods.filter((p) => p.periodicity === periodicity).sort((a, b) => a.from.localeCompare(b.from));
  const notes: string[] = [];
  if (!ps.length) notes.push(`sem-periodos-${periodicity}-declarados`);
  for (let i = 1; i < ps.length; i++) if (ps[i]!.from <= ps[i - 1]!.to) notes.push(`periodos-sobrepostos:${ps[i - 1]!.id}/${ps[i]!.id}`);
  const versions = new Set(obs.filter((o) => o.indicator === indicator).map((o) => o.version));
  if (versions.size > 1) notes.push("versoes-misturadas-descartadas");
  const points = ps.map((p) => ({ period: p, obs: obs.find((o) => o.indicator === indicator && o.version === version && o.schoolId === schoolId && o.periodId === p.id) ?? null }));
  if (points.some((x) => !x.obs)) notes.push("pontos-sem-observacao-nao-sao-zero");
  return { indicator, version, periodicity, schoolId, points, notes };
}

/** Comparação só entre pontos equivalentes: mesmo indicador@versão, periodicidade, duração e estado disponível. */
export function comparePoints(a: Series, ia: number, b: Series, ib: number): { comparable: boolean; delta: number | null; notes: string[] } {
  const pa = a.points[ia], pb = b.points[ib]; const n: string[] = [];
  if (!pa || !pb) return { comparable: false, delta: null, notes: ["ponto-inexistente"] };
  if (a.indicator !== b.indicator || a.version !== b.version) n.push("indicador-ou-versao-diferente");
  if (a.periodicity !== b.periodicity) n.push("periodicidade-diferente");
  const dur = (p: Period) => (Date.parse(p.to) - Date.parse(p.from)) / 864e5;
  if (Math.abs(dur(pa.period) - dur(pb.period)) > 3) n.push("duracao-de-periodo-diferente");
  for (const [o, s] of [[pa.obs, "a"], [pb.obs, "b"]] as const) if (!o || o.value === null || !["disponivel", "zero-observado"].includes(o.state)) n.push(`ponto-${s}-indisponivel`);
  if (pa.obs && pb.obs && pa.obs.knownAt !== pb.obs.knownAt) n.push("knownAt-diferentes(limitacao)");
  const blocking = n.filter((x) => !x.includes("limitacao"));
  return { comparable: blocking.length === 0, delta: blocking.length ? null : pb.obs!.value! - pa.obs!.value!, notes: n };
}

export type DashboardTheme = "matriculas" | "oferta" | "pessoal" | "censo" | "regularidade" | "evolucao";
export type Panel = { id: string; theme: DashboardTheme; indicators: string[]; capability: string; scope: "escola" | "rede"; drillTo: string | null };
export type Viewer = { capabilities: ReadonlySet<string>; schoolScope: ReadonlySet<string> | "rede" };

/** Painel visível só com capacidade; escopo de escola restringe observações; drill-down só a tela autorizada. */
export function visiblePanels(panels: Panel[], v: Viewer, pathAllowed: (p: string) => boolean) {
  return panels.filter((p) => v.capabilities.has(p.capability) && (p.scope === "escola" || v.schoolScope === "rede"))
    .map((p) => ({ ...p, drillTo: p.drillTo && pathAllowed(p.drillTo) ? p.drillTo : null }));
}
export function scopeObservations(obs: Observation[], v: Viewer): Observation[] {
  if (v.schoolScope === "rede") return obs;
  const s = v.schoolScope; return obs.filter((o) => o.schoolId !== null && s.has(o.schoolId));
}
/** Drill-down: abre só as referências da observação; nunca recalcula. */
export const drill = (o: Observation) => ({ indicator: `${o.indicator}@${o.version}`, refs: o.refs, knownAt: o.knownAt });
