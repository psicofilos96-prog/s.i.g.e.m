/** Marca itens do estoque citados no cardápio previsto. Nunca sugere quantidade: gramatura sem regra homologada não vira número. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function isPlannedItem(item: string, planned: string | null): boolean {
  if (!planned) return false;
  const i = norm(item);
  return i.length >= 3 && norm(planned).includes(i);
}

/** Itens previstos primeiro, preservando a ordem PVPS dentro de cada grupo. */
export function plannedFirst<T extends { item: string }>(lines: T[], planned: string | null): { line: T; index: number; planned: boolean }[] {
  const tagged = lines.map((line, index) => ({ line, index, planned: isPlannedItem(line.item, planned) }));
  return [...tagged.filter((t) => t.planned), ...tagged.filter((t) => !t.planned)];
}

import type { CyclePayload } from "./menu-cycle";
/** Ingredientes dos ciclos homologados da modalidade cujo cronograma toca a competência (AAAA-MM). */
export function menuIngredientsOfMonth(cycles: CyclePayload[], modality: string, competence: string): string[] {
  const set = new Map<string, string>();
  for (const c of cycles) {
    if (c.modalidade !== modality) continue;
    const weeks = new Set(c.cronograma.filter((w) => w.de.slice(0, 7) <= competence && w.ate.slice(0, 7) >= competence).map((w) => w.semana));
    for (const e of c.entradas) if (weeks.has(e.semana)) for (const g of e.ingredientes) if (g.trim()) set.set(norm(g), g.trim());
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Ingredientes do cardápio sem item no pedido (por nome). Só aponta; nunca sugere quantidade. */
export function menuIngredientsMissing(ingredients: string[], orderedItemNames: string[]): string[] {
  return ingredients.filter((g) => !orderedItemNames.some((n) => isPlannedItem(n, g) || isPlannedItem(g, n)));
}
