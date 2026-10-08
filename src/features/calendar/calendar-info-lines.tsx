/**
 * Informações adicionais do calendário: uma linha por item, guardada como texto (compatível com o já salvo).
 * Formato opcional por linha: `@lugar|` define onde aparece; `**texto**` = negrito; `_texto_` = itálico.
 * Linha sem marcação continua abaixo dos Conselhos, como antes. Só aparência; nada conta dia letivo.
 */
export const INFO_PLACES = [
  { code: "antes-periodos", label: "Acima dos períodos" },
  { code: "depois-periodos", label: "Abaixo dos períodos" },
  { code: "depois-total", label: "Abaixo do total de dias letivos" },
  { code: "depois-conselhos", label: "Abaixo dos Conselhos de Classe" },
] as const;
export type InfoPlace = (typeof INFO_PLACES)[number]["code"];
export const DEFAULT_INFO_PLACE: InfoPlace = "depois-conselhos";
export type InfoLine = { text: string; place: InfoPlace; bold: boolean; italic: boolean };

const PLACE_CODES = new Set<string>(INFO_PLACES.map((p) => p.code));

export function parseInfoLine(raw: string): InfoLine {
  let s = raw.trim();
  let place: InfoPlace = DEFAULT_INFO_PLACE;
  const m = /^@([a-z-]+)\|/.exec(s);
  if (m && PLACE_CODES.has(m[1]!)) { place = m[1] as InfoPlace; s = s.slice(m[0].length); }
  let bold = false, italic = false;
  if (s.length > 4 && s.startsWith("**") && s.endsWith("**")) { bold = true; s = s.slice(2, -2); }
  if (s.length > 2 && s.startsWith("_") && s.endsWith("_")) { italic = true; s = s.slice(1, -1); }
  return { text: s, place, bold, italic };
}

export function serializeInfoLine(l: InfoLine): string {
  let s = l.text.trim();
  if (!s) return "";
  if (l.italic) s = `_${s}_`;
  if (l.bold) s = `**${s}**`;
  return l.place === DEFAULT_INFO_PLACE ? s : `@${l.place}|${s}`;
}

/** Linhas de um lugar, na ordem gravada. */
export function InfoLinesAt({ lines, place }: { lines: readonly string[]; place: InfoPlace }) {
  const items = lines.map(parseInfoLine).filter((l) => l.place === place && l.text);
  if (items.length === 0) return null;
  return (
    <div className="cd-informacoes" data-cd-bloco="informacoes" data-info-place={place}>
      {items.map((l, i) => (
        <div key={`${place}-${i}`} className="cd-conselho-linha cd-info-linha">
          <span style={{ gridColumn: "1 / -1", fontWeight: l.bold ? 700 : undefined, fontStyle: l.italic ? "italic" : undefined }}>{l.text}</span>
        </div>
      ))}
    </div>
  );
}
