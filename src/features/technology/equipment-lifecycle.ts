// L12 Tecnologia — histórico de manutenção e ciclo de vida técnico (sem migration).
// Fontes canônicas apenas: cadeia do bem (ops_asset_events), ficha técnica (L11),
// vínculo bem→ordem L05 (ops_asset_maintenance_links), ordens de serviço L06,
// chamados com vínculo ao bem (ops_request_events) e sessões L08. Nada é gravado.
import type { AssetEvent, Sheet } from "./equipment-inventory";

export type LifeStage = "sem-cadeia" | "incorporado" | "em-uso" | "em-manutencao" | "baixado";
export interface MaintenanceOrder { id: string; openedAt: string; closedAt: string | null; state: string; preventive: boolean }
export interface ServiceOrder { id: string; maintenanceOrderId: string; state: string; confirmedAt: string | null }
export interface LinkedTicket { requestId: string; at: string; nature: "incidente" | "requisicao" | null; closedAt: string | null }
export interface HistoryEntry { at: string; source: "bem" | "ficha" | "manutencao" | "servico" | "chamado"; ref: string; label: string }

export const LIFECYCLE_SOURCES = ["ops_asset_events", "tech_equipment_sheets", "ops_asset_maintenance_links", "ops_maintenance_orders", "ops_service_orders", "ops_request_events"] as const;

const OPEN_ORDER = (o: MaintenanceOrder) => o.closedAt === null && o.state !== "cancelada" && o.state !== "concluida";

export function lifeStage(events: readonly (AssetEvent & { at?: string })[], orders: readonly MaintenanceOrder[]): LifeStage {
  if (events.length === 0) return "sem-cadeia";
  if (events.some((e) => e.kind === "baixa")) return "baixado";
  if (orders.some(OPEN_ORDER)) return "em-manutencao";
  return events.some((e) => e.kind === "localizacao" && e.spaceId) ? "em-uso" : "incorporado";
}

export function maintenanceHistory(input: {
  events: readonly (AssetEvent & { at: string })[]; sheets: readonly (Sheet & { at: string })[];
  orders: readonly MaintenanceOrder[]; services: readonly ServiceOrder[]; tickets: readonly LinkedTicket[];
}): HistoryEntry[] {
  const out: HistoryEntry[] = [
    ...input.events.map((e) => ({ at: e.at, source: "bem" as const, ref: `evento-${e.seq}`, label: e.kind })),
    ...input.sheets.map((s) => ({ at: s.at, source: "ficha" as const, ref: `v${s.version}`, label: "ficha técnica" })),
    ...input.orders.map((o) => ({ at: o.openedAt, source: "manutencao" as const, ref: o.id, label: o.preventive ? "preventiva" : "corretiva" })),
    // Serviço só conta como executado após confirmação L06; antes é "declarado/aberto".
    ...input.services.map((s) => ({ at: s.confirmedAt ?? "", source: "servico" as const, ref: s.id, label: s.confirmedAt ? "executado (confirmado)" : `não confirmado (${s.state})` })),
    ...input.tickets.map((t) => ({ at: t.at, source: "chamado" as const, ref: t.requestId, label: t.nature ?? "natureza não informada" })),
  ];
  return out.sort((a, b) => (a.at === "" ? 1 : b.at === "" ? -1 : a.at.localeCompare(b.at)));
}

/** Indicadores só de fatos: sem regra de vida útil configurada não há "fim de vida". */
export function lifecycleSummary(input: { orders: readonly MaintenanceOrder[]; services: readonly ServiceOrder[]; tickets: readonly LinkedTicket[]; usefulLifeRule: null | { approved: boolean } }) {
  const confirmed = input.services.filter((s) => s.confirmedAt);
  return {
    correctiveOrders: input.orders.filter((o) => !o.preventive).length,
    preventiveOrders: input.orders.filter((o) => o.preventive).length,
    confirmedServices: confirmed.length,
    unconfirmedServices: input.services.length - confirmed.length,
    incidents: input.tickets.filter((t) => t.nature === "incidente").length,
    lastConfirmedService: confirmed.map((s) => s.confirmedAt!).sort().at(-1) ?? null,
    endOfLife: input.usefulLifeRule?.approved ? "avaliável" : "indeterminado: sem regra de vida útil aprovada",
  };
}
