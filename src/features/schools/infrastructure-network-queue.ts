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

/**
 * PERF.LOADING.3 — mesma fila a partir da cobertura agregada no servidor (`infrastructure_coverage_at`):
 * por escola, os atributos com observação vigente. Evita trazer todas as observações ao navegador.
 */
export function infrastructureQueueFromCoverage(schoolIds: readonly string[], attrs: readonly InfraAttributeRow[], coverage: readonly { school_id: string; informed_attribute_ids: string[] | null }[]): InfraQueueRow[] {
  const latest = new Map<string, InfraAttributeRow>();
  for (const a of attrs) { const p = latest.get(a.attribute_id); if (!p || a.version_number > p.version_number) latest.set(a.attribute_id, a); }
  const labels = [...latest.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const informed = new Map(coverage.map((c) => [c.school_id, new Set(c.informed_attribute_ids ?? [])]));
  const rows = schoolIds.map((id) => {
    const have = informed.get(id) ?? new Set<string>();
    const missing = labels.filter((a) => !have.has(a.attribute_id)).map((a) => a.label);
    return { schoolId: id, informed: labels.length - missing.length, total: labels.length, missing };
  });
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
