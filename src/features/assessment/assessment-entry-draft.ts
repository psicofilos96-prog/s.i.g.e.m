/**
 * Etapa 6D.3.2.2 — Rascunho da sessão de lançamento (laboratório).
 *
 * Camada intermediária entre a PROJEÇÃO NORMATIVA (6D.3.2.1) e a superfície.
 * Ela NÃO registra fato oficial, não cria `AssessmentEntryVersion`, não decide
 * escala, elegibilidade, motivo admissível nem significado de vazio.
 *
 * Invariantes congelados:
 * 1. Quatro coisas distintas: fato oficial vigente (versões), projeção da pauta,
 *    RASCUNHO DA SESSÃO (este módulo) e ato de registro (6D.3.2.3, ausente aqui).
 * 2. A diferença é SEMÂNTICA, nunca `dirty`: voltar ao valor oficial remove a
 *    célula do conjunto de alterações locais.
 * 3. Navegação opera sobre `operationalSequence` derivada, nunca sobre índices
 *    da tabela: linha `not-applicable` permanece visível e simplesmente não
 *    existe para o controlador de lançamento.
 * 4. Nenhuma operação coletiva produz resultado avaliativo. Só operações
 *    semanticamente neutras: busca, desfazer, limpar alterações locais.
 * 5. Ausência de rascunho é ausência: nunca zero, nunca "não registrado".
 */
import type { EntryValue } from "./assessment-types";
import type {
  InstrumentRosterItemProjection,
  InstrumentSurfaceBalance,
} from "./assessment-entry-projection";

/** drafts[studentId] = valor em preparação. Ausência da chave = sem rascunho. */
export type AssessmentEntryDrafts = Readonly<Record<string, EntryValue>>;

export type AssessmentDraftOperation = {
  /** Frase humana da última operação, para o Desfazer. */
  label: string;
  /** Rascunho anterior à operação. */
  previous: AssessmentEntryDrafts;
};

/** Igualdade semântica entre resultados avaliativos, por natureza. */
export function entryValuesEqual(a?: EntryValue, b?: EntryValue): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "numerica" && b.kind === "numerica") return a.value === b.value;
  if (a.kind === "conceitual" && b.kind === "conceitual") return a.optionId === b.optionId;
  if (a.kind === "descritiva" && b.kind === "descritiva") return a.text.trim() === b.text.trim();
  if (a.kind === "nao-registrado" && b.kind === "nao-registrado")
    return (a.reason ?? "").trim() === (b.reason ?? "").trim();
  return false;
}

export type SemanticCellState =
  | { state: "no-local-change" }
  /** Havia fato oficial e o rascunho propõe outro valor. */
  | { state: "local-change"; official: EntryValue; draft: EntryValue }
  /** Não havia fato oficial e o rascunho prepara o primeiro. */
  | { state: "local-preparation"; draft: EntryValue };

/**
 * Compara rascunho e fato oficial vigente. Interação sem diferença real não
 * conta como alteração — é o que a 6D.3.2.3 precisará para saber o que
 * realmente teria de ser registrado.
 */
export function semanticCellState(
  item: InstrumentRosterItemProjection,
  draft?: EntryValue,
): SemanticCellState {
  if (!draft) return { state: "no-local-change" };
  if (!item.admissibility.eligible) return { state: "no-local-change" };
  const official = item.currentValue;
  if (!official) return { state: "local-preparation", draft };
  if (entryValuesEqual(official, draft)) return { state: "no-local-change" };
  return { state: "local-change", official, draft };
}

/** Estudantes com alteração local efetiva, na ordem da lista nominal. */
export function locallyChangedStudentIds(
  rosterItems: readonly InstrumentRosterItemProjection[],
  drafts: AssessmentEntryDrafts,
): readonly string[] {
  return rosterItems
    .filter((item) => semanticCellState(item, drafts[item.studentId]).state !== "no-local-change")
    .map((item) => item.studentId);
}

/** Filtro de visualização: preserva ordem e nunca toca no rascunho. */
export function filterRosterItems(
  rosterItems: readonly InstrumentRosterItemProjection[],
  query: string,
): readonly InstrumentRosterItemProjection[] {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  if (term.length < 2) return rosterItems;
  return rosterItems.filter(
    (item) =>
      item.displayName.toLocaleLowerCase("pt-BR").includes(term) ||
      String(item.rollNumber ?? "").includes(term),
  );
}

/**
 * Sequência operacional: apenas linhas navegáveis/lançáveis. Linha não
 * aplicável continua visível na tabela, mas fora daqui.
 */
export function operationalSequence(
  visibleItems: readonly InstrumentRosterItemProjection[],
): readonly string[] {
  return visibleItems
    .filter((item) => item.entryState !== "not-applicable" && item.admissibility.eligible)
    .map((item) => item.studentId);
}

/** Vizinho na sequência operacional; nunca aritmética sobre índice da tabela. */
export function stepOperational(
  sequence: readonly string[],
  currentId: string | undefined,
  delta: number,
): string | undefined {
  if (sequence.length === 0) return undefined;
  if (!currentId) return sequence[0];
  const index = sequence.indexOf(currentId);
  if (index === -1) return sequence[0];
  const next = index + delta;
  if (next < 0 || next >= sequence.length) return sequence[index];
  return sequence[next];
}

export type AssessmentDraftSummary = {
  /** Balanço dos FATOS OFICIAIS, projetado — não misturado com rascunho. */
  official: InstrumentSurfaceBalance;
  localChangeCount: number;
  /** Frase neutra do estado do rascunho; sem a palavra "pendência". */
  draftLabel: string;
};

export function summarizeDraft(
  balance: InstrumentSurfaceBalance,
  rosterItems: readonly InstrumentRosterItemProjection[],
  drafts: AssessmentEntryDrafts,
): AssessmentDraftSummary {
  const localChangeCount = locallyChangedStudentIds(rosterItems, drafts).length;
  return {
    official: balance,
    localChangeCount,
    draftLabel:
      localChangeCount === 0
        ? "Nenhuma alteração local preparada."
        : `${localChangeCount} ${localChangeCount === 1 ? "alteração local preparada" : "alterações locais preparadas"}, ainda não concluída${localChangeCount === 1 ? "" : "s"}.`,
  };
}

/* ------------------------------------------------------- reduções do rascunho */

export type AssessmentDraftState = {
  drafts: AssessmentEntryDrafts;
  undoStack: readonly AssessmentDraftOperation[];
};

export const emptyDraftState: AssessmentDraftState = { drafts: {}, undoStack: [] };

function commit(
  state: AssessmentDraftState,
  label: string,
  next: AssessmentEntryDrafts,
): AssessmentDraftState {
  return { drafts: next, undoStack: [...state.undoStack, { label, previous: state.drafts }] };
}

/** Lança um valor no rascunho de um estudante. Nada é inferido. */
export function applyDraftValue(
  state: AssessmentDraftState,
  studentId: string,
  label: string,
  value: EntryValue,
): AssessmentDraftState {
  if (entryValuesEqual(state.drafts[studentId], value)) return state;
  return commit(state, label, { ...state.drafts, [studentId]: value });
}

/** Remove o rascunho local: volta a exibir apenas o fato oficial vigente. */
export function discardDraftValue(
  state: AssessmentDraftState,
  studentId: string,
  label: string,
): AssessmentDraftState {
  if (!(studentId in state.drafts)) return state;
  const next = { ...state.drafts };
  delete next[studentId];
  return commit(state, label, next);
}

/** Operação coletiva semanticamente neutra: descarta as alterações locais. */
export function clearAllDrafts(state: AssessmentDraftState): AssessmentDraftState {
  if (Object.keys(state.drafts).length === 0) return state;
  return commit(state, "Alterações locais descartadas", {});
}

export function undoDraft(state: AssessmentDraftState): AssessmentDraftState {
  const last = state.undoStack[state.undoStack.length - 1];
  if (!last) return state;
  return { drafts: last.previous, undoStack: state.undoStack.slice(0, -1) };
}
