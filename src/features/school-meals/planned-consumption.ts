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
