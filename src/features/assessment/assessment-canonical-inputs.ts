/**
 * 6D.3.4.1 — Adaptador canônico compartilhado:
 * AssessmentEntryVersion OFICIAL VIGENTE → entrada do motor de composição.
 *
 * Única tradução usada pela Avaliação do período e pelo Fechamento do período,
 * para que nenhum dos dois reconstrua a entrada do motor por conta própria.
 * Não calcula: só escolhe a versão vigente registrada e a descreve ao motor.
 */
import type { CompositionEntryInput } from "./assessment-composition-types";
import {
  assessmentLogicalEntryId,
  currentAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";

export type OfficialEntryUse = { version: AssessmentEntryVersion; instrument: AssessmentInstrument };

/** Versões vigentes REGISTRADAS do estudante nos instrumentos dados (rascunho nunca entra). */
export function officialCurrentVersionsForStudent(args: {
  studentId: string;
  instruments: readonly AssessmentInstrument[];
  versions: readonly AssessmentEntryVersion[];
}): OfficialEntryUse[] {
  return args.instruments.flatMap((instrument) => {
    const v = currentAssessmentEntryVersion(
      args.versions,
      assessmentLogicalEntryId(instrument.id, args.studentId),
    );
    return v && v.status === "registrado" ? [{ version: v, instrument }] : [];
  });
}

/** Tradução da versão oficial para o motor; `entryId` é o ID imutável da versão. */
export function compositionInputFromVersion(
  use: OfficialEntryUse,
  configuration: { id: string; version: number },
): CompositionEntryInput {
  const { version: v, instrument } = use;
  return {
    entryId: v.id,
    instrumentId: instrument.id,
    instrumentTypeId: instrument.instrumentTypeId,
    periodId: instrument.periodId,
    configurationId: configuration.id,
    configurationVersion: configuration.version,
    value: v.value,
    status: "registrado",
    ...(v.origin ? { origin: v.origin } : {}),
    ...(v.originMetadata ? { metadata: v.originMetadata } : {}),
    at: v.recordedAt,
  };
}

/**
 * 6D.3.5.2 — Composição direta das duas etapas acima: versões oficiais vigentes
 * do estudante → entradas do motor. Consumida pela consolidação do ciclo para a
 * recuperação final, sem passar por formato legado.
 */
export function officialCompositionInputsForStudent(args: {
  studentId: string;
  instruments: readonly AssessmentInstrument[];
  versions: readonly AssessmentEntryVersion[];
  configuration: { id: string; version: number };
}): CompositionEntryInput[] {
  return officialCurrentVersionsForStudent(args).map((use) =>
    compositionInputFromVersion(use, args.configuration),
  );
}
