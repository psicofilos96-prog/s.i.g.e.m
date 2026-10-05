/**
 * Frente U (R4/R6/R7/R8) — Gate de prontidão pedagógica, puro, sobre o que os readers canônicos
 * (`class_allocations_at`, `allocation_curricular_positions_at`, `class_curricular_resolution_context_at`)
 * já devolveram. Não grava, não infere posição/matriz e não converte ausência em default.
 */

export type ReadinessAllocation = {
  allocationId: string;
  validFrom: string;
  validUntil: string | null;
  /** Posição individual vigente (B3.3); null = não registrada. */
  position: { id: string; validFrom: string; validUntil: string | null } | null;
  /** Matrizes resolvidas por E3 para esta posição/data (0, 1 ou >1). */
  resolvedMatrices: readonly string[];
};

export type ReadinessInput = {
  classId: string;
  on: string;
  /** Natureza da Oferta B2.6 (`natureza-da-turma`); null = não registrada. */
  nature: string | null;
  /** Jornada exigida pela correspondência mas sem valor homologado (EI). */
  journeyRequiredButUndefined?: boolean;
  allocations: readonly ReadinessAllocation[];
};

export type ReadinessIssue =
  | "natureza-nao-definida"
  | "sem-posicao"
  | "sem-matriz"
  | "matriz-ambigua"
  | "inconsistencia-temporal"
  | "jornada-nao-definida";

export type AllocationReadiness = { allocationId: string; issues: ReadinessIssue[]; matrix: string | null; active: boolean };
export type ClassReadiness = {
  classId: string;
  regular: boolean;
  ready: boolean;
  classIssues: ReadinessIssue[];
  allocations: AllocationReadiness[];
  /** União das matrizes resolvidas (multietapa pode ter várias). */
  matrices: string[];
};

export const READINESS_TEXT: Record<ReadinessIssue, string> = {
  "natureza-nao-definida": "Natureza da turma não registrada na oferta.",
  "sem-posicao": "Alocação regular sem posição curricular individual.",
  "sem-matriz": "Posição sem matriz homologada correspondente.",
  "matriz-ambigua": "Mais de uma matriz para a mesma posição; nada foi escolhido.",
  "inconsistencia-temporal": "Posição registrada fora da vigência da alocação.",
  "jornada-nao-definida": "Jornada exigida pela correspondência ainda sem valor homologado.",
};

const within = (d: string, from: string, until: string | null) => from <= d && (until === null || d <= until);
/** Natureza regular é a única que entra na associação automática às matrizes da CME 3/2026 (R4). */
export const REGULAR_NATURE = "regular";

export function assessClassReadiness(input: ReadinessInput): ClassReadiness {
  const classIssues: ReadinessIssue[] = [];
  if (input.nature === null) classIssues.push("natureza-nao-definida");
  const regular = input.nature === REGULAR_NATURE;
  if (input.journeyRequiredButUndefined) classIssues.push("jornada-nao-definida");
  const allocations: AllocationReadiness[] = [];
  const matrices = new Set<string>();
  for (const a of input.allocations) {
    // R8: a posição só produz efeito dentro da vigência da alocação; fora dela é ignorada sem apagar histórico.
    const active = within(input.on, a.validFrom, a.validUntil);
    const issues: ReadinessIssue[] = [];
    let matrix: string | null = null;
    if (active && regular) {
      const p = a.position;
      if (!p || !within(input.on, p.validFrom, p.validUntil)) issues.push("sem-posicao");
      else if (p.validFrom < a.validFrom) issues.push("inconsistencia-temporal");
      else if (a.resolvedMatrices.length === 0) issues.push("sem-matriz");
      else if (a.resolvedMatrices.length > 1) issues.push("matriz-ambigua");
      else { const m = a.resolvedMatrices[0] as string; matrix = m; matrices.add(m); }
    }
    allocations.push({ allocationId: a.allocationId, issues, matrix, active });
  }
  const ready = regular && classIssues.length === 0 && allocations.every((a) => a.issues.length === 0);
  return { classId: input.classId, regular, ready, classIssues, allocations, matrices: [...matrices].sort() };
}
