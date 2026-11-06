import { useId, useRef, type ReactNode } from "react";
import { Bold, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Formatação leve dos campos livres do acompanhamento: os marcadores ficam no
 * próprio texto (**negrito**, *itálico*, linhas com "• "), sem mudar o formato
 * gravado no banco. A tela renderiza a formatação; as exportações removem os
 * marcadores para o documento sair limpo.
 */
export type TextFormatKind = "bold" | "italic" | "bullet";

export function formattedTextValue(
  value: string, selectionStart: number, selectionEnd: number, kind: TextFormatKind,
): { value: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  if (kind === "bullet") {
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const already = value.slice(lineStart, lineStart + 2) === "• ";
    const next = already
      ? value.slice(0, lineStart) + value.slice(lineStart + 2)
      : value.slice(0, lineStart) + "• " + value.slice(lineStart);
    return { value: next, cursor: selectionStart + (already ? -2 : 2) };
  }
  const mark = kind === "bold" ? "**" : "*";
  const wrapped = selected || "texto";
  const next = value.slice(0, selectionStart) + mark + wrapped + mark + value.slice(selectionEnd);
  return { value: next, cursor: selectionStart + mark.length + wrapped.length + mark.length };
}

/** Remove os marcadores de ênfase para CSV/XLSX/PDF; as listas com "• " permanecem legíveis. */
export function stripTextFormat(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

/** Renderiza o texto livre com negrito, itálico e listas, sem HTML do usuário. */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-0.5 pl-5">
        {bullets.map((b, i) => <li key={i}>{renderInline(b, `${key}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith("• ")) {
      bullets.push(line.slice(2));
      return;
    }
    flushBullets(`ul-${i}`);
    if (line.trim()) blocks.push(<p key={`p-${i}`}>{renderInline(line, `p-${i}`)}</p>);
  });
  flushBullets("ul-end");
  return <div className={className ?? "space-y-1"}>{blocks}</div>;
}

/** Campo de texto com barra de formatação (negrito, itálico, lista). */
export function FollowupTextArea({
  label, value, onChange, className, maxLength, required, placeholder, rows, invalid, describedBy,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  className: string;
  maxLength: number;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const id = useId();
  const apply = (kind: TextFormatKind) => {
    const el = ref.current;
    if (!el) return;
    const next = formattedTextValue(el.value, el.selectionStart, el.selectionEnd, kind);
    onChange(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  };
  return (
    <div className="block text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id}>{label}</label>
        <span className="flex gap-1" aria-label={`Formatação do campo ${label}`}>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" title="Negrito"
            aria-label={`Negrito em ${label}`} onClick={() => apply("bold")}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" title="Itálico"
            aria-label={`Itálico em ${label}`} onClick={() => apply("italic")}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" title="Lista de itens"
            aria-label={`Lista de itens em ${label}`} onClick={() => apply("bullet")}>
            <List className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      <textarea id={id} ref={ref} className={className} maxLength={maxLength} required={required}
        placeholder={placeholder} rows={rows} value={value}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
