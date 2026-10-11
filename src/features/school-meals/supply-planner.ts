/**
 * Alimentação Lote 05 — planejador de abastecimento (modelo puro, recomputável).
 * Entradas são leituras já feitas: cardápio APROVADO (Lote 04), fichas homologadas (Lote 03),
 * dias letivos do calendário aplicável, atendidos por jornada (matrícula canônica), perdas técnicas
 * homologadas, estoque do livro único (meal_stock_lines), compromissos e entregas confirmadas.
 * Resultado é SIMULAÇÃO: nunca grava, nunca vira consumo (consumo só por record_meal_execution).
 */
export interface PlanInput {
  schoolId: string; from: string; to: string;
  menuApproved: boolean;
  servings: { date: string; preparationId: string }[];
  recipes: Record<string, { yieldPortions: number; lines: { itemId: string; gross: number }[] } | undefined>;
  schoolDays: string[] | null; // null = calendário não resolvido
  attendees: number | null;
  lossFactor: Record<string, { factor: number; justification: string } | undefined>; // perda técnica homologada por item
  stock: Record<string, { usable: number | null; lots: { qty: number; expiry: string | null }[] }>;
  commitments: Record<string, number>; // já reservados a outros usos
  confirmedDeliveries: { itemId: string; qty: number; on: string }[];
}

export interface Need { itemId: string; gross: number; withLoss: number; available: number | null; net: number | null; basis: string[] }

export function simulate(i: PlanInput): { state: "OK"; needs: Need[]; fingerprint: string; nature: "simulacao" } | { state: "BLOCKED"; reasons: string[] } {
  const r: string[] = [];
  if (!i.menuApproved) r.push("cardápio não aprovado");
  if (i.schoolDays == null) r.push("calendário aplicável não resolvido");
  if (i.attendees == null) r.push("atendidos não apurados");
  const missing = [...new Set(i.servings.map((s) => s.preparationId))].filter((p) => !i.recipes[p]);
  if (missing.length) r.push(`ficha técnica homologada ausente: ${missing.join(", ")}`);
  if (r.length) return { state: "BLOCKED", reasons: r };

  const days = new Set(i.schoolDays!.filter((d) => d >= i.from && d <= i.to));
  const gross = new Map<string, number>();
  for (const s of i.servings) {
    if (!days.has(s.date)) continue; // dia não letivo não gera necessidade
    const rec = i.recipes[s.preparationId]!;
    for (const l of rec.lines) gross.set(l.itemId, (gross.get(l.itemId) ?? 0) + (l.gross * i.attendees!) / rec.yieldPortions);
  }
  const needs = [...gross].sort(([a], [b]) => a.localeCompare(b)).map(([itemId, g]) => {
    const basis: string[] = [];
    const lf = i.lossFactor[itemId];
    const withLoss = lf ? g * lf.factor : g;
    basis.push(lf ? `perda técnica ${lf.factor} (${lf.justification})` : "sem perda técnica homologada (não aplicada)");
    const st = i.stock[itemId];
    const validLots = st ? st.lots.filter((l) => l.expiry == null || l.expiry >= i.to).reduce((a, l) => a + l.qty, 0) : 0;
    const usable = st?.usable == null ? null : Math.min(st.usable, validLots || st.usable);
    if (st?.lots.some((l) => l.expiry != null && l.expiry < i.to)) basis.push("lotes que vencem antes do fim do período excluídos");
    const deliveries = i.confirmedDeliveries.filter((d) => d.itemId === itemId && d.on <= i.to).reduce((a, d) => a + d.qty, 0);
    const available = usable == null ? null : usable - (i.commitments[itemId] ?? 0) + deliveries;
    if (usable == null) basis.push("saldo indeterminado: necessidade líquida não calculada");
    return { itemId, gross: rd(g), withLoss: rd(withLoss), available: available == null ? null : rd(available), net: available == null ? null : rd(Math.max(0, withLoss - available)), basis };
  });
  return { state: "OK", needs, fingerprint: fingerprint(i), nature: "simulacao" };
}

/** Risco futuro: regra visível (cobertura em dias < horizonte declarado). Sem horizonte, sem alerta. */
export function shortageRisk(need: Need, dailyUse: number | null, horizonDays: number | null) {
  if (horizonDays == null) return { state: "nao-configurado" as const, rule: "horizonte de alerta não declarado" };
  if (need.available == null || dailyUse == null || dailyUse <= 0) return { state: "indeterminado" as const, rule: "saldo ou uso diário desconhecido" };
  const cover = need.available / dailyUse;
  return { state: cover < horizonDays ? ("risco" as const) : ("sem-risco-no-horizonte" as const), coverDays: rd(cover), rule: `cobertura ${rd(cover)} dias < horizonte ${horizonDays} dias ⇒ risco (estimativa, não previsão garantida)` };
}

/** Impressão estável das entradas: mesma entrada ⇒ mesma simulação (auditável/recomputável). */
export function fingerprint(i: PlanInput): string {
  const s = JSON.stringify(i, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

const rd = (n: number) => Math.round(n * 1000) / 1000;
