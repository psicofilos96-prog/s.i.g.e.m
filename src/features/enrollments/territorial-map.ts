/**
 * Rede/Matrículas/Vagas L16 — Mapa territorial (modelo puro; sem provedor de mapa).
 * Pontos = SÓ escolas, com coordenada de fonte institucional (cadastro); sem coordenada ⇒ fora do mapa e
 * listada como lacuna, nunca geocodificada por nome. Indicadores vêm das linhas L15 (projeção, não gravada).
 * Demanda é só agregada por escola/território, com supressão de célula pequena por limiar declarado
 * (sem limiar ⇒ demanda não exibida). Nenhum dado de estudante (endereço, coordenada, nome) entra no modelo.
 */
export interface SchoolPlace {
  schoolId: string; name: string; districtCode: string | null; // IBGE DTB
  location: { lat: number; lng: number; source: string } | null;
  modalities: readonly string[]; stages: readonly string[];
}
export interface SchoolIndicators { schoolId: string; authorized: number | null; occupants: number | null; available: number | null; waiting: number | null }
export interface MapFilters { districtCodes?: readonly string[]; modalities?: readonly string[]; stages?: readonly string[] }
export interface PrivacyPolicy { minCellSize: number | null }

const FORBIDDEN = /endere|address|logradouro|cep|lat|lng|coord|nome_estud|student/i;
/** Recusa qualquer entrada de demanda que carregue campo individual. */
export function assertAggregateDemand(rows: readonly Record<string, unknown>[]) {
  for (const r of rows) for (const k of Object.keys(r)) if (!["schoolId", "districtCode", "count"].includes(k) || FORBIDDEN.test(k) && k !== "count")
    throw new Error(`Campo não permitido na demanda agregada: ${k}`);
}

const validCoord = (l: SchoolPlace["location"]) => !!l && Number.isFinite(l.lat) && Number.isFinite(l.lng) && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180 && !(l.lat === 0 && l.lng === 0) && !!l.source;
const suppress = (n: number | null, p: PrivacyPolicy) => n === null || p.minCellSize === null ? null : n > 0 && n < p.minCellSize ? "suprimido" as const : n;

export function buildTerritorialMap(places: readonly SchoolPlace[], indicators: readonly SchoolIndicators[], demand: readonly { schoolId: string; districtCode: string; count: number }[] | null, f: MapFilters, p: PrivacyPolicy) {
  if (demand) assertAggregateDemand(demand as unknown as Record<string, unknown>[]);
  const ind = new Map(indicators.map((i) => [i.schoolId, i]));
  const keep = places.filter((s) =>
    (!f.districtCodes?.length || (s.districtCode !== null && f.districtCodes.includes(s.districtCode))) &&
    (!f.modalities?.length || s.modalities.some((m) => f.modalities!.includes(m))) &&
    (!f.stages?.length || s.stages.some((m) => f.stages!.includes(m))));
  const points = keep.filter((s) => validCoord(s.location)).map((s) => {
    const i = ind.get(s.schoolId);
    return { schoolId: s.schoolId, name: s.name, lat: s.location!.lat, lng: s.location!.lng, locationSource: s.location!.source, modalities: s.modalities, stages: s.stages,
      authorized: i?.authorized ?? null, occupants: i?.occupants ?? null, available: i?.available ?? null, waiting: suppress(i?.waiting ?? null, p) };
  });
  const withoutLocation = keep.filter((s) => !validCoord(s.location)).map((s) => s.schoolId);
  const byDistrict = new Map<string, number>();
  for (const d of demand ?? []) if (keep.some((s) => s.schoolId === d.schoolId)) byDistrict.set(d.districtCode, (byDistrict.get(d.districtCode) ?? 0) + d.count);
  const districtDemand = demand === null ? null : [...byDistrict].sort(([a], [b]) => a.localeCompare(b)).map(([districtCode, n]) => ({ districtCode, demand: suppress(n, p) }));
  return { points, withoutLocation, districtDemand, demandHiddenReason: p.minCellSize === null ? "Limiar de supressão não declarado." : null, nature: "projecao-agregada" as const };
}
