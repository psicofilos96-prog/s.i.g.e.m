import { useId, useRef, useState, type ReactNode } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formattedTextValue, parseTextParagraphs, type ParagraphAlignment, type TextFormatKind, type TextRun } from "./text-format-model";
export { formattedTextValue, stripTextFormat } from "./text-format-model";

/**
 * Formatação leve dos campos livres do acompanhamento: os marcadores ficam no
 * próprio texto (**negrito**, *itálico*, linhas com "• "), sem mudar o formato
 * gravado no banco. Alinhamento é um marcador de parágrafo compartilhado pela
 * tela e pelo PDF, sem HTML fornecido pelo usuário.
 */
const alignmentClass: Record<ParagraphAlignment, string> = {
  left: "text-left", center: "text-center", right: "text-right", justify: "text-justify",
};
function renderInline(runs: TextRun[], keyPrefix: string): ReactNode[] {
  return runs.map((run, i) => {
    if (run.bold) return <strong key={`${keyPrefix}-${i}`}>{run.text}</strong>;
    if (run.italic) return <em key={`${keyPrefix}-${i}`}>{run.text}</em>;
    return <span key={`${keyPrefix}-${i}`}>{run.text}</span>;
  });
}

/** Renderiza o texto livre com negrito, itálico e listas, sem HTML do usuário. */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const lines = parseTextParagraphs(text);
  const blocks: ReactNode[] = [];
  let bullets: { runs: TextRun[]; alignment: ParagraphAlignment }[] = [];
  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-0.5 pl-5">
        {bullets.map((b, i) => <li key={i} className={alignmentClass[b.alignment]}>{renderInline(b.runs, `${key}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    const first = line.runs[0];
    if (first?.text.startsWith("• ")) {
      bullets.push({ alignment: line.alignment, runs: [{ ...first, text: first.text.slice(2) }, ...line.runs.slice(1)] });
      return;
    }
    flushBullets(`ul-${i}`);
    if (line.runs.some((r) => r.text.trim())) blocks.push(<p key={`p-${i}`} className={alignmentClass[line.alignment]}>{renderInline(line.runs, `p-${i}`)}</p>);
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
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const id = useId();
  const [activeAlignment, setActiveAlignment] = useState<ParagraphAlignment>("left");
  const apply = (kind: TextFormatKind) => {
    const el = ref.current;
    if (!el) return;
    const next = formattedTextValue(el.value, el.selectionStart, el.selectionEnd, kind);
    if (next.value.length > maxLength) return;
    if (kind === "left" || kind === "center" || kind === "right" || kind === "justify") setActiveAlignment(kind);
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
        <span className="flex flex-wrap gap-1" aria-label={`Formatação do campo ${label}`}>
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
          {([
            ["left", "Alinhar à esquerda", AlignLeft], ["center", "Centralizar", AlignCenter],
            ["right", "Alinhar à direita", AlignRight], ["justify", "Justificar", AlignJustify],
          ] as const).map(([kind, title, Icon]) => (
            <Button key={kind} type="button" size="sm" variant={activeAlignment === kind ? "secondary" : "ghost"}
              className="h-7 px-2" title={title} aria-label={`${title} em ${label}`}
              aria-pressed={activeAlignment === kind} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(kind)}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </span>
      </div>
      <textarea id={id} ref={ref} className={className} maxLength={maxLength} required={required}
        placeholder={placeholder} rows={rows} value={value}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onSelect={(e) => {
          const el = e.currentTarget;
          const start = el.selectionStart === 0 ? 0 : el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
          setActiveAlignment(parseTextParagraphs(el.value.slice(start))[0]?.alignment ?? "left");
        }}
        onChange={(e) => onChange(e.target.value)} />
      {value.includes("[align=") && <FormattedText text={value} className="mt-2 space-y-1 border-l-2 border-border pl-3 text-sm" />}
    </div>
  );
}
