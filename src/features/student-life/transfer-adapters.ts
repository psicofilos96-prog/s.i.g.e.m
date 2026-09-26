/**
 * Etapa 13D — Adaptadores de compatibilidade da Transferência.
 *
 * A tela do protótipo 8F (`/transferencias`) continua funcionando e permanece
 * DEMONSTRATIVA. Estes adaptadores traduzem o rascunho da tela para os contratos
 * canônicos da 13D sem transformar o protótipo em fonte de verdade.
 *
 * Saneamentos realizados na tradução:
 * - `kind: "interna" | "saida-externa" | "entrada-externa"` → rito cadastrado;
 * - unidade/instituição textual → referência polimórfica de contexto com schema;
 * - `externalDestinationKnown: boolean` → ausência epistêmica estruturada, com
 *   motivo, declarante e papel do declarante;
 * - `documentationState` textual → estado documental cadastrado;
 * - nenhuma enturmação de destino é traduzida: essa competência é da 13C na
 *   unidade receptora.
 */
import type { StudentLifeProvenance } from "./student-life-types";
import {
  DEMO_DECLARANT_ROLES,
  DEMO_TRANSFER_ABSENCE_REASONS,
  DEMO_TRANSFER_CONTEXT_SCHEMAS,
  DEMO_TRANSFER_CONTEXT_TYPES,
  DEMO_TRANSFER_PROCESS_KINDS,
} from "./transfer-fixtures";
import type { MobilityContextReference, MobilityPole } from "./transfer-types";

/** Rito canônico correspondente ao tipo textual do protótipo. */
export function processKindFromLegacyKind(
  kind: "interna" | "saida-externa" | "entrada-externa",
): string {
  if (kind === "interna") return DEMO_TRANSFER_PROCESS_KINDS.betweenNetworkUnits;
  if (kind === "saida-externa") return DEMO_TRANSFER_PROCESS_KINDS.networkExit;
  return DEMO_TRANSFER_PROCESS_KINDS.networkEntry;
}

/** Helper tipado de conveniência: referência a uma unidade da Rede. */
export function networkUnitContextReference(input: {
  schoolId: string;
  schoolBondId?: string;
  cycleEnrollmentId?: string;
  academicCycleId?: string;
  educationalOfferId?: string;
  academicOrganizationId?: string;
  labelSnapshot?: string;
}): MobilityContextReference {
  return {
    contextReferenceTypeDefinitionId: DEMO_TRANSFER_CONTEXT_TYPES.networkUnit,
    payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.networkUnit,
    attributes: {
      schoolId: input.schoolId,
      schoolBondId: input.schoolBondId ?? null,
      cycleEnrollmentId: input.cycleEnrollmentId ?? null,
      academicCycleId: input.academicCycleId ?? null,
      educationalOfferId: input.educationalOfferId ?? null,
      academicOrganizationId: input.academicOrganizationId ?? null,
    },
    ...(input.labelSnapshot ? { labelSnapshot: input.labelSnapshot } : {}),
  };
}

/** Helper tipado de conveniência: referência a uma instituição externa. */
export function externalInstitutionContextReference(input: {
  institutionName: string;
  systemOrNetworkName?: string;
  federativeUnit?: string;
  municipality?: string;
  inepSchoolCode?: string;
}): MobilityContextReference {
  return {
    contextReferenceTypeDefinitionId: DEMO_TRANSFER_CONTEXT_TYPES.externalInstitution,
    payloadSchemaDefinitionId: DEMO_TRANSFER_CONTEXT_SCHEMAS.externalInstitution,
    attributes: {
      institutionName: input.institutionName,
      systemOrNetworkName: input.systemOrNetworkName ?? null,
      federativeUnit: input.federativeUnit ?? null,
      municipality: input.municipality ?? null,
      inepSchoolCode: input.inepSchoolCode ?? null,
    },
    labelSnapshot: input.institutionName,
  };
}

/**
 * Traduz o destino do protótipo. Quando a tela informa que o destino não é
 * conhecido, NÃO se produz nenhuma flag: registra-se o fato epistêmico com
 * motivo estruturado, declarante e papel do declarante.
 */
export function destinationPoleFromLegacyDraft(
  draft: {
    kind: "interna" | "saida-externa" | "entrada-externa";
    destinationUnitId: string;
    externalDestinationKnown: boolean;
    externalInstitutionName: string;
    externalLocation: string;
  },
  provenance: StudentLifeProvenance,
  declarantRoleDefinitionId: string = DEMO_DECLARANT_ROLES.legalGuardian,
): MobilityPole {
  if (draft.kind === "interna") {
    return draft.destinationUnitId
      ? { reference: networkUnitContextReference({ schoolId: draft.destinationUnitId }) }
      : {
          reference: null,
          absence: {
            absenceReasonDefinitionId: DEMO_TRANSFER_ABSENCE_REASONS.notInformedByDeclarant,
            declarant: { declarantRoleDefinitionId },
            provenance,
          },
        };
  }
  if (draft.externalDestinationKnown && draft.externalInstitutionName) {
    return {
      reference: externalInstitutionContextReference({
        institutionName: draft.externalInstitutionName,
        ...(draft.externalLocation ? { municipality: draft.externalLocation } : {}),
      }),
    };
  }
  return {
    reference: null,
    absence: {
      absenceReasonDefinitionId: DEMO_TRANSFER_ABSENCE_REASONS.notInformedByDeclarant,
      declarant: { declarantRoleDefinitionId },
      provenance,
    },
  };
}
