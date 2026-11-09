export type ParagraphAlignment = "left" | "center" | "right" | "justify";
export type TextFormatKind = "bold" | "italic" | "bullet" | ParagraphAlignment;
export type TextRun = { text: string; bold?: boolean; italic?: boolean };
export type TextParagraph = { alignment: ParagraphAlignment; runs: TextRun[] };
const alignmentMarker = /^\[align=(left|center|right|justify)\] ?/;

export function parseTextParagraphs(text: string): TextParagraph[] {
  return text.split("\n").map((line) => {
    // Report field labels are outside the stored formatting marker.
    const labelled = line.match(/^(.*?: )(?=\[align=)/);
    const prefix = labelled?.[1] ?? "";
    const body = line.slice(prefix.length);
    const marker = body.match(alignmentMarker);
    const alignment: ParagraphAlignment = marker?.[1] === "center" ? "center"
      : marker?.[1] === "right" ? "right" : marker?.[1] === "justify" ? "justify" : "left";
    const content = prefix + body.replace(alignmentMarker, "");
    const runs = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part): TextRun => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return { text: part.slice(2, -2), bold: true };
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return { text: part.slice(1, -1), italic: true };
      return { text: part };
    });
    return { alignment, runs };
  });
}

export function formattedTextValue(
  value: string, selectionStart: number, selectionEnd: number, kind: TextFormatKind,
): { value: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  if (["left", "center", "right", "justify"].includes(kind)) {
    const start = selectionStart === 0 ? 0 : value.lastIndexOf("\n", selectionStart - 1) + 1;
    const last = Math.max(selectionStart, selectionEnd - 1);
    const endAt = value.indexOf("\n", last);
    const end = endAt < 0 ? value.length : endAt;
    const lines = value.slice(start, end).split("\n").map((line) => {
      const clean = line.replace(alignmentMarker, "");
      return kind === "left" ? clean : `[align=${kind}] ${clean}`;
    }).join("\n");
    return { value: value.slice(0, start) + lines + value.slice(end), cursor: start + lines.length };
  }
  if (kind === "bullet") {
    const lineStart = selectionStart === 0 ? 0 : value.lastIndexOf("\n", selectionStart - 1) + 1;
    const marker = value.slice(lineStart).match(alignmentMarker)?.[0] ?? "";
    const at = lineStart + marker.length;
    const already = value.slice(at, at + 2) === "• ";
    const next = already ? value.slice(0, at) + value.slice(at + 2)
      : value.slice(0, at) + "• " + value.slice(at);
    return { value: next, cursor: Math.max(at, selectionStart + (already ? -2 : 2)) };
  }
  const mark = kind === "bold" ? "**" : "*";
  const wrapped = selected || "texto";
  return { value: value.slice(0, selectionStart) + mark + wrapped + mark + value.slice(selectionEnd),
    cursor: selectionStart + mark.length + wrapped.length + mark.length };
}

export function stripTextFormat(text: string): string {
  return parseTextParagraphs(text).map((p) => p.runs.map((r) => r.text).join("")).join("\n");
}