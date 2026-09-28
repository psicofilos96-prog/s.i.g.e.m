/**
 * 6D.3.2.2 — testes do rascunho da sessão de lançamento.
 *
 * Critério de aceite: diferença semântica (não `dirty`), sequência operacional
 * derivada (não índice de tabela), nenhuma operação coletiva que invente
 * resultado e nenhuma criação de fato oficial.
 */
import { describe, expect, it } from "vitest";
import type { InstrumentRosterItemProjection } from "./assessment-entry-projection";
import {
  applyDraftValue,
  clearAllDrafts,
  discardDraftValue,
  emptyDraftState,
  entryValuesEqual,
  filterRosterItems,
  locallyChangedStudentIds,
  operationalSequence,
  semanticCellState,
  stepOperational,
  summarizeDraft,
  undoDraft,
} from "./assessment-entry-draft";

const recorded: InstrumentRosterItemProjection = {
  studentId: "alu-1",
  displayName: "Mariana Fictícia",
  rollNumber: 1,
  entryState: "recorded",
  admissibility: { eligible: true },
  currentVersionId: "ver-1",
  currentValue: { kind: "numerica", value: 7 },
  currentDisplayLabel: "7",
};

const unrecorded: InstrumentRosterItemProjection = {
  studentId: "alu-2",
  displayName: "Bruno Fictício",
  rollNumber: 2,
  entryState: "unrecorded",
  admissibility: { eligible: true },
};

const notApplicable: InstrumentRosterItemProjection = {
  studentId: "alu-3",
  displayName: "Carla Fictícia",
  rollNumber: 3,
  entryState: "not-applicable",
  admissibility: { eligible: false, blockerReason: "Sem vínculo na data." },
};

const roster = [recorded, unrecorded, notApplicable] as const;

describe("diferença semântica do rascunho", () => {
  it("tratar retorno ao valor oficial como ausência de alteração", () => {
    let state = applyDraftValue(emptyDraftState, "alu-1", "8", { kind: "numerica", value: 8 });
    expect(locallyChangedStudentIds(roster, state.drafts)).toEqual(["alu-1"]);

    state = applyDraftValue(state, "alu-1", "7", { kind: "numerica", value: 7 });
    expect(locallyChangedStudentIds(roster, state.drafts)).toEqual([]);
    expect(semanticCellState(recorded, state.drafts["alu-1"]).state).toBe("no-local-change");
  });

  it("distinguir preparação inicial de alteração de fato oficial", () => {
    const state = applyDraftValue(emptyDraftState, "alu-2", "9", { kind: "numerica", value: 9 });
    expect(semanticCellState(unrecorded, state.drafts["alu-2"]).state).toBe("local-preparation");
    expect(semanticCellState(recorded, { kind: "numerica", value: 9 }).state).toBe("local-change");
  });

  it("comparar por natureza, nunca por identidade de objeto", () => {
    expect(entryValuesEqual({ kind: "descritiva", text: " ok " }, { kind: "descritiva", text: "ok" })).toBe(true);
    expect(entryValuesEqual({ kind: "conceitual", optionId: "a" }, { kind: "numerica", value: 1 })).toBe(false);
    expect(entryValuesEqual(undefined, { kind: "numerica", value: 1 })).toBe(false);
  });

  it("ignorar rascunho em linha não aplicável", () => {
    expect(semanticCellState(notApplicable, { kind: "numerica", value: 5 }).state).toBe(
      "no-local-change",
    );
  });
});

describe("sequência operacional", () => {
  it("excluir linha não aplicável da navegação, mantendo-a visível", () => {
    expect(operationalSequence(roster)).toEqual(["alu-1", "alu-2"]);
    expect(filterRosterItems(roster, "")).toHaveLength(3);
  });

  it("navegar pela sequência derivada e parar nos extremos", () => {
    const sequence = operationalSequence(roster);
    expect(stepOperational(sequence, "alu-1", 1)).toBe("alu-2");
    expect(stepOperational(sequence, "alu-2", 1)).toBe("alu-2");
    expect(stepOperational(sequence, "alu-1", -1)).toBe("alu-1");
    expect(stepOperational(sequence, undefined, 1)).toBe("alu-1");
    expect(stepOperational([], "alu-1", 1)).toBeUndefined();
  });

  it("manter a sequência coerente após busca", () => {
    const visible = filterRosterItems(roster, "carla");
    expect(visible.map((item) => item.studentId)).toEqual(["alu-3"]);
    expect(operationalSequence(visible)).toEqual([]);
  });
});

describe("operações coletivas e desfazer", () => {
  it("oferecer apenas descarte de alterações locais, sem preenchimento coletivo", () => {
    const exported = Object.keys({ applyDraftValue, clearAllDrafts, discardDraftValue });
    expect(exported.some((name) => /fill|bulk|repeat/i.test(name))).toBe(false);
  });

  it("descartar alterações locais e permitir desfazer", () => {
    let state = applyDraftValue(emptyDraftState, "alu-1", "8", { kind: "numerica", value: 8 });
    state = applyDraftValue(state, "alu-2", "6", { kind: "numerica", value: 6 });
    state = clearAllDrafts(state);
    expect(Object.keys(state.drafts)).toEqual([]);
    state = undoDraft(state);
    expect(Object.keys(state.drafts).sort()).toEqual(["alu-1", "alu-2"]);
    state = undoDraft(state);
    expect(Object.keys(state.drafts)).toEqual(["alu-1"]);
  });

  it("descartar o rascunho de um estudante sem tocar no fato oficial", () => {
    let state = applyDraftValue(emptyDraftState, "alu-1", "8", { kind: "numerica", value: 8 });
    state = discardDraftValue(state, "alu-1", "descartado");
    expect(state.drafts["alu-1"]).toBeUndefined();
    expect(recorded.currentValue).toEqual({ kind: "numerica", value: 7 });
    expect(recorded.currentVersionId).toBe("ver-1");
  });
});

describe("balanço do laboratório", () => {
  it("separar balanço oficial de alterações locais e não falar em pendência", () => {
    const balance = {
      totalStudents: 3,
      recordedCount: 1,
      unrecordedCount: 1,
      notApplicableCount: 1,
      summaryLabel: "1 registrado · 1 sem registro · 1 não aplicável",
    };
    const state = applyDraftValue(emptyDraftState, "alu-2", "9", { kind: "numerica", value: 9 });
    const summary = summarizeDraft(balance, roster, state.drafts);
    expect(summary.official.recordedCount).toBe(1);
    expect(summary.localChangeCount).toBe(1);
    expect(summary.draftLabel).not.toMatch(/pend/i);
    expect(summarizeDraft(balance, roster, {}).draftLabel).toMatch(/Nenhuma alteração local/);
  });
});
