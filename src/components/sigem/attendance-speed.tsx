/**
 * SIGEM Human Interface Language — primitivas de alta velocidade da chamada
 * (Rodada 6D.1.2).
 *
 * Regras desta camada:
 *  - São primitivas de APRESENTAÇÃO e INTERAÇÃO. Não conhecem 12H.1, stores,
 *    capacidades, aula geminada, fechamento nem retificação. Recebem projeções
 *    e devolvem callbacks; quem compõe é que fala com o domínio.
 *  - Nenhuma marcação é inventada: as opções admissíveis chegam por `markOptions`.
 *  - Ausência de marcação é ausência: nunca é convertida em valor por inferência.
 *    A operação em lote é ato explícito do professor e reversível (Desfazer).
 *  - Os números do balanço são derivados do rascunho corrente, nunca agregados
 *    persistidos.
 *  - Desfazer pertence à edição do rascunho. Depois da conclusão oficial, a
 *    correção é do resolvedor institucional — não desta camada.
 *
 * Documentação normativa: docs/human-interface-language.md
 */
import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ------------------------------------------------------------------ tipos */

/** Pessoa da lista nominal, já projetada para a interface. */
export type SpeedRosterPerson = {
  /** Identificador interno; nunca é protagonista visual. */
  id: string;
  /** Número de ordem da lista nominal. */
  order: number;
  /** Nome como a pessoa deve ser chamada. */
  name: string;
  /** Identificador institucional exibível, revelado apenas sob demanda. */
  code?: string;
  /** Nota curta de nível 2 (ex.: nome civil), exibida só quando necessária. */
  detail?: string;
};

/** Opção de marcação admissível, declarada por quem compõe. */
export type SpeedMarkOption = {
  /** Valor da marcação no domínio (ex.: "Presente"). */
  value: string;
  /** Rótulo humano completo. */
  label: string;
  /** Rótulo curto do alvo de toque. */
  shortLabel: string;
  /** Tecla de atalho no teclado físico, quando houver. */
  shortcut?: string;
};

/** marks[pessoaId] = marcação explícita; ausência da chave = sem marcação. */
export type SpeedMarks = Record<string, string>;

export type SpeedBalance = {
  /** Contagem por valor de marcação, na ordem de `markOptions`. */
  byMark: readonly { value: string; label: string; count: number }[];
  /** Pessoas sem nenhuma marcação explícita. */
  unmarked: number;
  total: number;
};

type DraftOperation = {
  /** Frase humana da última operação, para o Desfazer. */
  label: string;
  /** Rascunho anterior à operação. */
  previous: SpeedMarks;
};

/* -------------------------------------------------------- rascunho + undo */

/**
 * Estado do rascunho da chamada com histórico de desfazer.
 *
 * `history` guarda os rascunhos anteriores — inclusive de operações em lote —
 * porque reverter uma conveniência da interface nunca pode virar fato
 * institucional.
 */
export function useSpeedDraft(options: {
  people: readonly SpeedRosterPerson[];
  markOptions: readonly SpeedMarkOption[];
  initialMarks?: SpeedMarks | undefined;
  onChange?: ((marks: SpeedMarks) => void) | undefined;
}) {
  const { people, markOptions, initialMarks, onChange } = options;
  const [marks, setMarks] = useState<SpeedMarks>(initialMarks ?? {});
  const [history, setHistory] = useState<readonly DraftOperation[]>([]);

  const commit = useCallback(
    (label: string, next: SpeedMarks) => {
      setHistory((stack) => [...stack, { label, previous: marks }]);
      setMarks(next);
      onChange?.(next);
    },
    [marks, onChange],
  );

  const setMark = useCallback(
    (personId: string, value: string) => {
      const person = people.find((item) => item.id === personId);
      const option = markOptions.find((item) => item.value === value);
      if (!person || !option) return;
      commit(`${person.name} · ${option.label}`, { ...marks, [personId]: value });
    },
    [commit, markOptions, marks, people],
  );

  const clearMark = useCallback(
    (personId: string) => {
      if (!(personId in marks)) return;
      const person = people.find((item) => item.id === personId);
      const next = { ...marks };
      delete next[personId];
      commit(`${person?.name ?? "Marcação"} · sem marcação`, next);
    },
    [commit, marks, people],
  );

  /**
   * Atribui `value` a quem está sem marcação. Ato explícito: nenhuma ausência
   * de marcação se converte em valor sozinha.
   */
  const markUnmarkedAs = useCallback(
    (value: string) => {
      const option = markOptions.find((item) => item.value === value);
      if (!option) return 0;
      const pending = people.filter((person) => !(person.id in marks));
      if (pending.length === 0) return 0;
      const next = { ...marks };
      for (const person of pending) next[person.id] = value;
      commit(
        `${pending.length} ${pending.length === 1 ? "estudante marcado" : "estudantes marcados"} como ${option.label.toLowerCase()}`,
        next,
      );
      return pending.length;
    },
    [commit, markOptions, marks, people],
  );

  const undo = useCallback(() => {
    setHistory((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setMarks(last.previous);
      onChange?.(last.previous);
      return stack.slice(0, -1);
    });
  }, [onChange]);

  const balance = useMemo<SpeedBalance>(() => {
    const byMark = markOptions.map((option) => ({
      value: option.value,
      label: option.label,
      count: people.filter((person) => marks[person.id] === option.value).length,
    }));
    const marked = byMark.reduce((sum, item) => sum + item.count, 0);
    return { byMark, unmarked: people.length - marked, total: people.length };
  }, [markOptions, marks, people]);

  const lastOperation = history[history.length - 1];

  return {
    marks,
    balance,
    setMark,
    clearMark,
    markUnmarkedAs,
    undo,
    canUndo: history.length > 0,
    lastOperationLabel: lastOperation?.label,
  };
}

/* ------------------------------------------------------ busca que preserva */

/**
 * Filtra por nome ou identificador institucional sem tocar nas marcações.
 * Menos de duas letras não filtra: a lista habitual continua inteira.
 */
export function filterSpeedRoster(
  people: readonly SpeedRosterPerson[],
  query: string,
): readonly SpeedRosterPerson[] {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  if (term.length < 2) return people;
  return people.filter(
    (person) =>
      person.name.toLocaleLowerCase("pt-BR").includes(term) ||
      (person.code ?? "").toLocaleLowerCase("pt-BR").includes(term),
  );
}

/** Nomes repetidos na mesma lista: só nesse caso o código é exibido por padrão. */
export function speedHomonymIds(people: readonly SpeedRosterPerson[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    const key = person.name.toLocaleLowerCase("pt-BR");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return people
    .filter((person) => (counts.get(person.name.toLocaleLowerCase("pt-BR")) ?? 0) > 1)
    .map((person) => person.id);
}

/* ----------------------------------------------------------- barra rápida */

export function AttendanceQuickBar({
  balance,
  bulkMark,
  onBulkMark,
  onUndo,
  canUndo,
  lastOperationLabel,
  persistenceNote,
  children,
}: {
  balance: SpeedBalance;
  /** Marcação usada pela ação em lote; sem ela, a ação não existe. */
  bulkMark?: SpeedMarkOption | undefined;
  onBulkMark?: (() => void) | undefined;
  onUndo?: (() => void) | undefined;
  canUndo?: boolean | undefined;
  lastOperationLabel?: string | undefined;
  /** Frase sobre o estado da informação, fornecida por quem compõe. */
  persistenceNote?: string | undefined;
  children?: ReactNode | undefined;
}) {
  const bulkDisabled = balance.unmarked === 0;
  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur"
      data-testid="attendance-quick-bar"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {balance.byMark.map((item) => (
          <span key={item.value} className="tabular-nums">
            <strong className="text-base">{item.count}</strong>{" "}
            <span className="text-muted-foreground">{item.label.toLowerCase()}</span>
          </span>
        ))}
        <span className="tabular-nums">
          <strong className="text-base">{balance.unmarked}</strong>{" "}
          <span className="text-muted-foreground">sem marcação</span>
        </span>
      </div>
      {children}
      {(bulkMark || canUndo) && (
        <div className="flex flex-wrap items-center gap-2">
          {bulkMark && onBulkMark && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={bulkDisabled}
              onClick={onBulkMark}
            >
              Marcar pendentes como {bulkMark.label.toLowerCase()}
            </Button>
          )}
          {canUndo && onUndo && (
            <Button type="button" variant="ghost" className="min-h-11" onClick={onUndo}>
              <RotateCcw /> Desfazer
            </Button>
          )}
          {lastOperationLabel && (
            <span className="text-xs text-muted-foreground" role="status">
              {lastOperationLabel}
            </span>
          )}
        </div>
      )}
      {persistenceNote && <p className="text-xs text-muted-foreground">{persistenceNote}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ busca rápida */

export function AttendanceQuickSearch({
  value,
  onChange,
  onSubmit,
  resultCount,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Enter: quem compõe leva o foco ao primeiro resultado. */
  onSubmit?: (() => void) | undefined;
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
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
            }
          }}
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

/* ------------------------------------------------------------------ linha */

export function AttendanceRow({
  person,
  mark,
  markOptions,
  showCode,
  focused,
  disabled,
  onMark,
  onClear,
  onFocus,
  onKeyDown,
  rowRef,
}: {
  person: SpeedRosterPerson;
  mark?: string | undefined;
  markOptions: readonly SpeedMarkOption[];
  showCode?: boolean | undefined;
  focused?: boolean | undefined;
  disabled?: boolean | undefined;
  onMark?: ((value: string) => void) | undefined;
  onClear?: (() => void) | undefined;
  onFocus?: (() => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined;
  rowRef?: ((element: HTMLDivElement | null) => void) | undefined;
}) {
  return (
    <div
      ref={rowRef}
      role="row"
      tabIndex={focused ? 0 : -1}
      aria-label={`${person.order}. ${person.name}`}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      data-testid={`attendance-row-${person.id}`}
      data-marked={mark ? "sim" : "nao"}
      className={cn(
        "flex min-h-[3.375rem] items-center gap-3 border-b px-3 py-1.5 outline-none",
        mark ? "bg-muted/40" : "bg-background",
        focused && "ring-2 ring-ring ring-offset-0",
      )}
    >
      <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {person.order}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-medium leading-tight">
          {person.name}
        </span>
        {(showCode && person.code) || person.detail ? (
          <span className="block truncate text-xs text-muted-foreground">
            {[showCode ? person.code : undefined, person.detail].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {markOptions.map((option) => {
          const active = mark === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? "default" : "outline"}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`${option.label} · ${person.name}`}
              className="size-11 p-0 text-base font-semibold"
              onClick={() => (active ? onClear?.() : onMark?.(option.value))}
            >
              {option.shortLabel}
            </Button>
          );
        })}
      </span>
    </div>
  );
}

/* ------------------------------------------------- controlador de teclado */

/**
 * Navegação contínua sem Tab: ↑/↓ movem o foco, as teclas declaradas em
 * `markOptions` marcam e avançam, Delete/Backspace limpa e permanece na mesma
 * pessoa (apagar é corretivo — o professor costuma remarcar em seguida).
 */
export function useSpeedKeyboard(options: {
  people: readonly SpeedRosterPerson[];
  markOptions: readonly SpeedMarkOption[];
  onMark: (personId: string, value: string) => void;
  onClear: (personId: string) => void;
}) {
  const { people, markOptions, onMark, onClear } = options;
  const [focusedId, setFocusedId] = useState<string | undefined>(people[0]?.id);
  const refs = useRef(new Map<string, HTMLDivElement | null>());

  const focus = useCallback((personId?: string) => {
    if (!personId) return;
    setFocusedId(personId);
    refs.current.get(personId)?.focus();
  }, []);

  const step = useCallback(
    (personId: string, delta: number) => {
      const index = people.findIndex((person) => person.id === personId);
      const next = people[Math.min(Math.max(index + delta, 0), people.length - 1)];
      focus(next?.id);
    },
    [focus, people],
  );

  const handleKeyDown = useCallback(
    (personId: string) => (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        step(personId, key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        onClear(personId);
        return;
      }
      const option = markOptions.find(
        (item) => item.shortcut && item.shortcut.toLowerCase() === key.toLowerCase(),
      );
      if (option) {
        event.preventDefault();
        onMark(personId, option.value);
        step(personId, 1);
      }
    },
    [markOptions, onClear, onMark, step],
  );

  const registerRow = useCallback(
    (personId: string) => (element: HTMLDivElement | null) => {
      refs.current.set(personId, element);
    },
    [],
  );

  return { focusedId, focus, handleKeyDown, registerRow, setFocusedId };
}
