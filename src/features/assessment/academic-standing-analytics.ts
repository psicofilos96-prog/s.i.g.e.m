/**
 * Etapa 12I — materialização analítica para o CIECE (ajustes 5, 8 e 9).
 *
 * Aqui NÃO existem indicadores, taxas, gráficos nem relatórios. Exportamos
 * fatos e dimensões ATÔMICOS, com identificador estável, temporalidade, estado,
 * regra, versão e proveniência, para que o motor analítico do CIECE construa
 * depois qualquer leitura que a rede precisar.
 */
import type {
  AcademicStandingDetermination,
  AcademicStandingRecord,
  FactCategory,
  StandingValue,
} from "./academic-standing-types";

export type StandingAnalyticRow = {
  /** Identificador estável da linha analítica. */
  id: string;
  factKind: string;
  factId: string;
  category: FactCategory | "estado-operacional" | "criterio" | "deliberacao";
  scopeKey: string;
  cycleId: string;
  cycleKindId: string;
  academicYearId: string;
  studentId: string;
  value: StandingValue | readonly StandingValue[] | null;
  unit?: string;
  /** Estado operacional no momento da materialização. */
  operationalState: string;
  ruleSetId?: string;
  ruleSetVersion?: number;
  recordId?: string;
  recordVersion?: number;
  official: boolean;
  observedAt: string;
  provenance: {
    algorithm: string;
    sources: readonly { kind: string; id: string; version?: number }[];
  };
};

const identity = (
  source:
    | { kind: "determinacao"; determination: AcademicStandingDetermination; at: string }
    | { kind: "registro"; record: AcademicStandingRecord },
) =>
  source.kind === "determinacao"
    ? {
        cycleId: source.determination.cycleId,
        cycleKindId: source.determination.cycleKindId,
        academicYearId: source.determination.academicYearId,
        studentId: source.determination.studentId,
        operationalState: source.determination.operationalState,
        ruleSetId: source.determination.ruleSetId,
        ruleSetVersion: source.determination.ruleSetVersion,
        official: source.determination.official,
        observedAt: source.at,
        facts: source.determination.facts,
        steps: source.determination.steps,
        standingId: source.determination.standingId,
        deliberation: source.determination.deliberation,
        prefix: `det-${source.determination.cycleId}-${source.determination.studentId}`,
      }
    : {
        cycleId: source.record.cycleId,
        cycleKindId: source.record.cycleKindId,
        academicYearId: source.record.academicYearId,
        studentId: source.record.studentId,
        operationalState: source.record.operationalState,
        ruleSetId: source.record.ruleSetId,
        ruleSetVersion: source.record.ruleSetVersion,
        official: true,
        observedAt: source.record.determinedAt,
        facts: source.record.facts,
        steps: source.record.steps,
        standingId: source.record.standingId,
        deliberation: null,
        prefix: `${source.record.id}`,
      };

/**
 * Converte uma determinação (ou uma versão registrada) em linhas atômicas.
 * Cada fato consultado, cada critério avaliado e a própria situação resultante
 * viram linhas independentes, sem agregação.
 */
export function standingAnalyticRows(
  source:
    | { kind: "determinacao"; determination: AcademicStandingDetermination; at: string }
    | { kind: "registro"; record: AcademicStandingRecord },
): StandingAnalyticRow[] {
  const base = identity(source);
  const record = source.kind === "registro" ? source.record : undefined;
  const common = {
    cycleId: base.cycleId,
    cycleKindId: base.cycleKindId,
    academicYearId: base.academicYearId,
    studentId: base.studentId,
    operationalState: base.operationalState,
    ...(base.ruleSetId ? { ruleSetId: base.ruleSetId } : {}),
    ...(base.ruleSetVersion !== undefined ? { ruleSetVersion: base.ruleSetVersion } : {}),
    ...(record ? { recordId: record.id, recordVersion: record.version } : {}),
    official: base.official,
    observedAt: base.observedAt,
  };

  const rows: StandingAnalyticRow[] = [];

  for (const fact of base.facts)
    rows.push({
      ...common,
      id: `${base.prefix}|fato|${fact.factId}|${fact.scopeKey}`,
      factKind: "fato-consultado",
      factId: fact.factId,
      category: fact.category,
      scopeKey: fact.scopeKey,
      value: fact.value,
      ...(fact.unit ? { unit: fact.unit } : {}),
      provenance: {
        algorithm: fact.provenance.algorithm,
        sources: fact.provenance.sources,
      },
    });

  for (const step of base.steps)
    rows.push({
      ...common,
      id: `${base.prefix}|criterio|${step.stepId}`,
      factKind: "criterio-avaliado",
      factId: step.stepId,
      category: "criterio",
      scopeKey: step.node.scopeKey ?? "*",
      value: step.result === null ? null : step.result,
      provenance: {
        algorithm: `avaliação declarativa do critério "${step.label}" (regra ${step.ruleSetId} v${step.ruleSetVersion})`,
        sources: [{ kind: "regra-de-situacao", id: step.ruleSetId, version: step.ruleSetVersion }],
      },
    });

  rows.push({
    ...common,
    id: `${base.prefix}|situacao`,
    factKind: "situacao-academica-do-ciclo",
    factId: "situacao-academica-do-ciclo",
    category: "estado-operacional",
    scopeKey: `ciclo:${base.cycleId}`,
    value: base.standingId,
    provenance: {
      algorithm: "determinação declarativa de situação acadêmica (12I)",
      sources: [
        { kind: "ciclo-avaliativo", id: base.cycleId },
        ...(base.ruleSetId
          ? [
              {
                kind: "regra-de-situacao",
                id: base.ruleSetId,
                ...(base.ruleSetVersion !== undefined ? { version: base.ruleSetVersion } : {}),
              },
            ]
          : []),
      ],
    },
  });

  if (base.deliberation)
    rows.push({
      ...common,
      id: `${base.prefix}|deliberacao|${base.deliberation.id}`,
      factKind: "deliberacao-institucional",
      factId: base.deliberation.competenceId,
      category: "deliberacao",
      scopeKey: base.deliberation.scopeKey,
      value: base.deliberation.decision.standingId ?? null,
      provenance: {
        algorithm: "deliberação institucional registrada",
        sources: [{ kind: "orgao-deliberativo", id: base.deliberation.bodyId }],
      },
    });

  return rows;
}

export const STANDING_ANALYTICS_NOTE =
  "Saída analítica atômica: fatos, critérios, deliberações e situações preservados linha a linha, com proveniência, versão e temporalidade. Indicadores, séries e relatórios serão construídos depois pelo motor analítico do CIECE.";
