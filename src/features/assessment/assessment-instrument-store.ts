/**
 * Estado temporário da aba (12C). Sem persistência real: a interface do
 * repositório é o contrato para uma futura persistência.
 */
import { useSyncExternalStore } from "react";
import { demonstrationStudents } from "@/features/students/students-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { instrumentFixtures, instrumentTypes, periodStructures } from "./assessment-fixtures";
import { PERIOD_LAB_INSTRUMENTS } from "./assessment-period-lab-fixture";
import {
  buildInstrument,
  correctEntry,
  draftEntry,
  instrumentRoster,
  registerEntries,
  resolveInstrumentPeriod,
  type DomainResult,
  type InstrumentInput,
} from "./assessment-instruments";
import type {
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  EntryValue,
} from "./assessment-types";

type State = { instruments: AssessmentInstrument[]; entries: AssessmentEntry[]; seq: number };

export function createInstrumentStore(seed: Partial<State> = {}) {
  let state: State = {
    instruments: seed.instruments ?? structuredClone([...instrumentFixtures, ...PERIOD_LAB_INSTRUMENTS]),
    entries: seed.entries ?? [],
    seq: seed.seq ?? 1,
  };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const now = () => new Date().toISOString();
  const typeLabel = (id: string) => instrumentTypes.find((t) => t.id === id)?.label ?? id;
  const periodLabel = (i: AssessmentInstrument) => {
    const structure = periodStructures.find((s) => s.periods.some((p) => p.id === i.periodId));
    if (!structure) return i.periodId;
    const r = resolveInstrumentPeriod(structure, i.appliedOn);
    return r.ok ? r.period.label : i.periodId;
  };
  const fail = (reasons: string[]): DomainResult<never> => ({ ok: false, reasons });

  const api = {
    /** 6D.3.5.7 — instala instrumento FICTÍCIO de laboratório (ativação explícita). */
    installLaboratoryInstrument(instrument: AssessmentInstrument) {
      if (state.instruments.some((i) => i.id === instrument.id)) return;
      set({ ...state, instruments: [...state.instruments, instrument] });
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: () => state,
    instrumentsForClass: (classId: string) =>
      state.instruments
        .filter((i) => i.classId === classId)
        .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn)),
    get: (id: string) => state.instruments.find((i) => i.id === id),
    entries: (instrumentId: string) => state.entries.filter((e) => e.instrumentId === instrumentId),
    typeLabel,
    periodLabel,
    create(args: {
      input: InstrumentInput;
      configuration: AssessmentConfiguration;
      structureId: string;
      assignmentId: string;
      professionalId: string;
      classId: string;
    }): DomainResult<AssessmentInstrument> {
      const structure = periodStructures.find((s) => s.id === args.structureId);
      if (!structure) return fail(["Estrutura de períodos inexistente."]);
      const r = buildInstrument({
        id: `ins-${String(state.seq).padStart(3, "0")}-${args.classId}`,
        input: args.input,
        configuration: args.configuration,
        structure,
        assignment: demonstrationPedagogicalAssignments.find((a) => a.id === args.assignmentId),
        professionalId: args.professionalId,
        classId: args.classId,
        now: now(),
      });
      if (r.ok) set({ ...state, instruments: [...state.instruments, r.value], seq: state.seq + 1 });
      return r;
    },
    apply(id: string): DomainResult<AssessmentInstrument> {
      const i = api.get(id);
      if (!i) return fail(["Instrumento inexistente."]);
      if (i.status === "aplicado") return { ok: true, value: i };
      const next = { ...i, status: "aplicado" as const };
      set({ ...state, instruments: state.instruments.map((x) => (x.id === id ? next : x)) });
      return { ok: true, value: next };
    },
    saveDraft(args: {
      instrumentId: string;
      studentId: string;
      value: EntryValue;
      configuration: AssessmentConfiguration;
    }): DomainResult<AssessmentEntry> {
      const instrument = api.get(args.instrumentId);
      if (!instrument) return fail(["Instrumento inexistente."]);
      const eligible = instrumentRoster(instrument, demonstrationStudents).eligible.find(
        (e) => e.student.id === args.studentId,
      );
      if (!eligible) return fail(["Aluno sem vínculo com a turma na data de aplicação."]);
      const existing = state.entries.find(
        (e) => e.instrumentId === instrument.id && e.studentId === args.studentId,
      );
      const r = draftEntry({
        instrument,
        configuration: args.configuration,
        eligible,
        value: args.value,
        now: now(),
        ...(existing ? { existing } : {}),
        periodLabel: periodLabel(instrument),
        instrumentTypeLabel: typeLabel(instrument.instrumentTypeId),
      });
      if (r.ok)
        set({
          ...state,
          entries: [...state.entries.filter((e) => e.id !== r.value.id), r.value],
        });
      return r;
    },
    discardDraft(entryId: string) {
      set({
        ...state,
        entries: state.entries.filter((e) => !(e.id === entryId && e.status !== "registrado")),
      });
    },
    register(instrumentId: string, entryIds?: string[]) {
      const ids =
        entryIds ??
        state.entries
          .filter((e) => e.instrumentId === instrumentId && e.status !== "registrado")
          .map((e) => e.id);
      set({ ...state, entries: registerEntries(state.entries, ids, now()) });
      return ids.length;
    },
    correct(args: {
      entryId: string;
      value: EntryValue;
      justification: string;
      configuration: AssessmentConfiguration;
      correctedBy?: { professionalId: string; pedagogicalAssignmentId: string };
    }): DomainResult<AssessmentEntry> {
      const entry = state.entries.find((e) => e.id === args.entryId);
      if (!entry) return fail(["Lançamento inexistente."]);
      const r = correctEntry({ entry, ...args, now: now() });
      if (r.ok)
        set({ ...state, entries: state.entries.map((e) => (e.id === entry.id ? r.value : e)) });
      return r;
    },
  };
  return api;
}

export type InstrumentStore = ReturnType<typeof createInstrumentStore>;
export const instrumentStore = createInstrumentStore();

export function useInstrumentStore(store: InstrumentStore = instrumentStore) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
