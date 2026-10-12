// Centro de Operações L17 — rotas temporais, itinerários, pontos seguros e simulação isolada (migration 0424).
// Simulação é pura e nunca grava; visão de rota nunca combina estudante com horário/ponto (rotina de menor).

export type Stop = { stopId: string; time: string };
export type RouteVersion = {
  id: string; version: number; shift: string; capacity: number | null; capacitySource: string | null;
  validFrom: string; validUntil: string | null; schools: string[]; itinerary: Stop[]; approved: boolean;
};
export type Safety = "seguro" | "inseguro" | "nao-avaliado";

/** Versão vigente: só aprovada, maior versão com início ≤ data; ausência ⇒ null (nunca a versão em rascunho). */
export function routeVersionOn(versions: RouteVersion[], on: string): RouteVersion | null {
  const c = versions.filter((v) => v.approved && v.validFrom <= on && (!v.validUntil || v.validUntil >= on)).sort((a, b) => b.version - a.version);
  return c[0] ?? null;
}

export function latestSafety(assessments: { stopId: string; result: "seguro" | "inseguro"; assessedOn: string }[], stopId: string): Safety {
  const a = assessments.filter((x) => x.stopId === stopId).sort((x, y) => y.assessedOn.localeCompare(x.assessedOn))[0];
  return a?.result ?? "nao-avaliado";
}

export type SimIssue = "capacidade-desconhecida" | "capacidade-excedida" | "horario-fora-de-ordem" | "ponto-repetido" | "ponto-nao-seguro";

/** Simulação: entrada é um cenário em memória; retorno descreve problemas. `writes` é sempre vazio. */
export function simulateRoute(input: { itinerary: Stop[]; capacity: number | null; boardingsPerStop: Record<string, number>; safety: Record<string, Safety> }) {
  const issues: { issue: SimIssue; stopId?: string }[] = [];
  const seen = new Set<string>();
  let prev = "", load = 0, peak = 0;
  for (const s of input.itinerary) {
    if (seen.has(s.stopId)) issues.push({ issue: "ponto-repetido", stopId: s.stopId });
    seen.add(s.stopId);
    if (prev && s.time <= prev) issues.push({ issue: "horario-fora-de-ordem", stopId: s.stopId });
    prev = s.time;
    if ((input.safety[s.stopId] ?? "nao-avaliado") !== "seguro") issues.push({ issue: "ponto-nao-seguro", stopId: s.stopId });
    load += input.boardingsPerStop[s.stopId] ?? 0;
    peak = Math.max(peak, load);
  }
  if (input.capacity === null) issues.push({ issue: "capacidade-desconhecida" });
  else if (peak > input.capacity) issues.push({ issue: "capacidade-excedida" });
  return { peakLoad: peak, issues, writes: [] as const };
}

/** Visão compartilhável: por ponto só horário e contagem suprimida abaixo do limiar homologado; nunca nomes/IDs. */
export function protectedRouteView(itinerary: Stop[], boardings: Record<string, number>, threshold: number | null) {
  return itinerary.map((s, i) => ({
    order: i + 1, time: s.time,
    students: threshold === null || threshold < 2 ? "bloqueado" as const : (boardings[s.stopId] ?? 0) < threshold ? "suprimido" as const : boardings[s.stopId]!,
  }));
}
