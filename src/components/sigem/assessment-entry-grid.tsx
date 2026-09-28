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
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { MoreHorizontal, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
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
  homonymDiscriminators,
  quickEntrySequence,
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
      // 6D.3.2.7 — o texto do parecer existe UMA vez, no editor. O status
      // global da pauta nunca o reproduz.
      const label =
        inputMode.kind === "descritiva"
          ? `${item.displayName} · alteração local`
          : `${item.displayName} · ${entryValueLabel(value, inputMode)}`;
      setState((current) => applyDraftValue(current, studentId, label, value));
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
  /**
   * Após o registro oficial, os rascunhos efetivados deixam de existir: a
   * verdade volta ao domínio. A pilha de desfazer é reiniciada, pois desfazer
   * além de um ato oficial ressuscitaria rascunhos já registrados.
   */
  const dropDrafts = useCallback((studentIds: readonly string[]) => {
    const gone = new Set(studentIds);
    setState((current) => ({
      drafts: Object.fromEntries(Object.entries(current.drafts).filter(([id]) => !gone.has(id))),
      undoStack: [],
    }));
  }, []);

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
    dropDrafts,
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
export function useAssessmentEntryKeyboard(
  visibleItems: readonly InstrumentRosterItemProjection[],
  sequenceOverride?: readonly string[],
) {
  const derived = useMemo(() => operationalSequence(visibleItems), [visibleItems]);
  const sequence = sequenceOverride ?? derived;
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
            Última alteração: {lastOperationLabel}
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
  /** Ctrl/Cmd+Z — desfazer a última alteração local (controlador do rascunho). */
  onUndo?: (() => void) | undefined;
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
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            props.onUndo?.();
            return;
          }
          if (event.key === "Escape") {
            // 6D.3.2.7 — abandona a edição sem criar alteração nova,
            // preservando eventual rascunho anterior.
            event.preventDefault();
            setError(undefined);
            setRaw(rawFromValue(props.draft, mode));
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
  unlocked,
  discriminator,
  correctionSlot,
  onRequestCorrection,
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
  /** Entrada consciente em "Corrigir resultado" já realizada nesta linha. */
  unlocked?: boolean | undefined;
  discriminator?: string | undefined;
  correctionSlot?: ReactNode;
  onRequestCorrection?: (() => void) | undefined;
  onCommit: (value: EntryValue) => void;
  onDiscardDraft: () => void;
  onNavigate: (delta: number) => void;
  onFocus: () => void;
  editorRef: (element: HTMLElement | null) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const cell = semanticCellState(item, draft);
  const notApplicable = item.entryState === "not-applicable";
  // Fato oficial é referência protegida: sem ação consciente não há editor.
  const protectedOfficial = !notApplicable && !!item.currentValue && !draft && !unlocked;

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

  const draftLabel = draft ? entryValueLabel(draft, mode) : undefined;

  return (
    <div
      role="row"
      data-testid={`assessment-row-${item.studentId}`}
      data-entry-state={item.entryState}
      data-local-change={cell.state === "no-local-change" ? "nao" : "sim"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5",
        notApplicable && "bg-muted/30",
        focused && !notApplicable && !protectedOfficial && "ring-2 ring-ring",
      )}
    >
      <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {item.rollNumber ?? "–"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[0.95rem] font-medium leading-snug" title={item.displayName}>
          {item.displayName}
        </span>
        {discriminator && (
          <span className="block text-xs font-medium" data-testid={`assessment-discriminator-${item.studentId}`}>
            {discriminator}
          </span>
        )}
        {notApplicable ? (
          <span className="block text-xs text-muted-foreground">
            Não se aplica · {item.admissibility.blockerReason ?? "Não aplicável a este instrumento."}
          </span>
        ) : (
          <span className="block text-xs text-muted-foreground">
            {item.currentDisplayLabel ? `Registrado: ${item.currentDisplayLabel}` : "Sem registro oficial."}
            {/* 6D.3.2.7 — o texto do rascunho existe uma vez, no editor. */}
            {cell.state === "local-change" &&
              (draft?.kind === "descritiva"
                ? " · Alteração local preparada (ainda não registrada)."
                : ` · alteração local preparada: ${draftLabel} (ainda não registrada)`)}
            {cell.state === "local-preparation" &&
              (draft?.kind === "descritiva"
                ? " · Alteração local preparada (ainda não registrada)."
                : ` · lançamento local preparado: ${draftLabel} (ainda não registrado)`)}
          </span>
        )}
      </span>
      {protectedOfficial && (
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums" aria-hidden>
            {item.currentDisplayLabel}
          </span>
          {onRequestCorrection && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-testid={`assessment-correct-${item.studentId}`}
              aria-label={`Corrigir resultado de ${item.displayName}`}
              onClick={onRequestCorrection}
            >
              Corrigir
            </Button>
          )}
        </span>
      )}
      {!notApplicable && !protectedOfficial && (
        <span className="flex shrink-0 items-center gap-1">
          {mode.kind === "numerica" && <NumericEntryEditor {...editorProps} />}
          {mode.kind === "conceitual" && <ConceptualEntryEditor {...editorProps} />}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 px-2"
            aria-expanded={moreOpen}
            aria-label={`Mais ações para ${item.displayName}`}
            data-testid={`assessment-row-more-${item.studentId}`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreHorizontal />
          </Button>
        </span>
      )}
      {!notApplicable && !protectedOfficial && mode.kind === "descritiva" && (
        <div className="basis-full pl-10">
          <DescriptiveEntryEditor {...editorProps} />
        </div>
      )}
      {moreOpen && !notApplicable && !protectedOfficial && (
        <div className="flex basis-full flex-wrap justify-end gap-2 pb-1">
          <MissingEntryAction
            studentId={item.studentId}
            studentName={item.displayName}
            policy={policy}
            onCommit={(value) => {
              onCommit(value);
              setMoreOpen(false);
            }}
          />
          {draft && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-xs"
              data-testid={`assessment-discard-${item.studentId}`}
              onClick={() => {
                onDiscardDraft();
                setMoreOpen(false);
              }}
            >
              Descartar alteração
            </Button>
          )}
        </div>
      )}
      {correctionSlot && <div className="basis-full pb-2">{correctionSlot}</div>}
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
  unlockedIds,
  discriminators,
  correctingStudentId,
  renderCorrection,
  onRequestCorrection,
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
  unlockedIds?: ReadonlySet<string>;
  discriminators?: ReadonlyMap<string, string>;
  correctingStudentId?: string | undefined;
  renderCorrection?: ((item: InstrumentRosterItemProjection) => ReactNode) | undefined;
  onRequestCorrection?: ((studentId: string) => void) | undefined;
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
          unlocked={unlockedIds?.has(item.studentId)}
          discriminator={discriminators?.get(item.studentId)}
          correctionSlot={
            correctingStudentId === item.studentId && renderCorrection ? renderCorrection(item) : undefined
          }
          onRequestCorrection={onRequestCorrection ? () => onRequestCorrection(item.studentId) : undefined}
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

type AssessmentEntryWorkspaceProps = {
  contextLabel: string;
  rosterItems: readonly InstrumentRosterItemProjection[];
  mode: InstrumentInputMode;
  policy: MissingEntryPolicyProjection;
  persistenceNote?: string | undefined;
  /** Rascunho controlado por quem conduz o registro (6D.3.2.3b). */
  draftController?: AssessmentEntryDraftController;
  footer?: ReactNode;
  /**
   * Correção focal na própria linha. Sem `onRequestCorrection` externo,
   * "Corrigir" libera o editor da linha como correção preparada nesta sessão.
   */
  correctingStudentId?: string | undefined;
  renderCorrection?: ((item: InstrumentRosterItemProjection) => ReactNode) | undefined;
  onRequestCorrection?: ((studentId: string) => void) | undefined;
  /** Ação natural após o fim da pauta descritiva: abrir a conferência (6D.3.2.7). */
  onRequestReview?: (() => void) | undefined;
};

/**
 * 6D.3.2.7 — Gramática cognitiva ≠ modo de interação. A mesma gramática
 * Executar escolhe a geometria pelo `inputMode` projetado: grade compacta para
 * numérico e conceitual; lista nominal + editor focal para o descritivo.
 * Projeção, rascunho, teclado e registro são os contratos homologados.
 */
export function AssessmentEntryWorkspace(props: AssessmentEntryWorkspaceProps) {
  if (props.mode.kind === "descritiva")
    return <AssessmentEntryDescriptiveWorkspace {...props} />;
  return <AssessmentEntryGridWorkspace {...props} />;
}

/**
 * Composição de referência da pauta (numérica/conceitual): projeção →
 * renderização → digitação → validação → navegação → rascunho → desfazer.
 * ZERO fato oficial novo.
 */
function AssessmentEntryGridWorkspace({
  contextLabel,
  rosterItems,
  mode,
  policy,
  persistenceNote,
  draftController,
  footer,
  correctingStudentId,
  renderCorrection,
  onRequestCorrection,
}: AssessmentEntryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set());
  const [lastId, setLastId] = useState<string | undefined>(undefined);
  const [gridFocused, setGridFocused] = useState(false);
  const visibleItems = useMemo(() => filterRosterItems(rosterItems, query), [rosterItems, query]);
  const discriminators = useMemo(() => homonymDiscriminators(rosterItems), [rosterItems]);
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

  const internalDraft = useAssessmentEntryDraft({ rosterItems, balance, inputMode: mode });
  const draft = draftController ?? internalDraft;
  const sequence = useMemo(
    () => quickEntrySequence(visibleItems, draft.drafts, unlocked),
    [visibleItems, draft.drafts, unlocked],
  );
  const keyboard = useAssessmentEntryKeyboard(visibleItems, sequence);

  const requestCorrection = (studentId: string) => {
    if (onRequestCorrection) {
      onRequestCorrection(studentId);
      return;
    }
    setUnlocked((current) => new Set([...current, studentId]));
    setTimeout(() => keyboard.focus(studentId), 0);
  };

  const lastItem = lastId ? rosterItems.find((item) => item.studentId === lastId) : undefined;
  const showResume = !!lastItem && !gridFocused && sequence.includes(lastItem.studentId);

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
          draft.summary.localChangeCount > 0
            ? (persistenceNote ??
              "Laboratório de preparação: as alterações locais ainda não foram concluídas nem registradas.")
            : undefined
        }
        search={
          <div className="flex flex-col gap-2">
            <AssessmentEntrySearch
              value={query}
              onChange={setQuery}
              resultCount={visibleItems.length}
            />
            {showResume && lastItem && (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 justify-start"
                data-testid="assessment-resume"
                onClick={() => keyboard.focus(lastItem.studentId)}
              >
                Continuar de onde parei — {lastItem.rollNumber ? `nº ${lastItem.rollNumber}, ` : ""}
                {lastItem.displayName}
              </Button>
            )}
          </div>
        }
      />
      <div
        onFocus={() => setGridFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGridFocused(false);
        }}
      >
        <AssessmentEntryGrid
          rosterItems={visibleItems}
          mode={mode}
          policy={policy}
          drafts={draft.drafts}
          {...(keyboard.focusedId ? { focusedId: keyboard.focusedId } : {})}
          unlockedIds={unlocked}
          discriminators={discriminators}
          correctingStudentId={correctingStudentId}
          renderCorrection={renderCorrection}
          onRequestCorrection={requestCorrection}
          onCommit={draft.setValue}
          onDiscardDraft={draft.discardValue}
          onNavigate={keyboard.step}
          onFocus={(studentId) => {
            keyboard.setFocusedId(studentId);
            setLastId(studentId);
          }}
          registerEditor={keyboard.registerEditor}
        />
      </div>
      {footer}
    </div>
  );
}

export type AssessmentEntryDraftController = ReturnType<typeof useAssessmentEntryDraft>;

/* ------------------------------------------- 6D.3.2.7 — pauta descritiva focal */

/**
 * Especialização ergonômica EXCLUSIVA de `inputMode.kind === "descritiva"`:
 * escrever é tarefa de texto, não de célula. Lista nominal compacta + editor
 * focal do estudante ativo. Projeção, rascunho, versionamento, lote, teclado
 * e regras permanecem EXATAMENTE os contratos homologados — nada aqui registra
 * fato oficial e nenhuma validação própria é criada.
 */
function descriptiveListStatus(
  item: InstrumentRosterItemProjection,
  cell: SemanticCellState,
): string {
  if (item.entryState === "not-applicable") return "Não se aplica";
  if (cell.state !== "no-local-change") return "Alteração local preparada";
  if (item.entryState === "recorded")
    return item.currentDisplayLabel ? `Registrado: ${item.currentDisplayLabel}` : "Registrado";
  return "Sem registro oficial";
}

function AssessmentEntryDescriptiveWorkspace({
  contextLabel,
  rosterItems,
  mode,
  policy,
  persistenceNote,
  draftController,
  footer,
  correctingStudentId,
  renderCorrection,
  onRequestCorrection,
  onRequestReview,
}: AssessmentEntryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [lastEditedId, setLastEditedId] = useState<string | undefined>(undefined);
  const [endNotice, setEndNotice] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [editorEl, setEditorEl] = useState<HTMLTextAreaElement | null>(null);
  const isMobile = useIsMobile();

  const visibleItems = useMemo(() => filterRosterItems(rosterItems, query), [rosterItems, query]);
  const discriminators = useMemo(() => homonymDiscriminators(rosterItems), [rosterItems]);
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
  const internalDraft = useAssessmentEntryDraft({ rosterItems, balance, inputMode: mode });
  const draft = draftController ?? internalDraft;
  // Fato oficial protegido fica FORA do caminho de digitação, como homologado.
  const sequence = useMemo(
    () => quickEntrySequence(visibleItems, draft.drafts, unlocked),
    [visibleItems, draft.drafts, unlocked],
  );

  const activeItem =
    rosterItems.find((item) => item.studentId === activeId) ??
    rosterItems.find((item) => item.studentId === sequence[0]);
  const effectiveActiveId = activeItem?.studentId;

  const selectStudent = useCallback((studentId: string) => {
    setActiveId(studentId);
    setEndNotice(false);
  }, []);

  const requestCorrection = (studentId: string) => {
    if (onRequestCorrection) {
      onRequestCorrection(studentId);
      return;
    }
    setUnlocked((current) => new Set([...current, studentId]));
  };

  /**
   * Avanço pela sequência operacional. No último estudante, mantém o estado e
   * o foco e anuncia serenamente o fim da pauta — nunca abre a conferência.
   */
  const navigate = (studentId: string, delta: number) => {
    const next = stepOperational(sequence, studentId, delta);
    if (next && next !== studentId) {
      selectStudent(next);
      return;
    }
    if (delta > 0) setEndNotice(true);
  };

  const commitDraft = (studentId: string, value: EntryValue) => {
    draft.setValue(studentId, value);
    setLastEditedId(studentId);
    setEndNotice(false);
  };

  // Editor focal: o único protagonista textual do modo descritivo.
  useEffect(() => {
    editorEl?.focus();
  }, [editorEl]);

  const activeDraft = activeItem ? draft.drafts[activeItem.studentId] : undefined;
  const activeNotApplicable = activeItem?.entryState === "not-applicable";
  const activeProtected =
    !!activeItem &&
    !activeNotApplicable &&
    !!activeItem.currentValue &&
    !activeDraft &&
    !unlocked.has(activeItem.studentId);

  const lastEdited = lastEditedId
    ? rosterItems.find((item) => item.studentId === lastEditedId)
    : undefined;
  const showResume =
    !!lastEdited &&
    lastEdited.studentId !== effectiveActiveId &&
    sequence.includes(lastEdited.studentId);

  return (
    <div className="flex flex-col" data-testid="assessment-descriptive-workspace">
      <AssessmentEntryQuickBar
        contextLabel={contextLabel}
        summary={draft.summary}
        canUndo={draft.canUndo}
        onUndo={draft.undo}
        onClearLocalChanges={draft.clearAll}
        {...(draft.lastOperationLabel ? { lastOperationLabel: draft.lastOperationLabel } : {})}
        persistenceNote={
          draft.summary.localChangeCount > 0
            ? (persistenceNote ??
              "Laboratório de preparação: as alterações locais ainda não foram concluídas nem registradas.")
            : undefined
        }
        search={
          <div className="flex flex-col gap-2">
            <AssessmentEntrySearch
              value={query}
              onChange={setQuery}
              resultCount={visibleItems.length}
            />
            {showResume && lastEdited && (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 justify-start"
                data-testid="assessment-resume"
                onClick={() => selectStudent(lastEdited.studentId)}
              >
                Continuar de onde parei — {lastEdited.rollNumber ? `nº ${lastEdited.rollNumber}, ` : ""}
                {lastEdited.displayName}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 py-3">
        {/* Lista nominal compacta. No mobile, recolhe enquanto o professor escreve. */}
        <div className={cn(isMobile && listCollapsed && "hidden")}>
          <ul
            data-testid="assessment-descriptive-list"
            aria-label="Lista nominal da pauta"
            className="max-h-80 overflow-y-auto rounded-md border border-border"
          >
            {visibleItems.map((item) => {
              const status = descriptiveListStatus(
                item,
                semanticCellState(item, draft.drafts[item.studentId]),
              );
              return (
                <li key={item.studentId} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    data-testid={`assessment-descriptive-list-item-${item.studentId}`}
                    aria-current={item.studentId === effectiveActiveId ? "true" : undefined}
                    onClick={() => {
                      selectStudent(item.studentId);
                      if (isMobile) setListCollapsed(true);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left",
                      item.studentId === effectiveActiveId && "bg-accent/60",
                      item.entryState === "not-applicable" && "bg-muted/30",
                    )}
                  >
                    <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {item.rollNumber ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={item.displayName}>
                        {item.displayName}
                      </span>
                      {discriminators.get(item.studentId) && (
                        <span className="block text-xs text-muted-foreground">
                          {discriminators.get(item.studentId)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs font-medium text-muted-foreground">
                      {status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {isMobile && listCollapsed && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 self-start"
            onClick={() => setListCollapsed(false)}
          >
            Voltar à lista
          </Button>
        )}

        {activeItem && (
          <section
            aria-label={`Editor de ${activeItem.displayName}`}
            data-testid="assessment-descriptive-editor"
            className="rounded-md border border-border p-3"
          >
            <h3 className="text-base font-semibold">{activeItem.displayName}</h3>
            {!activeNotApplicable && !activeProtected && (
              <p className="text-sm text-muted-foreground">O que registrar sobre este estudante?</p>
            )}
            {activeNotApplicable ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Não se aplica ·{" "}
                {activeItem.admissibility.blockerReason ?? "Não aplicável a este instrumento."}
              </p>
            ) : activeProtected ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm">
                    Registrado: {activeItem.currentDisplayLabel ?? "—"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    data-testid={`assessment-correct-${activeItem.studentId}`}
                    onClick={() => requestCorrection(activeItem.studentId)}
                  >
                    Corrigir
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O registro oficial é referência protegida: a alteração passa pela correção
                  consciente, nunca pela sequência de lançamento.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-2">
                  <DescriptiveEntryEditor
                    key={activeItem.studentId}
                    studentId={activeItem.studentId}
                    studentName={activeItem.displayName}
                    mode={mode}
                    {...(activeDraft ? { draft: activeDraft } : {})}
                    {...(activeItem.currentValue ? { official: activeItem.currentValue } : {})}
                    onCommit={(value) => commitDraft(activeItem.studentId, value)}
                    onDiscardDraft={() => draft.discardValue(activeItem.studentId)}
                    onUndo={draft.undo}
                    onNavigate={(delta) => navigate(activeItem.studentId, delta)}
                    onFocus={() => setLastEditedId(activeItem.studentId)}
                    editorRef={(element) => setEditorEl(element as HTMLTextAreaElement | null)}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <MissingEntryAction
                    studentId={activeItem.studentId}
                    studentName={activeItem.displayName}
                    policy={policy}
                    onCommit={(value) => commitDraft(activeItem.studentId, value)}
                  />
                  {activeDraft && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 text-xs"
                      data-testid={`assessment-discard-${activeItem.studentId}`}
                      onClick={() => draft.discardValue(activeItem.studentId)}
                    >
                      Descartar alteração
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Alt+↑/↓ estudante anterior/próximo · Ctrl+Enter manter e ir ao próximo · Esc
                  abandona a edição sem criar alteração
                </p>
              </>
            )}
            {correctingStudentId === activeItem.studentId && renderCorrection && (
              <div className="mt-3">{renderCorrection(activeItem)}</div>
            )}
          </section>
        )}

        {endNotice && (
          <div
            role="status"
            aria-live="polite"
            data-testid="assessment-end-of-roster"
            className="rounded-md border border-border bg-muted/40 p-3"
          >
            <p className="text-sm font-medium">
              Fim da pauta — todos os estudantes da sequência foram percorridos.
            </p>
            {onRequestReview && (
              <Button
                type="button"
                className="mt-2 min-h-11"
                data-testid="assessment-review-from-end"
                onClick={onRequestReview}
              >
                Conferir lançamentos
              </Button>
            )}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
