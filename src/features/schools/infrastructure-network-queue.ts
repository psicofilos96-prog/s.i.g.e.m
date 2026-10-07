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
