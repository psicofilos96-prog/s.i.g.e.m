/**
 * Campo de data do SIGEM — exibe e aceita DD/MM/AAAA, mas entrega ao código
 * o valor canônico ISO (AAAA-MM-DD) em `event.target.value`, igual a um
 * `<input type="date">`. Assim nenhuma tela converte datas manualmente.
 */
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAcademicDate, maskBrazilianDate, parseAcademicDate } from "@/lib/academic-date";

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue"> & {
  value?: string | undefined;
  defaultValue?: string | undefined;
};

type IsoEvent<E> = E & { target: { value: string }; currentTarget: { value: string } };

function isoEvent<E extends React.SyntheticEvent<HTMLInputElement>>(e: E, iso: string) {
  const target = { ...e.target, value: iso, name: (e.target as HTMLInputElement).name };
  return { ...e, target, currentTarget: target } as unknown as IsoEvent<E>;
}

const display = (v: string | undefined) => (v ? formatAcademicDate(v) : "");

export const DateInput = React.forwardRef<HTMLInputElement, Props>(function DateInput(
  { className, value, defaultValue, onChange, onBlur, min, max, disabled, ...rest },
  ref,
) {
  const [text, setText] = React.useState(() => display(value ?? defaultValue));
  const picker = React.useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;

  React.useEffect(() => {
    if (!controlled) return;
    setText((t) => (parseAcademicDate(t) === value ? t : display(value)));
  }, [controlled, value]);

  const emit = (e: React.ChangeEvent<HTMLInputElement>, iso: string) =>
    onChange?.(isoEvent(e, iso));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const iso = parseAcademicDate(raw);
    if (iso) {
      setText(formatAcademicDate(iso));
      emit(e, iso);
      return;
    }
    const clean = raw.replace(/[^\d/-]/g, "").slice(0, 10);
    setText(clean);
    if (!clean) emit(e, "");
  };

  return (
    <div className="relative flex w-full min-w-0 items-center">
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={rest.placeholder ?? "dd/mm/aaaa"}
        maxLength={10}
        disabled={disabled}
        value={text}
        onChange={handleChange}
        onBlur={(e) => {
          const fixed = /^\d{8}$/.test(text) ? maskBrazilianDate(text) : text;
          const iso = parseAcademicDate(fixed);
          if (fixed !== text) {
            setText(iso ? fixed : text);
            if (iso) onChange?.(isoEvent(e as unknown as React.ChangeEvent<HTMLInputElement>, iso));
          }
          onBlur?.(isoEvent(e, iso ?? ""));
        }}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 pr-9 text-base tabular-nums shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        className="absolute right-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          el.value = parseAcademicDate(text) ?? "";
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        min={min}
        max={max}
        onChange={(e) => {
          const iso = e.target.value;
          setText(display(iso));
          emit(e, iso);
          onBlur?.(isoEvent(e as unknown as React.FocusEvent<HTMLInputElement>, iso));
        }}
      />
    </div>
  );
});
