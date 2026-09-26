/**
 * Etapa 13D/13E — Projeção configurável de SITUAÇÃO DE VIDA ESCOLAR.
 *
 * A cadeia correta é:
 *
 *   FATO OFICIAL DE MOBILIDADE (13D) → POLÍTICA CONFIGURÁVEL → PROJEÇÃO
 *
 * e NUNCA `13D → código da 13E → TRANSFERIDO`. Nenhum identificador de situação
 * existe neste módulo: `sit-rede-transferido` é dado cadastrado na política.
 * Mudando a política, o mesmo fato histórico passa a projetar outra situação —
 * preservando qual política, em qual versão, produziu cada projeção.
 */
import { diagnostic } from "./student-life-diagnostics";
import type { StudentLifeDiagnostic } from "./student-life-types";
import {
  TRANSFER_DIAGNOSTIC_CODES as CODES,
  TRANSFER_DIAGNOSTIC_TYPES as TYPES,
} from "./transfer-diagnostics";
import type { StudentMobilityAtomicFactRow } from "./transfer-analytics";
import type {
  StudentLifeSituationProjection,
  StudentLifeSituationProjectionPolicy,
} from "./transfer-types";

export type SituationProjectionResult = {
  projections: readonly StudentLifeSituationProjection[];
  diagnostics: readonly StudentLifeDiagnostic[];
};

/**
 * Projeta situações de vida escolar a partir dos fatos atômicos de mobilidade.
 * Fato sem regra correspondente NÃO recebe situação por omissão: produz
 * diagnóstico estruturado de política não declarada.
 */
export function projectStudentLifeSituations(
  facts: readonly StudentMobilityAtomicFactRow[],
  policy: StudentLifeSituationProjectionPolicy,
  projectedAt: string,
): SituationProjectionResult {
  const projections: StudentLifeSituationProjection[] = [];
  const diagnostics: StudentLifeDiagnostic[] = [];

  for (const fact of facts) {
    const rule = policy.rules.find((candidate) => {
      if (candidate.appliesToMobilityFactTypeId !== fact.mobilityFactTypeId) return false;
      const kinds = candidate.appliesToProcessKindIds ?? [];
      if (kinds.length > 0 && !kinds.includes(fact.processKindDefinitionId)) return false;
      const destinations = candidate.appliesToDestinationTypeIds ?? [];
      if (
        destinations.length > 0 &&
        (fact.destinationContextTypeDefinitionId === null ||
          !destinations.includes(fact.destinationContextTypeDefinitionId))
      ) {
        return false;
      }
      if (candidate.requiresKnownDestination !== undefined) {
        const known = fact.destinationContextTypeDefinitionId !== null;
        if (candidate.requiresKnownDestination !== known) return false;
      }
      return true;
    });

    if (!rule) {
      diagnostics.push(
        diagnostic(
          CODES.situationProjectionUndeclared,
          TYPES.projection,
          "requirement",
          { studentId: fact.studentId },
          {
            parameters: {
              mobilityFactTypeId: fact.mobilityFactTypeId,
              transferProcessId: fact.transferProcessId,
              policyId: policy.policyId,
              policyVersion: policy.policyVersion,
            },
            message: "Nenhuma regra de projeção declarada para este fato de mobilidade.",
          },
        ),
      );
      continue;
    }

    projections.push({
      studentId: fact.studentId,
      transferProcessId: fact.transferProcessId,
      situationDefinitionId: rule.producesSituationDefinitionId,
      effectiveDate: fact.effectiveDate,
      producedFromFactTypeId: fact.mobilityFactTypeId,
      producedByPolicy: {
        definitionId: policy.policyId,
        definitionVersion: policy.policyVersion,
      },
      producedByRuleId: rule.ruleId,
      projectedAt,
    });
  }

  return { projections, diagnostics };
}
