// Centro de Operações L23 — projeções puras do painel e do mapa operacional restrito.
export type RequestRow = { id: string; sector: string; schoolId: string; createdAt: string };

export function dashboardBySector(rows: RequestRow[], limit: number) {
  const by = (s: string) => rows.filter((r) => r.sector === s);
  return {
    sectors: (["transporte", "infraestrutura", "patrimonio"] as const).map((s) => ({ sector: s, requests: by(s).length, schools: new Set(by(s).map((r) => r.schoolId)).size })),
    truncated: rows.length >= limit,
  };
}

/** Mapa operacional: só por escola com coordenada de fonte declarada; contagem abaixo do limiar suprimida; sem limiar ⇒ bloqueado. */
export function operationalMap(points: { schoolId: string; lat: number | null; lng: number | null; source: string | null; count: number }[], threshold: number | null) {
  if (threshold === null || threshold < 2) return { status: "bloqueado" as const, points: [] };
  return {
    status: "ok" as const,
    points: points.filter((p) => p.lat !== null && p.lng !== null && !!p.source)
      .map((p) => ({ schoolId: p.schoolId, lat: p.lat!, lng: p.lng!, count: p.count < threshold ? ("suprimido" as const) : p.count })),
  };
}
