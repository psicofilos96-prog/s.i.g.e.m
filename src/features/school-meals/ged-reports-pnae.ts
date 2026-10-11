/**
 * Alimentação Lote 13 — GED, relatórios, PNAE e CAE.
 * GED: reusa ged-core (numeração/tramitação/retenção) e evidências no bucket privado da alimentação;
 * aqui só a classificação documental da alimentação. Relatórios: ReportDefinition no report-engine
 * (PDF/XLSX, colunas sensíveis fora por padrão). PNAE: demonstrativo de APOIO, nunca transmissão.
 * CAE: perfil de leitura agregada e limitada; atos do conselho são do próprio conselho.
 */
import type { ReportDefinition } from "@/features/reports/report-engine";

export const MEAL_DOC_CLASSES = ["cardapio", "ficha-tecnica", "recebimento", "relatorio", "visita", "evidencia", "contrato", "documento-tecnico"] as const;
export type MealDocClass = (typeof MEAL_DOC_CLASSES)[number];
export interface DocVersion { docId: string; cls: MealDocClass; v: number; sha256: string; path: string; authorId: string; reason: string | null; schoolId: string | null }

export function addDocVersion(chain: DocVersion[], next: Omit<DocVersion, "v">, expectedV: number): DocVersion[] | { error: string } {
  const head = chain.at(-1);
  if ((head?.v ?? 0) !== expectedV) return { error: "versão base desatualizada" };
  if (head && (head.cls !== next.cls || head.schoolId !== next.schoolId)) return { error: "classe e escola do documento são imutáveis" };
  if (head && !next.reason?.trim()) return { error: "nova versão exige motivo" };
  if (!/^[0-9a-f]{64}$/.test(next.sha256)) return { error: "SHA-256 inválido" };
  if (!next.path.startsWith("alimentacao-evidencias/")) return { error: "arquivo fora do armazenamento privado da alimentação" };
  return [...chain, { ...next, v: expectedV + 1 }];
}

/** Retenção: sem regra aprovada para a classe, sempre retém. */
export function retention(cls: MealDocClass, rules: Record<string, { years: number; approved: boolean } | undefined>, createdOn: string, today: string) {
  const r = rules[cls];
  if (!r?.approved) return { action: "reter" as const, reason: "sem regra de retenção aprovada" };
  const until = `${Number(createdOn.slice(0, 4)) + r.years}${createdOn.slice(4)}`;
  return until <= today ? { action: "elegivel-para-descarte-com-decisao-humana" as const, until } : { action: "reter" as const, until };
}

// ---------- Relatórios ----------
const P = [{ id: "from", label: "De", type: "date" as const, required: true }, { id: "to", label: "Até", type: "date" as const, required: true }];
const def = (id: string, title: string, source: string, columns: ReportDefinition["columns"], dependency: string | null = null): ReportDefinition =>
  ({ id: `alimentacao-${id}`, version: 1, title, description: `${title}. Ausência aparece como não disponível.`, source, params: P as unknown as ReportDefinition["params"], columns, formats: ["pdf", "xlsx"], reproducible: true, syncRowLimit: 5000, dependency });

export const MEAL_REPORTS: ReportDefinition[] = [
  def("planejamento", "Planejamento de cardápios", "menu-plan", [{ id: "date", label: "Data", kind: "date" }, { id: "school", label: "Escola", kind: "text" }, { id: "meal", label: "Refeição", kind: "text" }, { id: "preparation", label: "Preparação", kind: "text" }, { id: "state", label: "Situação", kind: "text" }]),
  def("lotes-validade", "Lotes e validades", "meal_stock_lines", [{ id: "depot", label: "Depósito", kind: "text" }, { id: "item", label: "Item", kind: "text" }, { id: "lot", label: "Lote", kind: "text" }, { id: "expires", label: "Validade", kind: "date" }, { id: "balance", label: "Saldo", kind: "number" }, { id: "blocked", label: "Bloqueio", kind: "text" }]),
  def("distribuicao", "Distribuição e remessas", "shipments", [{ id: "shipment", label: "Remessa", kind: "text" }, { id: "destination", label: "Destino", kind: "text" }, { id: "item", label: "Item", kind: "text" }, { id: "sent", label: "Enviado", kind: "number" }, { id: "accepted", label: "Aceito", kind: "number" }, { id: "quarantine", label: "Quarentena", kind: "number" }, { id: "returned", label: "Devolvido", kind: "number" }]),
  def("producao", "Produção diária", "record_meal_execution", [{ id: "date", label: "Data", kind: "date" }, { id: "school", label: "Escola", kind: "text" }, { id: "produced", label: "Produzidas", kind: "number" }, { id: "served", label: "Servidas", kind: "number" }, { id: "followed", label: "Cardápio", kind: "text" }, { id: "responsible", label: "Responsável", kind: "text", sensitive: true }]),
  def("custos", "Custos estimados", "costs-indicators", [{ id: "item", label: "Item", kind: "text" }, { id: "qty", label: "Consumo efetivo", kind: "number" }, { id: "cost", label: "Custo estimado", kind: "number" }, { id: "origin", label: "Origem do preço", kind: "text" }]),
  def("perdas", "Perdas", "costs-indicators", [{ id: "kind", label: "Tipo", kind: "text" }, { id: "item", label: "Item", kind: "text" }, { id: "qty", label: "Quantidade", kind: "number" }, { id: "ref", label: "Lançamento", kind: "text" }]),
];

// ---------- PNAE ----------
export interface PnaeInput { transferred: { value: number; source: string } | null; booked: { value: number; source: string } | null; familyFarming: { state: string; share: number | null; rule?: string }; schoolDays: number | null; servedMeals: number | null }
export function pnaeStatement(i: PnaeInput) {
  return {
    title: "Demonstrativo de apoio à prestação de contas PNAE",
    disclaimer: "Documento de apoio interno. Não é prestação de contas oficial e não foi transmitido a nenhum sistema.",
    transferred: i.transferred ?? { value: null, source: "repasse não informado" },
    booked: i.booked ?? { value: null, source: "fonte contábil não integrada" },
    balance: i.transferred && i.booked ? Math.round((i.transferred.value - i.booked.value) * 100) / 100 : null,
    familyFarming: i.familyFarming, schoolDays: i.schoolDays, servedMeals: i.servedMeals,
    transmission: "nao-transmitido" as const,
  };
}

// ---------- CAE ----------
const CAE_ALLOWED = new Set(["alimentacao-planejamento", "alimentacao-lotes-validade", "alimentacao-distribuicao", "alimentacao-custos", "alimentacao-perdas", "pnae"]);
export function caeView(reportId: string, rows: Record<string, unknown>[], def?: ReportDefinition) {
  if (!CAE_ALLOWED.has(reportId)) return { error: "fora das competências do CAE" };
  const sensitive = new Set((def?.columns ?? []).filter((c) => c.sensitive).map((c) => c.id));
  const banned = /^(student|estudante|aluno|cpf|nome|responsible)/i;
  return { rows: rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !sensitive.has(k) && !banned.test(k)))), readOnly: true };
}
/** Atos do conselho (parecer, ata, deliberação) não são produzidos pelo sistema. */
export function caeAct(kind: string) {
  return { error: `ato "${kind}" pertence ao CAE e não é produzido ou simulado pelo SIGEM; anexe o documento do conselho ao GED` };
}
