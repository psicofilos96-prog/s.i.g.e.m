// Tecnologia L11 — inventário de equipamentos (migration 0486). Equipamento = bem permanente (ops_assets) de categoria
// patrimonial marcada como tecnologia (marca append-only aprovada por pessoa ≠ autor). Localização, responsável,
// estado, tombamento e baixa vêm só da cadeia do bem (ops_asset_events); a ficha técnica é versão própria, sem
// campos contábeis. Inventário é projeção; sem marca aprovada, nenhum bem é presumido equipamento.
export interface CategoryMark { seq: number; categoryKey: string; action: "incluir" | "retirar"; personId: string; approvedBy: string | null }
export interface AssetEvent { seq: number; kind: "localizacao" | "responsavel" | "estado" | "tombamento-oficial" | "documento" | "baixa"; schoolId?: string | null; spaceId?: string | null; engagementId?: string | null; condition?: string | null; officialTag?: string | null }
export interface Sheet { version: number; equipmentType: string; manufacturer: string | null; model: string | null; serialNumber: string | null }
export interface AssetRow { id: string; internalCode: string; categoryKey: string; events: AssetEvent[]; sheets: Sheet[] }

/** Categorias de tecnologia: último estado APROVADO por pessoa ≠ autor; marcas pendentes não contam. */
export function techCategories(ms: readonly CategoryMark[]): Set<string> {
  const st = new Map<string, string>();
  for (const m of [...ms].sort((a, b) => a.seq - b.seq)) if (m.approvedBy && m.approvedBy !== m.personId) st.set(m.categoryKey, m.action);
  return new Set([...st].filter(([, a]) => a === "incluir").map(([k]) => k));
}

const lastOf = (es: readonly AssetEvent[], k: AssetEvent["kind"]) => [...es].filter((e) => e.kind === k).sort((a, b) => b.seq - a.seq)[0] ?? null;

export function equipmentInventory(assets: readonly AssetRow[], marks: readonly CategoryMark[]) {
  const cats = techCategories(marks);
  const items = assets.filter((a) => cats.has(a.categoryKey)).map((a) => {
    const loc = lastOf(a.events, "localizacao"), sheet = [...a.sheets].sort((x, y) => y.version - x.version)[0] ?? null;
    return { id: a.id, internalCode: a.internalCode, categoryKey: a.categoryKey,
      schoolId: loc?.schoolId ?? null, spaceId: loc?.spaceId ?? null,
      responsible: lastOf(a.events, "responsavel")?.engagementId ?? null,
      condition: lastOf(a.events, "estado")?.condition ?? null,
      officialTag: lastOf(a.events, "tombamento-oficial")?.officialTag ?? null,
      writtenOff: !!lastOf(a.events, "baixa"), sheet };
  });
  const active = items.filter((i) => !i.writtenOff);
  const serials = new Map<string, string[]>();
  for (const i of active) if (i.sheet?.serialNumber) { const k = i.sheet.serialNumber.trim().toLowerCase(); serials.set(k, [...(serials.get(k) ?? []), i.id]); }
  return {
    status: cats.size ? "ok" as const : "sem-categoria-aprovada" as const,
    items: active, writtenOff: items.length - active.length,
    gaps: {
      withoutSheet: active.filter((i) => !i.sheet).map((i) => i.id),
      withoutLocation: active.filter((i) => !i.schoolId).map((i) => i.id),
      withoutCondition: active.filter((i) => !i.condition).map((i) => i.id),
      duplicateSerials: [...serials.values()].filter((ids) => ids.length > 1),
    },
  };
}
