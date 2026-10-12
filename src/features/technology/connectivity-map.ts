// L14 Tecnologia — mapa de conectividade AGREGADO (sem migration). Situação por escola vem só do painel L13
// (medições verificadas); agrupamento só pelas redes do cadastro (classifySchool/matchesNetwork); camada
// geográfica só com coordenadas válidas de fonte real — sem fonte, recusada com motivo. Nada é gravado.
import { classifySchool, matchesNetwork, NETWORK_FILTERS, type NetworkFilter } from "@/features/statistical-map/declared-inconsistencies";
import { connectivityPanel, type Link, type Measurement, type Verification } from "./connectivity";

export type SchoolConnState = "sem-link" | "sem-medicao-verificada" | "medida";
export interface SchoolRow { id: string; location_kind?: string | null; administrative_dependency?: string | null; lat?: number | null; lng?: number | null }

export function schoolStates(schools: readonly SchoolRow[], links: readonly Link[], ms: readonly Measurement[], vs: readonly Verification[]) {
  const panels = connectivityPanel(links, ms, vs);
  return schools.map((s) => {
    const own = panels.filter((p) => p.schoolId === s.id);
    const measured = own.filter((p) => p.verifiedCount > 0);
    const state: SchoolConnState = own.length === 0 ? "sem-link" : measured.length === 0 ? "sem-medicao-verificada" : "medida";
    const downs = measured.flatMap((p) => (p.medianDownMbps == null ? [] : [p.medianDownMbps]));
    return { schoolId: s.id, state, links: own.length, bestDownMbps: downs.length ? Math.max(...downs) : null, classification: classifySchool(s) };
  });
}

/** Agrega por rede; escola não classificada fica em grupo próprio (nunca presumida). Mediana só das medidas. */
export function aggregateByNetwork(rows: ReturnType<typeof schoolStates>, minGroup: number | null) {
  const group = (sel: typeof rows, key: string) => {
    const downs = sel.flatMap((r) => (r.bestDownMbps == null ? [] : [r.bestDownMbps])).sort((a, b) => a - b);
    const h = downs.length >> 1;
    const suppressed = minGroup == null ? false : sel.length < minGroup;
    return {
      key, schools: sel.length, suppressed,
      semLink: suppressed ? null : sel.filter((r) => r.state === "sem-link").length,
      semMedicao: suppressed ? null : sel.filter((r) => r.state === "sem-medicao-verificada").length,
      medidas: suppressed ? null : sel.filter((r) => r.state === "medida").length,
      medianDownMbps: suppressed || !downs.length ? null : downs.length % 2 ? downs[h]! : (downs[h - 1]! + downs[h]!) / 2,
    };
  };
  const out = NETWORK_FILTERS.map((f: NetworkFilter) => group(rows.filter((r) => matchesNetwork(r.classification, f)), f));
  out.push(group(rows.filter((r) => r.classification.localizacao === null || r.classification.conveniada === null), "nao-classificada"));
  return out;
}

/** Camada de pontos: só coordenadas válidas; sem nenhuma, a camada é recusada (coordenada nunca é inventada). */
export function geoLayer(schools: readonly SchoolRow[], rows: ReturnType<typeof schoolStates>) {
  const ok = schools.filter((s) => typeof s.lat === "number" && typeof s.lng === "number" && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180);
  if (!ok.length) return { available: false as const, reason: "Nenhuma fonte canônica traz coordenadas das escolas; o mapa mostra só a agregação por rede." };
  const st = new Map(rows.map((r) => [r.schoolId, r.state]));
  return { available: true as const, excluded: schools.length - ok.length, points: ok.map((s) => ({ schoolId: s.id, lat: s.lat!, lng: s.lng!, state: st.get(s.id) ?? "sem-link" })) };
}
