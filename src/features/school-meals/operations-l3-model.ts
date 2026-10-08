// NAE.8 Lote 3 — modelo puro de estoque operacional, fechamento por competência e Estação Cozinha.
// Nada aqui calcula norma: só classifica fatos lidos dos readers canônicos. Ausência nunca vira zero.

export const MOVEMENT_CLASS_LABEL: Record<string, string> = {
  "entrada-aceite": "Entrada (aceite)", "consumo-observado": "Consumo observado", perda: "Perda", devolucao: "Devolução",
  "transferencia-saida": "Transferência (saída)", "transferencia-entrada": "Transferência (entrada)", "ajuste-inventario": "Ajuste de inventário",
  "entrada-legado": "Entrada (legado)", "saida-legado": "Saída (legado)", "ajuste-legado": "Ajuste legado (sem direção)",
};
/** Classes que a escola registra diretamente; entrada só nasce do aceite, transferência só com política. */
export const MANUAL_CLASSES = ["consumo-observado", "perda", "devolucao"] as const;

export interface LedgerRow {
  id: string; event_kind: string; movement_class: string; sign: number | null; item_value_id: string; unit_value_id: string;
  quantity: number; moved_on: string; lot: string | null; expires_on: string | null; reason: string | null; superseded: boolean;
  source_receipt_version_id: string | null; stock_count_ref: string | null; recorded_at: string;
}
export interface LedgerFilter { item?: string | undefined; klass?: string | undefined; lot?: string | undefined; situation?: "vigente" | "substituido" | "todos" | undefined }

export function filterLedger(rows: LedgerRow[], f: LedgerFilter): LedgerRow[] {
  return rows.filter((r) => (!f.item || r.item_value_id === f.item) && (!f.klass || r.movement_class === f.klass)
    && (!f.lot || (f.lot === "__sem__" ? r.lot === null : r.lot === f.lot))
    && (f.situation === "todos" || (f.situation === "substituido" ? r.superseded : !r.superseded)));
}

/** Ficha do item: cronológica, com saldo corrente. Sinal desconhecido torna o saldo UNKNOWN dali em diante. */
export function itemCard(rows: LedgerRow[], item: string, unit: string): { row: LedgerRow; running: number | null }[] {
  let running: number | null = 0;
  return rows.filter((r) => r.item_value_id === item && r.unit_value_id === unit && !r.superseded)
    .sort((a, b) => (a.moved_on + a.recorded_at < b.moved_on + b.recorded_at ? -1 : 1))
    .map((row) => { running = running === null || row.sign === null ? null : running + row.sign * row.quantity; return { row, running }; });
}

/** Lote/validade como fato: ausente = "não informado", nunca inventado. */
export const lotText = (l: string | null) => l ?? "não informado";
export const expiryText = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "não informada");

export interface CountLine { item_value_id: string; unit_value_id: string; lote: string | null; fisica: number; calculada: number | null; diferenca: number | null; justificativa: string | null }
export type Divergence = "IGUAL" | "DIVERGENTE" | "UNKNOWN";
export const divergence = (l: CountLine): Divergence => (l.calculada === null || l.diferenca === null ? "UNKNOWN" : l.diferenca === 0 ? "IGUAL" : "DIVERGENTE");
/** Direção do ajuste vinculado à contagem: só a diferença declarada; desconhecida ⇒ sem ajuste possível. */
export function adjustmentFor(l: CountLine): { direction: 1 | -1; quantity: number } | null {
  if (l.diferenca === null || l.diferenca === 0) return null;
  return { direction: l.diferenca > 0 ? 1 : -1, quantity: Math.abs(l.diferenca) };
}

export type ChecklistState = "AVAILABLE" | "ZERO" | "PENDING" | "UNKNOWN" | "BLOCKED";
export interface ChecklistRow { area: string; state: string; amount: number | null; code: string | null }
export const CHECKLIST_AREAS = ["pedidos", "recebimentos", "evidencias", "ocorrencias", "movimentos", "inventario", "divergencias", "execucao", "fechamento"] as const;
export const CHECKLIST_LABEL: Record<string, string> = {
  pedidos: "Pedidos da competência", recebimentos: "Recebimentos das entregas programadas", evidencias: "Fotos e documentos dos recebimentos",
  ocorrencias: "Não conformidades em aberto", movimentos: "Movimentos de estoque", inventario: "Contagem física", divergencias: "Divergências sem ajuste",
  execucao: "Execução registrada (dias)", fechamento: "Fechamento de estoque e manifesto",
};
export const CODE_TEXT: Record<string, string> = {
  NO_ORDER_RECORDED: "Nenhum pedido registrado: não é possível afirmar que não havia pedido.",
  NO_DELIVERY_SCHEDULED: "Nenhuma entrega programada para o mês.",
  EVIDENCE_REQUIREMENT_NOT_HOMOLOGATED: "Não há regra homologada exigindo anexo; o número é só informativo.",
  LEGACY_SIGN_UNKNOWN: "Há ajuste legado sem direção: o saldo do mês é desconhecido.",
  NO_MOVEMENT_RECORDED: "Nenhum movimento registrado: ausência não é saldo zero.",
  NO_PHYSICAL_COUNT: "Nenhuma contagem física no mês.",
  SCHOOL_DAYS_CALENDAR_UNRESOLVED: "Dias letivos da escola não resolvidos: não é possível dizer quantos dias faltam.",
  COMPETENCE_NOT_ENDED: "O mês ainda não terminou: o fechamento é recusado.",
  NO_STOCK_CLOSING: "Mês encerrado, ainda sem fechamento de estoque.",
};
/** Classifica a linha; estado desconhecido vindo do banco falha fechado como UNKNOWN. */
export function checklistState(r: ChecklistRow): ChecklistState {
  return (["AVAILABLE", "ZERO", "PENDING", "UNKNOWN", "BLOCKED"] as const).includes(r.state as ChecklistState) ? (r.state as ChecklistState) : "UNKNOWN";
}
/** Completo só quando todas as áreas estão AVAILABLE/ZERO. Nunca conclui por ausência. */
export function checklistComplete(rows: ChecklistRow[]): boolean {
  if (CHECKLIST_AREAS.some((a) => !rows.find((r) => r.area === a))) return false;
  return rows.every((r) => { const s = checklistState(r); return s === "AVAILABLE" || s === "ZERO"; });
}
export const isCompetenceEnded = (competence: string, todayIso: string) => {
  const [y, m] = competence.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10) <= todayIso;
};

export interface KitchenDay {
  executions: { id: string; slot: string; version: number; followed: boolean | null; preparation: string | null; deviation: string | null; meals_total: number | null; count_basis: string | null; students_present: number | null }[];
  deliveries: { schedule: string; item: string; unit: string; quantity: number; receipt_status: string | null }[];
  overdue_receipts: number; stock: { item: string; unit: string; lot: string | null; expires_on: string | null; balance: number | null }[]; operational_records: number;
}
/** Campos permitidos na Cozinha: nada de aluno, pessoa ou e-mail. Usado também como teste de minimização. */
export const KITCHEN_ALLOWED_KEYS = ["executions", "deliveries", "overdue_receipts", "stock", "operational_records"] as const;
export function expiresWithin(d: string | null, todayIso: string, days: number): boolean | null {
  if (!d) return null;
  const diff = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400000;
  return diff <= days;
}
export const LABELS_STATE = "LABEL_TEMPLATE — NOT_CONFIGURED";

export function opsMessage(raw: string): string {
  const m: Record<string, string> = {
    "meal:competence-not-ended": "O mês ainda não terminou: o fechamento só é aceito depois do último dia.",
    "meal:transfer-policy-pending": "Transferência bloqueada: não há política homologada que a permita.",
    "meal:count-final": "Esta contagem já foi aprovada ou anulada.",
    "meal:approver-must-differ": "A aprovação deve ser feita por outra pessoa.",
    "meal:divergence-requires-justification": "Justifique cada diferença entre físico e calculado.",
    "meal:count-not-approved": "O ajuste exige contagem conferida (ou aprovada, se a política exigir).",
    "meal:adjustment-date-must-match-count": "O ajuste deve ter a data da contagem.",
    "meal:reason-required": "Informe o motivo.",
    "meal:stale": "Outra pessoa já atualizou este registro. Recarregue.",
    "meal:inventory-catalog-pending": "Item ou unidade sem catálogo homologado.",
    "meal:unit-incompatible": "Unidade diferente da já usada para este item; sem conversão homologada.",
    "meal:negative-balance-requires-reason": "O saldo ficaria negativo: informe o motivo.",
    "meal:negative-balance-blocked": "A política homologada bloqueia saldo negativo.",
    "meal:movement-date-invalid": "Data inválida ou futura.",
    "session-required": "Entre com sua conta institucional.",
    "natural-person-required": "Somente pessoa natural pode registrar.",
  };
  const k = Object.keys(m).find((x) => raw.includes(x));
  if (k) return m[k]!;
  if (raw.includes("capability:")) return "Sua atuação não tem permissão para esta escola nesta data.";
  return "Não foi possível concluir.";
}
