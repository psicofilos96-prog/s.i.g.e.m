// AI — modelo puro da operação de alimentação (publicação, rede, estoque). Sem regra nutricional.
export type PublicationEvent = { menu_logical_id: string; menu_version_id: string; sequence: number; action: "publicacao" | "retirada"; current_version: boolean };
export type PublicationState =
  | { kind: "nao-publicado"; nextSequence: number }
  | { kind: "publicado"; nextSequence: number }
  | { kind: "versao-desatualizada"; nextSequence: number }
  | { kind: "retirado"; nextSequence: number };

/** Estado de publicação de um cardápio lógico: só a última ação vale e só se ela aponta para a versão vigente. */
export function publicationState(events: PublicationEvent[], logicalId: string, currentVersionId: string): PublicationState {
  const mine = events.filter((e) => e.menu_logical_id === logicalId).sort((a, b) => a.sequence - b.sequence);
  const last = mine[mine.length - 1];
  const nextSequence = last?.sequence ?? 0;
  if (!last) return { kind: "nao-publicado", nextSequence };
  if (last.action === "retirada") return { kind: "retirado", nextSequence };
  return last.menu_version_id === currentVersionId ? { kind: "publicado", nextSequence } : { kind: "versao-desatualizada", nextSequence };
}

export const PUBLICATION_LABEL: Record<PublicationState["kind"], string> = {
  "nao-publicado": "Não publicado para famílias",
  publicado: "Publicado para famílias",
  "versao-desatualizada": "Cardápio corrigido depois da publicação — famílias não veem até nova publicação",
  retirado: "Publicação retirada",
};

export type NetworkRow = {
  school_id: string; forecast_total: number | null; forecast_days: number | null; served_total: number | null;
  served_days: number | null; served_unknown_records: number | null; menu_days: number | null; published_menus: number | null;
};

/** Grandeza ausente nunca vira zero: null ⇒ "não informado". */
export const quantity = (v: number | null | undefined) => (v === null || v === undefined ? "não informado" : String(v));

export const INVENTORY_CATALOG_PENDING =
  "Estoque: os catálogos de itens e de unidades de medida ainda não têm valores aprovados. Nenhum item ou unidade é presumido.";

export function inventoryReady(items: unknown[], units: unknown[]) {
  return items.length > 0 && units.length > 0;
}
