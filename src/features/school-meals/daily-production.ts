/**
 * Alimentação Lote 09 — produção diária e consumo (modelo puro).
 * Complementa execution-model.ts (NAE.5): gravação continua SÓ por record_meal_execution e a baixa
 * definitiva pelo writer NAE.4 uma vez por linha (meal_execution_consumptions, chave única).
 * Aqui: previsto × efetivo, porções produzidas/servidas, sobras/restos, sugestão de baixa pelas
 * fichas com confirmação explícita, prevenção de baixa duplicada e retificação auditável.
 * Refeição servida só vem de contagem registrada pela cozinha — nunca de matrícula ou remessa.
 */
export interface DayRecord {
  schoolId: string; date: string; meal: string;
  plannedPreparationId: string | null; actualPreparationId: string | null; deviationNote: string | null;
  produced: number | null; served: number | null;
  leftoverKg: number | null; wasteKg: number | null; // resto só se medido
  occurrences: string[]; responsibleId: string; responsibleIsPerson: boolean;
}

export function recordProblems(r: DayRecord): string[] {
  const p: string[] = [];
  if (!r.responsibleIsPerson) p.push("registro exige pessoa natural responsável");
  if (r.actualPreparationId && r.plannedPreparationId && r.actualPreparationId !== r.plannedPreparationId && !r.deviationNote?.trim()) p.push("desvio do cardápio exige descrição");
  if (r.produced != null && r.produced < 0) p.push("porções produzidas inválidas");
  if (r.served != null && r.served < 0) p.push("porções servidas inválidas");
  if (r.produced != null && r.served != null && r.served > r.produced) p.push("servidas maior que produzidas");
  for (const k of ["leftoverKg", "wasteKg"] as const) if (r[k] != null && r[k]! < 0) p.push(`${k} inválido`);
  return p;
}

/** Fatos do dia: ausência permanece ausência; nenhum número vem de matrícula/remessa. */
export function dayFacts(r: DayRecord | null) {
  if (!r) return { followed: "sem-registro" as const, produced: null, served: null, notServed: null, leftoverKg: null, wasteKg: null };
  return {
    followed: !r.actualPreparationId ? ("nao-informado" as const) : r.actualPreparationId === r.plannedPreparationId ? ("seguido" as const) : ("desvio" as const),
    produced: r.produced, served: r.served,
    notServed: r.produced != null && r.served != null ? r.produced - r.served : null,
    leftoverKg: r.leftoverKg, wasteKg: r.wasteKg,
  };
}

/** Sugestão de baixa: ficha homologada × porções PRODUZIDAS registradas. É sugestão, não movimento. */
export function suggestDebit(r: DayRecord, recipe: { yieldPortions: number; lines: { itemId: string; gross: number; unit: string }[] } | null) {
  if (!recipe) return { state: "BLOCKED" as const, reason: "ficha técnica homologada ausente" };
  if (r.produced == null) return { state: "BLOCKED" as const, reason: "porções produzidas não registradas" };
  return { state: "SUGGESTED" as const, lines: recipe.lines.map((l) => ({ itemId: l.itemId, unit: l.unit, qty: Math.round(((l.gross * r.produced!) / recipe.yieldPortions) * 1000) / 1000 })) };
}

export const debitKey = (r: Pick<DayRecord, "schoolId" | "date" | "meal">, itemId: string) => `baixa:${r.schoolId}:${r.date}:${r.meal}:${itemId}`;

/** Confirmação explícita: pessoa natural, linhas revisadas e nenhuma chave já baixada. */
export function confirmDebit(lines: { itemId: string; qty: number; unit: string }[], r: DayRecord, a: { confirmedBy: string; isPerson: boolean; explicit: boolean }, alreadyDebited: Set<string>) {
  if (!a.isPerson) return { error: "baixa definitiva exige confirmação por pessoa natural" };
  if (!a.explicit) return { error: "confirmação explícita obrigatória" };
  const dup = lines.filter((l) => alreadyDebited.has(debitKey(r, l.itemId)));
  if (dup.length) return { error: `baixa já realizada: ${dup.map((d) => d.itemId).join(", ")}` };
  if (lines.some((l) => !(l.qty > 0))) return { error: "quantidade de baixa inválida" };
  return { moves: lines.map((l) => ({ ...l, key: debitKey(r, l.itemId), confirmedBy: a.confirmedBy })) };
}

/** Retificação: nova versão com motivo e autor; anterior preservada. Baixa já feita só se corrige por estorno (stock-lots.rectify). */
export interface Version { v: number; record: DayRecord; reason: string | null; authorId: string }
export function rectifyRecord(history: Version[], expectedV: number, next: DayRecord, reason: string, authorId: string): Version[] | { error: string } {
  const head = history[history.length - 1];
  if (!head || head.v !== expectedV) return { error: "versão base desatualizada (concorrência)" };
  if (!reason.trim()) return { error: "retificação exige motivo" };
  const p = recordProblems(next);
  if (p.length) return { error: p.join("; ") };
  return [...history, { v: head.v + 1, record: next, reason, authorId }];
}
