/**
 * Etapa 6D.3.1 — Adaptador de compatibilidade entre o lançamento legado
 * (`AssessmentEntry`, com `history[]` interno) e a cadeia canônica de versões
 * (`AssessmentEntryVersion`).
 *
 * Existe por uma razão só: permitir que a 6D.3.2/6D.3.4 migrem a interface e o
 * repositório sem reescrever o passado nem parar o Diário. O adaptador LÊ o
 * formato legado e projeta a cadeia; ele não é uma segunda fonte de verdade e
 * nunca inventa ato de retificação nem proveniência que não exista no registro.
 *
 * Invariantes:
 * - Nenhuma revisão legada é descartada: cada `EntryRevision` vira uma versão
 *   anterior da cadeia, na ordem em que foi substituída.
 * - Ausência permanece ausência: "não registrado" não é convertido.
 * - O que o formato legado não sabe (regra aplicada, capacidades, fechamento
 *   consultado) NÃO é preenchido: o ato reconstruído declara sua origem.
 */
import {
  assessmentLogicalEntryId,
  type AssessmentEntryVersion,
  type AssessmentRectificationAct,
} from "./assessment-entry-versions";
import { ASSESSMENT_CHANGE_ASPECTS, assessmentValueDelta } from "./assessment-entry-versions";
import type { AssessmentEntry } from "./assessment-types";

/** Proveniência explícita de um ato reconstruído a partir do formato legado. */
export const LEGACY_RECTIFICATION_POLICY_ID = "registro-legado-sem-politica-declarada";

/**
 * Projeta a cadeia de versões de um lançamento legado. A versão vigente é a
 * última; as revisões preservadas tornam-se as versões anteriores.
 */
export function assessmentVersionsFromLegacyEntry(entry: AssessmentEntry): AssessmentEntryVersion[] {
  const logicalEntryId = assessmentLogicalEntryId(entry.instrumentId, entry.studentId);
  const revisions = entry.history ?? [];
  const versions: AssessmentEntryVersion[] = [];

  // Cada revisão guarda o valor SUBSTITUÍDO: ela descreve a versão anterior.
  revisions.forEach((revision, index) => {
    versions.push(
      freeze({
        id: `${entry.id}-v${index + 1}`,
        logicalEntryId,
        version: index + 1,
        instrumentId: entry.instrumentId,
        studentId: entry.studentId,
        placement: { ...entry.placement },
        value: revision.value,
        status: "registrado",
        recordedAt: revision.recordedAt,
        recordedByAssignmentId: entry.recordedByAssignmentId,
        ...(index > 0 ? { supersedesVersionId: `${entry.id}-v${index}` } : {}),
        ...(revision.valueLabel ? { valueLabel: revision.valueLabel } : {}),
        ...(entry.context ? { context: entry.context } : {}),
        ...(entry.author ? { recordedBy: entry.author } : {}),
        ...(entry.origin ? { origin: entry.origin } : {}),
        ...(entry.originMetadata ? { originMetadata: entry.originMetadata } : {}),
        ...(index > 0
          ? { rectification: legacyAct(revisions[index - 1]!, revision.value, revisions[index - 1]!.value) }
          : {}),
      }),
    );
  });

  const lastRevision = revisions[revisions.length - 1];
  versions.push(
    freeze({
      id: `${entry.id}-v${revisions.length + 1}`,
      logicalEntryId,
      version: revisions.length + 1,
      instrumentId: entry.instrumentId,
      studentId: entry.studentId,
      placement: { ...entry.placement },
      value: entry.value,
      status: entry.status ?? "rascunho",
      recordedAt: entry.recordedAt,
      recordedByAssignmentId: entry.recordedByAssignmentId,
      ...(revisions.length ? { supersedesVersionId: `${entry.id}-v${revisions.length}` } : {}),
      ...(entry.valueLabel ? { valueLabel: entry.valueLabel } : {}),
      ...(entry.context ? { context: entry.context } : {}),
      ...(entry.author ? { recordedBy: entry.author } : {}),
      ...(entry.origin ? { origin: entry.origin } : {}),
      ...(entry.originMetadata ? { originMetadata: entry.originMetadata } : {}),
      ...(lastRevision ? { rectification: legacyAct(lastRevision, entry.value, lastRevision.value) } : {}),
    }),
  );

  return versions;
}

/**
 * Ato reconstruído. Declara abertamente que a política aplicada não consta no
 * registro legado, em vez de atribuir uma regra que ninguém homologou.
 */
function legacyAct(
  revision: NonNullable<AssessmentEntry["history"]>[number],
  next: AssessmentEntry["value"],
  previous: AssessmentEntry["value"],
): AssessmentRectificationAct {
  const changed = assessmentValueDelta({ value: previous }, { value: next });
  return {
    actedAt: revision.replacedAt,
    agentId: revision.correctedBy?.professionalId ?? "",
    policyId: LEGACY_RECTIFICATION_POLICY_ID,
    policyVersion: 0,
    policyLabel: "Correção registrada antes da política de retificação versionada",
    satisfiedRequirements: [],
    changedAspects: changed.length ? changed : [ASSESSMENT_CHANGE_ASPECTS.value],
    ...(revision.justification.trim() ? { justification: revision.justification.trim() } : {}),
  };
}

function freeze(version: AssessmentEntryVersion): AssessmentEntryVersion {
  Object.freeze(version.placement);
  Object.freeze(version.value);
  return Object.freeze(version);
}
