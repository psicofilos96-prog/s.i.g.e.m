/**
 * Fatos analíticos do encerramento.
 *
 * @deprecated A raiz única de publicação passou a ser a projeção canônica da 12L.
 * Esta função permanece apenas como compatibilidade de leitura e agora DERIVA da
 * projeção, para que não exista uma segunda verdade com formato ligeiramente
 * diferente. Novos consumidores devem usar
 * `projectClosingChain` + `projectToAnalyticRows`.
 */
import { projectToAnalyticRows } from "@/features/academic-projections/academic-projection-analytics";
import { projectClosingChain } from "@/features/academic-projections/academic-projection-service";
import type { ProjectionOptions } from "@/features/academic-projections/academic-projection-service";
import type { ClassCycleClosingSnapshot } from "./cycle-closing-types";

export type ClosingAnalyticRow = {
  rowId: string;
  category: string;
  dimensions: Record<string, string | number | boolean | null>;
  at: string;
  provenance: Record<string, string | number | boolean | null>;
};

export function closingAnalyticRows(
  snapshots: readonly ClassCycleClosingSnapshot[],
  options: ProjectionOptions = {},
): ClosingAnalyticRow[] {
  return projectToAnalyticRows(projectClosingChain(snapshots, options));
}
