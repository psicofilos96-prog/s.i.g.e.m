// L18 — Mapa territorial agregado. Unidade espacial = escola (coordenada do
// cadastro da ESCOLA) ou região (distrito do catálogo IBGE). Nunca há ponto
// por residência nem por estudante; contagens pequenas são suprimidas pelo
// limiar configurado e homologado (sem limiar ⇒ mapa bloqueado).

export const MAP_LAYERS = ["alertas", "casos", "barreiras", "transporte", "demanda"] as const;
export type Layer = (typeof MAP_LAYERS)[number];

export interface Fact { layer: Layer; schoolId: string; studentRef: string } // studentRef só para contar pessoas distintas
export interface SchoolPlace { schoolId: string; regionCode: string | null; lat: number | null; lng: number | null; coordSource: string | null }
export interface MapPolicy { minCellSize: number; decisionRef: string } // ex.: limiar homologado (nunca default no código)

export type Cell = { unit: string; layer: Layer; value: number | "suprimido" };
export interface MapResult { status: "ok" | "bloqueado"; reason: string | null; cells: Cell[]; points: { schoolId: string; lat: number; lng: number }[]; unplaced: number }

const FORBIDDEN_KEYS = /(lat|lng|endereco|address|cep|residen|domicil|geo)/i;

/** Recusa qualquer fato que traga localização do estudante/família. */
export function rejectsResidence(rows: readonly Record<string, unknown>[]): boolean {
  return rows.some((r) => Object.keys(r).some((k) => k !== "schoolId" && FORBIDDEN_KEYS.test(k)));
}

export function buildMap(facts: readonly Fact[], places: readonly SchoolPlace[], by: "escola" | "regiao", policy: MapPolicy | null): MapResult {
  if (!policy || !policy.decisionRef || !(policy.minCellSize >= 2)) return { status: "bloqueado", reason: "sem-limiar-homologado", cells: [], points: [], unplaced: 0 };
  if (rejectsResidence(facts as unknown as Record<string, unknown>[])) return { status: "bloqueado", reason: "fato-com-localizacao-pessoal", cells: [], points: [], unplaced: 0 };
  const place = new Map(places.map((p) => [p.schoolId, p]));
  const unitOf = (s: string) => (by === "escola" ? s : place.get(s)?.regionCode ?? null);
  const sets = new Map<string, Set<string>>();
  let unplaced = 0;
  for (const f of facts) {
    const u = unitOf(f.schoolId);
    if (!u) { unplaced++; continue; }
    const k = `${u}|${f.layer}`;
    (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(f.studentRef);
  }
  const raw = [...sets.entries()].map(([k, s]) => { const parts = k.split("|"); const unit = parts[0] ?? ""; const layer = parts[1]; return { unit, layer: layer as Layer, n: s.size }; });
  const cells: Cell[] = raw.map((c) => ({ unit: c.unit, layer: c.layer, value: c.n < policy.minCellSize ? "suprimido" : c.n }));
  // Supressão complementar: numa camada, uma única célula suprimida poderia ser deduzida
  // de um total publicado; suprime-se a menor célula visível restante.
  for (const layer of MAP_LAYERS) {
    const inLayer = cells.filter((c) => c.layer === layer);
    if (inLayer.filter((c) => c.value === "suprimido").length === 1) {
      const vis = inLayer.filter((c) => c.value !== "suprimido").sort((a, b) => (a.value as number) - (b.value as number));
      if (vis[0]) vis[0].value = "suprimido";
    }
  }
  const points = by === "escola"
    ? places.filter((p) => p.lat !== null && p.lng !== null && p.coordSource && cells.some((c) => c.unit === p.schoolId))
        .map((p) => ({ schoolId: p.schoolId, lat: p.lat!, lng: p.lng! }))
    : [];
  return { status: "ok", reason: null, cells, points, unplaced };
}

/** Sem total da camada: totais somados das visíveis reabririam o suprimido. */
export const LAYER_TOTALS_PUBLISHED = false;
