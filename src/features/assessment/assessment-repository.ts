/**
 * Repositório temporário (memória). A interface é o contrato que uma futura
 * persistência real deverá implementar; a UI dependerá apenas dela.
 */
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";

export interface AssessmentRepository {
  listInstruments(filter?: {
    classId?: string;
    periodId?: string;
    assignmentId?: string;
  }): AssessmentInstrument[];
  getInstrument(id: string): AssessmentInstrument | undefined;
  saveInstrument(instrument: AssessmentInstrument): void;
  listEntries(instrumentId: string): AssessmentEntry[];
  saveEntry(entry: AssessmentEntry): void;
}

export function createInMemoryAssessmentRepository(
  seed: {
    instruments?: AssessmentInstrument[];
    entries?: AssessmentEntry[];
  } = {},
): AssessmentRepository {
  const instruments = new Map((seed.instruments ?? []).map((i) => [i.id, i]));
  const entries = new Map((seed.entries ?? []).map((e) => [e.id, e]));
  return {
    listInstruments(filter = {}) {
      return [...instruments.values()].filter(
        (i) =>
          (!filter.classId || i.classId === filter.classId) &&
          (!filter.periodId || i.periodId === filter.periodId) &&
          (!filter.assignmentId || i.pedagogicalAssignmentId === filter.assignmentId),
      );
    },
    getInstrument: (id) => instruments.get(id),
    saveInstrument(instrument) {
      instruments.set(instrument.id, instrument);
    },
    listEntries: (instrumentId) =>
      [...entries.values()].filter((e) => e.instrumentId === instrumentId),
    saveEntry(entry) {
      if (!instruments.has(entry.instrumentId)) throw new Error("Instrumento inexistente.");
      const duplicate = [...entries.values()].find(
        (e) =>
          e.instrumentId === entry.instrumentId &&
          e.studentId === entry.studentId &&
          e.id !== entry.id,
      );
      if (duplicate) throw new Error("Já existe lançamento deste aluno neste instrumento.");
      entries.set(entry.id, entry);
    },
  };
}
