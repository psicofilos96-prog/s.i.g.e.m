// NAE.3 — modelo puro de programação de entrega, recebimento, não conformidade e documento fiscal.
// Autorização ≠ entrega ≠ conferência ≠ aceite ≠ estoque ≠ pagamento. Nenhum prazo, nota de fornecedor ou sanção é calculado.
import type { ReportDefinition } from "@/features/reports/report-engine";

export type ScheduleAction = "programacao" | "reprogramacao" | "cancelamento";
export type ReceiptStatus = "rascunho" | "confirmado" | "retificado";
export type NonconformityStatus = "aberta" | "comunicada" | "providencia" | "resolvida" | "encerrada";
export type FiscalStatus = "recebido" | "conferido" | "substituido";

export const NONCONFORMITY_FLOW: Record<NonconformityStatus, NonconformityStatus[]> = {
  aberta: ["comunicada", "providencia", "resolvida", "encerrada"],
  comunicada: ["providencia", "resolvida", "encerrada"],
  providencia: ["comunicada", "resolvida", "encerrada"],
  resolvida: ["encerrada", "providencia"],
  encerrada: [],
};
export const NONCONFORMITY_LABEL: Record<NonconformityStatus, string> = {
  aberta: "Aberta", comunicada: "Comunicada ao fornecedor", providencia: "Em providência/retorno", resolvida: "Resolvida", encerrada: "Encerrada",
};
/** Documento recebido/conferido nunca equivale a aceite físico nem a liquidação/pagamento. */
export const FISCAL_LABEL: Record<FiscalStatus, string> = {
  recebido: "Documento recebido (não é aceite nem pagamento)", conferido: "Documento conferido (não é aceite nem pagamento)", substituido: "Substituído",
};
export const NONCONFORMITY_DEADLINE_BLOCK = "NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE";
export const FINANCIAL_WORKFLOW_BLOCK = "FINANCIAL_WORKFLOW — OUTSIDE_SCOPE / INTEGRATION_PENDING";

export interface ReceiptDraft { delivered: number | null; accepted: number | null; rejected: number | null; temperature?: number | null; checklist: Record<string, unknown> }
export interface ChecklistItem { id: string; rotulo: string; obrigatorio?: boolean }

/** Espelha o writer: aceito + rejeitado = entregue; obrigatórios só do checklist homologado (sem checklist nada é exigido). */
export function validateReceipt(d: ReceiptDraft, checklist: ChecklistItem[] | null): string[] {
  const issues: string[] = [];
  if (d.delivered == null || d.accepted == null || d.rejected == null) issues.push("Informe entregue, aceito e rejeitado.");
  else {
    if (d.delivered < 0 || d.accepted < 0 || d.rejected < 0) issues.push("Quantidades não podem ser negativas.");
    if (d.accepted + d.rejected !== d.delivered) issues.push("Aceito + rejeitado deve ser igual ao entregue.");
  }
  for (const q of checklist ?? []) {
    if (!q.obrigatorio) continue;
    if (q.id === "temperatura" ? d.temperature == null : d.checklist[q.id] == null || d.checklist[q.id] === "") issues.push(`Responda: ${q.rotulo}.`);
  }
  return issues;
}

/** Quantidade que entra no estoque: só o aceito de recebimento confirmado/retificado. Rascunho e rejeitado nunca entram. */
export function inventoryEntry(status: ReceiptStatus | null, accepted: number | null): number {
  return status === "confirmado" || status === "retificado" ? Math.max(accepted ?? 0, 0) : 0;
}

export interface DeliveryRow {
  schedule_logical_id: string; action: ScheduleAction; school_id: string; competence: string; item_ref: string; unidade_ref: string; contrato_ref: string | null;
  quantity: number; expected_on: string; receipt_logical_id: string | null; receipt_version: number | null; receipt_status: ReceiptStatus | null;
  received_at: string | null; delivered_qty: number | null; accepted_qty: number | null; rejected_qty: number | null; pending_qty: number; late: boolean;
  open_nonconformities: number; expected_brand: string | null;
}
export type Bucket = "hoje" | "pendentes" | "atrasadas" | "recebidas" | "canceladas";
/** Classificação factual relativa a uma data de referência explícita (nunca o relógio implícito do servidor). */
export function bucketOf(r: DeliveryRow, today: string): Bucket {
  if (r.action === "cancelamento") return "canceladas";
  if (r.receipt_status === "confirmado" || r.receipt_status === "retificado") return "recebidas";
  if (r.expected_on === today) return "hoje";
  return r.expected_on < today ? "atrasadas" : "pendentes";
}

export interface SupplierFacts { contract: string; scheduled: number; onTime: number; late: number; partial: number; rejectedQty: number; pendingQty: number; openNonconformities: number }
/** Fatos por referência contratual; nenhuma nota, ranking ou sanção. */
export function supplierFacts(rows: DeliveryRow[], today: string): SupplierFacts[] {
  const m = new Map<string, SupplierFacts>();
  for (const r of rows) {
    if (r.action === "cancelamento") continue;
    const k = r.contrato_ref ?? "sem referência contratual";
    const f = m.get(k) ?? { contract: k, scheduled: 0, onTime: 0, late: 0, partial: 0, rejectedQty: 0, pendingQty: 0, openNonconformities: 0 };
    f.scheduled++;
    const received = r.receipt_status === "confirmado" || r.receipt_status === "retificado";
    if (received && r.received_at) { if (r.received_at.slice(0, 10) <= r.expected_on) f.onTime++; else f.late++; }
    else if (r.expected_on < today) f.late++;
    if (received && (r.accepted_qty ?? 0) < r.quantity) f.partial++;
    f.rejectedQty += r.rejected_qty ?? 0;
    f.pendingQty += r.pending_qty;
    f.openNonconformities += r.open_nonconformities;
    m.set(k, f);
  }
  return [...m.values()];
}

export function receivingMessage(raw: string): string {
  if (raw.includes("inventory-catalog-pending")) return "Item ou unidade sem correspondência homologada no catálogo do estoque. O aceite não foi registrado.";
  if (raw.includes("checklist-answer-required")) return "Responda os itens obrigatórios da conferência.";
  if (raw.includes("temperature-required")) return "Este item exige temperatura na conferência.";
  if (raw.includes("quantities-inconsistent")) return "Aceito + rejeitado deve ser igual ao entregue.";
  if (raw.includes("receipt-confirmed-use-rectification")) return "Recebimento já confirmado: use Retificar, com motivo.";
  if (raw.includes("schedule-exceeds-authorized")) return "A programação excede a quantidade autorizada.";
  if (raw.includes("order-not-authorized") || raw.includes("line-not-authorized")) return "Só é possível programar item de pedido autorizado.";
  if (raw.includes("received-in-future")) return "A data real do recebimento não pode estar no futuro.";
  if (raw.includes("stale")) return "Este registro foi atualizado por outra pessoa. Recarregue.";
  if (raw.includes("reason-required")) return "Informe o motivo.";
  if (raw.includes("capability:")) return "Sua atuação não tem permissão para esta ação nesta escola.";
  if (raw.includes("natural-person") || raw.includes("af_natural_person")) return "Ato exige pessoa natural vinculada à conta.";
  return "Não foi possível concluir. Tente novamente.";
}

const period = [{ id: "from", label: "De", type: "date" as const, required: true }, { id: "to", label: "Até", type: "date" as const, required: true }];
export const ENTREGAS_ALIMENTACAO: ReportDefinition = {
  id: "entregas-alimentacao", version: 1, title: "Entregas de alimentação: programado × recebido",
  description: "Programado, entregue, aceito, rejeitado, saldo e ocorrências por entrega. Não é atesto nem pagamento.",
  source: "meal_deliveries_at", params: period,
  columns: [
    { id: "school", label: "Escola", kind: "text" }, { id: "expected", label: "Prevista", kind: "date" }, { id: "item", label: "Item", kind: "text" },
    { id: "scheduled", label: "Programado", kind: "number" }, { id: "delivered", label: "Entregue", kind: "number" }, { id: "accepted", label: "Aceito", kind: "number" },
    { id: "rejected", label: "Rejeitado", kind: "number" }, { id: "pending", label: "Saldo a receber", kind: "number" }, { id: "situation", label: "Situação", kind: "text" },
    { id: "nonconformities", label: "Não conformidades abertas", kind: "number" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
export const FORNECEDOR_FATOS_ALIMENTACAO: ReportDefinition = {
  id: "fornecedor-fatos-alimentacao", version: 1, title: "Entregas por referência contratual (fatos)",
  description: "Contagens factuais: no prazo, atrasadas, parciais, rejeitado, saldo e ocorrências. Sem nota, ranking ou sanção.",
  source: "meal_deliveries_at", params: period,
  columns: [
    { id: "contract", label: "Referência contratual", kind: "text" }, { id: "scheduled", label: "Entregas programadas", kind: "number" },
    { id: "onTime", label: "No prazo", kind: "number" }, { id: "late", label: "Atrasadas", kind: "number" }, { id: "partial", label: "Parciais", kind: "number" },
    { id: "rejectedQty", label: "Quantidade rejeitada", kind: "number" }, { id: "pendingQty", label: "Saldo a receber", kind: "number" },
    { id: "openNonconformities", label: "Ocorrências abertas", kind: "number" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
