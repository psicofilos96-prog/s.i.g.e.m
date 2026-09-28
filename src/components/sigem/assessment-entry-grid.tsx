/**
 * SIGEM Human Interface Language — primitivas da pauta de lançamento avaliativo
 * (Rodada 6D.3.2.2, laboratório de rascunho).
 *
 * Regras desta camada:
 *  - Esta camada NÃO decide o que é uma avaliação. Ela recebe a projeção da
 *    6D.3.2.1 e apenas escolhe o controle visual correspondente ao `inputMode`
 *    já projetado. Elegibilidade, escala, motivos admissíveis, significado de
 *    vazio e valor oficial pertencem ao contrato anterior.
 *  - Nenhum fato oficial é criado, alterado ou registrado aqui. O ato de
 *    registro é da 6D.3.2.3.
 *  - `not-applicable` é contexto: a linha permanece visível, não recebe foco na
 *    sequência de lançamento e não interrompe a navegação rápida.
 *  - Nenhuma operação coletiva produz resultado avaliativo. Só busca, desfazer e
 *    descarte de alterações locais.
 *
 * Documentação normativa: docs/human-interface-language.md
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EntryValue } from "@/features/assessment/assessment-types";
import {
  validateInstrumentEntryDraft,
  validateMissingEntryDraft,
  type InstrumentInputMode,
  type InstrumentRosterItemProjection,
  type InstrumentSurfaceBalance,
  type MissingEntryPolicyProjection,
} from "@/features/assessment/assessment-entry-projection";
import {
  applyDraftValue,
  clearAllDrafts,
  discardDraftValue,
  emptyDraftState,
  filterRosterItems,
  operationalSequence,
  semanticCellState,
  stepOperational,
  summarizeDraft,
  undoDraft,
  type AssessmentDraftState,
  type AssessmentDraftSummary,
} from "@/features/assessment/assessment-entry-draft";

/* ------------------------------------------------------ rótulo de exibição */

/** Apresentação de um valor: nunca reinterpreta a semântica projetada. */
export function entryValueLabel(value: EntryValue, mode: InstrumentInputMode): string {
  if (value.kind === "numerica") return String(value.value).replace(".", ",");
  if (value.kind === "conceitual") {
    const option =
      mode.kind === "conceitual" ? mode.options.find((item) => item.id === value.optionId) : undefined;
    return option?.label ?? value.optionId;
  }
  if (value.kind === "descritiva") return value.text;
  return value.reason ? `Não registrado · ${value.reason}` : "Não registrado";
}

/** Texto bruto inicial do editor a partir do valor em rascunho ou oficial. */
function rawFromValue(value: EntryValue | undefined, mode: InstrumentInputMode): string {
  if (!value) return "";
  if (value.kind === "numerica" && mode.kind === "numerica")
    return String(value.value).replace(".", ",");
  if (value.kind === "descritiva" && mode.kind === "descritiva") return value.text;
  return "";
}

/* ---------------------------------------------- rascunho da sessão (React) */

export function useAssessmentEntryDraft(options: {
  rosterItems: readonly InstrumentRosterItemProjection[];
  balance: InstrumentSurfaceBalance;
  inputMode: InstrumentInputMode;
}) {
  const { rosterItems, balance, inputMode } = options;
  const [state, setState] = useState<AssessmentDraftState>(emptyDraftState);

  const setValue = useCallback(
    (studentId: string, value: EntryValue) => {
      const item = rosterItems.find((row) => row.studentId === studentId);
      if (!item || !item.admissibility.eligible) return;
      setState((current) =>
        applyDraftValue(
          current,
          studentId,
          `${item.displayName} · ${entryValueLabel(value, inputMode)}`,
          value,
        ),
      );
    },
    [inputMode, rosterItems],
  );

  const discardValue = useCallback(
    (studentId: string) => {
      const item = rosterItems.find((row) => row.studentId === studentId);
      setState((current) =>
        discardDraftValue(
          current,
          studentId,
          `${item?.displayName ?? "Estudante"} · alteração local descartada`,
        ),
      );
    },
    [rosterItems],
  );

  const clearAll = useCallback(() => setState((current) => clearAllDrafts(current)), []);
  const undo = useCallback(() => setState((current) => undoDraft(current)), []);

  const summary = useMemo<AssessmentDraftSummary>(
    () => summarizeDraft(balance, rosterItems, state.drafts),
    [balance, rosterItems, state.drafts],
  );

  const lastOperation = state.undoStack[state.undoStack.length - 1];

  return {
    drafts: state.drafts,
    summary,
    setValue,
    discardValue,
    clearAll,
    undo,
    canUndo: state.undoStack.length > 0,
    lastOperationLabel: lastOperation?.label,
  };
}

/* ------------------------------------------------- controlador de teclado */

/**
 * Navegação sobre a SEQUÊNCIA OPERACIONAL projetada: linha não aplicável é
 * saltada porque não existe para o lançamento. Avanço automático ocorre apenas
 * após entrada válida — quem valida é `validateInstrumentEntryDraft`.
 */
export function useAssessmentEntryKeyboard(visibleItems: readonly InstrumentRosterItemProjection[]) {
  const sequence = useMemo(() => operationalSequence(visibleItems), [visibleItems]);
  const [focusedId, setFocusedId] = useState<string | undefined>(sequence[0]);
  const refs = useRef(new Map<string, HTMLElement | null>());

  const focus = useCallback((studentId?: string) => {
    if (!studentId) return;
    setFocusedId(studentId);
    refs.current.get(studentId)?.focus();
  }, []);

  const step = useCallback(
    (studentId: string, delta: number) => {
      focus(stepOperational(sequence, studentId, delta));
    },
    [focus, sequence],
  );

  const registerEditor = useCallback(
    (studentId: string) => (element: HTMLElement | null) => {
      refs.current.set(studentId, element);
    },
    [],
  );

  return { sequence, focusedId, focus, step, registerEditor, setFocusedId };
}

/* ----------------------------------------------------------- barra rápida */

export function AssessmentEntryQuickBar({
  contextLabel,
  summary,
  search,
  onUndo,
  canUndo,
  lastOperationLabel,
  onClearLocalChanges,
  persistenceNote,
}: {
  contextLabel: string;
  summary: AssessmentDraftSummary;
  search?: ReactNode | undefined;
  onUndo?: (() => void) | undefined;
  canUndo?: boolean | undefined;
  lastOperationLabel?: string | undefined;
  onClearLocalChanges?: (() => void) | undefined;
  persistenceNote?: string | undefined;
}) {
  const { official } = summary;
  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur"
      data-testid="assessment-entry-quick-bar"
    >
      <p className="text-sm font-medium leading-tight">{contextLabel}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums">
          <strong className="text-base">{official.recordedCount}</strong>{" "}
          <span className="text-muted-foreground">registrados</span>
        </span>
        <span className="tabular-nums">
          <strong className="text-base">{official.unrecordedCount}</strong>{" "}
          <span className="text-muted-foreground">sem registro</span>
        </span>
        <span className="tabular-nums">
          <strong className="text-base">{official.notApplicableCount}</strong>{" "}
          <span className="text-muted-foreground">não aplicáveis</span>
        </span>
      </div>
      {search}
      <div className="flex flex-wrap items-center gap-2">
        {canUndo && onUndo && (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onUndo}>
            <RotateCcw /> Desfazer
          </Button>
        )}
        {summary.localChangeCount > 0 && onClearLocalChanges && (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClearLocalChanges}>
            Descartar alterações locais
          </Button>
        )}
        {lastOperationLabel && (
          <span className="text-xs text-muted-foreground" role="status">
            {lastOperationLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {summary.draftLabel}
      </p>
      {persistenceNote && <p className="text-xs text-muted-foreground">{persistenceNote}</p>}
    </div>
  );
}

export function AssessmentEntrySearch({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (next: string) => void;
  resultCount?: number | undefined;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 pl-8"
          placeholder="Localizar estudante pelo nome"
          aria-label="Localizar estudante pelo nome"
          autoComplete="off"
        />
      </div>
      {value !== "" && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
        >
          <X />
        </Button>
      )}
      {value.trim().length >= 2 && (
        <span className="text-xs text-muted-foreground" role="status">
          {resultCount === 1 ? "1 estudante" : `${resultCount ?? 0} estudantes`}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- editores */

type EditorProps = {
  studentId: string;
  studentName: string;
  mode: InstrumentInputMode;
  draft?: EntryValue | undefined;
  official?: EntryValue | undefined;
  onCommit: (value: EntryValue) => void;
  onDiscardDraft: () => void;
  onNavigate: (delta: number) => void;
  onFocus: () => void;
  editorRef: (element: HTMLElement | null) => void;
};

function NumericEntryEditor(props: EditorProps) {
  const { mode } = props;
  const [raw, setRaw] = useState(() => rawFromValue(props.draft ?? props.official, mode));
  const [error, setError] = useState<string | undefined>(undefined);
  if (mode.kind !== "numerica") return null;

  const commit = (): boolean => {
    const result = validateInstrumentEntryDraft(mode, raw);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(undefined);
    props.onCommit(result.value);
    return true;
  };

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Input
        ref={props.editorRef as (element: HTMLInputElement | null) => void}
        value={raw}
        inputMode="decimal"
        autoComplete="off"
        aria-label={`Resultado de ${props.studentName} (${mode.formatLabel})`}
        aria-invalid={error ? true : undefined}
        data-testid={`assessment-numeric-${props.studentId}`}
        className="min-h-11 w-24 text-right tabular-nums"
        onFocus={props.onFocus}
        onChange={(event) => {
          setRaw(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (commit()) props.onNavigate(1);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            if (raw.trim() === "") {
              props.onNavigate(delta);
              return;
            }
            if (commit()) props.onNavigate(delta);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setRaw(rawFromValue(props.official, mode));
            setError(undefined);
            props.onDiscardDraft();
          }
        }}
      />
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function ConceptualEntryEditor(props: EditorProps) {
  const { mode } = props;
  const current = props.draft ?? props.official;
  const currentId = current?.kind === "conceitual" ? current.optionId : undefined;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    mode.kind === "conceitual"
      ? Math.max(
          0,
          mode.options.findIndex((option) => option.id === currentId),
        )
      : 0,
  );
  if (mode.kind !== "conceitual") return null;

  const confirm = (index: number) => {
    const option = mode.options[index];
    if (!option) return;
    const result = validateInstrumentEntryDraft(mode, option.id);
    if (!result.ok) return;
    props.onCommit(result.value);
    setOpen(false);
    props.onNavigate(1);
  };

  return (
    <div className="relative flex min-w-0 flex-col items-end gap-1">
      <Button
        ref={props.editorRef as (element: HTMLButtonElement | null) => void}
        type="button"
        variant={currentId ? "secondary" : "outline"}
        className="min-h-11 min-w-24"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Conceito de ${props.studentName}`}
        data-testid={`assessment-conceptual-${props.studentId}`}
        onFocus={props.onFocus}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (open) {
              setOpen(false);
              return;
            }
            props.onDiscardDraft();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            if (!open) {
              props.onNavigate(delta);
              return;
            }
            setHighlight((index) =>
              Math.min(Math.max(index + delta, 0), mode.options.length - 1),
            );
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            confirm(highlight);
            return;
          }
          if (event.key.length === 1 && /\p{L}/u.test(event.key)) {
            // Busca incremental acessível entre rótulos: letra NÃO é atalho
            // institucional e não carrega significado avaliativo.
            const term = event.key.toLocaleLowerCase("pt-BR");
            const index = mode.options.findIndex((option) =>
              option.label.toLocaleLowerCase("pt-BR").startsWith(term),
            );
            if (index >= 0) {
              event.preventDefault();
              setOpen(true);
              setHighlight(index);
            }
          }
        }}
      >
        {currentId
          ? entryValueLabel({ kind: "conceitual", optionId: currentId }, mode)
          : "Selecionar"}
      </Button>
      {open && (
        <ul
          role="listbox"
          aria-label={`Conceitos admissíveis para ${props.studentName}`}
          className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {mode.options.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={cn(
                  "flex min-h-11 w-full items-center px-3 text-left text-sm",
                  index === highlight && "bg-accent text-accent-foreground",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => confirm(index)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DescriptiveEntryEditor(props: EditorProps) {
  const { mode } = props;
  const [raw, setRaw] = useState(() => rawFromValue(props.draft ?? props.official, mode));
  const [error, setError] = useState<string | undefined>(undefined);
  if (mode.kind !== "descritiva") return null;

  const commit = (): boolean => {
    const result = validateInstrumentEntryDraft(mode, raw);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(undefined);
    props.onCommit(result.value);
    return true;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Textarea
        ref={props.editorRef as (element: HTMLTextAreaElement | null) => void}
        value={raw}
        rows={2}
        aria-label={`Registro descritivo de ${props.studentName}`}
        aria-invalid={error ? true : undefined}
        data-testid={`assessment-descriptive-${props.studentId}`}
        placeholder={mode.placeholder}
        className="min-h-11"
        onFocus={props.onFocus}
        onChange={(event) => {
          setRaw(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (commit()) props.onNavigate(1);
            return;
          }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.altKey) {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            if (raw.trim() === "") {
              props.onNavigate(delta);
              return;
            }
            if (commit()) props.onNavigate(delta);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setError(undefined);
          }
        }}
      />
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------- "não registrado" */

export function MissingEntryAction({
  studentId,
  studentName,
  policy,
  onCommit,
}: {
  studentId: string;
  studentName: string;
  policy: MissingEntryPolicyProjection;
  onCommit: (value: EntryValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState<string | undefined>(undefined);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const confirm = () => {
    const result = validateMissingEntryDraft(policy, {
      ...(reasonId ? { reasonId } : {}),
      ...(custom.trim() ? { customReason: custom } : {}),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setOpen(false);
    onCommit(result.value);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 text-xs"
        data-testid={`assessment-missing-${studentId}`}
        onClick={() => setOpen(true)}
      >
        Não registrado
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-xs text-muted-foreground">Motivo de “não registrado” · {studentName}</p>
      {policy.admissibleReasons.map((reason) => (
        <Button
          key={reason.id}
          type="button"
          variant={reasonId === reason.id ? "secondary" : "outline"}
          className="min-h-11 text-xs"
          onClick={() => {
            setReasonId(reason.id);
            setCustom("");
          }}
        >
          {reason.label}
        </Button>
      ))}
      {policy.allowsCustomReason && (
        <Input
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            setReasonId(undefined);
          }}
          className="min-h-11"
          placeholder="Motivo"
          aria-label={`Motivo de não registrado para ${studentName}`}
        />
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="min-h-11"
          data-testid={`assessment-missing-confirm-${studentId}`}
          onClick={confirm}
        >
          Confirmar
        </Button>
      </div>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ linha */

export function AssessmentEntryRow({
  item,
  mode,
  policy,
  draft,
  focused,
  onCommit,
  onDiscardDraft,
  onNavigate,
  onFocus,
  editorRef,
}: {
  item: InstrumentRosterItemProjection;
  mode: InstrumentInputMode;
  policy: MissingEntryPolicyProjection;
  draft?: EntryValue | undefined;
  focused?: boolean | undefined;
  onCommit: (value: EntryValue) => void;
  onDiscardDraft: () => void;
  onNavigate: (delta: number) => void;
  onFocus: () => void;
  editorRef: (element: HTMLElement | null) => void;
}) {
  const cell = semanticCellState(item, draft);
  const notApplicable = item.entryState === "not-applicable";

  const editorProps: EditorProps = {
    studentId: item.studentId,
    studentName: item.displayName,
    mode,
    ...(draft ? { draft } : {}),
    ...(item.currentValue ? { official: item.currentValue } : {}),
    onCommit,
    onDiscardDraft,
    onNavigate,
    onFocus,
    editorRef,
  };

  return (
    <div
      role="row"
      data-testid={`assessment-row-${item.studentId}`}
      data-entry-state={item.entryState}
      data-local-change={cell.state === "no-local-change" ? "nao" : "sim"}
      className={cn(
        "flex min-h-[3.375rem] items-start gap-3 border-b px-3 py-2",
        notApplicable && "bg-muted/30",
        focused && !notApplicable && "ring-2 ring-ring",
      )}
    >
      <span className="w-7 shrink-0 pt-2 text-right text-sm tabular-nums text-muted-foreground">
        {item.rollNumber ?? "–"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-medium leading-tight">
          {item.displayName}
        </span>
        {notApplicable ? (
          <span className="block text-xs text-muted-foreground">
            {item.admissibility.blockerReason ?? "Não aplicável a este instrumento."}
          </span>
        ) : (
          <span className="block text-xs text-muted-foreground">
            {item.currentDisplayLabel
              ? `Registro oficial vigente: ${item.currentDisplayLabel}`
              : "Sem registro oficial."}
            {cell.state === "local-change" && " · alteração local preparada"}
            {cell.state === "local-preparation" && " · lançamento local preparado"}
          </span>
        )}
      </span>
      {!notApplicable && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {mode.kind === "numerica" && <NumericEntryEditor {...editorProps} />}
          {mode.kind === "conceitual" && <ConceptualEntryEditor {...editorProps} />}
          {mode.kind === "descritiva" && <DescriptiveEntryEditor {...editorProps} />}
          <MissingEntryAction
            studentId={item.studentId}
            studentName={item.displayName}
            policy={policy}
            onCommit={onCommit}
          />
          {draft && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-xs"
              data-testid={`assessment-discard-${item.studentId}`}
              onClick={onDiscardDraft}
            >
              Descartar alteração
            </Button>
          )}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ grade */

export function AssessmentEntryGrid({
  rosterItems,
  mode,
  policy,
  drafts,
  focusedId,
  onCommit,
  onDiscardDraft,
  onNavigate,
  onFocus,
  registerEditor,
}: {
  rosterItems: readonly InstrumentRosterItemProjection[];
  mode: InstrumentInputMode;
  policy: MissingEntryPolicyProjection;
  drafts: Readonly<Record<string, EntryValue>>;
  focusedId?: string | undefined;
  onCommit: (studentId: string, value: EntryValue) => void;
  onDiscardDraft: (studentId: string) => void;
  onNavigate: (studentId: string, delta: number) => void;
  onFocus: (studentId: string) => void;
  registerEditor: (studentId: string) => (element: HTMLElement | null) => void;
}) {
  return (
    <div role="rowgroup" data-testid="assessment-entry-grid">
      {rosterItems.map((item) => (
        <AssessmentEntryRow
          key={item.studentId}
          item={item}
          mode={mode}
          policy={policy}
          {...(drafts[item.studentId] ? { draft: drafts[item.studentId] } : {})}
          focused={focusedId === item.studentId}
          onCommit={(value) => onCommit(item.studentId, value)}
          onDiscardDraft={() => onDiscardDraft(item.studentId)}
          onNavigate={(delta) => onNavigate(item.studentId, delta)}
          onFocus={() => onFocus(item.studentId)}
          editorRef={registerEditor(item.studentId)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ laboratório */

/**
 * Composição de referência da pauta: projeção → renderização → digitação →
 * validação → navegação → rascunho → desfazer. ZERO fato oficial novo.
 */
export function AssessmentEntryWorkspace({
  contextLabel,
  rosterItems,
  mode,
  policy,
  persistenceNote,
}: {
  contextLabel: string;
  rosterItems: readonly InstrumentRosterItemProjection[];
  mode: InstrumentInputMode;
  policy: MissingEntryPolicyProjection;
  persistenceNote?: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => filterRosterItems(rosterItems, query), [rosterItems, query]);
  const balance = useMemo<InstrumentSurfaceBalance>(() => {
    const recordedCount = rosterItems.filter((item) => item.entryState === "recorded").length;
    const unrecordedCount = rosterItems.filter((item) => item.entryState === "unrecorded").length;
    const notApplicableCount = rosterItems.filter(
      (item) => item.entryState === "not-applicable",
    ).length;
    return {
      totalStudents: rosterItems.length,
      recordedCount,
      unrecordedCount,
      notApplicableCount,
      summaryLabel: `${recordedCount} registrados · ${unrecordedCount} sem registro · ${notApplicableCount} não aplicáveis`,
    };
  }, [rosterItems]);

  const draft = useAssessmentEntryDraft({ rosterItems, balance, inputMode: mode });
  const keyboard = useAssessmentEntryKeyboard(visibleItems);

  return (
    <div className="flex flex-col">
      <AssessmentEntryQuickBar
        contextLabel={contextLabel}
        summary={draft.summary}
        canUndo={draft.canUndo}
        onUndo={draft.undo}
        onClearLocalChanges={draft.clearAll}
        {...(draft.lastOperationLabel ? { lastOperationLabel: draft.lastOperationLabel } : {})}
        persistenceNote={
          persistenceNote ??
          "Laboratório de preparação: as alterações locais ainda não foram concluídas nem registradas."
        }
        search={
          <AssessmentEntrySearch
            value={query}
            onChange={setQuery}
            resultCount={visibleItems.length}
          />
        }
      />
      <AssessmentEntryGrid
        rosterItems={visibleItems}
        mode={mode}
        policy={policy}
        drafts={draft.drafts}
        {...(keyboard.focusedId ? { focusedId: keyboard.focusedId } : {})}
        onCommit={draft.setValue}
        onDiscardDraft={draft.discardValue}
        onNavigate={keyboard.step}
        onFocus={keyboard.setFocusedId}
        registerEditor={keyboard.registerEditor}
      />
    </div>
  );
}
