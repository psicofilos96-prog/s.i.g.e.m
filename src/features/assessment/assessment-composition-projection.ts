/**
 * Etapa 12E — ponte de leitura entre os lançamentos existentes (12C/12D) e o
 * motor de composição. Projeção pura: não grava nem transforma lançamentos.
 */
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";
import type { CompositionEntryInput } from "./assessment-composition-types";

/**
 * Converte lançamentos do aluno em entradas do motor, preservando origem e
 * metadados administrativos exatamente como registrados.
 */
export function compositionInputsForStudent(args: {
  studentId: string;
  instruments: readonly AssessmentInstrument[];
  entries: readonly AssessmentEntry[];
  classIds?: readonly string[];
}): CompositionEntryInput[] {
  const instruments = args.classIds
    ? args.instruments.filter((i) => args.classIds!.includes(i.classId))
    : args.instruments;
  return instruments.flatMap((instrument) => {
    const entry = args.entries.find(
      (e) => e.instrumentId === instrument.id && e.studentId === args.studentId,
    );
    if (!entry) return [];
    const configurationId = entry.context?.configurationId ?? instrument.configurationId;
    const configurationVersion =
      entry.context?.configurationVersion ?? instrument.configurationVersion;
    return [
      {
        entryId: entry.id,
        instrumentId: instrument.id,
        instrumentTypeId: instrument.instrumentTypeId,
        periodId: instrument.periodId,
        configurationId,
        ...(configurationVersion !== undefined ? { configurationVersion } : {}),
        value: entry.value,
        ...(entry.status ? { status: entry.status } : {}),
        ...(entry.origin ? { origin: entry.origin } : {}),
        ...(entry.originMetadata ? { metadata: entry.originMetadata } : {}),
        at: entry.recordedAt,
      },
    ];
  });
}
