/**
 * Rede — L19 Planejamento de acessibilidade e recursos (NEI × infraestrutura × transporte).
 * Entrada da Inclusão é SÓ contagem agregada por escola×tipo de recurso (catálogo homologado), com supressão
 * 1–4 já aplicada pelo NEI (`nei_network_aggregate`); nenhum nome, CID, laudo ou registro individual.
 * Infraestrutura vem da ficha institucional declarada (não informado ≠ ausente) e transporte da frota
 * documentada. Saída = lacunas de planejamento (necessidade sem recurso), nunca decisão de matrícula.
 * Necessidade de apoio NUNCA é critério de vaga, distribuição, oferta ou recusa de matrícula.
 */
export type Count = number | "suprimido" | null;
export interface NeedAggregate { schoolId: string; resourceType: string; count: Count }
export interface Infra { schoolId: string; resources: Readonly<Record<string, boolean | null>> } // null = não informado
export interface TransportSupply { schoolId: string; accessibleVehicles: number | null }

const CLINICAL = /\bcid\b|laudo|diagn|defici|transtorno|tea\b|autis|s[ií]ndrome|nome|student|estudante_id|cpf/i;
export function assertAggregateOnly(rows: readonly Record<string, unknown>[]) {
  for (const r of rows) for (const k of Object.keys(r)) {
    if (!["schoolId", "resourceType", "count"].includes(k)) throw new Error(`Campo não permitido: ${k}`);
  }
  for (const r of rows) if (typeof r["resourceType"] === "string" && CLINICAL.test(r["resourceType"])) throw new Error("Tipo de recurso com termo clínico/identificador recusado.");
  for (const r of rows) { const c = r["count"]; if (typeof c === "number" && c > 0 && c < 5) throw new Error("Contagem 1–4 deve chegar suprimida do NEI."); }
}

export type Gap = { schoolId: string; resourceType: string; status: "lacuna" | "atendido" | "indeterminado"; reason: string };
export function planGaps(needs: readonly NeedAggregate[], infra: readonly Infra[], transport: readonly TransportSupply[], transportResource: string | null): Gap[] {
  assertAggregateOnly(needs as unknown as Record<string, unknown>[]);
  const inf = new Map(infra.map((i) => [i.schoolId, i])); const tr = new Map(transport.map((t) => [t.schoolId, t]));
  return needs.filter((n) => n.count !== 0).map((n) => {
    if (n.count === null) return { schoolId: n.schoolId, resourceType: n.resourceType, status: "indeterminado" as const, reason: "Necessidade não lida." };
    if (transportResource !== null && n.resourceType === transportResource) {
      const v = tr.get(n.schoolId)?.accessibleVehicles ?? null;
      if (v === null) return { schoolId: n.schoolId, resourceType: n.resourceType, status: "indeterminado" as const, reason: "Frota acessível não documentada." };
      return { schoolId: n.schoolId, resourceType: n.resourceType, status: v > 0 ? "atendido" as const : "lacuna" as const, reason: v > 0 ? `${v} veículo(s) acessível(is) documentado(s).` : "Sem veículo acessível documentado." };
    }
    const has = inf.get(n.schoolId)?.resources[n.resourceType];
    if (has === undefined || has === null) return { schoolId: n.schoolId, resourceType: n.resourceType, status: "indeterminado" as const, reason: "Recurso não informado na ficha da escola." };
    return { schoolId: n.schoolId, resourceType: n.resourceType, status: has ? "atendido" as const : "lacuna" as const, reason: has ? "Recurso declarado na ficha." : "Ficha declara ausência do recurso." };
  }).sort((a, b) => `${a.schoolId}|${a.resourceType}`.localeCompare(`${b.schoolId}|${b.resourceType}`));
}

/** Guarda de não discriminação: critério de vaga/distribuição/recusa não pode citar apoio ou condição. */
const SUPPORT = /apoio|inclus|nei|aee|media[cç][aã]o|acessib|defici|laudo|cid|necessidade/i;
export function assertNonDiscriminatoryCriteria(criteria: readonly { factKey: string; label: string; effect: string }[]) {
  const bad = criteria.filter((c) => SUPPORT.test(c.factKey) || SUPPORT.test(c.label));
  if (bad.length) throw new Error(`Critério proibido: necessidade de apoio não pode ordenar, excluir ou recusar matrícula (${bad.map((b) => b.factKey).join(", ")}).`);
}
export function assertRefusalReasonAllowed(reason: string) {
  if (SUPPORT.test(reason)) throw new Error("Recusa de matrícula por necessidade de apoio é vedada; registre lacuna de recurso para providência.");
}
