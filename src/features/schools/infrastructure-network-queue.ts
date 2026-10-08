// N11.2.3 — Fila da rede de infraestrutura: projeção pura de cobertura.
// Não classifica condição (boa/ruim) nem prioriza: só mostra o que falta informar, por escola.
import { schoolInfrastructureAt, type InfraAttributeRow, type InfraObservationRow } from "./school-infrastructure";

export type InfraQueueRow = { schoolId: string; informed: number; total: number; missing: string[] };

export function infrastructureQueue(schoolIds: readonly string[], attrs: readonly InfraAttributeRow[], obs: readonly InfraObservationRow[], on: string): InfraQueueRow[] {
  const rows = schoolIds.map((id) => {
    const facts = schoolInfrastructureAt(id, attrs as InfraAttributeRow[], obs as InfraObservationRow[], on);
    const missing = facts.filter((f) => !f.current).map((f) => f.label);
    return { schoolId: id, informed: facts.length - missing.length, total: facts.length, missing };
  });
  // Ordem: só por quantidade a informar (fato), depois identidade — nenhum peso inventado.
  return rows.sort((a, b) => b.missing.length - a.missing.length || a.schoolId.localeCompare(b.schoolId));
}

import type { ReportDefinition, CellValue } from "@/features/reports/report-engine";
/** Relatório de cobertura: só o que a escola informou × falta informar; não avalia condição nem prioridade. */
export const INFRAESTRUTURA_COBERTURA: ReportDefinition = {
  id: "infraestrutura-cobertura-rede", version: 1, title: "Infraestrutura — cobertura por escola",
  description: "Quantos itens de infraestrutura cada escola visível informou na data e quais faltam. Não avalia condição nem define prioridade.",
  source: "school_infrastructure_* (RLS da sessão) → infrastructureQueue",
  params: [{ id: "on", label: "Situação na data", type: "date", required: false }],
  columns: [
    { id: "school", label: "Escola", kind: "text" },
    { id: "informed", label: "Informados", kind: "number" },
    { id: "total", label: "Itens cadastrados", kind: "number" },
    { id: "missing", label: "Falta informar", kind: "text" },
  ],
  formats: ["csv", "pdf"], reproducible: false, syncRowLimit: 5000,
};
export function infrastructureReportRows(rows: readonly InfraQueueRow[], names: ReadonlyMap<string, string>): Record<string, CellValue>[] {
  return rows.map((r) => ({ school: names.get(r.schoolId) ?? "Escola sem nome registrado", informed: r.informed, total: r.total, missing: r.missing.length ? r.missing.join("; ") : null }));
}
